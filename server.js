require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

const app = express();
const patientRoutes = require('./routes/patients');
app.use('/api/patients', patientRoutes);

// Middlewares
app.use(cors());
app.use(express.json());

// الاتصال بقاعدة البيانات
mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log('✅ تم الاتصال بـ MongoDB'))
    .catch(err => console.error('❌ خطأ في الاتصال:', err));

// استيراد المسارات
const authRoutes = require('./routes/auth');
const clinicRoutes = require('./routes/clinics');
const treatmentRoutes = require('./routes/treatments');
const reportRoutes = require('./routes/reports');
const masterRoutes = require('./routes/master');
const labRoutes = require('./routes/lab');

// استخدام المسارات
app.use('/api/auth', authRoutes);
app.use('/api/clinics', clinicRoutes);
app.use('/api/treatments', treatmentRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/master', masterRoutes);
app.use('/api/lab', labRoutes);

// تشغيل السيرفر
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 السيرفر يعمل على http://localhost:${PORT}`);
});
