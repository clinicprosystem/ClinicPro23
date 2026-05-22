const express = require('express');
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const User = require('../models/User');
const Clinic = require('../models/Clinic');
const { authMiddleware, clinicOwnerOnly } = require('../middleware/auth');
const router = express.Router();

router.use(authMiddleware);
router.use(clinicOwnerOnly);

// ============= الأطباء =============

// جلب الأطباء
router.get('/doctors', async (req, res) => {
  try {
    // جلب الأطباء من نموذج Clinic مباشرة
    const clinic = await Clinic.findById(req.clinicId);
    res.json({ success: true, doctors: clinic.doctors || [] });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// إضافة طبيب
router.post('/add-doctor', async (req, res) => {
  try {
    const { name, phone, percentage } = req.body;
    
    const clinic = await Clinic.findById(req.clinicId);
    if (!clinic) {
      return res.status(404).json({ error: 'عيادة غير موجودة' });
    }
    
    // إنشاء حساب مستخدم للطبيب
    const tempPassword = Math.random().toString(36).slice(-8);
    const hashedPassword = await bcrypt.hash(tempPassword, 10);
    
    const doctorUser = new User({
      name,
      phone: phone || `temp_${Date.now()}`,
      password: hashedPassword,
      role: 'doctor',
      clinicId: req.clinicId
    });
    await doctorUser.save();
    
    // إضافة الطبيب إلى قائمة الأطباء في العيادة
    clinic.doctors.push({
      doctorId: doctorUser._id,
      name: name,
      phone: phone || '',
      percentage: percentage || 0,
      isActive: true
    });
    await clinic.save();
    
    res.json({
      success: true,
      doctor: { 
        _id: doctorUser._id, 
        name: name, 
        phone: phone || '',
        percentage: percentage || 0 
      },
      tempPassword: tempPassword
    });
    
  } catch (error) {
    console.error('Error adding doctor:', error);
    res.status(500).json({ error: error.message });
  }
});
// جلب الخدمات
router.get('/services', async (req, res) => {
  try {
    const clinic = await Clinic.findById(req.clinicId);
    res.json({ success: true, services: clinic.services || [] });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// إضافة خدمة
router.post('/add-service', async (req, res) => {
  try {
    const { name, price, category } = req.body;
    const clinic = await Clinic.findById(req.clinicId);
    
    clinic.services.push({
      name,
      price,
      category,
      isActive: true
    });
    await clinic.save();
    
    res.json({ success: true, service: { name, price, category } });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// تعديل سعر خدمة
router.put('/services/:id/price', async (req, res) => {
  try {
    const { price } = req.body;
    const clinic = await Clinic.findById(req.clinicId);
    const service = clinic.services.id(req.params.id);
    if (service) {
      service.price = price;
      await clinic.save();
    }
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// حذف خدمة
router.delete('/services/:id', async (req, res) => {
  try {
    const clinic = await Clinic.findById(req.clinicId);
    clinic.services = clinic.services.filter(s => s._id.toString() !== req.params.id);
    await clinic.save();
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
// حذف طبيب
router.delete('/doctors/:id', async (req, res) => {
  try {
    const clinic = await Clinic.findById(req.clinicId);
    clinic.doctors = clinic.doctors.filter(d => d.doctorId.toString() !== req.params.id);
    await clinic.save();
    
    // حذف حساب المستخدم أيضاً
    await User.findByIdAndDelete(req.params.id);
    
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// تعديل نسبة الطبيب
router.put('/doctors/:id/percentage', async (req, res) => {
  try {
    const { percentage } = req.body;
    const clinic = await Clinic.findById(req.clinicId);
    const doctor = clinic.doctors.find(d => d.doctorId.toString() === req.params.id);
    if (doctor) {
      doctor.percentage = percentage;
      await clinic.save();
    }
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============= السكرتيرات =============

// جلب السكرتيرات
router.get('/secretaries', async (req, res) => {
  try {
    const users = await User.find({ clinicId: req.clinicId, role: 'secretary' }).select('-password');
    res.json({ success: true, secretaries: users });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// إضافة سكرتير
router.post('/add-secretary', async (req, res) => {
  try {
    const { name, phone, password } = req.body;
    
    // التحقق من عدم وجود الرقم
    const existingUser = await User.findOne({ phone });
    if (existingUser) {
      return res.status(400).json({ error: 'هذا الرقم مستخدم بالفعل' });
    }
    
    // تشفير كلمة السر
    const hashedPassword = await bcrypt.hash(password, 10);
    
    // إنشاء حساب سكرتير
    const secretary = new User({
      name,
      phone,
      password: hashedPassword,
      role: 'secretary',
      clinicId: req.clinicId
    });
    await secretary.save();
    
    // إضافة السكرتير إلى قائمة السكرتيرات في العيادة (اختياري)
    const clinic = await Clinic.findById(req.clinicId);
    if (clinic) {
      clinic.secretaries.push({
        secretaryId: secretary._id,
        name: name,
        phone: phone,
        isActive: true
      });
      await clinic.save();
    }
    
    res.json({ 
      success: true, 
      secretary: { 
        _id: secretary._id, 
        name: secretary.name, 
        phone: secretary.phone 
      },
      tempPassword: password
    });
    
  } catch (error) {
    console.error('Error adding secretary:', error);
    res.status(500).json({ error: error.message });
  }
});

// حذف سكرتير
router.delete('/secretaries/:id', async (req, res) => {
  try {
    await User.findByIdAndDelete(req.params.id);
    
    // حذف من قائمة السكرتيرات في العيادة
    const clinic = await Clinic.findById(req.clinicId);
    if (clinic) {
      clinic.secretaries = clinic.secretaries.filter(s => s.secretaryId.toString() !== req.params.id);
      await clinic.save();
    }
    
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});



// ============= بيانات العيادة =============

// جلب بيانات العيادة كاملة
router.get('/my-clinic', async (req, res) => {
  try {
    const clinic = await Clinic.findById(req.clinicId);
    const users = await User.find({ clinicId: req.clinicId }).select('-password');
    
    res.json({
      success: true,
      clinic,
      users: users.map(u => ({
        id: u._id,
        name: u.name,
        phone: u.phone,
        role: u.role,
        isActive: u.isActive
      }))
    });
    
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// التحقق من صلاحية الاشتراك
router.get('/subscription-status', async (req, res) => {
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
      status = 'subscribed';
      daysLeft = Math.ceil((clinic.subscriptionEndDate - now) / (1000 * 60 * 60 * 24));
      message = `اشتراك فعال، متبقي ${daysLeft} يوم`;
    } else {
      status = 'expired';
      message = 'انتهت صلاحية الاشتراك، يرجى التجديد';
    }
    
    res.json({
      success: true,
      status,
      daysLeft,
      message,
      trialEndDate: clinic.trialEndDate,
      subscriptionEndDate: clinic.subscriptionEndDate
    });
    
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
