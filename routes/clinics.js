const express = require('express');
const Patient = require('../models/Patient');
const Treatment = require('../models/Treatment');
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const User = require('../models/User');
const Clinic = require('../models/Clinic');
const { authMiddleware, clinicOwnerOnly } = require('../middleware/auth');
const router = express.Router();

router.use(authMiddleware);
router.use(clinicOwnerOnly);


// ✅ دالة للتحقق من صلاحية الإضافة (للمرضى والمعالجات)
async function canAddData(clinicId) {
    // تحديث حالة الاشتراك أولاً
    await updateSubscriptionStatus(clinicId);
    
    const clinic = await Clinic.findById(clinicId);
    if (!clinic) return false;
    
    const now = new Date();
    
    // إذا كان الحساب موقوف
    if (clinic.isFrozen) return false;
    
    // إذا كانت فترة تجريبية ولم تنته
    if (clinic.subscriptionStatus === 'trial' && clinic.trialEndDate && now < new Date(clinic.trialEndDate)) {
        return true;
    }
    
    // إذا كان اشتراك نشط ولم ينته
    if (clinic.subscriptionStatus === 'active' && clinic.subscriptionEndDate && now < new Date(clinic.subscriptionEndDate)) {
        return true;
    }
    
    return false;
}
// ✅ دالة للتحقق من عدد الأطباء في الفترة التجريبية (حد أقصى 2)
async function canAddDoctorInTrial(clinicId) {
    await updateSubscriptionStatus(clinicId);
    
    const clinic = await Clinic.findById(clinicId);
    if (clinic.subscriptionStatus !== 'trial') return true;
    
    if (clinic.trialEndDate && new Date() > new Date(clinic.trialEndDate)) {
        return false;
    }
    
    const doctorsCount = clinic.doctors?.length || 0;
    return doctorsCount < 2;  // حد أقصى 2 أطباء
}

// ✅ دالة للتحقق من عدد السكرتيرات في الفترة التجريبية (حد أقصى 1)
async function canAddSecretaryInTrial(clinicId) {
    await updateSubscriptionStatus(clinicId);
    
    const clinic = await Clinic.findById(clinicId);
    if (clinic.subscriptionStatus !== 'trial') return true;
    
    if (clinic.trialEndDate && new Date() > new Date(clinic.trialEndDate)) {
        return false;
    }
    
    const secretariesCount = clinic.secretaries?.length || 0;
    return secretariesCount < 1;  // حد أقصى 1 سكرتير
}

// ✅ دالة للتحقق من عدد الخدمات الرئيسية في الفترة التجريبية (حد أقصى 2)
async function canAddMainServiceInTrial(clinicId) {
    await updateSubscriptionStatus(clinicId);
    
    const clinic = await Clinic.findById(clinicId);
    if (clinic.subscriptionStatus !== 'trial') return true;
    
    if (clinic.trialEndDate && new Date() > new Date(clinic.trialEndDate)) {
        return false;
    }
    
    const servicesCount = clinic.mainServices?.length || 0;
    return servicesCount < 2;  // حد أقصى 2 خدمات رئيسية
}

// ✅ دالة للتحقق من عدد المعالجات في الفترة التجريبية
async function canAddTreatmentInTrial(clinicId) {
    // تحديث حالة الاشتراك أولاً
    await updateSubscriptionStatus(clinicId);
    
    const clinic = await Clinic.findById(clinicId);
    if (clinic.subscriptionStatus !== 'trial') return true;
    
    // التحقق من تاريخ انتهاء التجربة
    if (clinic.trialEndDate && new Date() > new Date(clinic.trialEndDate)) {
        return false;
    }
    
    // حساب عدد المعالجات
    const Treatment = require('../models/Treatment');
    const treatmentsCount = await Treatment.countDocuments({ clinicId: clinicId });
    
    return treatmentsCount < 3;  // حد أقصى 3 معالجات
}

