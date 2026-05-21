const express = require('express');
const bcrypt = require('bcrypt');
const User = require('../models/User');
const Clinic = require('../models/Clinic');
const { authMiddleware, clinicOwnerOnly } = require('../middleware/auth');
const router = express.Router();

router.use(authMiddleware);
router.use(clinicOwnerOnly);

// إضافة طبيب
router.post('/add-doctor', async (req, res) => {
    try {
        const { name, percentage } = req.body;
        
        const clinic = await Clinic.findById(req.clinicId);
        if (!clinic) {
            return res.status(404).json({ error: 'عيادة غير موجودة' });
        }
        
        // إنشاء حساب مستخدم للطبيب
        const tempPassword = Math.random().toString(36).slice(-8);
        const hashedPassword = await bcrypt.hash(tempPassword, 10);
        
        const doctorUser = new User({
            name,
            phone: `temp_${Date.now()}`, // سيتم تحديثه لاحقاً
            password: hashedPassword,
            role: 'doctor',
            clinicId: req.clinicId
        });
        await doctorUser.save();
        
        clinic.doctors.push({
            doctorId: doctorUser._id,
            name,
            percentage,
            isActive: true
        });
        await clinic.save();
        
        res.json({
            success: true,
            doctor: { id: doctorUser._id, name, percentage },
            tempPassword
        });
        
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// إضافة سكرتير
router.post('/add-secretary', async (req, res) => {
    try {
        const { name, phone, password } = req.body;
        
        const existingUser = await User.findOne({ phone });
        if (existingUser) {
            return res.status(400).json({ error: 'هذا الرقم مستخدم بالفعل' });
        }
        
        const hashedPassword = await bcrypt.hash(password, 10);
        
        const secretary = new User({
            name,
            phone,
            password: hashedPassword,
            role: 'secretary',
            clinicId: req.clinicId
        });
        await secretary.save();
        
        const clinic = await Clinic.findById(req.clinicId);
        clinic.secretaries.push({
            name,
            phone,
            isActive: true
        });
        await clinic.save();
        
        res.json({ success: true, secretary: { id: secretary._id, name, phone } });
        
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// إضافة خدمة جديدة
router.post('/add-service', async (req, res) => {
    try {
        const { name, price, category } = req.body;
        
        const clinic = await Clinic.findById(req.clinicId);
        clinic.services.push({ name, price, category });
        await clinic.save();
        
        res.json({ success: true, service: { name, price, category } });
        
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// جلب بيانات العيادة كاملة
router.get('/my-clinic', async (req, res) => {
    try {
        const clinic = await Clinic.findById(req.clinicId);
        const users = await User.find({ clinicId: req.clinicId });
        
        res.json({
            success: true,
            clinic,
            users: users.map(u => ({
                id: u._id,
                name: u.name,
                phone: u.phone,
                role: u.role,
                isActive: u.isActive
            }))
        });
        
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// التحقق من صلاحية الاشتراك
router.get('/subscription-status', async (req, res) => {
    try {
        const clinic = await Clinic.findById(req.clinicId);
        const now = new Date();
        
        let status = 'active';
        let daysLeft = 0;
        let message = '';
        
        if (clinic.isFrozen) {
            status = 'frozen';
            message = 'الحساب موقوف مؤقتاً، راجع المسؤول';
        } else if (clinic.trialEndDate && now < clinic.trialEndDate) {
            status = 'trial';
            daysLeft = Math.ceil((clinic.trialEndDate - now) / (1000 * 60 * 60 * 24));
            message = `فترة تجريبية، متبقي ${daysLeft} يوم`;
        } else if (clinic.subscriptionEndDate && now < clinic.subscriptionEndDate) {
            status = 'subscribed';
            daysLeft = Math.ceil((clinic.subscriptionEndDate - now) / (1000 * 60 * 60 * 24));
            message = `اشتراك فعال، متبقي ${daysLeft} يوم`;
        } else {
            status = 'expired';
            message = 'انتهت صلاحية الاشتراك، يرجى التجديد';
        }
        
        res.json({
            success: true,
            status,
            daysLeft,
            message,
            trialEndDate: clinic.trialEndDate,
            subscriptionEndDate: clinic.subscriptionEndDate
        });
        
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
