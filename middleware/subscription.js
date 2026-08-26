const Clinic = require('../models/Clinic');

const requireActiveSubscription = async (req, res, next) => {
    try {
        const clinicId = req.clinicId;

        if (!clinicId) {
            return res.status(403).json({
                success: false,
                code: 'CLINIC_NOT_FOUND',
                error: 'لم يتم العثور على العيادة'
            });
        }

        const clinic = await Clinic.findById(clinicId);

        if (!clinic) {
            return res.status(403).json({
                success: false,
                code: 'CLINIC_NOT_FOUND',
                error: 'العيادة غير موجودة'
            });
        }

        // الحساب المجمد
        if (clinic.isFrozen) {
            return res.status(403).json({
                success: false,
                code: 'SUBSCRIPTION_FROZEN',
                error: 'الحساب موقوف مؤقتاً'
            });
        }

        const now = new Date();

        // طالب جامعي
        if (clinic.subscriptionType === 'university_student') {
            req.clinicData = clinic;
            req.subscriptionType = 'university_student';
            req.subscriptionStatus = 'active';

            return next();
        }

        // فترة تجريبية
        if (
            clinic.subscriptionStatus === 'trial' &&
            clinic.trialEndDate &&
            now < new Date(clinic.trialEndDate)
        ) {
            req.clinicData = clinic;
            req.subscriptionType = clinic.subscriptionType;
            req.subscriptionStatus = 'trial';

            return next();
        }

        // اشتراك مدفوع
        if (
            clinic.subscriptionStatus === 'active' &&
            clinic.subscriptionEndDate &&
            now < new Date(clinic.subscriptionEndDate)
        ) {
            req.clinicData = clinic;
            req.subscriptionType = clinic.subscriptionType;
            req.subscriptionStatus = 'active';

            return next();
        }

        // الاشتراك منتهي
        return res.status(403).json({
            success: false,
            code: 'SUBSCRIPTION_EXPIRED',
            error: 'انتهت صلاحية الاشتراك. يرجى تجديد الاشتراك.'
        });

    } catch (error) {
        console.error('Subscription middleware error:', error);

        return res.status(500).json({
            success: false,
            code: 'SUBSCRIPTION_CHECK_ERROR',
            error: 'تعذر التحقق من حالة الاشتراك'
        });
    }
};

module.exports = {
    requireActiveSubscription
};
