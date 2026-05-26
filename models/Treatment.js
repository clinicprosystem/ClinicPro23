const mongoose = require('mongoose');

const treatmentSchema = new mongoose.Schema({
    clinicId: { type: mongoose.Schema.Types.ObjectId, ref: 'Clinic', required: true },
    patientId: { type: mongoose.Schema.Types.ObjectId, ref: 'Patient', required: true },
    
    // الخدمات الرئيسية والفرعية
    mainServiceId: { type: String, default: null },
    mainServiceName: { type: String, default: null },
    subServiceId: { type: String, default: null },
    subServiceName: { type: String, default: null },
    
    // الأطباء
    doctorId: { type: String, default: null },
    doctorName: { type: String, default: null },
    doctorPercentage: { type: Number, default: 0 },
    
    // الأسعار
    originalPrice: { type: Number, required: true },
    discount: { type: Number, default: 0 },
    discountType: { type: String, enum: ['ريال', 'نسبة'], default: 'ريال' },
    finalPrice: { type: Number, required: true },
    
    // تفاصيل الأسنان
    teeth: { type: Array, default: [] },
    numberOfTeeth: { type: Number, default: 0 },
    
    // ✅ تفاصيل الفكين (اجعلها اختيارية بدون enum إلزامي)
    jawDetails: {
        jawType: { type: String, default: null },
        treatmentType: { type: String, default: null }
    },
    
    // ✅ ملاحظات إضافية
    additionalNotes: { type: String, default: null },
    
    // حقول قديمة (اختيارية للتوافق)
    serviceName: { type: String, default: null },
    treatmentType: { type: String, default: null },
    archType: { type: String, default: null },
    subType: { type: String, default: null },
    notes: { type: String, default: null },
    
    sharedToWhatsApp: { type: Boolean, default: false },
    date: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Treatment', treatmentSchema);
