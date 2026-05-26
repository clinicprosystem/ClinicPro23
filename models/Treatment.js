const mongoose = require('mongoose');

const treatmentSchema = new mongoose.Schema({
    clinicId: { type: mongoose.Schema.Types.ObjectId, ref: 'Clinic', required: true },
    patientId: { type: mongoose.Schema.Types.ObjectId, ref: 'Patient', required: true },
    
    // الخدمات الرئيسية والفرعية
    mainServiceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Clinic.mainServices', default: null },
    mainServiceName: { type: String, default: null },
    subServiceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Clinic.subServices', default: null },
    subServiceName: { type: String, default: null },
    
    // الأطباء
    doctorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    doctorName: { type: String, default: null },
    doctorPercentage: { type: Number, default: 0 },
    
    // الأسعار
    originalPrice: { type: Number, required: true },
    discount: { type: Number, default: 0 },
    discountType: { type: String, enum: ['ريال', 'نسبة'], default: 'ريال' },
    finalPrice: { type: Number, required: true },
    
    // ✅ تفاصيل الأسنان
    teeth: [{
        jaw: { type: String, enum: ['علوي', 'سفلي'], default: null },
        side: { type: String, enum: ['يمين', 'يسار', 'وسط'], default: null },
        number: { type: Number, min: 1, max: 8, default: null }
    }],
    
    // ✅ عدد الأسنان (مضاف)
    numberOfTeeth: { type: Number, default: 0 },
    
    // ✅ تفاصيل الفكين
    jawDetails: {
        jawType: { type: String, enum: ['علوي', 'سفلي', 'كلا الفكين'], default: null },
        treatmentType: { type: String, default: null }
    },
    
    // ✅ تفاصيل إضافية (مضافة)
    additionalNotes: { type: String, default: null },
    
    // حقول قديمة (للتوافق)
    serviceName: { type: String, default: null },
    treatmentType: { type: String, default: null },
    archType: { type: String, enum: ['علوي', 'سفلي', 'الفكين معاً'], default: null },
    subType: { type: String, default: null },
    notes: { type: String, default: null },
    
    sharedToWhatsApp: { type: Boolean, default: false },
    date: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Treatment', treatmentSchema);
