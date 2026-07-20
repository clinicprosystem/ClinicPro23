const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
require('dotenv').config();
const admin = require('firebase-admin');

const app = express();

// ✅ استيراد المودلات
const Patient = require('./models/Patient');
const Clinic = require('./models/Clinic');

// ✅ تهيئة Firebase Admin SDK
try {
    const serviceAccount = require('./service-account.json');
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
    console.log('✅ Firebase Admin initialized with service account');
} catch (e) {
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

// ============= ✅ خدمة الملفات الثابتة للموقع =============
app.use(express.static(path.join(__dirname, 'public')));

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
const notificationRoutes = require('./routes/notifications');
const subscriptionRoutes = require('./routes/subscription');

app.use('/api/auth', authRoutes);
app.use('/api/clinics', clinicRoutes);
app.use('/api/treatments', treatmentRoutes);
app.use('/api/patients', patientRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/master', masterRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/subscription', subscriptionRoutes);

// ============================================================
// ✅ PUBLIC ROUTES (بدون توكن) - للطلاب الجامعيين
// ============================================================

// ✅ 1. تسجيل مريض عام (بدون توكن)
app.post('/api/public/patient-register', async (req, res) => {
    try {
        const { name, phone, gender, address, description, willPay } = req.body;
        
        // التحقق من وجود البيانات المطلوبة
        if (!name || !phone) {
            return res.status(400).json({ 
                success: false, 
                error: 'الاسم ورقم الجوال مطلوبان' 
            });
        }
        
        // ✅ التحقق من عدم تكرار رقم الجوال
        const existingPatient = await Patient.findOne({ phone });
        if (existingPatient) {
            return res.status(400).json({
                success: false,
                error: 'رقم الجوال مسجل مسبقاً'
            });
        }
        
        // ✅ إنشاء مريض جديد باستخدام المودل
        const patient = new Patient({
            name: name.trim(),
            phone: phone.trim(),
            gender: gender || 'غير محدد',
            address: address || '',
            description: description || '',
            willPay: willPay !== undefined ? willPay : true,
            isBooked: false,
            registeredBy: 'public'
        });
        
        await patient.save();
        
        res.status(201).json({ 
            success: true, 
            patient,
            message: 'تم تسجيل المريض بنجاح' 
        });
    } catch (error) {
        console.error('❌ Error in register:', error);
        res.status(500).json({ 
            success: false, 
            error: error.message || 'فشل في تسجيل المريض' 
        });
    }
});

// ✅ 2. جلب جميع المرضى (بدون توكن)
app.get('/api/public/patients', async (req, res) => {
    try {
        const patients = await Patient.find()
            .sort({ registeredAt: -1 })
            .select('-__v');
        
        res.json({ 
            success: true, 
            patients 
        });
    } catch (error) {
        console.error('❌ Error fetching patients:', error);
        res.status(500).json({ 
            success: false, 
            error: 'فشل في جلب المرضى' 
        });
    }
});

// ✅ 3. تحديث حالة الحجز (بدون توكن)
app.put('/api/public/patients/:id/book', async (req, res) => {
    try {
        const { id } = req.params;
        const { isBooked } = req.body;
        
        // ✅ البحث عن المريض
        const patient = await Patient.findById(id);
        if (!patient) {
            return res.status(404).json({ 
                success: false, 
                error: 'المريض غير موجود' 
            });
        }
        
        // ✅ تحديث حالة الحجز
        patient.isBooked = isBooked !== undefined ? isBooked : !patient.isBooked;
        patient.bookingUpdatedAt = new Date();
        await patient.save();
        
        res.json({ 
            success: true, 
            patient,
            message: patient.isBooked ? 'تم تأكيد الحجز' : 'تم إلغاء الحجز'
        });
    } catch (error) {
        console.error('❌ Error updating booking:', error);
        res.status(500).json({ 
            success: false, 
            error: 'فشل في تحديث الحجز' 
        });
    }
});

// ✅ 4. حذف مريض (بدون توكن - اختياري)
app.delete('/api/public/patients/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const patient = await Patient.findByIdAndDelete(id);
        
        if (!patient) {
            return res.status(404).json({
                success: false,
                error: 'المريض غير موجود'
            });
        }
        
        res.json({
            success: true,
            message: 'تم حذف المريض بنجاح'
        });
    } catch (error) {
        console.error('❌ Error deleting patient:', error);
        res.status(500).json({
            success: false,
            error: 'فشل في حذف المريض'
        });
    }
});

// ✅ 5. إحصائيات المرضى (بدون توكن)
app.get('/api/public/patients/stats', async (req, res) => {
    try {
        const total = await Patient.countDocuments();
        const booked = await Patient.countDocuments({ isBooked: true });
        const pending = await Patient.countDocuments({ isBooked: false });
        
        // اليوم
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        
        const todayCount = await Patient.countDocuments({
            registeredAt: {
                $gte: today,
                $lt: tomorrow
            }
        });
        
        res.json({
            success: true,
            stats: { total, booked, pending, today: todayCount }
        });
    } catch (error) {
        console.error('❌ Error getting stats:', error);
        res.status(500).json({
            success: false,
            error: 'فشل في جلب الإحصائيات'
        });
    }
});

// ============= مسار التحقق من الإصدار =============
const fs = require('fs');

app.get('/api/version', (req, res) => {
    try {
        const versionFile = path.join(__dirname, 'public', 'version.json');
        const data = fs.readFileSync(versionFile, 'utf8');
        res.json(JSON.parse(data));
    } catch (e) {
        res.json({
            success: true,
            version: '1.0.3',
            releaseNotes: 'الإصدار الأول',
            forceUpdate: false,
            lastUpdated: new Date().toISOString()
        });
    }
});

// ✅ مسار الموقع - يجب أن يكون بعد مسارات API
app.get('*', (req, res) => {
    const filePath = path.join(__dirname, 'public', req.path);
    res.sendFile(filePath, (err) => {
        if (err) {
            res.sendFile(path.join(__dirname, 'public', 'index.html'));
        }
    });
});

// ============= الاتصال بقاعدة البيانات =============
mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log('✅ تم الاتصال بـ MongoDB'))
    .catch(err => console.error('❌ خطأ في الاتصال:', err));

// ============= تشغيل السيرفر =============
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 السيرفر يعمل على http://localhost:${PORT}`);
    console.log(`🌐 الموقع متاح على http://localhost:${PORT}`);
});
