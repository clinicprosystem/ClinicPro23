const express = require('express');
const Lab = require('../models/Lab');
const LabOrder = require('../models/LabOrder');
const Patient = require('../models/Patient');
const { authMiddleware, secretaryOrOwner } = require('../middleware/auth');
const router = express.Router();

// ============= إدارة المعامل =============

// ✅ جلب كل المعامل - يسمح للجميع (سكرتير، صاحب عيادة)
router.get('/labs', authMiddleware, async (req, res) => {
    try {
        const labs = await Lab.find({ clinicId: req.clinicId });
        res.json({ success: true, labs });
    } catch (error) {
        console.error('❌ Error getting labs:', error);
        res.status(500).json({ error: error.message });
    }
});

// ✅ إضافة معمل جديد - يسمح للسكرتير أيضاً
router.post('/labs', authMiddleware, secretaryOrOwner, async (req, res) => {
    try {
        const { name, phone, address, notes } = req.body;
        
        console.log('📥 إضافة معمل جديد:', { name, phone, address, notes });
        
        const lab = new Lab({
            clinicId: req.clinicId,
            name,
            phone,
            address,
            notes
        });
        await lab.save();
        
        console.log('✅ تم إضافة المعمل:', lab);
        
        res.status(201).json({ success: true, lab });
    } catch (error) {
        console.error('❌ Error adding lab:', error);
        res.status(500).json({ error: error.message });
    }
});

// ============= طلبيات المعمل =============

// ✅ جلب طلبيات المعمل - يسمح للجميع
router.get('/lab-orders', authMiddleware, async (req, res) => {
    try {
        const { labId, status } = req.query;
        const filter = { clinicId: req.clinicId };
        
        if (labId) filter.labId = labId;
        if (status) filter.status = status;
        
        const orders = await LabOrder.find(filter).sort({ createdAt: -1 });
        res.json({ success: true, orders });
    } catch (error) {
        console.error('❌ Error getting lab orders:', error);
        res.status(500).json({ error: error.message });
    }
});

// ✅ إضافة طلبية معمل جديدة - يسمح للسكرتير أيضاً
router.post('/lab-orders', authMiddleware, secretaryOrOwner, async (req, res) => {
    try {
        const { labId, labName, patientId, patientName, teeth, workType, price, paid, remaining, notes } = req.body;
        
        console.log('📥 إضافة طلبية معمل:', { labId, labName, patientId, patientName, workType, price });
        
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
            teeth: teeth || [],
            workType,
            price,
            paid: paid || 0,
            remaining: remaining || (price - (paid || 0)),
            notes,
            status: 'pending'
        });
        await order.save();
        
        console.log('✅ تم إضافة الطلبية:', order);
        
        res.status(201).json({ success: true, order });
    } catch (error) {
        console.error('❌ Error adding lab order:', error);
        res.status(500).json({ error: error.message });
    }
});

// ✅ إضافة دفعة لطلبية - يسمح للسكرتير أيضاً
router.post('/lab-orders/:id/pay', authMiddleware, secretaryOrOwner, async (req, res) => {
    try {
        const { amount } = req.body;
        const order = await LabOrder.findOne({
            _id: req.params.id,
            clinicId: req.clinicId
        });
        
        if (!order) {
            return res.status(404).json({ error: 'طلبية غير موجودة' });
        }
        
        console.log('📥 إضافة دفعة للطلبية:', { orderId: req.params.id, amount });
        
        order.paid += amount;
        order.remaining = order.price - order.paid;
        
        if (order.paid >= order.price) {
            order.status = 'completed';
        }
        
        await order.save();
        
        console.log('✅ تم إضافة الدفعة:', order);
        
        res.json({ success: true, order });
    } catch (error) {
        console.error('❌ Error adding payment:', error);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
