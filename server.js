const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const app = express();
// أضف هذه الـ imports في الأعلى
const { google } = require('googleapis');
const fetch = require('node-fetch');

// بيانات Service Account (ضعها في متغيرات البيئة للأمان)
const serviceAccount = {
  "type": "service_account",
  "project_id": "clinicprosystem-e89de",
  "private_key_id": "YOUR_PRIVATE_KEY_ID",
  "private_key": "-----BEGIN PRIVATE KEY-----\nYOUR_PRIVATE_KEY\n-----END PRIVATE KEY-----\n",
  "client_email": "YOUR_CLIENT_EMAIL",
  "client_id": "YOUR_CLIENT_ID",
  "auth_uri": "https://accounts.google.com/o/oauth2/auth",
  "token_uri": "https://oauth2.googleapis.com/token",
};

// الحصول على Access Token
async function getAccessToken() {
  const auth = new google.auth.JWT(
    serviceAccount.client_email,
    null,
    serviceAccount.private_key,
    ['https://www.googleapis.com/auth/firebase.messaging']
  );
  const token = await auth.authorize();
  return token.access_token;
}

// إرسال إشعار
async function sendNotification(fcmToken, title, body) {
  const accessToken = await getAccessToken();
  
  const response = await fetch(
    `https://fcm.googleapis.com/v1/projects/${serviceAccount.project_id}/messages:send`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: {
          token: fcmToken,
          notification: { title, body },
          android: { priority: 'high' },
        },
      }),
    }
  );
  
  return response.json();
}

// ✅ أضف هذا المسار الجديد
app.post('/api/send-notification', async (req, res) => {
  const { token, title, body } = req.body;
  
  if (!token || !title || !body) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  
  try {
    const result = await sendNotification(token, title, body);
    res.json({ success: true, result });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
// إعدادات CORS المتقدمة
app.use(cors({
    origin: '*',  // يسمح لجميع المواقع بالاتصال
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true
}));

// معالجة طلبات OPTIONS (preflight)
app.options('*', cors());

app.use(express.json());
// باقي الكود...
const patientRoutes = require('./routes/patients');
app.use('/api/patients', patientRoutes);
const notificationRoutes = require('./routes/notifications');
app.use('/api/notifications', notificationRoutes);
const subscriptionRoutes = require('./routes/subscription');
app.use('/api/subscription', subscriptionRoutes);

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
