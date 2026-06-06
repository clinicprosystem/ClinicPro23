const jwt = require('jsonwebtoken');
const User = require('../models/User');

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
        
        next();
    } catch (error) {
        res.status(401).json({ error: 'توكن غير صالح' });
    }
};

// في middleware/auth.js
const clinicOwnerOnly = (req, res, next) => {
    // ✅ السماح لـ clinic_owner و university_student
    if (req.userRole === 'clinic_owner' || req.userRole === 'university_student') {
        return next();
    }
    return res.status(403).json({ error: 'غير مصرح لك. هذا الإجراء مخصص لأصحاب العيادات فقط' });
};

const secretaryOrOwner = (req, res, next) => {
    // ✅ إضافة university_student إلى الصلاحيات المسموح لها
    if (['clinic_owner', 'secretary', 'university_student'].includes(req.userRole)) {
        return next();
    }
    return res.status(403).json({ error: 'غير مصرح لك' });
};


module.exports = { authMiddleware, clinicOwnerOnly, secretaryOrOwner };
