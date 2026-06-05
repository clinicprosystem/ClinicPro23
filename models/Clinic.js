const mongoose = require('mongoose');

const clinicSchema = new mongoose.Schema({
    name: { type: String, required: true },
    address: String,
    phone: { type: String, required: true, unique: true },
    ownerName: { type: String, required: true },
    
// الاشتراكات
trialEndDate: { type: Date, required: true },
subscriptionEndDate: { type: Date, default: null },
subscriptionType: { type: String, enum: ['trial', 'monthly', 'yearly', 'university_student'], default: 'trial' },  // ✅ أضف هذا
subscriptionStatus: { type: String, enum: ['trial', 'active', 'expired', 'frozen'], default: 'trial' },
isActive: { type: Boolean, default: true },
isFrozen: { type: Boolean, default: false },
    
    // الأطباء
    doctors: [{
        doctorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        name: String,
        phone: String,
        percentage: { type: Number, default: 0 },
        isActive: { type: Boolean, default: true }
    }],
    
    // السكرتيرات
    secretaries: [{
        secretaryId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        name: String,
        phone: String,
        isActive: { type: Boolean, default: true }
    }],
    
    // ✅ الخدمات الرئيسية (جديد)
    mainServices: [{
        name: { type: String, required: true },
        category: { type: String, enum: ['teeth', 'arch'], required: true },
        isActive: { type: Boolean, default: true }
    }],
    
    // ✅ المعالجات الفرعية (جديد)
    subServices: [{
        name: { type: String, required: true },
        price: { type: Number, required: true },
        mainServiceId: { type: mongoose.Schema.Types.ObjectId, required: true },
        isActive: { type: Boolean, default: true }
    }],
    
    // ⚠️ الخدمات القديمة (للتوافق مع الإصدارات السابقة - يمكن حذفها لاحقاً)
    services: [{
        name: String,
        category: String,
        price: Number,
        parentId: { type: mongoose.Schema.Types.ObjectId, default: null },
        isActive: { type: Boolean, default: true }
    }],
    
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Clinic', clinicSchema);
