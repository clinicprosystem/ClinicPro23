const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();
const admin = require('firebase-admin');

const app = express();

// ✅ تهيئة Firebase Admin SDK (بدون Service Account معقد)
// إذا كان ملف service-account.json موجوداً
try {
    const serviceAccount = require('./service-account.json');
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
    console.log('✅ Firebase Admin initialized with service account');
} catch (e) {
    // إذا لم يوجد ملف، استخدم الإعدادات الافتراضية
    admin.initializeApp();
    console.log('✅ Firebase Admin initialized with default settings');
}

// إعدادات CORS
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true
}));

app.use(express.json());

// ============= مسار إرسال الإشعار =============
app.post('/api/send-notification', async (req, res) => {
    console.log('📨 استلام طلب إرسال إشعار');
    
    const { token, title, body } = req.body;
    
    if (!token || !title || !body) {
        return res.status(400).json({ 
            success: false, 
            error: 'الرجاء إرسال token, title, body' 
        });
    }
    
    try {
        const message = {
            notification: {
                title: title,
                body: body,
            },
            token: token,
            android: {
                priority: 'high',
            },
        };
        
        const response = await admin.messaging().send(message);
        console.log('📡 رد Firebase:', response);
        
        res.json({ success: true, message: 'تم إرسال الإشعار بنجاح', response });
    } catch (error) {
        console.error('❌ خطأ:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ============= مسارات API =============
const authRoutes = require('./routes/auth');
const clinicRoutes = require('./routes/clinics');
const treatmentRoutes = require('./routes/treatments');
const patientRoutes = require('./routes/patients');
const reportRoutes = require('./routes/reports');
const masterRoutes = require('./routes/master');
const labRoutes = require('./routes/lab');
const notificationRoutes = require('./routes/notifications');
const subscriptionRoutes = require('./routes/subscription');

app.use('/api/auth', authRoutes);
app.use('/api/clinics', clinicRoutes);
app.use('/api/treatments', treatmentRoutes);
app.use('/api/patients', patientRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/master', masterRoutes);
app.use('/api/lab', labRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/subscription', subscriptionRoutes);

// الاتصال بقاعدة البيانات
mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log('✅ تم الاتصال بـ MongoDB'))
    .catch(err => console.error('❌ خطأ في الاتصال:', err));

// تشغيل السيرفر
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 السيرفر يعمل على http://localhost:${PORT}`);
});
