const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const app = express();
// أضف هذه الـ imports في الأعلى
const { google } = require('googleapis');
const fetch = require('node-fetch');

// بيانات Service Account (ضعها في متغيرات البيئة للأمان)
// بيانات Service Account (انسخ والصق هذا)
const serviceAccount = {
  "type": "service_account",
  "project_id": "clinicprosystem-e89de",
  "private_key_id": "1d1b369cd4039762a19409b7fbf769bfc40ae4e2",
  "private_key": "-----BEGIN PRIVATE KEY-----\nMIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQDeORru44SxQ8ZC\nShx8Xz3SionOj0jrFowMWDwWB6AfBC7NyQ9laPfUwRXT+qFttJBRvc8dPb/KFF62\nc/q8syGGEo/fV+RBSwAQ4H4hJ5sUqfZCH0FdbPLuEoUi970I+PLCtto8+tQ0k5mg\nMbyE2Gjl62CLw7LsqEpfNNPnkvVMeCyaOZ7TmuMjx9Bx9ChnH2PflcYrQvRVMKTc\nd04WCwr7RSEWy9pRRXhSWsLhMlRlhGwLlTjPg6iCOaJn8vjyOMqVw4KigZvOk6FM\n/e7rx39Ijh1X1RV5yTigVC35npjGUbwoorOLONHSNANcaTWBOfVSBlfDg3ulLujq\nd3JuOS9LAgMBAAECggEAQiT3OlHoZicJNSQAFJj4utlXqW8GwkrExsvgnqIIbBL/\np2sINSQoWGBckesQ76mGJ356znZZxtmHU4F0CYS8Hr8Zqd3sZ+7eByf7Av1Z8K2i\nSg4pk5hhOrGyhTT+RFRtVb29edcjIL8qQ/9p4JTVrFICO7e1YzG4aVw9ErmwX+D7\nNO+NdFkNsP4tReMCIm3K12tPgdxh1/Cyrj4FnJmEHs3KjHhNc3miD1cgggV9YFaA\ngKoC2h+fuTrONYWDo2m6SHOUlgRQjI9RdGOfjkYj5bHDjbtulzfl0Rgso87sjRPc\nNTU80g3oxYXEbIrPU/ksspDEPzqs9Yi4CbJWlQRtGQKBgQD3+xr/S9As2wsHSX3j\nDo8x89Vvj5BdB52IEaYNi8bJyc2VN9G5mYv+ih6LqOQbq+PXnpuSa+fXxv9w7/U3\nME/ePAuJyV7O0ZlXEreszTLFXRsjo1Fq7jXeoQu4AzGbShdcf8gYFQduymIw3uLl\nidHYgftVROAmi4dJ68bYnpfzDQKBgQDlaMPokGGNj7KqAIYEz96yOf3ZXlILnME1\nCDnjPK3Iy0nilm6tuCtrhGx1rDZYQAAU4FLveNluopnHbTUVWuYUVdy0SIDSuY0J\nY2cHQw4dx0+8TpI6ofU2hkV8OQUjpftJCKZL8U7WlyJcn8l66MssSebUquDaVx3H\nCtZXIDv1twKBgQC+RCBWuWikwfwYPz8js8wS269rxY9SkcFA4amywwhnUzs1vnpg\nGXvcdUUyiwdaY+yRR9S956UfXkQn9zUCf0MIlLGVqrffn9ozgN0E7PyDigiEs46I\nqPUUOCSxr2GkcJi0FCcGszvcudPVA268B57GrBSXPB1v9aZ8BTewhR65EQKBgD8C\nF0y42xJWdWvb2PNZZIDvDJm3HjGyTB6Us9GFyPVtYE2ro5pzCvns1R08v3Bdo6gY\nNK8xMgcBAduUUxAadzb+ni+l+jvmWqZJdvK3qBjltTCzI9aWxRLErjEAODkiTXIx\nvfr9u/mUaQunl176sVLouU2P4VIWu0b/4v7rC4zhAoGBAIShTleCI61cJln5iuLs\nkcHXDWz9dlMKMFjhcKggNdxorIHk9DQIvHM+B69KbVR5qwl/AVi92uSzmQfvOpxu\nxVFiLkeDHT43zISXdhxD3O/9SiIJiG/l9DwJ4HZPNKm72spfLiWB8vLM5Pp5zYj1\nd85vyO/9Lwpy+Ry18uW5ZqRc\n-----END PRIVATE KEY-----\n",
  "client_email": "firebase-adminsdk-fbsvc@clinicprosystem-e89de.iam.gserviceaccount.com",
  "client_id": "104129070156101481784",
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


// معالجة طلبات OPTIONS (preflight)
app.options('*', cors());

app.use(express.json());

app.post('/api/send-notification', async (req, res) => {
  const { token, title, body } = req.body;
  
  if (!token || !title || !body) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  
  try {
    const response = await fetch('https://fcm.googleapis.com/fcm/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'key=BB-ZGLPdjx1gyNdRE7sRAsjGrfZEZcp1LayZfADTkQg9Z-jVDrxTM_NArb5pkYfsSvl-DVS-86hAC6bI_V8QhUM',
      },
      body: JSON.stringify({
        to: token,
        notification: {
          title: title,
          body: body,
        },
      }),
    });
    
    const result = await response.json();
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
