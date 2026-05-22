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
            role: 'clinic_owner'
        });
        await user.save();
        
        // إنشاء العيادة
        const trialEnd = new Date();
        trialEnd.setDate(trialEnd.getDate() + 7);
        
        const clinic = new Clinic({
            name: clinicName,
            phone,
            ownerName,
            trialEndDate: trialEnd
        });
        await clinic.save();
        
        // ربط المستخدم بالعيادة
        user.clinicId = clinic._id;
        await user.save();
        
        // إضافة خدمات افتراضية للعيادة
        clinic.services = [
            { name: 'حشو', price: 100, category: 'teeth' },
            { name: 'خلع', price: 80, category: 'teeth' },
            { name: 'علاج عصب', price: 300, category: 'teeth' },
            { name: 'تقويم', price: 3000, category: 'arch' },
            { name: 'تبييض', price: 500, category: 'arch' }
        ];
        await clinic.save();
        
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
        
        // التحقق من صلاحية العيادة
        let clinic = null;
        if (user.clinicId) {
            clinic = await Clinic.findById(user.clinicId);
            if (clinic && clinic.isFrozen) {
                return res.status(403).json({ error: 'حساب العيادة موقوف مؤقتاً، راجع المسؤول' });
            }
        }
        
        const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: '30d' });
        
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
                trialEndDate: clinic?.trialEndDate,
                subscriptionEndDate: clinic?.subscriptionEndDate
            }
        });
        
    } catch (error) {
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
