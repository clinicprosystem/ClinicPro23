const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
require('dotenv').config();
const admin = require('firebase-admin');

const app = express();

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
// ========== 1. تسجيل مريض عام (بدون توكن) ==========
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
        
        // إنشاء مريض جديد
        const patient = {
            id: generateId(),
            name,
            phone,
            gender: gender || 'غير محدد',
            address: address || '',
            description: description || '',
            willPay: willPay !== undefined ? willPay : true,
            isBooked: false,
            registeredAt: new Date().toISOString(),
        };
        
        // حفظ في قاعدة البيانات
        await savePatient(patient);
        
        res.json({ 
            success: true, 
            patient,
            message: 'تم تسجيل المريض بنجاح' 
        });
    } catch (error) {
        console.error('❌ Error in register:', error);
        res.status(500).json({ 
            success: false, 
            error: 'فشل في تسجيل المريض' 
        });
    }
});

// ========== 2. جلب جميع المرضى (بدون توكن) ==========
app.get('/api/public/patients', async (req, res) => {
    try {
        const patients = await getAllPatients();
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

// ========== 3. تحديث حالة الحجز (بدون توكن) ==========
app.put('/api/public/patients/:id/book', async (req, res) => {
    try {
        const { id } = req.params;
        const { isBooked } = req.body;
        
        const patient = await getPatientById(id);
        if (!patient) {
            return res.status(404).json({ 
                success: false, 
                error: 'المريض غير موجود' 
            });
        }
        
        // تحديث حالة الحجز
        patient.isBooked = isBooked;
        await updatePatient(patient);
        
        res.json({ 
            success: true, 
            patient,
            message: isBooked ? 'تم تأكيد الحجز' : 'تم إلغاء الحجز'
        });
    } catch (error) {
        console.error('❌ Error updating booking:', error);
        res.status(500).json({ 
            success: false, 
            error: 'فشل في تحديث الحجز' 
        });
    }
});

app.use('/api/subscription', subscriptionRoutes);


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
// ✅ إذا كان المسار غير موجود، أرسل index.html
app.get('*', (req, res) => {
    // المحاولة: إرسال الملف المطلوب إذا كان موجوداً
    const filePath = path.join(__dirname, 'public', req.path);
    res.sendFile(filePath, (err) => {
        if (err) {
            // إذا لم يوجد الملف، أرسل index.html
            res.sendFile(path.join(__dirname, 'public', 'index.html'));
        }
    });
});

// الاتصال بقاعدة البيانات
mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log('✅ تم الاتصال بـ MongoDB'))
    .catch(err => console.error('❌ خطأ في الاتصال:', err));

// تشغيل السيرفر
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 السيرفر يعمل على http://localhost:${PORT}`);
    console.log(`🌐 الموقع متاح على http://localhost:${PORT}`);
});
