const express = require('express');
const mongoose = require('mongoose');
const Payment = require('../models/Payment');
const Treatment = require('../models/Treatment');
const Patient = require('../models/Patient');
const Clinic = require('../models/Clinic');
const { authMiddleware, secretaryOrOwner } = require('../middleware/auth');
const { requireActiveSubscription } = require('../middleware/subscription');
const router = express.Router();

router.use(authMiddleware);
router.use(secretaryOrOwner);

// ✅ دالة للتحقق من عدد المعالجات في الفترة التجريبية
async function canAddTreatment(clinicId) {
    try {
        const clinic = await Clinic.findById(clinicId);
        
        // إذا لم يكن في فترة تجريبية، يسمح
        if (clinic.subscriptionStatus !== 'trial') {
            return { allowed: true };
        }
        
        // التحقق من تاريخ انتهاء التجربة
        if (clinic.trialEndDate && new Date() > new Date(clinic.trialEndDate)) {
            return { allowed: false, reason: 'انتهت الفترة التجريبية' };
        }
        
        // حساب عدد المعالجات
        const treatmentsCount = await Treatment.countDocuments({ clinicId: clinicId });
        const maxTreatments = 3;
        
        if (treatmentsCount >= maxTreatments) {
            return { 
                allowed: false, 
                reason: `لقد تجاوزت الحد المسموح في الفترة التجريبية (${maxTreatments} معالجات). يرجى ترقية اشتراكك.` 
            };
        }
        
        return { allowed: true };
    } catch (error) {
        console.error('Error in canAddTreatment:', error);
        return { allowed: true }; // في حالة الخطأ، نسمح مؤقتاً
    }
}

// إضافة معالجة جديدة
router.post('/', requireActiveSubscription, async (req, res) => {
    try {
        // ✅ التحقق من حدود الفترة التجريبية
        const canAdd = await canAddTreatment(req.clinicId);
        if (!canAdd.allowed) {
            return res.status(403).json({ 
                success: false, 
                error: canAdd.reason || 'لا يمكن إضافة معالجات جديدة في الفترة التجريبية'
            });
        }
    
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
            numberOfTeeth,
            jawDetails,
            notes,
            archType,           // ✅ أضف هذا
            paid                // ✅ أضف هذا
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
        
        const paidAmount = paid || 0;
        const remainingAmount = calculatedFinalPrice - paidAmount;
        
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
            numberOfTeeth: numberOfTeeth || 0,
            jawDetails: jawDetails || null,
            notes: notes || null,
            archType: archType || null,           // ✅ أضف هذا
            date: new Date(),
            paid: paidAmount,
            remaining: remainingAmount < 0 ? 0 : remainingAmount
        });
        
        await treatment.save();
        
        // ✅ إرجاع المعالجة مع جميع الحقول
        res.status(201).json({ 
            success: true, 
            treatment: {
                id: treatment._id,
                patientId: treatment.patientId,
                patientName: treatment.patientName,
                doctorId: treatment.doctorId,
                doctorName: treatment.doctorName,
                mainServiceName: treatment.mainServiceName,
                subServiceName: treatment.subServiceName,
                originalPrice: treatment.originalPrice,
                discount: treatment.discount,
                discountType: treatment.discountType,
                finalPrice: treatment.finalPrice,
                paid: treatment.paid,
                remaining: treatment.remaining,
                teeth: treatment.teeth,
                numberOfTeeth: treatment.numberOfTeeth,
                archType: treatment.archType,
                jawDetails: treatment.jawDetails,
                notes: treatment.notes,
                date: treatment.date
            }
        });
        
    } catch (error) {
        console.error('Error adding treatment:', error);
        res.status(500).json({ error: error.message });
    }
});
// ✅ جلب سجل المدفوعات لمعالجة
router.get('/:id/payments', async (req, res) => {
    try {
        const payments = await Payment.find({
            treatmentId: req.params.id,
            clinicId: req.clinicId
        }).sort({ date: -1 });
        
        res.json({ 
            success: true, 
            payments: payments.map(p => ({
                id: p.id,
                amount: p.amount,
                type: p.type,
                note: p.note,
                date: p.date
            }))
        });
        
    } catch (error) {
        console.error('Error getting payments:', error);
        res.status(500).json({ error: error.message });
    }
});

// جلب معالجات مريض
router.get('/patient/:patientId', async (req, res) => {
    try {
        const ObjectId = mongoose.Types.ObjectId;
        
        let patientObjectId;
        try {
            patientObjectId = new ObjectId(req.params.patientId);
        } catch (e) {
            return res.status(400).json({ error: 'Invalid patient ID format' });
        }
        
        console.log('📡 patientId (String):', req.params.patientId);
        console.log('📡 patientId (ObjectId):', patientObjectId);
        
        // ✅ إضافة select لجلب جميع الحقول المطلوبة
        const treatments = await Treatment.find({
            clinicId: req.clinicId,
            patientId: patientObjectId
        }).select('id patientId patientName doctorId doctorName mainServiceName subServiceName originalPrice discount discountType finalPrice paid remaining teeth numberOfTeeth archType jawDetails notes date').sort({ date: -1 });
        
        console.log('📡 عدد المعالجات:', treatments.length);
        
        res.json({ success: true, treatments: treatments });
    } catch (error) {
        console.error('❌ خطأ:', error);
        res.status(500).json({ error: error.message });
    }
});

