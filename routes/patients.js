const express = require('express');
const Patient = require('../models/Patient');
const User = require('../models/User');
const { authMiddleware, secretaryOrOwner } = require('../middleware/auth');
const { requireActiveSubscription } = require('../middleware/subscription');
const router = express.Router();

// ============================================================
// ✅ PUBLIC ROUTES (بدون توكن) - توضع قبل الميدلوير
// ============================================================

// ✅ 1. تسجيل مريض عام (بدون توكن)
router.post('/public/patient-register', async (req, res) => {
    try {
        const { name, phone, gender, address, description, willPay } = req.body;
        
        console.log('📥 استلام طلب تسجيل مريض عام:');
        console.log('📥 name:', name);
        console.log('📥 phone:', phone);
        
        if (!name || !phone) {
            return res.status(400).json({ 
                success: false, 
                error: 'الاسم ورقم الجوال مطلوبان' 
            });
        }
        
        // ✅ التحقق من عدم تكرار رقم الجوال
        const existingPatient = await Patient.findOne({ 
            phone: phone.trim(),
            isPublic: true 
        });
        if (existingPatient) {
            return res.status(400).json({
                success: false,
                error: 'رقم الجوال مسجل مسبقاً'
            });
        }
        
        // ✅ إنشاء مريض عام جديد
        const patient = new Patient({
            name: name.trim(),
            phone: phone.trim(),
            gender: gender || 'غير محدد',
            address: address || '',
            description: description || '',
            willPay: willPay !== undefined ? willPay : true,
            isBooked: false,
            isPublic: true,
            registeredBy: 'public'
        });
        
        await patient.save();
        
        console.log('✅ تم تسجيل المريض:', patient.name);
        
        res.status(201).json({ 
            success: true, 
            patient,
            message: 'تم تسجيل المريض بنجاح' 
        });
    } catch (error) {
        console.error('❌ Error in register:', error);
        res.status(500).json({ 
            success: false, 
            error: error.message || 'فشل في تسجيل المريض' 
        });
    }
});

// ✅ 2. جلب جميع المرضى العامين (بدون توكن)
router.get('/public/patients', async (req, res) => {
    try {
        const patients = await Patient.find({ isPublic: true })
            .sort({ createdAt: -1 })
            .select('-__v -medicalHistory -notes -clinicId');
        
        res.json({ 
            success: true, 
            patients 
        });
    } catch (error) {
        console.error('❌ Error fetching patients:', error);
        res.status(500).json({ 
            success: false, 
            error: 'فشل في جلب المرضى' 
        });
    }
});

// ✅ 3. تحديث حالة الحجز (بدون توكن)
router.put('/public/patients/:id/book', async (req, res) => {
    try {
        const { id } = req.params;
        const { isBooked } = req.body;
        
        const patient = await Patient.findOne({ 
            _id: id,
            isPublic: true 
        });
        
        if (!patient) {
            return res.status(404).json({ 
                success: false, 
                error: 'المريض غير موجود' 
            });
        }
        
        patient.isBooked = isBooked !== undefined ? isBooked : !patient.isBooked;
        patient.bookingUpdatedAt = new Date();
        await patient.save();
        
        res.json({ 
            success: true, 
            patient,
            message: patient.isBooked ? 'تم تأكيد الحجز' : 'تم إلغاء الحجز'
        });
    } catch (error) {
        console.error('❌ Error updating booking:', error);
        res.status(500).json({ 
            success: false, 
            error: 'فشل في تحديث الحجز' 
        });
    }
});
// ✅ 4. إخفاء/إظهار بيانات المريض (بدون توكن)
router.put('/public/patients/:id/hide', async (req, res) => {
    try {
        const { id } = req.params;
        const { isHidden } = req.body;
        
        const patient = await Patient.findOne({ 
            _id: id,
            isPublic: true 
        });
        
        if (!patient) {
            return res.status(404).json({ 
                success: false, 
                error: 'المريض غير موجود' 
            });
        }
        
        patient.isHidden = isHidden !== undefined ? isHidden : !patient.isHidden;
        await patient.save();
        
        res.json({ 
            success: true, 
            patient,
            message: patient.isHidden ? 'تم إخفاء البيانات' : 'تم إظهار البيانات'
        });
    } catch (error) {
        console.error('❌ Error toggling hide:', error);
        res.status(500).json({ 
            success: false, 
            error: 'فشل في تحديث الإعدادات' 
        });
    }
});