// ✅ دالة للتحقق من عدد المرضى في الفترة التجريبية
async function canAddPatientInTrial(clinicId) {
    await updateSubscriptionStatus(clinicId);
    
    const clinic = await Clinic.findById(clinicId);
    if (clinic.subscriptionStatus !== 'trial') return true;
    
    if (clinic.trialEndDate && new Date() > new Date(clinic.trialEndDate)) {
        return false;
    }
    
    const patientsCount = await Patient.countDocuments({ clinicId: clinicId });
    return patientsCount < 3;  // حد أقصى 3 مرضى
}

// ✅ دالة لتحديث حالة الاشتراك تلقائياً
async function updateSubscriptionStatus(clinicId) {
    const clinic = await Clinic.findById(clinicId);
    if (!clinic) return;
    
    const now = new Date();
    
    // إذا كانت فترة تجريبية وانتهت
    if (clinic.subscriptionStatus === 'trial' && clinic.trialEndDate && now > new Date(clinic.trialEndDate)) {
        clinic.subscriptionStatus = 'expired';
        await clinic.save();
        console.log(`⚠️ انتهت الفترة التجريبية للعيادة: ${clinic.name}`);
    }
    
    // إذا كان اشتراك نشط وانتهى
    if (clinic.subscriptionStatus === 'active' && clinic.subscriptionEndDate && now > new Date(clinic.subscriptionEndDate)) {
        clinic.subscriptionStatus = 'expired';
        await clinic.save();
        console.log(`⚠️ انتهى الاشتراك للعيادة: ${clinic.name}`);
    }
    
    return clinic.subscriptionStatus;
}
// ============= الأطباء =============

