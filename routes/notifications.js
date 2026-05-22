const express = require('express');
const Notification = require('../models/Notification');
const User = require('../models/User');
const { authMiddleware } = require('../middleware/auth');
const router = express.Router();

router.use(authMiddleware);

// جلب إشعارات المستخدم
router.get('/', async (req, res) => {
    try {
        const user = await User.findById(req.userId);
        const notifications = await Notification.find({
            clinicId: user.clinicId,
            $or: [
                { targetRole: 'all' },
                { targetRole: user.role },
                { targetUserId: req.userId }
            ]
        }).sort({ createdAt: -1 }).limit(50);
        
        res.json({ success: true, notifications });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// إرسال إشعار (للأدمن فقط)
router.post('/', async (req, res) => {
    try {
        const user = await User.findById(req.userId);
        if (user.role !== 'clinic_owner' && !user.isMasterAdmin) {
            return res.status(403).json({ error: 'غير مصرح لك' });
        }
        
        const { title, body, type, targetRole, targetUserId } = req.body;
        
        const notification = new Notification({
            clinicId: user.clinicId,
            title,
            body,
            type: type || 'info',
            targetRole: targetRole || 'all',
            targetUserId: targetUserId || null
        });
        
        await notification.save();
        res.json({ success: true, notification });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// تحديث حالة الإشعار (قراءة)
router.put('/:id/read', async (req, res) => {
    try {
        await Notification.findByIdAndUpdate(req.params.id, { isRead: true });
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// حذف إشعار
router.delete('/:id', async (req, res) => {
    try {
        await Notification.findByIdAndDelete(req.params.id);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
