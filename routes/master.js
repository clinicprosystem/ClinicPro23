const express = require('express');
const User = require('../models/User');
const Clinic = require('../models/Clinic');
const Treatment = require('../models/Treatment');
const Patient = require('../models/Patient');
const LabOrder = require('../models/LabOrder');
const { authMiddleware } = require('../middleware/auth');
const { masterAuth } = require('../middleware/masterAuth');
const router = express.Router();

// كل المسارات تحتاج مصادقة + صلاحيات المالك الأساسي
router.use(authMiddleware);
router.use(masterAuth);

// 1. جلب جميع العيادات
router.get('/clinics', async (req, res) => {
    try {
        const clinics = await Clinic.find().sort({ createdAt: -1 });
        
        const clinicsWithStats = await Promise.all(clinics.map(async (clinic) => {
            const patientsCount = await Patient.countDocuments({ clinicId: clinic._id });
            const treatmentsCount = await Treatment.countDocuments({ clinicId: clinic._id });
            const totalIncome = await Treatment.aggregate([
                { $match: { clinicId: clinic._id } },
                { $group: { _id: null, total: { $sum: '$finalPrice' } } }
            ]);
            
            return {
                ...clinic.toObject(),
                patientsCount,
                treatmentsCount,
                totalIncome: totalIncome[0]?.total || 0
            };
        }));
        
        res.json({ success: true, clinics: clinicsWithStats });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 2. تجديد اشتراك عيادة
router.post('/clinic/:id/renew', async (req, res) => {
    try {
        const { type } = req.body; // 'monthly' or 'yearly'
        const clinic = await Clinic.findById(req.params.id);
        
        if (!clinic) {
            return res.status(404).json({ error: 'عيادة غير موجودة' });
        }
        
        const days = type === 'yearly' ? 365 : 30;
        const newEndDate = new Date();
        newEndDate.setDate(newEndDate.getDate() + days);
        
        clinic.subscriptionEndDate = newEndDate;
        clinic.subscriptionType = type;
        clinic.isActive = true;
        clinic.isFrozen = false;
        await clinic.save();
        
        res.json({ 
            success: true, 
            message: `تم التجديد حتى ${newEndDate.toLocaleDateString('ar-EG')}`,
            newEndDate 
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 3. إيقاف حساب (تجميد)
router.post('/clinic/:id/freeze', async (req, res) => {
    try {
        await Clinic.findByIdAndUpdate(req.params.id, { isFrozen: true, isActive: false });
        res.json({ success: true, message: 'تم إيقاف الحساب مؤقتاً' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 4. تنشيط حساب
router.post('/clinic/:id/activate', async (req, res) => {
    try {
        await Clinic.findByIdAndUpdate(req.params.id, { isFrozen: false, isActive: true });
        res.json({ success: true, message: 'تم تنشيط الحساب' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 5. حذف عيادة وكل بياناتها
router.delete('/clinic/:id', async (req, res) => {
    try {
        const clinicId = req.params.id;
        
        // حذف جميع البيانات المرتبطة
        await Patient.deleteMany({ clinicId });
        await Treatment.deleteMany({ clinicId });
        await LabOrder.deleteMany({ clinicId });
        await User.deleteMany({ clinicId });
        await Clinic.findByIdAndDelete(clinicId);
        
        res.json({ success: true, message: 'تم حذف العيادة وجميع بياناتها' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 6. إحصائيات عامة
router.get('/stats', async (req, res) => {
    try {
        const totalClinics = await Clinic.countDocuments();
        const activeClinics = await Clinic.countDocuments({ isActive: true, isFrozen: false });
        const trialClinics = await Clinic.countDocuments({ 
            trialEndDate: { $gt: new Date() } 
        });
        const expiredClinics = await Clinic.countDocuments({
            subscriptionEndDate: { $lt: new Date() },
            isActive: true
        });
        
        res.json({
            success: true,
            stats: {
                totalClinics,
                activeClinics,
                trialClinics,
                expiredClinics
            }
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
