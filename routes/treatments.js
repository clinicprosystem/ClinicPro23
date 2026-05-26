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
    doctorId,           // ✅ أضف هذا
    doctorName,         // ✅ أضف هذا
    mainServiceId,
    mainServiceName,
    subServiceId,
    subServiceName,
    originalPrice,
    discount,
    discountType,
    finalPrice,
    teeth,
    jawDetails,
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
    doctorId,           // ✅ أضف هذا
    doctorName,         // ✅ أضف هذا
    mainServiceId,
    mainServiceName: mainServiceName || (mainService ? mainService.name : null),
    subServiceId,
    subServiceName: subServiceName || (subService ? subService.name : null),
    originalPrice,
    discount: discount || 0,
    discountType: discountType || 'ريال',
    finalPrice: calculatedFinalPrice,
    teeth: teeth || [],
    jawDetails: jawDetails || null,
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
router.get('/patient/:patientId', async (req, res) => {
    try {
        const treatments = await Treatment.find({
            clinicId: req.clinicId,
            patientId: req.params.patientId
        }).sort({ date: -1 });
        
        // إضافة معلومات إضافية من الخدمات الرئيسية والفرعية
        const clinic = await Clinic.findById(req.clinicId);
        
        const enrichedTreatments = treatments.map(t => {
            const treatmentObj = t.toObject();
            
            // البحث عن الخدمة الرئيسية للحصول على التصنيف
            if (treatmentObj.mainServiceId) {
                const mainService = clinic.mainServices.id(treatmentObj.mainServiceId);
                if (mainService) {
                    treatmentObj.category = mainService.category;
                }
            }
            
            return treatmentObj;
        });
        
        res.json({ success: true, treatments: enrichedTreatments });
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
