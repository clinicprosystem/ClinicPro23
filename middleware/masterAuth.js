const User = require('../models/User');

const masterAuth = async (req, res, next) => {
    try {
        const user = await User.findById(req.userId);
        
        if (!user || !user.isMasterAdmin) {
            return res.status(403).json({ 
                error: 'غير مصرح لك. هذا القسم للمالك الأساسي فقط' 
            });
        }
        
        next();
    } catch (error) {
        res.status(500).json({ error: 'خطأ في التحقق من الصلاحيات' });
    }
};

module.exports = { masterAuth };
