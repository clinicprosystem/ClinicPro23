const express = require('express');
const Treatment = require('../models/Treatment');
const Patient = require('../models/Patient');
const Clinic = require('../models/Clinic');
const { authMiddleware, secretaryOrOwner } = require('../middleware/auth');
const router = express.Router();

router.use(authMiddleware);
router.use(secretaryOrOwner);

// إضافة معالجة جديدة
// إضافة معالجة جديدة (متوافقة مع الهيكل الجديد للخدمات)
router.post('/', async (req, res) => {
    try {
        const {
    patientId,
    doctorId,
    doctorName,
    mainServiceId,
    mainServiceName,
    subServiceId,
    subServiceName,
    originalPrice,
    discount,
    discountType,
    finalPrice,
    teeth,
    numberOfTeeth,        // ✅ أضف هذا
    jawDetails,
    additionalNotes,      // ✅ أضف هذا
    notes
} = req.body;
        
        const clinic = await Clinic.findById(req.clinicId);
        
        // البحث عن الخدمة الرئيسية (اختياري)
        let mainService = null;
        if (mainServiceId) {
            mainService = clinic.mainServices.id(mainServiceId);
        }
        
        // البحث عن المعالجة الفرعية
        let subService = null;
        if (subServiceId) {
            subService = clinic.subServices.id(subServiceId);
        }
        
        const patient = await Patient.findById(patientId);
        if (!patient) {
            return res.status(404).json({ error: 'المريض غير موجود' });
        }
        
        // حساب السعر النهائي إذا لم يتم إرساله
        let calculatedFinalPrice = finalPrice;
        if (!calculatedFinalPrice) {
            calculatedFinalPrice = originalPrice - (discount || 0);
            if (discountType === 'نسبة') {
                calculatedFinalPrice = originalPrice - ((originalPrice * (discount || 0)) / 100);
            }
        }
        
        const treatment = new Treatment({
    clinicId: req.clinicId,
    patientId,
    patientName: patient.name,
    doctorId,
    doctorName,
    mainServiceId,
    mainServiceName: mainServiceName || (mainService ? mainService.name : null),
    subServiceId,
    subServiceName: subServiceName || (subService ? subService.name : null),
    originalPrice,
    discount: discount || 0,
    discountType: discountType || 'ريال',
    finalPrice: calculatedFinalPrice,
    teeth: teeth || [],
    numberOfTeeth: numberOfTeeth || 0,        // ✅ أضف هذا
    jawDetails: jawDetails || null,
    additionalNotes: additionalNotes || null,  // ✅ أضف هذا
    notes,
    date: new Date()
});
        
        await treatment.save();
        
        res.status(201).json({ success: true, treatment });
        
    } catch (error) {
        console.error('Error adding treatment:', error);
        res.status(500).json({ error: error.message });
    }
});

// جلب معالجات مريض
// جلب معالجات مريض
const mongoose = require('mongoose');

router.get('/patient/:patientId', async (req, res) => {
    try {
        const ObjectId = mongoose.Types.ObjectId;
        
        // ✅ تحويل patientId من String إلى ObjectId
        let patientObjectId;
        try {
            patientObjectId = new ObjectId(req.params.patientId);
        } catch (e) {
            return res.status(400).json({ error: 'Invalid patient ID format' });
        }
        
        console.log('📡 patientId (String):', req.params.patientId);
        console.log('📡 patientId (ObjectId):', patientObjectId);
        
        const treatments = await Treatment.find({
            clinicId: req.clinicId,
            patientId: patientObjectId
        }).sort({ date: -1 });
        
        console.log('📡 عدد المعالجات:', treatments.length);
        
        res.json({ success: true, treatments: treatments });
    } catch (error) {
        console.error('❌ خطأ:', error);
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
