const express = require('express');
const Patient = require('../models/Patient');
const User = require('../models/User');
const { authMiddleware, secretaryOrOwner } = require('../middleware/auth');
const router = express.Router();

// جميع المسارات تحتاج مصادقة
router.use(authMiddleware);
router.use(secretaryOrOwner);

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
