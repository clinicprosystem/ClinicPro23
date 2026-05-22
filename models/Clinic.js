const mongoose = require('mongoose');

const clinicSchema = new mongoose.Schema({
    name: { type: String, required: true },
    address: String,
    phone: { type: String, required: true, unique: true },
    ownerName: { type: String, required: true },
    
    // الاشتراكات
    trialEndDate: { type: Date, required: true },  // تاريخ انتهاء التجربة (بعد 7 أيام)
subscriptionEndDate: { type: Date, default: null },  // تاريخ انتهاء الاشتراك
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
    
    // السكرتيرات (اختياري - للتخزين الإضافي)
    secretaries: [{
        secretaryId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        name: String,
        phone: String,
        isActive: { type: Boolean, default: true }
    }],
    
    // الخدمات
    services: [{
    name: String,        // "حشو", "خلع", "تقويم", "تبييض"
    category: String,    // 'teeth' أو 'arch'
    price: Number,       // السعر الثابت للخدمة
    isActive: { type: Boolean, default: true }
}],
    
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Clinic', clinicSchema);