// جلب الأطباء - فقط لصاحب العيادة
router.get('/doctors', async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    if (user.role !== 'clinic_owner') {
      return res.status(403).json({ error: 'غير مصرح لك' });
    }
    const clinic = await Clinic.findById(req.clinicId);
    res.json({ success: true, doctors: clinic.doctors || [] });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// جلب الخدمات - للجميع (السكرتير يحتاجها لإضافة معالجة)
// ⚠️ مسار الخدمات القديم (للتوافق مع الإصدارات السابقة)
router.get('/services', async (req, res) => {
  try {
    const clinic = await Clinic.findById(req.clinicId);
    // دمج الخدمات القديمة والجديدة للتوافق
    const allServices = [
      ...(clinic.services || []).map(s => ({ ...s.toObject(), isLegacy: true })),
      ...(clinic.mainServices || []).map(s => ({ ...s.toObject(), type: 'main', parentId: null })),
      ...(clinic.subServices || []).map(s => ({ ...s.toObject(), type: 'sub' }))
    ];
    res.json({ success: true, services: allServices });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// إضافة طبيب
router.post('/add-doctor', async (req, res) => {
  try {
    const { name, phone, percentage } = req.body;
    
    const clinic = await Clinic.findById(req.clinicId);
    if (!clinic) {
      return res.status(404).json({ error: 'عيادة غير موجودة' });
    }
    
    // ✅ السماح بتكرار رقم الهاتف (لا تتحقق من uniqueness)
    // (تم إزالة التحقق من وجود الرقم)
    
    // إنشاء حساب مستخدم للطبيب (برقم فريد)
    const tempPassword = Math.random().toString(36).slice(-8);
    const hashedPassword = await bcrypt.hash(tempPassword, 10);
    
    // ✅ إضافة timestamp لجعل رقم الهاتف فريداً في جدول users
    const uniquePhone = phone.startsWith('+') 
        ? `${phone}_doctor_${Date.now()}`
        : `${phone}_doctor_${Date.now()}`;
    
    const doctorUser = new User({
      name: name,
      phone: uniquePhone,  // ✅ رقم فريد في جدول users
      password: hashedPassword,
      role: 'doctor',
      clinicId: req.clinicId
    });
    await doctorUser.save();
    
    // ✅ في قائمة الأطباء، نستخدم الرقم الأصلي (بدون timestamp)
    clinic.doctors.push({
      doctorId: doctorUser._id,
      name: name,
      phone: phone,  // ✅ الرقم الأصلي يظهر في الواجهة
      percentage: percentage || 0,
      isActive: true
    });
    await clinic.save();
    
    res.json({
      success: true,
      doctor: { 
        _id: doctorUser._id, 
        name: name, 
        phone: phone,  // ✅ نرسل الرقم الأصلي
        percentage: percentage || 0 
      },
      tempPassword: tempPassword
    });
    
  } catch (error) {
    console.error('Error adding doctor:', error);
    res.status(500).json({ error: error.message });
  }
});


// إضافة خدمة (تدعم الرئيسية والفرعية)
router.post('/add-service', async (req, res) => {
  try {
    const { name, price, category, parentId } = req.body;
    console.log('📥 استلام:', { name, price, category, parentId });
    
    const clinic = await Clinic.findById(req.clinicId);
    
    // التحقق من عدم وجود خدمة مكررة بنفس الاسم و parentId
    const existingService = clinic.services.find(s => 
      s.name === name && 
      (s.parentId === (parentId || null) || (s.parentId === null && parentId === null))
    );
    
    if (existingService) {
      console.log('⚠️ خدمة مكررة، لن تتم الإضافة');
      return res.status(400).json({ error: 'الخدمة موجودة بالفعل' });
    }
    
    clinic.services.push({
      name,
      price,
      category,
      parentId: parentId || null,
      isActive: true
    });
    
    await clinic.save();
    
    const newService = clinic.services[clinic.services.length - 1];
    console.log('✅ تم الحفظ:', newService);
    
    res.json({ success: true, service: newService });
  } catch (error) {
    console.error('❌ خطأ:', error);
    res.status(500).json({ error: error.message });
  }
});

// تعديل سعر خدمة
router.put('/services/:id/price', async (req, res) => {
  try {
    const { price } = req.body;
    const clinic = await Clinic.findById(req.clinicId);
    const service = clinic.services.id(req.params.id);
    if (service) {
      service.price = price;
      await clinic.save();
    }
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// حذف خدمة
router.delete('/services/:id', async (req, res) => {
  try {
    const clinic = await Clinic.findById(req.clinicId);
    clinic.services = clinic.services.filter(s => s._id.toString() !== req.params.id);
    await clinic.save();
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
// ============= الخدمات الرئيسية (جديد) =============

// جلب الخدمات الرئيسية
router.get('/main-services', async (req, res) => {
  try {
    const clinic = await Clinic.findById(req.clinicId);
    res.json({ success: true, services: clinic.mainServices || [] });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// إضافة خدمة رئيسية
router.post('/main-services', async (req, res) => {
  try {
    const { name, category } = req.body;
    console.log('📥 إضافة خدمة رئيسية:', { name, category });
    
    const clinic = await Clinic.findById(req.clinicId);
    
    // التحقق من عدم وجود خدمة مكررة
    const existingService = clinic.mainServices.find(s => s.name === name);
    if (existingService) {
      return res.status(400).json({ error: 'الخدمة موجودة بالفعل' });
    }
    
    clinic.mainServices.push({
      name,
      category: category || 'teeth',
      isActive: true
    });
    
    await clinic.save();
    const newService = clinic.mainServices[clinic.mainServices.length - 1];
    console.log('✅ تم حفظ الخدمة الرئيسية:', newService);
    
    res.json({ success: true, service: newService });
  } catch (error) {
    console.error('❌ خطأ:', error);
    res.status(500).json({ error: error.message });
  }
});

// حذف خدمة رئيسية (مع حذف معالجاتها الفرعية)
router.delete('/main-services/:id', async (req, res) => {
  try {
    const clinic = await Clinic.findById(req.clinicId);
    
    // حذف الخدمة الرئيسية
    clinic.mainServices = clinic.mainServices.filter(s => s._id.toString() !== req.params.id);
    
    // حذف جميع المعالجات الفرعية المرتبطة بها
    clinic.subServices = clinic.subServices.filter(s => s.mainServiceId.toString() !== req.params.id);
    
    await clinic.save();
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============= المعالجات الفرعية (جديد) =============


// ============= المعالجات الفرعية =============

// إضافة معالجة فرعية
router.post('/sub-services', async (req, res) => {
  try {
    const { name, price, mainServiceId } = req.body;
    console.log('📥 إضافة معالجة فرعية:', { name, price, mainServiceId });
    
    const clinic = await Clinic.findById(req.clinicId);
    if (!clinic) {
      return res.status(404).json({ error: 'عيادة غير موجودة' });
    }
    
    // التحقق من وجود الخدمة الرئيسية
    const mainService = clinic.mainServices.id(mainServiceId);
    if (!mainService) {
      return res.status(400).json({ error: 'الخدمة الرئيسية غير موجودة' });
    }
    
    // التحقق من عدم وجود معالجة مكررة
    const existingService = clinic.subServices.find(s => 
      s.name === name && s.mainServiceId.toString() === mainServiceId
    );
    
    if (existingService) {
      return res.status(400).json({ error: 'المعالجة موجودة بالفعل' });
    }
    
    // إضافة المعالجة الفرعية
    clinic.subServices.push({
      name: name,
      price: price,
      mainServiceId: mainServiceId,
      isActive: true
    });
    
    await clinic.save();
    
    const newService = clinic.subServices[clinic.subServices.length - 1];
    console.log('✅ تم حفظ المعالجة الفرعية:', newService);
    
    res.status(201).json({ 
      success: true, 
      service: {
        _id: newService._id,
        name: newService.name,
        price: newService.price,
        mainServiceId: newService.mainServiceId
      } 
    });
    
  } catch (error) {
    console.error('❌ خطأ في إضافة معالجة فرعية:', error);
    res.status(500).json({ error: error.message });
  }
});

// جلب المعالجات الفرعية
router.get('/sub-services', async (req, res) => {
  try {
    const clinic = await Clinic.findById(req.clinicId);
    res.json({ success: true, services: clinic.subServices || [] });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
// تعديل سعر معالجة فرعية
router.put('/sub-services/:id/price', async (req, res) => {
  try {
    const { price } = req.body;
    const clinic = await Clinic.findById(req.clinicId);
    const service = clinic.subServices.id(req.params.id);
    if (service) {
      service.price = price;
      await clinic.save();
    }
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// حذف معالجة فرعية
router.delete('/sub-services/:id', async (req, res) => {
  try {
    const clinic = await Clinic.findById(req.clinicId);
    clinic.subServices = clinic.subServices.filter(s => s._id.toString() !== req.params.id);
    await clinic.save();
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
// حذف طبيب
router.delete('/doctors/:id', async (req, res) => {
  try {
    const clinic = await Clinic.findById(req.clinicId);
    clinic.doctors = clinic.doctors.filter(d => d.doctorId.toString() !== req.params.id);
    await clinic.save();
    
    // حذف حساب المستخدم أيضاً
    await User.findByIdAndDelete(req.params.id);
    
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// تعديل نسبة الطبيب
router.put('/doctors/:id/percentage', async (req, res) => {
  try {
    const { percentage } = req.body;
    const clinic = await Clinic.findById(req.clinicId);
    const doctor = clinic.doctors.find(d => d.doctorId.toString() === req.params.id);
    if (doctor) {
      doctor.percentage = percentage;
      await clinic.save();
    }
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============= السكرتيرات =============

// جلب السكرتيرات
router.get('/secretaries', async (req, res) => {
  try {
    const users = await User.find({ clinicId: req.clinicId, role: 'secretary' }).select('-password');
    res.json({ success: true, secretaries: users });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// إضافة سكرتير
router.post('/add-secretary', async (req, res) => {
  try {
    const { name, phone, password } = req.body;
    
    // ✅ التحقق من عدم وجود الرقم
    const existingUser = await User.findOne({ phone });
    if (existingUser) {
      return res.status(400).json({ error: 'هذا الرقم مستخدم بالفعل' });
    }
    
    // ✅ جلب العيادة لمعرفة نوع الاشتراك
    const clinic = await Clinic.findById(req.clinicId);
    if (!clinic) {
      return res.status(404).json({ error: 'عيادة غير موجودة' });
    }
    
    // ✅ تشفير كلمة السر
    const hashedPassword = await bcrypt.hash(password, 10);
    
    // ✅ إنشاء حساب سكرتير مع نفس نوع اشتراك العيادة
    const secretary = new User({
      name,
      phone,
      password: hashedPassword,
      role: 'secretary',
      clinicId: req.clinicId,
      subscriptionType: clinic.subscriptionType || 'trial',  // ✅ نفس نوع اشتراك العيادة
      subscriptionStatus: clinic.subscriptionStatus || 'trial',  // ✅ نفس حالة الاشتراك
    });
    await secretary.save();
    
    // ✅ إضافة السكرتير إلى قائمة السكرتيرات في العيادة
    if (clinic) {
      clinic.secretaries.push({
        secretaryId: secretary._id,
        name: name,
        phone: phone,
        isActive: true
      });
      await clinic.save();
    }
    
    res.json({ 
      success: true, 
      secretary: { 
        _id: secretary._id, 
        name: secretary.name, 
        phone: secretary.phone,
        subscriptionType: secretary.subscriptionType  // ✅ إرسال نوع الاشتراك
      },
      tempPassword: password
    });
    
  } catch (error) {
    console.error('Error adding secretary:', error);
    res.status(500).json({ error: error.message });
  }
});

// حذف سكرتير
router.delete('/secretaries/:id', async (req, res) => {
  try {
    await User.findByIdAndDelete(req.params.id);
    
    // حذف من قائمة السكرتيرات في العيادة
    const clinic = await Clinic.findById(req.clinicId);
    if (clinic) {
      clinic.secretaries = clinic.secretaries.filter(s => s.secretaryId.toString() !== req.params.id);
      await clinic.save();
    }
    
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});



// ============= بيانات العيادة =============

// جلب بيانات العيادة كاملة
router.get('/my-clinic', async (req, res) => {
  try {
    const clinic = await Clinic.findById(req.clinicId);
    const users = await User.find({ clinicId: req.clinicId }).select('-password');
    
    res.json({
      success: true,
      clinic,
      users: users.map(u => ({
        id: u._id,
        name: u.name,
        phone: u.phone,
        role: u.role,
        isActive: u.isActive
      }))
    });
    
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// التحقق من صلاحية الاشتراك
// ✅ بدلاً من استخدام authMiddleware و clinicOwnerOnly على كل الملف
// قم بنقل هذا المسار خارج الـ router.use(authMiddleware)

// في بداية الملف (قبل router.use(authMiddleware))
router.get('/subscription/status', authMiddleware, async (req, res) => {
    try {
        const clinic = await Clinic.findById(req.clinicId);
        if (!clinic) {
            return res.status(404).json({ error: 'عيادة غير موجودة' });
        }
        
        const now = new Date();
        let subscriptionType = clinic.subscriptionType || 'trial';
        let subscriptionStatus = clinic.subscriptionStatus || 'trial';
        let canAddData = false;
        let endDate = null;
        let daysLeft = 0;
        let message = '';
        
        if (subscriptionStatus === 'trial' && clinic.trialEndDate) {
            if (now < new Date(clinic.trialEndDate)) {
                canAddData = true;
                endDate = clinic.trialEndDate;
                daysLeft = Math.ceil((new Date(clinic.trialEndDate) - now) / (1000 * 60 * 60 * 24));
                message = `فترة تجريبية، متبقي ${daysLeft} يوم`;
            } else {
                subscriptionStatus = 'expired';
                message = 'انتهت الفترة التجريبية';
            }
        }
        else if (subscriptionStatus === 'active' && clinic.subscriptionEndDate) {
            if (now < new Date(clinic.subscriptionEndDate)) {
                canAddData = true;
                endDate = clinic.subscriptionEndDate;
                daysLeft = Math.ceil((new Date(clinic.subscriptionEndDate) - now) / (1000 * 60 * 60 * 24));
                message = `اشتراك فعال، متبقي ${daysLeft} يوم`;
            } else {
                subscriptionStatus = 'expired';
                message = 'انتهى الاشتراك';
            }
        }
        
        // ✅ إذا كان نوع الاشتراك university_student، فهو فعال
        if (subscriptionType === 'university_student') {
            canAddData = true;
            subscriptionStatus = 'active';
            message = 'باقة طالب جامعي - مفعلة';
        }
        
        if (clinic.isFrozen) {
            canAddData = false;
            message = 'الحساب موقوف مؤقتاً';
        }
        
        res.json({
            success: true,
            subscriptionType: subscriptionType,
            subscriptionStatus: subscriptionStatus,
            canAddData: canAddData,
            endDate: endDate,
            daysLeft: daysLeft,
            message: message
        });
    } catch (error) {
        console.error('Error getting subscription status:', error);
        res.status(500).json({ error: error.message });
    }
});

// ثم بعد ذلك
router.use(authMiddleware);
router.use(clinicOwnerOnly);

// ===================== دوال الإحصائيات والحدود =====================

// ✅ 1. عدد المعالجات
router.get('/treatments/count', async (req, res) => {
    try {
        const Treatment = require('../models/Treatment');
        const count = await Treatment.countDocuments({ clinicId: req.clinicId });
        res.json({ success: true, count: count || 0 });
    } catch (error) {
        console.error('Error getting treatments count:', error);
        res.status(500).json({ error: error.message });
    }
});

// ✅ 2. عدد المرضى
router.get('/patients/count', async (req, res) => {
    try {
        const count = await Patient.countDocuments({ clinicId: req.clinicId });
        res.json({ success: true, count: count || 0 });
    } catch (error) {
        console.error('Error getting patients count:', error);
        res.status(500).json({ error: error.message });
    }
});

// ✅ 3. عدد الأطباء
router.get('/doctors/count', async (req, res) => {
    try {
        const clinic = await Clinic.findById(req.clinicId);
        const count = clinic?.doctors?.length || 0;
        res.json({ success: true, count: count });
    } catch (error) {
        console.error('Error getting doctors count:', error);
        res.status(500).json({ error: error.message });
    }
});

// ✅ 4. عدد السكرتيرات
router.get('/secretaries/count', async (req, res) => {
    try {
        const clinic = await Clinic.findById(req.clinicId);
        const count = clinic?.secretaries?.length || 0;
        res.json({ success: true, count: count });
    } catch (error) {
        console.error('Error getting secretaries count:', error);
        res.status(500).json({ error: error.message });
    }
});

// ✅ 5. عدد الخدمات الرئيسية
router.get('/main-services/count', async (req, res) => {
    try {
        const clinic = await Clinic.findById(req.clinicId);
        const count = clinic?.mainServices?.length || 0;
        res.json({ success: true, count: count });
    } catch (error) {
        console.error('Error getting main services count:', error);
        res.status(500).json({ error: error.message });
    }
});

// ✅ 6. جلب معالجة واحدة
router.get('/treatments/:id', async (req, res) => {
    try {
        const Treatment = require('../models/Treatment');
        const treatment = await Treatment.findOne({
            _id: req.params.id,
            clinicId: req.clinicId
        });
        
        if (!treatment) {
            return res.status(404).json({ error: 'معالجة غير موجودة' });
        }
        
        res.json({ 
            success: true, 
            treatment: {
                id: treatment._id,
                patientId: treatment.patientId,
                patientName: treatment.patientName,
                doctorId: treatment.doctorId,
                doctorName: treatment.doctorName,
                mainServiceId: treatment.mainServiceId,
                mainServiceName: treatment.mainServiceName,
                subServiceId: treatment.subServiceId,
                subServiceName: treatment.subServiceName,
                originalPrice: treatment.originalPrice,
                discount: treatment.discount,
                discountType: treatment.discountType,
                finalPrice: treatment.finalPrice,
                paid: treatment.paid || 0,
                remaining: treatment.remaining || treatment.finalPrice,
                teeth: treatment.teeth,
                numberOfTeeth: treatment.numberOfTeeth,
                archType: treatment.archType,
                jawDetails: treatment.jawDetails,
                notes: treatment.notes,
                date: treatment.date
            }
        });
    } catch (error) {
        console.error('Error getting treatment:', error);
        res.status(500).json({ error: error.message });
    }
});

// ✅ 7. تحديث حالة الاشتراك (مفصل)
router.get('/subscription/status', async (req, res) => {
    try {
        const clinic = await Clinic.findById(req.clinicId);
        if (!clinic) {
            return res.status(404).json({ error: 'عيادة غير موجودة' });
        }
        
        const now = new Date();
        let subscriptionType = clinic.subscriptionType || 'trial';
        let subscriptionStatus = clinic.subscriptionStatus || 'trial';
        let canAddData = false;
        let endDate = null;
        let daysLeft = 0;
        let message = '';
        
        if (subscriptionStatus === 'trial' && clinic.trialEndDate) {
            if (now < new Date(clinic.trialEndDate)) {
                canAddData = true;
                endDate = clinic.trialEndDate;
                daysLeft = Math.ceil((new Date(clinic.trialEndDate) - now) / (1000 * 60 * 60 * 24));
                message = `فترة تجريبية، متبقي ${daysLeft} يوم`;
            } else {
                subscriptionStatus = 'expired';
                message = 'انتهت الفترة التجريبية';
            }
        }
        else if (subscriptionStatus === 'active' && clinic.subscriptionEndDate) {
            if (now < new Date(clinic.subscriptionEndDate)) {
                canAddData = true;
                endDate = clinic.subscriptionEndDate;
                daysLeft = Math.ceil((new Date(clinic.subscriptionEndDate) - now) / (1000 * 60 * 60 * 24));
                message = `اشتراك فعال، متبقي ${daysLeft} يوم`;
            } else {
                subscriptionStatus = 'expired';
                message = 'انتهى الاشتراك';
            }
        }
        
        if (clinic.isFrozen) {
            canAddData = false;
            message = 'الحساب موقوف مؤقتاً';
        }
        
        res.json({
            success: true,
            subscriptionType: subscriptionType,
            subscriptionStatus: subscriptionStatus,
            canAddData: canAddData,
            endDate: endDate,
            daysLeft: daysLeft,
            message: message
        });
    } catch (error) {
        console.error('Error getting subscription status:', error);
        res.status(500).json({ error: error.message });
    }
});

// ✅ 8. التحقق من إمكانية إضافة بيانات
router.get('/subscription/can-add', async (req, res) => {
    try {
        const clinic = await Clinic.findById(req.clinicId);
        if (!clinic) {
            return res.json({ canAdd: false });
        }
        
        const now = new Date();
        let canAdd = false;
        
        if (clinic.subscriptionStatus === 'trial' && clinic.trialEndDate && now < new Date(clinic.trialEndDate)) {
            canAdd = true;
        }
        else if (clinic.subscriptionStatus === 'active' && clinic.subscriptionEndDate && now < new Date(clinic.subscriptionEndDate)) {
            canAdd = true;
        }
        
        if (clinic.isFrozen) {
            canAdd = false;
        }
        
        res.json({ canAdd: canAdd });
    } catch (error) {
        console.error('Error checking can add:', error);
        res.json({ canAdd: false });
    }
});

// ✅ 9. الحصول على نوع الاشتراك الحالي
router.get('/subscription/type', async (req, res) => {
    try {
        const clinic = await Clinic.findById(req.clinicId);
        const subscriptionType = clinic?.subscriptionType || 'trial';
        res.json({ subscriptionType: subscriptionType });
    } catch (error) {
        console.error('Error getting subscription type:', error);
        res.json({ subscriptionType: 'trial' });
    }
});

module.exports = router;
