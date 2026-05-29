const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const app = express();
// أضف هذه الـ imports في الأعلى

const { google } = require('googleapis');
const fetch = require('node-fetch');

// ============= بيانات Service Account (ضعها في متغيرات البيئة للأمان) =============
const serviceAccount = {
  "type": "service_account",
  "project_id": "clinicprosystem-e89de",
  "private_key_id": "aa915b2d1621e82f3fbcb34d7754d61495a8179c",
  "private_key": "-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQCmQlQSaIbg4aV0\n4H1Z70zrvPMJOJ6XnGAKuFeoKLhzDo7lcV0C5nGPn5pZfYPahSJgf6QekNanVg3u\nPiEjsRoukD+FXRKbnXplo113GU7SxXhg0e6UNksa8tQsU/vtl9ZxqUDyiTOe80yu\nGIOMpFDzOjzotYJYO+BjCPgFal3nAiJR+em2H7AzcFGDK/Xe4rAdnzEXmlO2sqR8\nGgozTEV4ZxtuY2R9TX9QgzKNo55EbFdAdb17iGC2DEl/9/8Za7puvdr8je3Qb8Pt\n7ZHiK1Ysdv6RPUn0bpVuba07c4DrhhCMVWq4QpXtjzX0BviD2XRdJsaHPTDIwXBH\nmomeLBA9AgMBAAECggEAC96Q33aQaIYbeJZdRJopsOu+oxIkeljq32ENOv9bObWY\nnIdFF2OpyFHh5FEqZGOcUmzSY+89r9kcKf3MAl8OqjPYoRYFsc/ikNaCofHP14rK\n/wiFwpWEs6IR5S9CvVHZeKhXb2k9ovOmLgiofZYuhErMVeW9bjyqFo/pmwNevFLk\ndrSrxHIXrMw6qxDBs9oy51BKTccP8W0pWNWj0+6P/zyQmvQA06QXAF+/2MkaZSKw\nkI1kSbT/wke3jIsRlN8MaMQbaJDL7KfLxT4IJ9gknIOosO8VqJ/fQDs/awsDCEWA\n1ACO1Nqc2h976YaHGybQX1CAmbHL7hAUUvwHmB91gQKBgQDTN/cB8VVx0dehyj5Y\nUV+Vjzzt+FjzDPQBrmNJpjoEUclTC/TJk2cZvt3CtHaonZoaImGrZ9YGN4Ne5rLL\ns/HY1AswBSwZlPd5i+NlpS8/NVXaUnbYZnaKtUEcE5Y6ZgNYd3HVZG9MEJOsmakg\n1lzkMtht0ujmsqRIQ9fHlrLvgQKBgQDJgiel9Atjt4TFl6pQfmcBy/gbliHO8VWK\nOQ17IHsUXRGKvx022ElCgxCERNvAfwZYIjm5PbBUtN5dLB7FHuLS6N8rWMOzreGt\nNe+rMtUUexogc3p60UDqgQI8hbgJmBImdMG5OcGorBbu8gcHebro/SGwjZGo3/xx\nUPVoDhA+vQKBgGQ92EWcwn9tJphLQoFpxSJWw4Tw604WZKtzlv16HWi1ZAW80+Ti\nxviKA/cG7JWjjmI+1PmjIwj6Sae9dzeD5BCSueiFW+OcNkMCJ96yoZSu/FrL7klP\nf4ze7tKjXRXEGmxe67BppQSFjYBJwOGrupQ2qU6d3Ri3yY3eXMcFd1CBAoGBAJiL\n5JH4Twr9KhEfgLqRBk/Q5pGTtSJhhl0uVatJaoN+9UGw7l/Pmp40dDN9oVJ3lwjv\nV/2I2s01Y0TrmpulhxcdXZ0GBJkoYDjtJPPYdoCbtKquYSFK+jbM1TGWFT2GFu9v\n4hvjwlx7cp0PMg0RtVKeFnv+oC9U6VmrbSyJwPiNAoGAS8MKZlBuhK9KMn7IJ7tZ\nsL44UIUfTmk+L1XeDeQqTy/bzT08J0nGTGql7Ttd1jYtk0gKpm7fmmXCPk+g7wZD\nd9Vyd4143sLqwb7eEeKDKFAT26B6P0ai7E3uc39whaJHxJ7/7q2aBjs4anMMpBPw\nowtWgiGsMg4WBwfJMD3+04o=\n-----END PRIVATE KEY-----\n" 
  "client_email": "firebase-adminsdk-fbsvc@clinicprosystem-e89de.iam.gserviceaccount.com",
  "client_id": "107259244136993598697",
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

// إرسال إشعار عبر FCM API V1
async function sendFCMV1Notification(fcmToken, title, body) {
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
          notification: {
            title: title,
            body: body,
          },
          android: {
            priority: 'high',
          },
        },
      }),
    }
  );
  
  return response.json();
}


// معالجة طلبات OPTIONS (preflight)
app.options('*', cors());

app.use(express.json());

// ============= مسار إرسال الإشعار =============
app.post('/api/send-notification', async (req, res) => {
  console.log('📨 استلام طلب إرسال إشعار (API V1)');
  
  const { token, title, body } = req.body;
  
  if (!token || !title || !body) {
    return res.status(400).json({ 
      success: false, 
      error: 'الرجاء إرسال token, title, body' 
    });
  }
  
  try {
    const result = await sendFCMV1Notification(token, title, body);
    console.log('📡 رد Firebase V1:', result);
    
    if (result.name) {
      // النجاح: Firebase يعيد name إذا نجح
      res.json({ success: true, message: 'تم إرسال الإشعار بنجاح', result });
    } else {
      res.json({ success: false, error: result.error?.message || 'فشل الإرسال' });
    }
  } catch (error) {
    console.error('❌ خطأ:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});
// إعدادات CORS المتقدمة
app.use(cors({
    origin: '*',  // يسمح لجميع المواقع بالاتصال
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true
}));
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
