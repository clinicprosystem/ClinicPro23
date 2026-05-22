const express = require('express');
const Clinic = require('../models/Clinic');
const { authMiddleware } = require('../middleware/auth');
const router = express.Router();

router.use(authMiddleware);

// جلب حالة الاشتراك
router.get('/status', async (req, res) => {
  try {
    const clinic = await Clinic.findById(req.clinicId);
    const now = new Date();
    
    let status = 'active';
    let daysLeft = 0;
    let message = '';
    
    if (clinic.isFrozen) {
      status = 'frozen';
      message = 'الحساب موقوف مؤقتاً، راجع المسؤول';
    } else if (clinic.trialEndDate && now < clinic.trialEndDate) {
      status = 'trial';
      daysLeft = Math.ceil((clinic.trialEndDate - now) / (1000 * 60 * 60 * 24));
      message = `فترة تجريبية، متبقي ${daysLeft} يوم`;
    } else if (clinic.subscriptionEndDate && now < clinic.subscriptionEndDate) {
      status = 'active';
      daysLeft = Math.ceil((clinic.subscriptionEndDate - now) / (1000 * 60 * 60 * 24));
      message = `اشتراك فعال، متبقي ${daysLeft} يوم`;
    } else {
      status = 'expired';
      message = 'انتهت صلاحية الاشتراك، يرجى التجديد';
    }
    
    res.json({ success: true, status, daysLeft, message, isFrozen: clinic.isFrozen });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// التحقق من صلاحية الإضافة (للعمليات الحساسة)
router.get('/can-add', async (req, res) => {
  try {
    const clinic = await Clinic.findById(req.clinicId);
    const now = new Date();
    
    let canAdd = true;
    let reason = '';
    
    if (clinic.isFrozen) {
      canAdd = false;
      reason = 'الحساب موقوف مؤقتاً';
    } else if (clinic.trialEndDate && now > clinic.trialEndDate) {
      if (!clinic.subscriptionEndDate || now > clinic.subscriptionEndDate) {
        canAdd = false;
        reason = 'انتهت صلاحية الاشتراك، يرجى التجديد';
      }
    }
    
    res.json({ success: true, canAdd, reason });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
