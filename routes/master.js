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

// ✅ دالة لتحديث اشتراك جميع المستخدمين التابعين للعيادة
async function updateAllUsersSubscription(clinicId, subscriptionType, subscriptionStatus) {
    try {
        const result = await User.updateMany(
            { 
                clinicId: clinicId, 
                role: { $in: ['secretary', 'doctor'] } 
            },
            { 
                $set: { 
                    subscriptionType: subscriptionType,
                    subscriptionStatus: subscriptionStatus
                } 
            }
        );
        console.log(`✅ تم تحديث ${result.modifiedCount} مستخدم تابع للعيادة ${clinicId}`);
        return result;
    } catch (error) {
        console.error('❌ خطأ في تحديث المستخدمين التابعين:', error);
        return null;
    }
}

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
                totalIncome: totalIncome[0]?.total || 0,
                subscriptionType: clinic.subscriptionType || 'trial',  // ✅ أضف هذا
                subscriptionStatus: clinic.subscriptionStatus,          // ✅ أضف هذا
                subscriptionEndDate: clinic.subscriptionEndDate        // ✅ أضف هذا
            };
        }));
        
        res.json({ success: true, clinics: clinicsWithStats });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});
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
        clinic.subscriptionStatus = 'active';
        clinic.isActive = true;
        clinic.isFrozen = false;
        await clinic.save();
        
        // ✅ تحديث جميع السكرتيرات والأطباء التابعين
        await updateAllUsersSubscription(clinic._id, type, 'active');
        
        // ✅ تغيير role صاحب العيادة (إذا كان طالب جامعي)
        const clinicOwner = await User.findOne({ 
            clinicId: clinic._id, 
            role: 'university_student'
        });
        
        if (clinicOwner) {
            clinicOwner.role = 'clinic_owner';
            await clinicOwner.save();
            console.log(`✅ تم تغيير دور صاحب العيادة من university_student إلى clinic_owner`);
        }
        
        res.json({ 
            success: true, 
            message: `تم التجديد حتى ${newEndDate.toLocaleDateString('ar-EG')}`,
            newEndDate 
        });
    } catch (error) {
        console.error('❌ خطأ في التجديد:', error);
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
router.post('/clinic/:id/university-plan', async (req, res) => {
    try {
        const clinic = await Clinic.findById(req.params.id);
        
        if (!clinic) {
            return res.status(404).json({ error: 'عيادة غير موجودة' });
        }
        
        // ✅ 1. تحديث العيادة
        clinic.subscriptionType = 'university_student';
        clinic.subscriptionStatus = 'active';
        
        const newEndDate = new Date();
        newEndDate.setDate(newEndDate.getDate() + 30);
        clinic.subscriptionEndDate = newEndDate;
        clinic.isActive = true;
        clinic.isFrozen = false;
        
        await clinic.save();
        
        // ✅ 2. تحديث جميع السكرتيرات والأطباء التابعين
        await updateAllUsersSubscription(clinic._id, 'university_student', 'active');
        
        // ✅ 3. تحديث دور صاحب العيادة
        const clinicOwner = await User.findOne({ 
            clinicId: clinic._id, 
            role: 'clinic_owner' 
        });
        
        if (clinicOwner) {
            clinicOwner.role = 'university_student';
            await clinicOwner.save();
            console.log(`✅ تم تحديث دور صاحب العيادة من clinic_owner إلى university_student`);
        }
        
        console.log(`✅ تم تفعيل باقة طالب جامعي للعيادة: ${clinic.name}`);
        
        res.json({ 
            success: true, 
            message: 'تم تفعيل باقة طالب جامعي بنجاح',
            clinic: {
                id: clinic._id,
                name: clinic.name,
                subscriptionType: clinic.subscriptionType,
                subscriptionEndDate: clinic.subscriptionEndDate
            }
        });
    } catch (error) {
        console.error('❌ خطأ في تفعيل باقة طالب جامعي:', error);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
