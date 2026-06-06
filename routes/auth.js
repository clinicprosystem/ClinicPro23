const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Clinic = require('../models/Clinic');
const router = express.Router();

// تسجيل عيادة جديدة (تسجيل صاحب العيادة)
router.post('/register', async (req, res) => {
    try {
        const { clinicName, ownerName, phone, password } = req.body;
        
        // التحقق إذا كان الرقم مستخدماً
        const existingUser = await User.findOne({ phone });
        if (existingUser) {
            return res.status(400).json({ error: 'هذا الرقم مسجل بالفعل' });
        }
        
        // إنشاء حساب المستخدم
        const hashedPassword = await bcrypt.hash(password, 10);
        const user = new User({
            name: ownerName,
            phone,
            password: hashedPassword,
            role: 'clinic_owner',
            subscriptionType: 'trial',  // ✅ إضافة نوع الاشتراك
        });
        await user.save();
        
        // إنشاء العيادة مع فترة تجريبية 7 أيام
        const trialEnd = new Date();
        trialEnd.setDate(trialEnd.getDate() + 7);
        
        const clinic = new Clinic({
            name: clinicName,
            phone,
            ownerName,
            trialEndDate: trialEnd,
            subscriptionType: 'trial',      // ✅ نوع الاشتراك
            subscriptionStatus: 'trial',    // ✅ حالة الاشتراك
        });
        await clinic.save();
        
        // ربط المستخدم بالعيادة
        user.clinicId = clinic._id;
        await user.save();
        
        // ❌ تم إزالة إضافة الخدمات الافتراضية
        
        // إنشاء توكن
        const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: '30d' });
        
        res.status(201).json({
            success: true,
            token,
            user: {
                id: user._id,
                name: user.name,
                phone: user.phone,
                role: user.role,
                clinicId: clinic._id,
                subscriptionType: 'trial',
                trialEndDate: clinic.trialEndDate
            }
        });
        
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'خطأ في التسجيل' });
    }
});
// تسجيل الدخول
router.post('/login', async (req, res) => {
    try {
        const { phone, password } = req.body;
        
        const user = await User.findOne({ phone });
        if (!user) {
            return res.status(401).json({ error: 'رقم الجوال أو كلمة السر غير صحيحة' });
        }
        
        const isValid = await bcrypt.compare(password, user.password);
        if (!isValid) {
            return res.status(401).json({ error: 'رقم الجوال أو كلمة السر غير صحيحة' });
        }
        
        // ✅ جلب معلومات العيادة والاشتراك
        let clinic = null;
        let subscriptionType = 'trial';
        let subscriptionStatus = 'trial';
        let canAddData = true;
        let endDate = null;
        let daysLeft = 0;
        
        if (user.clinicId) {
            clinic = await Clinic.findById(user.clinicId);
            
            if (clinic) {
                const now = new Date();
                
                // ✅ استخدام اشتراك المستخدم إذا كان موجوداً، وإلا استخدم اشتراك العيادة
                subscriptionType = user.subscriptionType || clinic.subscriptionType || 'trial';
                subscriptionStatus = user.subscriptionStatus || clinic.subscriptionStatus || 'trial';
                
                // ✅ تحديد صلاحية الإضافة
                canAddData = false;
                
                if (clinic.subscriptionStatus === 'trial' && clinic.trialEndDate && now < clinic.trialEndDate) {
                    canAddData = true;
                    endDate = clinic.trialEndDate;
                    daysLeft = Math.ceil((clinic.trialEndDate - now) / (1000 * 60 * 60 * 24));
                } else if (clinic.subscriptionStatus === 'active' && clinic.subscriptionEndDate && now < clinic.subscriptionEndDate) {
                    canAddData = true;
                    endDate = clinic.subscriptionEndDate;
                    daysLeft = Math.ceil((clinic.subscriptionEndDate - now) / (1000 * 60 * 60 * 24));
                } else if (clinic.subscriptionType === 'university_student') {
                    canAddData = true;
                }
                
                // ✅ التحقق من تجميد الحساب
                if (clinic.isFrozen) {
                    return res.status(403).json({ error: 'حساب العيادة موقوف مؤقتاً، راجع المسؤول' });
                }
            }
        }
        
        const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: '30d' });
        
        // ✅ إرسال الرد مع subscriptionType مباشرة في user object
        res.json({
            success: true,
            token,
            user: {
                id: user._id,
                name: user.name,
                phone: user.phone,
                role: user.role,
                clinicId: user.clinicId,
                isMasterAdmin: user.isMasterAdmin || false,
                subscriptionType: subscriptionType,      // ✅ أضف هذا
                subscriptionStatus: subscriptionStatus,  // ✅ أضف هذا
                canAddData: canAddData,                  // ✅ أضف هذا
                daysLeft: daysLeft,                      // ✅ أضف هذا
                subscription: {                          // ✅ احتفظ به للتوافق
                    type: subscriptionType,
                    status: subscriptionStatus,
                    canAddData: canAddData,
                    endDate: endDate,
                    daysLeft: daysLeft
                }
            }
        });
        
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'خطأ في تسجيل الدخول' });
    }
});
// إنشاء حساب المالك الأساسي (مرة واحدة فقط)
router.post('/create-master', async (req, res) => {
    try {
        const existing = await User.findOne({ isMasterAdmin: true });
        if (existing) {
            return res.status(400).json({ error: 'المالك الأساسي موجود بالفعل' });
        }
        
        const hashedPassword = await bcrypt.hash(process.env.MASTER_PASSWORD, 10);
        const master = new User({
            name: 'المالك الأساسي',
            phone: process.env.MASTER_PHONE,
            password: hashedPassword,
            role: 'master_admin',
            isMasterAdmin: true
        });
        await master.save();
        
        res.json({ success: true, message: 'تم إنشاء حساب المالك الأساسي' });
        
    } catch (error) {
        res.status(500).json({ error: 'خطأ في إنشاء المالك الأساسي' });
    }
});

module.exports = router;
