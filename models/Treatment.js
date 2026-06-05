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
    
    // ✅ المدفوعات (أضف هذه الحقول)
    paid: { type: Number, default: 0, min: 0 },
    remaining: { type: Number, default: 0, min: 0 },
    
    // تفاصيل الأسنان
    teeth: { type: Array, default: [] },
    numberOfTeeth: { type: Number, default: 0 },
    
    jawDetails: {
        jawType: { type: String, default: null },
        treatmentType: { type: String, default: null }
    },
    
    additionalNotes: { type: String, default: null },
    
    serviceName: { type: String, default: null },
    treatmentType: { type: String, default: null },
    archType: { type: String, default: null },
    subType: { type: String, default: null },
    notes: { type: String, default: null },
    
    sharedToWhatsApp: { type: Boolean, default: false },
    date: { type: Date, default: Date.now }
});

// ✅ تحويل patientId من String إلى ObjectId عند الاستعلام
treatmentSchema.statics.findByPatientId = function(patientId) {
    const ObjectId = mongoose.Types.ObjectId;
    const id = patientId instanceof ObjectId ? patientId : new ObjectId(patientId);
    return this.find({ patientId: id });
};

module.exports = mongoose.model('Treatment', treatmentSchema);
