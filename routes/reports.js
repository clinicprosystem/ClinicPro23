const express = require('express');
const Treatment = require('../models/Treatment');
const Patient = require('../models/Patient');
const { authMiddleware, clinicOwnerOnly } = require('../middleware/auth');
const router = express.Router();

router.use(authMiddleware);
router.use(clinicOwnerOnly);

// تقرير الدخل اليومي
router.get('/daily', async (req, res) => {
    try {
        const { date } = req.query;
        const targetDate = date ? new Date(date) : new Date();
        
        const startOfDay = new Date(targetDate);
        startOfDay.setHours(0, 0, 0, 0);
        
        const endOfDay = new Date(targetDate);
        endOfDay.setHours(23, 59, 59, 999);
        
        const treatments = await Treatment.find({
            clinicId: req.clinicId,
            date: { $gte: startOfDay, $lte: endOfDay }
        });
        
        const total = treatments.reduce((sum, t) => sum + t.finalPrice, 0);
        
        // إحصائيات كل طبيب
        const doctorStats = {};
        treatments.forEach(t => {
            if (!doctorStats[t.doctorName]) {
                doctorStats[t.doctorName] = {
                    total: 0,
                    count: 0,
                    percentage: t.doctorPercentage,
                    doctorShare: 0
                };
            }
            doctorStats[t.doctorName].total += t.finalPrice;
            doctorStats[t.doctorName].count++;
            doctorStats[t.doctorName].doctorShare += (t.finalPrice * t.doctorPercentage) / 100;
        });
        
        res.json({
            success: true,
            date: startOfDay,
            total,
            treatmentsCount: treatments.length,
            doctors: doctorStats,
            treatments
        });
        
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// تقرير شهري
router.get('/monthly', async (req, res) => {
    try {
        const { year, month } = req.query;
        const startDate = new Date(year, month - 1, 1);
        const endDate = new Date(year, month, 0, 23, 59, 59);
        
        const treatments = await Treatment.find({
            clinicId: req.clinicId,
            date: { $gte: startDate, $lte: endDate }
        });
        
        const total = treatments.reduce((sum, t) => sum + t.finalPrice, 0);
        
        // إحصائيات يومية
        const dailyStats = {};
        treatments.forEach(t => {
            const day = new Date(t.date).getDate();
            if (!dailyStats[day]) dailyStats[day] = 0;
            dailyStats[day] += t.finalPrice;
        });
        
        res.json({
            success: true,
            year,
            month,
            total,
            treatmentsCount: treatments.length,
            dailyStats,
            treatments
        });
        
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// تقرير سنوي
router.get('/yearly', async (req, res) => {
    try {
        const { year } = req.query;
        const startDate = new Date(year, 0, 1);
        const endDate = new Date(year, 11, 31, 23, 59, 59);
        
        const treatments = await Treatment.find({
            clinicId: req.clinicId,
            date: { $gte: startDate, $lte: endDate }
        });
        
        const total = treatments.reduce((sum, t) => sum + t.finalPrice, 0);
        
        // إحصائيات شهرية
        const monthlyStats = {};
        treatments.forEach(t => {
            const month = new Date(t.date).getMonth() + 1;
            if (!monthlyStats[month]) monthlyStats[month] = 0;
            monthlyStats[month] += t.finalPrice;
        });
        
        res.json({
            success: true,
            year,
            total,
            treatmentsCount: treatments.length,
            monthlyStats
        });
        
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// تقرير كامل للمريض لمشاركته
router.get('/patient/:patientId/full-report', async (req, res) => {
    try {
        const patient = await Patient.findOne({
            _id: req.params.patientId,
            clinicId: req.clinicId
        });
        
        if (!patient) {
            return res.status(404).json({ error: 'مريض غير موجود' });
        }
        
        const treatments = await Treatment.find({
            clinicId: req.clinicId,
            patientId: req.params.patientId
        }).sort({ date: -1 });
        
        const totalSpent = treatments.reduce((sum, t) => sum + t.finalPrice, 0);
        
        const whatsappMessage = `
📋 *تقريرك الطبي الكامل* 📋

👤 المريض: ${patient.name}
📞 الجوال: ${patient.phone}

📊 *المعالجات السابقة:*
${treatments.map(t => `• ${t.serviceName} - ${t.finalPrice} ريال (${new Date(t.date).toLocaleDateString('ar-EG')})`).join('\n')}

💰 *إجمالي المصروفات: ${totalSpent} ريال*

شكراً لثقتكم بنا
        `;
        
        const whatsappUrl = `https://wa.me/${patient.phone}?text=${encodeURIComponent(whatsappMessage)}`;
        
        res.json({
            success: true,
            patient,
            treatments,
            totalSpent,
            whatsappUrl
        });
        
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