// ✅ 4. حذف مريض عام (بدون توكن)
router.delete('/public/patients/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const patient = await Patient.findOneAndDelete({ 
            _id: id,
            isPublic: true 
        });
        
        if (!patient) {
            return res.status(404).json({
                success: false,
                error: 'المريض غير موجود'
            });
        }
        
        res.json({
            success: true,
            message: 'تم حذف المريض بنجاح'
        });
    } catch (error) {
        console.error('❌ Error deleting patient:', error);
        res.status(500).json({
            success: false,
            error: 'فشل في حذف المريض'
        });
    }
});

// ✅ 5. إحصائيات المرضى العامين (بدون توكن)
router.get('/public/patients/stats', async (req, res) => {
    try {
        const total = await Patient.countDocuments({ isPublic: true });
        const booked = await Patient.countDocuments({ isPublic: true, isBooked: true });
        const pending = await Patient.countDocuments({ isPublic: true, isBooked: false });
        
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        
        const todayCount = await Patient.countDocuments({
            isPublic: true,
            createdAt: {
                $gte: today,
                $lt: tomorrow
            }
        });
        
        res.json({
            success: true,
            stats: { total, booked, pending, today: todayCount }
        });
    } catch (error) {
        console.error('❌ Error getting stats:', error);
        res.status(500).json({
            success: false,
            error: 'فشل في جلب الإحصائيات'
        });
    }
});

// ============================================================
// ✅ PROTECTED ROUTES (تتطلب توكن) - توضع بعد الميدلوير
// ============================================================

// جميع المسارات التالية تحتاج مصادقة
router.use(authMiddleware);
router.use(secretaryOrOwner);

// جلب جميع المرضى (للعيادة)
router.get('/', async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    const patients = await Patient.find({ 
      clinicId: user.clinicId,
      isPublic: { $ne: true } // ✅ استبعاد المرضى العامين
    }).sort({ createdAt: -1 });
    res.json({ success: true, patients });
  } catch (error) {
    console.error('Error getting patients:', error);
    res.status(500).json({ error: error.message });
  }
});

// إضافة مريض جديد (للعيادة)
router.post('/', requireActiveSubscription, async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    
    const canAdd = await canAddPatient(user.clinicId);
    if (!canAdd.allowed) {
      return res.status(403).json({ success: false, error: canAdd.reason });
    }
    
    const { name, phone, age, gender, medicalHistory, notes } = req.body;
    
    const patient = new Patient({
      clinicId: user.clinicId,
      name,
      phone,
      age: age || null,
      gender: gender || null,
      medicalHistory: medicalHistory || '',
      notes: notes || '',
      isPublic: false
    });
    
    await patient.save();
    res.json({ success: true, patient });
  } catch (error) {
    console.error('Error adding patient:', error);
    res.status(500).json({ error: error.message });
  }
});

// حذف مريض
router.delete('/:id', requireActiveSubscription, async (req, res) => {
  try {
    await Patient.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting patient:', error);
    res.status(500).json({ error: error.message });
  }
});

// تعديل بيانات مريض
router.put('/:id', requireActiveSubscription, async (req, res) => {
  try {
    const patient = await Patient.findByIdAndUpdate(
      req.params.id,
      { ...req.body },
      { new: true }
    );
    res.json({ success: true, patient });
  } catch (error) {
    console.error('Error updating patient:', error);
    res.status(500).json({ error: error.message });
  }
});

// ✅ دالة للتحقق من عدد المرضى في الفترة التجريبية
async function canAddPatient(clinicId) {
    try {
        const Clinic = require('../models/Clinic');
        const clinic = await Clinic.findById(clinicId);
        
        if (clinic.subscriptionStatus !== 'trial') {
            return { allowed: true };
        }
        
        if (clinic.trialEndDate && new Date() > new Date(clinic.trialEndDate)) {
            return { allowed: false, reason: 'انتهت الفترة التجريبية. يرجى ترقية اشتراكك.' };
        }
        
        const patientsCount = await Patient.countDocuments({ clinicId: clinicId });
        const maxPatients = 3;
        
        if (patientsCount >= maxPatients) {
            return { 
                allowed: false, 
                reason: `لقد تجاوزت الحد المسموح في الفترة التجريبية (${maxPatients} مرضى). يرجى ترقية اشتراكك لإضافة المزيد.` 
            };
        }
        
        return { allowed: true };
    } catch (error) {
        console.error('Error in canAddPatient:', error);
        return { allowed: true };
    }
}

module.exports = router;
