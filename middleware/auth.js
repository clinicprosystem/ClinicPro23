const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Clinic = require('../models/Clinic');  // ✅ أضف هذا

const authMiddleware = async (req, res, next) => {
    try {
        const token = req.header('Authorization')?.replace('Bearer ', '');
        
        if (!token) {
            return res.status(401).json({ error: 'الرجاء تسجيل الدخول أولاً' });
        }
        
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findById(decoded.userId);
        
        if (!user || !user.isActive) {
            return res.status(401).json({ error: 'حساب غير صالح' });
        }
        
        req.userId = user._id;
        req.userRole = user.role;
        req.clinicId = user.clinicId;
        
        // ✅ التحقق من صلاحية الاشتراك للمستخدمين التابعين (سكرتير، طبيب)
        if (user.role === 'secretary' || user.role === 'doctor') {
            const clinic = await Clinic.findById(user.clinicId);
            if (!clinic) {
                return res.status(403).json({ error: 'عيادة غير موجودة' });
            }
            
            const now = new Date();
            let isSubscriptionActive = false;
            
            // ✅ تحقق من صلاحية العيادة
            if (clinic.subscriptionType === 'university_student') {
                isSubscriptionActive = true;
            }
            else if (clinic.subscriptionStatus === 'trial' && clinic.trialEndDate && now < new Date(clinic.trialEndDate)) {
                isSubscriptionActive = true;
            }
            else if (clinic.subscriptionStatus === 'active' && clinic.subscriptionEndDate && now < new Date(clinic.subscriptionEndDate)) {
                isSubscriptionActive = true;
            }
            
            if (!isSubscriptionActive) {
                return res.status(403).json({ 
                    error: 'انتهت صلاحية اشتراك العيادة. يرجى التواصل مع صاحب العيادة للتجديد.',
                    code: 'SUBSCRIPTION_EXPIRED'
                });
            }
            
            // ✅ تحديث حالة المستخدم التابع لتتطابق مع العيادة
            await User.findByIdAndUpdate(user._id, {
                subscriptionStatus: isSubscriptionActive ? (clinic.subscriptionStatus === 'trial' ? 'trial' : 'active') : 'expired',
                subscriptionType: clinic.subscriptionType
            });
        }
        
        next();
    } catch (error) {
        console.error('Auth error:', error);
        res.status(401).json({ error: 'توكن غير صالح' });
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
