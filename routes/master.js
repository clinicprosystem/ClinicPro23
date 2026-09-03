const express = require('express');
const User = require('../models/User');
const Clinic = require('../models/Clinic');
const Treatment = require('../models/Treatment');
const Patient = require('../models/Patient');
const LabOrder = require('../models/LabOrder');
const { authMiddleware } = require('../middleware/auth');
const { masterAuth } = require('../middleware/masterAuth');
const router = express.Router();

// ✅ دالة لتحديث حالة الاشتراك تلقائياً
async function updateSubscriptionStatus(clinicId) {
    const clinic = await Clinic.findById(clinicId);

    if (!clinic) return null;

    // الطالب الجامعي اشتراكه فعال بدون تاريخ انتهاء
    if (clinic.subscriptionType === 'university_student') {
        if (
            clinic.subscriptionStatus !== 'active' ||
            clinic.subscriptionEndDate !== null
        ) {
            clinic.subscriptionStatus = 'active';
            clinic.subscriptionEndDate = null;
            clinic.isActive = true;
            clinic.isFrozen = false;

            await clinic.save();

            await updateAllUsersSubscription(
                clinicId,
                'university_student',
                'active'
            );
        }

        return clinic;
    }

    const now = new Date();
    let newStatus = clinic.subscriptionStatus;

    // انتهاء التجربة
    if (
        clinic.subscriptionStatus === 'trial' &&
        clinic.trialEndDate &&
        now >= new Date(clinic.trialEndDate)
    ) {
        newStatus = 'expired';

        console.log(
            `⚠️ انتهت الفترة التجريبية للعيادة: ${clinic.name}`
        );
    }

    // انتهاء الاشتراك المدفوع
    if (
        clinic.subscriptionStatus === 'active' &&
        clinic.subscriptionEndDate &&
        now >= new Date(clinic.subscriptionEndDate)
    ) {
        newStatus = 'expired';

        console.log(
            `⚠️ انتهى الاشتراك للعيادة: ${clinic.name}`
        );
    }

    if (newStatus !== clinic.subscriptionStatus) {
        clinic.subscriptionStatus = newStatus;

        await clinic.save();

        await updateAllUsersSubscription(
            clinicId,
            clinic.subscriptionType,
            newStatus
        );
    }

    return clinic;
}

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

// كل المسارات تحتاج مصادقة + صلاحيات المالك الأساسي
router.use(authMiddleware);
router.use(masterAuth);



// 1. جلب جميع العيادات
router.get('/clinics', async (req, res) => {
    try {
        console.log(
            '📋 Master Admin طلب قائمة العيادات'
        );

        console.log(
            '👤 userId:',
            req.userId
        );

        const clinics =
            await Clinic.find()
                .sort({ createdAt: -1 });

        console.log(
            `🏥 عدد العيادات: ${clinics.length}`
        );
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
        await User.updateMany(
    { clinicId: clinic._id },
    {
        $set: {
            subscriptionType: type,
            subscriptionStatus: 'active'
        }
    }
);
        
        // ✅ تحديث جميع السكرتيرات والأطباء التابعين
        await updateAllUsersSubscription(clinic._id, type, 'active');
        
        
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
        const now = new Date();

const expiredClinics = await Clinic.countDocuments({
    $or: [
        {
            subscriptionStatus: 'expired'
        },
        {
            subscriptionStatus: 'trial',
            trialEndDate: { $lte: now }
        },
        {
            subscriptionStatus: 'active',
            subscriptionEndDate: { $lte: now }
        }
    ],
    subscriptionType: {
        $ne: 'university_student'
    }
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
            return res.status(404).json({
                success: false,
                error: 'عيادة غير موجودة'
            });
        }

        // ==========================================
        // تفعيل باقة الطالب الجامعي
        // ==========================================

        clinic.subscriptionType = 'university_student';
        clinic.subscriptionStatus = 'active';

        // لا يوجد تاريخ انتهاء للطالب الجامعي
        clinic.subscriptionEndDate = null;
        clinic.trialEndDate = null;

        clinic.isActive = true;
        clinic.isFrozen = false;

        await clinic.save();

        // تحديث مستخدمي العيادة
        await updateAllUsersSubscription(
            clinic._id,
            'university_student',
            'active'
        );

        // صاحب العيادة يبقى clinic_owner
        const clinicOwner = await User.findOne({
            clinicId: clinic._id,
            role: 'clinic_owner'
        });

        if (clinicOwner) {
            clinicOwner.subscriptionType =
                'university_student';

            clinicOwner.subscriptionStatus =
                'active';

            await clinicOwner.save();
        }

        console.log(
            `✅ تم تفعيل باقة طالب جامعي للعيادة: ${clinic.name}`
        );

        res.json({
            success: true,

            message:
                'تم تفعيل باقة طالب جامعي بنجاح',

            clinic: {
                id: clinic._id,
                name: clinic.name,
                subscriptionType:
                    clinic.subscriptionType,

                subscriptionStatus:
                    clinic.subscriptionStatus,

                subscriptionEndDate:
                    null
            }
        });

    } catch (error) {
        console.error(
            '❌ خطأ في تفعيل باقة طالب جامعي:',
            error
        );

        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

module.exports = router;
