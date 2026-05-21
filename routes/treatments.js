const express = require('express');
const Treatment = require('../models/Treatment');
const Patient = require('../models/Patient');
const Clinic = require('../models/Clinic');
const { authMiddleware, secretaryOrOwner } = require('../middleware/auth');
const router = express.Router();

router.use(authMiddleware);
router.use(secretaryOrOwner);

// إضافة معالجة جديدة
router.post('/', async (req, res) => {
    try {
        const {
            patientId,
            doctorId,
            serviceName,
            originalPrice,
            discount,
            treatmentType,
            teeth,
            archType,
            subType,
            notes
        } = req.body;
        
        const clinic = await Clinic.findById(req.clinicId);
        const doctor = clinic.doctors.find(d => d.doctorId.toString() === doctorId);
        
        if (!doctor) {
            return res.status(404).json({ error: 'الطبيب غير موجود' });
        }
        
        const finalPrice = originalPrice - (discount || 0);
        const patient = await Patient.findById(patientId);
        
        const treatment = new Treatment({
            clinicId: req.clinicId,
            patientId,
            doctorId,
            patientName: patient.name,
            doctorName: doctor.name,
            doctorPercentage: doctor.percentage,
            serviceName,
            originalPrice,
            discount: discount || 0,
            finalPrice,
            treatmentType,
            teeth: treatmentType === 'حشو' || treatmentType === 'عصب' || treatmentType === 'خلع' || treatmentType === 'تلبيس' ? teeth : [],
            archType: ['تقويم', 'طقم', 'تبييض', 'تصفية'].includes(treatmentType) ? archType : null,
            subType: subType || null,
            notes
        });
        
        await treatment.save();
        
        res.status(201).json({ success: true, treatment });
        
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// جلب معالجات مريض
router.get('/patient/:patientId', async (req, res) => {
    try {
        const treatments = await Treatment.find({
            clinicId: req.clinicId,
            patientId: req.params.patientId
        }).sort({ date: -1 });
        
        res.json({ success: true, treatments });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// مشاركة معالجة عبر الواتساب
router.post('/:id/share', async (req, res) => {
    try {
        const treatment = await Treatment.findOne({
            _id: req.params.id,
            clinicId: req.clinicId
        }).populate('patientId');
        
        if (!treatment) {
            return res.status(404).json({ error: 'معالجة غير موجودة' });
        }
        
        const message = `
مرحباً ${treatment.patientName}،
تم تسجيل معالجة جديدة في عيادتك:

📋 الخدمة: ${treatment.serviceName}
💰 السعر الأصلي: ${treatment.originalPrice} ريال
🏷️ الخصم: ${treatment.discount} ريال
💵 المبلغ النهائي: ${treatment.finalPrice} ريال
📅 التاريخ: ${new Date(treatment.date).toLocaleDateString('ar-EG')}

شكراً لثقتكم بنا
        `;
        
        const whatsappUrl = `https://wa.me/${treatment.patientId.phone}?text=${encodeURIComponent(message)}`;
        
        treatment.sharedToWhatsApp = true;
        await treatment.save();
        
        res.json({ success: true, whatsappUrl });
        
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