// جلب جميع المعالجات (للتقارير)
// ✅ جلب جميع المعالجات مع تفاصيل الدفع
router.get('/', async (req, res) => {
    try {
        const treatments = await Treatment.find({
            clinicId: req.clinicId
        })
        .populate('patientId', 'name phone')  // ✅ جلب بيانات المريض
        .sort({ date: -1 });
        
        // ✅ معالجة البيانات وإضافة patientName و patientPhone
        const treatmentsWithPayments = await Promise.all(treatments.map(async (treatment) => {
            const payments = await Payment.find({
                treatmentId: treatment._id
            }).select('amount type note date').sort({ date: -1 });
            
            const treatmentObj = treatment.toObject();
            
            // ✅ إضافة اسم المريض ورقمه من البيانات المسترطبة
            treatmentObj.patientName = treatment.patientId?.name || 'مريض غير محدد';
            treatmentObj.patientPhone = treatment.patientId?.phone || '';
            
            // ✅ إزالة patientId إذا كان كائن (اختياري)
            if (treatmentObj.patientId && typeof treatmentObj.patientId === 'object') {
                treatmentObj.patientId = treatmentObj.patientId._id || treatmentObj.patientId;
            }
            
            return {
                id: treatmentObj._id,
                patientId: treatmentObj.patientId,
                patientName: treatmentObj.patientName,
                patientPhone: treatmentObj.patientPhone,
                doctorName: treatmentObj.doctorName,
                mainServiceName: treatmentObj.mainServiceName,
                subServiceName: treatmentObj.subServiceName,
                originalPrice: treatmentObj.originalPrice,
                discount: treatmentObj.discount,
                discountType: treatmentObj.discountType,
                finalPrice: treatmentObj.finalPrice,
                paid: treatmentObj.paid || 0,
                remaining: treatmentObj.remaining || treatmentObj.finalPrice,
                date: treatmentObj.date,
                payments: payments,
                teeth: treatmentObj.teeth,
                numberOfTeeth: treatmentObj.numberOfTeeth,
                archType: treatmentObj.archType,
                jawDetails: treatmentObj.jawDetails,
                notes: treatmentObj.notes
            };
        }));
        
        res.json({ success: true, treatments: treatmentsWithPayments });
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

📋 الخدمة: ${treatment.subServiceName || treatment.mainServiceName}
💰 السعر الأصلي: ${treatment.originalPrice} ريال
🏷️ الخصم: ${treatment.discount} ريال
💵 المبلغ النهائي: ${treatment.finalPrice} ريال
💳 المدفوع: ${treatment.paid || 0} ريال
📊 المتبقي: ${treatment.remaining || treatment.finalPrice} ريال
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



// ✅ إضافة دفعة أو عودة لمعالجة
router.post('/:id/payment', async (req, res) => {
    try {
        const { amount, type, note } = req.body;
        
        const treatment = await Treatment.findOne({
            _id: req.params.id,
            clinicId: req.clinicId
        });
        
        if (!treatment) {
            return res.status(404).json({ error: 'معالجة غير موجودة' });
        }
        
        let newPaid = treatment.paid || 0;
        
        if (type === 'payment') {
            newPaid += amount;
        } else if (type === 'refund') {
            newPaid -= amount;
        } else {
            return res.status(400).json({ error: 'نوع العملية غير صحيح' });
        }
        
        if (newPaid > treatment.finalPrice) {
            return res.status(400).json({ error: 'المبلغ المدفوع لا يمكن أن يتجاوز السعر النهائي' });
        }
        
        if (newPaid < 0) {
            return res.status(400).json({ error: 'المبلغ لا يمكن أن يكون سالباً' });
        }
        
        // ✅ 1. حفظ سجل الدفعة في جدول Payments
        const payment = new Payment({
            id: Date.now().toString(),
            treatmentId: treatment._id,
            clinicId: req.clinicId,
            amount: amount,
            type: type,
            note: note || '',
            date: new Date()
        });
        await payment.save();
        
        // ✅ 2. تحديث المعالجة
        treatment.paid = newPaid;
        treatment.remaining = treatment.finalPrice - newPaid;
        await treatment.save();
        
        res.json({ 
            success: true, 
            treatment: {
                id: treatment._id,
                paid: treatment.paid,
                remaining: treatment.remaining,
                finalPrice: treatment.finalPrice
            },
            payment: {
                id: payment.id,
                amount: payment.amount,
                type: payment.type,
                note: payment.note,
                date: payment.date
            }
        });
        
    } catch (error) {
        console.error('Error updating payment:', error);
        res.status(500).json({ error: error.message });
    }
});

// ✅ جلب حالة الدفع لمعالجة
router.get('/:id/payment-status', async (req, res) => {
    try {
        const treatment = await Treatment.findOne({
            _id: req.params.id,
            clinicId: req.clinicId
        }).select('paid remaining finalPrice');
        
        if (!treatment) {
            return res.status(404).json({ error: 'معالجة غير موجودة' });
        }
        
        res.json({ 
            success: true, 
            paid: treatment.paid || 0,
            remaining: treatment.remaining || treatment.finalPrice,
            totalPrice: treatment.finalPrice
        });
        
    } catch (error) {
        console.error('Error getting payment status:', error);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
