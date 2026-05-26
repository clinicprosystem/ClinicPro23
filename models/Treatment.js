const mongoose = require('mongoose');

const treatmentSchema = new mongoose.Schema({
    clinicId: { type: mongoose.Schema.Types.ObjectId, ref: 'Clinic', required: true },
    patientId: { type: mongoose.Schema.Types.ObjectId, ref: 'Patient', required: true },
    
    // ✅ الخدمات الرئيسية والفرعية (جديد)
    mainServiceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Clinic.mainServices', default: null },
    mainServiceName: String,
    subServiceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Clinic.subServices', default: null },
    subServiceName: String,
    
    // ⚠️ للتوافق مع الإصدارات القديمة
    doctorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    doctorName: String,
    doctorPercentage: { type: Number, default: 0 },
    serviceName: String,
    treatmentType: String,
    
    // الأسعار
    originalPrice: { type: Number, required: true },
    discount: { type: Number, default: 0 },
    discountType: { type: String, enum: ['ريال', 'نسبة'], default: 'ريال' },
    finalPrice: { type: Number, required: true },
    
    // ✅ تفاصيل الأسنان (جديد - كـ JSON كامل)
    teeth: [{
        jaw: { type: String, enum: ['علوي', 'سفلي'] },
        side: { type: String, enum: ['يمين', 'يسار', 'وسط'] },
        number: { type: Number, min: 1, max: 8 }
    }],
    
    // ✅ تفاصيل الفكين (جديد - كـ JSON كامل)
    jawDetails: {
        jawType: { type: String, enum: ['علوي', 'سفلي', 'كلا الفكين'], default: null },
        treatmentType: String
    },
    
    // ⚠️ حقول قديمة (للتوافق - يمكن حذفها لاحقاً)
    archType: { type: String, enum: ['علوي', 'سفلي', 'الفكين معاً'], default: null },
    subType: String,
    
    notes: String,
    sharedToWhatsApp: { type: Boolean, default: false },
    date: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Treatment', treatmentSchema);
