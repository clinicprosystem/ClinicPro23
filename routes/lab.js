const express = require('express');
const Lab = require('../models/Lab');
const LabOrder = require('../models/LabOrder');
const Patient = require('../models/Patient');
const { authMiddleware, secretaryOrOwner } = require('../middleware/auth');
const router = express.Router();

router.use(authMiddleware);
router.use(secretaryOrOwner);

// ============= إدارة المعامل =============

// ✅ إضافة معمل جديد (تعديل المسار من /lab إلى /labs)
router.post('/labs', async (req, res) => {
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

// ✅ جلب كل المعامل (تعديل المسار من /lab إلى /labs)
router.get('/labs', async (req, res) => {
    try {
        const labs = await Lab.find({ clinicId: req.clinicId });
        res.json({ success: true, labs });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ============= طلبيات المعمل =============

// ✅ إضافة طلبية جديدة (تعديل المسار من /order إلى /lab-orders)
router.post('/lab-orders', async (req, res) => {
    try {
        const { labId, labName, patientId, patientName, teeth, workType, price, paid, remaining, notes } = req.body;
        
        const lab = await Lab.findById(labId);
        const patient = await Patient.findById(patientId);
        
        if (!lab || !patient) {
            return res.status(404).json({ error: 'معمل أو مريض غير موجود' });
        }
        
        // ✅ دعم الأسنان المتعددة
        const teethText = teeth != null && teeth.isNotEmpty 
            ? teeth.map((t) => `السن ${t['number']} (${t['jaw']})`).join(', ')
            : '';
        
        const order = new LabOrder({
            clinicId: req.clinicId,
            labId,
            patientId,
            labName: lab.name,
            patientName: patient.name,
            teeth: teeth || [],
            workType,
            price,
            paid: paid || 0,
            remaining: remaining || (price - (paid || 0)),
            notes,
            status: 'pending'
        });
        await order.save();
        
        res.status(201).json({ success: true, order });
        
    } catch (error) {
        console.error('Error adding lab order:', error);
        res.status(500).json({ error: error.message });
    }
});

// ✅ جلب طلبيات المعمل (تعديل المسار من /orders إلى /lab-orders)
router.get('/lab-orders', async (req, res) => {
    try {
        const { labId, status } = req.query;
        const filter = { clinicId: req.clinicId };
        
        if (labId) filter.labId = labId;
        if (status) filter.status = status;
        
        const orders = await LabOrder.find(filter).sort({ createdAt: -1 });
        res.json({ success: true, orders });
        
    } catch (error) {
        console.error('Error getting lab orders:', error);
        res.status(500).json({ error: error.message });
    }
});

// ✅ إضافة دفعة لطلبية
router.post('/lab-orders/:id/pay', async (req, res) => {
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
        console.error('Error adding payment:', error);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
