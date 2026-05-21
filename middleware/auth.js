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

const clinicOwnerOnly = (req, res, next) => {
    if (req.userRole !== 'clinic_owner' && req.userRole !== 'master_admin') {
        return res.status(403).json({ error: 'هذه الخاصية لصاحب العيادة فقط' });
    }
    next();
};

const secretaryOrOwner = (req, res, next) => {
    if (!['clinic_owner', 'secretary'].includes(req.userRole)) {
        return res.status(403).json({ error: 'غير مصرح لك' });
    }
    next();
};

module.exports = { authMiddleware, clinicOwnerOnly, secretaryOrOwner };
