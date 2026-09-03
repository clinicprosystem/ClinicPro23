const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Clinic = require('../models/Clinic');

const authMiddleware = async (req, res, next) => {
    try {
        const token = req.header('Authorization')?.replace('Bearer ', '');

        if (!token) {
            return res.status(401).json({
                success: false,
                code: 'AUTH_REQUIRED',
                error: 'الرجاء تسجيل الدخول أولاً'
            });
        }

        const decoded = jwt.verify(
            token,
            process.env.JWT_SECRET
        );

        const user = await User.findById(decoded.userId);

        if (!user || !user.isActive) {
            return res.status(401).json({
                success: false,
                code: 'INVALID_ACCOUNT',
                error: 'حساب غير صالح'
            });
        }

        // ==========================================
        // بيانات المستخدم
        // ==========================================

        req.userId = user._id;
        req.userRole = user.role;
        req.clinicId = user.clinicId;
        req.userData = user;

        // ==========================================
        // Master Admin
        // ==========================================

        if (user.isMasterAdmin) {
            req.isMasterAdmin = true;
            return next();
        }

        // ==========================================
        // المستخدم التابع لعيادة
        // ==========================================

        if (user.clinicId) {

            const clinic =
                await Clinic.findById(user.clinicId);

            if (!clinic) {
                return res.status(403).json({
                    success: false,
                    code: 'CLINIC_NOT_FOUND',
                    error: 'عيادة غير موجودة'
                });
            }

            const now = new Date();

            const subscriptionType =
                clinic.subscriptionType || 'trial';

            let subscriptionStatus =
                clinic.subscriptionStatus || 'trial';

            let isSubscriptionActive = false;

            // ==========================================
            // طالب جامعي
            // ==========================================

            if (
                subscriptionType ===
                'university_student'
            ) {
                subscriptionStatus = 'active';
                isSubscriptionActive = true;
            }

            // ==========================================
            // Trial
            // ==========================================

            else if (
                subscriptionStatus === 'trial' &&
                clinic.trialEndDate &&
                now < new Date(clinic.trialEndDate)
            ) {
                isSubscriptionActive = true;
            }

            // ==========================================
            // اشتراك مدفوع
            // ==========================================

            else if (
                subscriptionStatus === 'active' &&
                clinic.subscriptionEndDate &&
                now < new Date(
                    clinic.subscriptionEndDate
                )
            ) {
                isSubscriptionActive = true;
            }

            // ==========================================
            // منتهي
            // ==========================================

            else {

                isSubscriptionActive = false;

                if (
                    subscriptionStatus === 'trial' ||
                    subscriptionStatus === 'active'
                ) {
                    subscriptionStatus = 'expired';
                }
            }

            // ==========================================
            // تجميد الحساب
            // ==========================================

            if (clinic.isFrozen) {
                subscriptionStatus = 'frozen';
                isSubscriptionActive = false;
            }

            // ==========================================
            // البيانات التي تحتاجها باقي الـ Routes
            // ==========================================

            req.clinicData = clinic;

            req.subscriptionType =
                subscriptionType;

            req.subscriptionStatus =
                subscriptionStatus;

            req.isSubscriptionActive =
                isSubscriptionActive;
        }

        // ==========================================
        // لا نمنع الدخول بسبب انتهاء الاشتراك
        // ==========================================

        next();

    } catch (error) {

        console.error(
            'Auth error:',
            error
        );

        return res.status(401).json({
            success: false,
            code: 'INVALID_TOKEN',
            error: 'توكن غير صالح أو منتهي'
        });
    }
};


// ==========================================
// صاحب العيادة
// ==========================================

const clinicOwnerOnly = (req, res, next) => {

    if (
        req.userRole === 'clinic_owner' ||
        req.userRole === 'university_student'
    ) {
        return next();
    }

    return res.status(403).json({
        success: false,
        code: 'OWNER_ONLY',
        error:
            'غير مصرح لك. هذا الإجراء مخصص لأصحاب العيادات فقط'
    });
};


// ==========================================
// السكرتير أو صاحب العيادة أو الطبيب
// ==========================================

const secretaryOrOwner = (req, res, next) => {

    if (
        [
            'clinic_owner',
            'secretary',
            'university_student',
            'doctor'
        ].includes(req.userRole)
    ) {
        return next();
    }

    return res.status(403).json({
        success: false,
        code: 'ROLE_NOT_ALLOWED',
        error: 'غير مصرح لك'
    });
};


module.exports = {
    authMiddleware,
    clinicOwnerOnly,
    secretaryOrOwner
};
