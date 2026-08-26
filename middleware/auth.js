const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Clinic = require('../models/Clinic');  // ✅ أضف هذا

const authMiddleware = async (req, res, next) => {
    try {
        const token = req.header('Authorization')?.replace('Bearer ', '');

        if (!token) {
            return res.status(401).json({
                error: 'الرجاء تسجيل الدخول أولاً'
            });
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        const user = await User.findById(decoded.userId);

        if (!user || !user.isActive) {
            return res.status(401).json({
                error: 'حساب غير صالح'
            });
        }

        // ==============================
        // بيانات المستخدم
        // ==============================
        req.userId = user._id;
        req.userRole = user.role;
        req.clinicId = user.clinicId;

        // ==============================
        // جلب بيانات العيادة
        // ==============================
        if (user.clinicId) {
            const clinic = await Clinic.findById(user.clinicId);

            if (!clinic) {
                return res.status(403).json({
                    error: 'عيادة غير موجودة'
                });
            }

            // تحديث الاشتراك بشكل ديناميكي
            const now = new Date();

            let subscriptionStatus =
                clinic.subscriptionStatus || 'trial';

            const subscriptionType =
                clinic.subscriptionType || 'trial';

            let isSubscriptionActive = false;

            // ==============================
            // الطالب الجامعي
            // ==============================
            if (subscriptionType === 'university_student') {
                isSubscriptionActive = true;
                subscriptionStatus = 'active';
            }

            // ==============================
            // الفترة التجريبية
            // ==============================
            else if (
                subscriptionStatus === 'trial' &&
                clinic.trialEndDate &&
                now < new Date(clinic.trialEndDate)
            ) {
                isSubscriptionActive = true;
            }

            // ==============================
            // الاشتراك المدفوع
            // ==============================
            else if (
                subscriptionStatus === 'active' &&
                clinic.subscriptionEndDate &&
                now < new Date(clinic.subscriptionEndDate)
            ) {
                isSubscriptionActive = true;
            }

            // ==============================
            // انتهاء الاشتراك
            // ==============================
            else {
                isSubscriptionActive = false;

                if (
                    subscriptionStatus === 'trial' ||
                    subscriptionStatus === 'active'
                ) {
                    subscriptionStatus = 'expired';
                }
            }

            // ==============================
            // إذا انتهى الاشتراك
            // لا نمنع تسجيل الدخول
            // ==============================

            req.subscriptionType = subscriptionType;
            req.subscriptionStatus = subscriptionStatus;
            req.isSubscriptionActive = isSubscriptionActive;

            // بيانات العيادة متاحة لباقي المسارات
            req.clinicData = clinic;

            // ==============================
            // تحديث بيانات المستخدم التابع
            // ==============================
            if (
                user.role === 'secretary' ||
                user.role === 'doctor'
            ) {
                await User.findByIdAndUpdate(user._id, {
                    subscriptionType: subscriptionType,
                    subscriptionStatus: subscriptionStatus,
                    subscriptionEndDate:
                        clinic.subscriptionEndDate || null,
                    trialEndDate:
                        clinic.trialEndDate || null
                });
            }

            // ==============================
            // تحديث حالة العيادة في قاعدة البيانات
            // ==============================
            if (
                clinic.subscriptionStatus !== subscriptionStatus &&
                subscriptionType !== 'university_student'
            ) {
                clinic.subscriptionStatus = subscriptionStatus;
                await clinic.save();
            }
        }

        next();

    } catch (error) {
        console.error('Auth error:', error);

        return res.status(401).json({
            error: 'توكن غير صالح'
        });
    }
};

// ✅ صلاحيات صاحب العيادة (مع دعم university_student)
const clinicOwnerOnly = (req, res, next) => {
    if (req.userRole === 'clinic_owner' || req.userRole === 'university_student') {
        return next();
    }
    return res.status(403).json({ error: 'غير مصرح لك. هذا الإجراء مخصص لأصحاب العيادات فقط' });
};

// ✅ صلاحيات السكرتير أو صاحب العيادة
const secretaryOrOwner = (req, res, next) => {
    if (['clinic_owner', 'secretary', 'university_student', 'doctor'].includes(req.userRole)) {
        return next();
    }
    return res.status(403).json({ error: 'غير مصرح لك' });
};

module.exports = { authMiddleware, clinicOwnerOnly, secretaryOrOwner };
