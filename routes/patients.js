const express = require('express');
const Patient = require('../models/Patient');
const User = require('../models/User');
const { authMiddleware, secretaryOrOwner } = require('../middleware/auth');
const router = express.Router();

// جميع المسارات تحتاج مصادقة
router.use(authMiddleware);
router.use(secretaryOrOwner);

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

// جلب جميع المرضى
router.get('/', async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    const patients = await Patient.find({ clinicId: user.clinicId }).sort({ createdAt: -1 });
    res.json({ success: true, patients });
  } catch (error) {
    console.error('Error getting patients:', error);
    res.status(500).json({ error: error.message });
  }
});

// إضافة مريض جديد
router.post('/', async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    
    // ✅ التحقق من حدود الفترة التجريبية
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
    });
    
    await patient.save();
    res.json({ success: true, patient });
  } catch (error) {
    console.error('Error adding patient:', error);
    res.status(500).json({ error: error.message });
  }
});

// حذف مريض
router.delete('/:id', async (req, res) => {
  try {
    await Patient.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting patient:', error);
    res.status(500).json({ error: error.message });
  }
});

// تعديل بيانات مريض
router.put('/:id', async (req, res) => {
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

module.exports = router;
