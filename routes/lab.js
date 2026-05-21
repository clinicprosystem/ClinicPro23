const express = require('express');
const Lab = require('../models/Lab');
const LabOrder = require('../models/LabOrder');
const Patient = require('../models/Patient');
const { authMiddleware, secretaryOrOwner } = require('../middleware/auth');
const router = express.Router();

router.use(authMiddleware);
router.use(secretaryOrOwner);

// ============= إدارة المعامل =============

// إضافة معمل جديد
router.post('/lab', async (req, res) => {
    try {
        const { name, phone, address, notes } = req.body;
        
        const lab = new Lab({
            clinicId: req.clinicId,
            name,
            phone,
            address,
            notes
        });
        await lab.save();
        
        res.status(201).json({ success: true, lab });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// جلب كل المعامل التابعة للعيادة
router.get('/lab', async (req, res) => {
    try {
        const labs = await Lab.find({ clinicId: req.clinicId });
        res.json({ success: true, labs });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ============= طلبيات المعمل =============

// إضافة طلبية جديدة
router.post('/order', async (req, res) => {
    try {
        const { labId, patientId, jaw, toothNumber, workType, price, paid, notes } = req.body;
        
        const lab = await Lab.findById(labId);
        const patient = await Patient.findById(patientId);
        
        if (!lab || !patient) {
            return res.status(404).json({ error: 'معمل أو مريض غير موجود' });
        }
        
        const order = new LabOrder({
            clinicId: req.clinicId,
            labId,
            patientId,
            labName: lab.name,
            patientName: patient.name,
            jaw,
            toothNumber,
            workType,
            price,
            paid: paid || 0,
            notes
        });
        await order.save();
        
        res.status(201).json({ success: true, order });
        
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// جلب طلبيات المعمل
router.get('/orders', async (req, res) => {
    try {
        const { labId, status } = req.query;
        const filter = { clinicId: req.clinicId };
        
        if (labId) filter.labId = labId;
        if (status) filter.status = status;
        
        const orders = await LabOrder.find(filter).sort({ createdAt: -1 });
        res.json({ success: true, orders });
        
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// إضافة دفعة لطلبية
router.post('/order/:id/pay', async (req, res) => {
    try {
        const { amount } = req.body;
        const order = await LabOrder.findOne({
            _id: req.params.id,
            clinicId: req.clinicId
        });
        
        if (!order) {
            return res.status(404).json({ error: 'طلبية غير موجودة' });
        }
        
        order.paid += amount;
        order.remaining = order.price - order.paid;
        
        if (order.paid >= order.price) {
            order.status = 'completed';
        }
        
        await order.save();
        
        res.json({ success: true, order });
        
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// مشاركة طلبية مع المعمل عبر الواتساب
router.post('/order/:id/share', async (req, res) => {
    try {
        const order = await LabOrder.findOne({
            _id: req.params.id,
            clinicId: req.clinicId
        });
        
        if (!order) {
            return res.status(404).json({ error: 'طلبية غير موجودة' });
        }
        
        const lab = await Lab.findById(order.labId);
        
        const message = `
📋 طلبية معمل جديدة:

المريض: ${order.patientName}
نوع العمل: ${order.workType}
الفك: ${order.jaw}
رقم السن: ${order.toothNumber || 'لا يوجد'}
السعر: ${order.price} ريال
المدفوع: ${order.paid} ريال
المتبقي: ${order.remaining} ريال

ملاحظات: ${order.notes || 'لا توجد'}
        `;
        
        const whatsappUrl = `https://wa.me/${lab.phone}?text=${encodeURIComponent(message)}`;
        
        order.sharedToWhatsApp = true;
        await order.save();
        
        res.json({ success: true, whatsappUrl });
        
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
