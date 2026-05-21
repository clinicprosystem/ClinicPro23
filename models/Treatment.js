const mongoose = require('mongoose');

const treatmentSchema = new mongoose.Schema({
    clinicId: { type: mongoose.Schema.Types.ObjectId, ref: 'Clinic', required: true },
    patientId: { type: mongoose.Schema.Types.ObjectId, ref: 'Patient', required: true },
    doctorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    
    patientName: String,
    doctorName: String,
    doctorPercentage: Number,
    
    serviceName: String,
    originalPrice: Number,
    discount: { type: Number, default: 0 },
    finalPrice: Number,
    
    treatmentType: { type: String, required: true }, // 'حشو', 'عصب', 'خلع', 'تقويم', 'تبييض'...
    
    // للمعالجات التي تحتاج أسنان (حشو، عصب، خلع، تلبيس)
    teeth: [{
        jaw: { type: String, enum: ['علوي', 'سفلي'] },
        side: { type: String, enum: ['يمين', 'يسار', 'أمامي'] },
        number: { type: Number, min: 1, max: 8 }
    }],
    
    // للمعالجات التي تحتاج فكين (تقويم، طقم، تبييض، تصفية)
    archType: { type: String, enum: ['علوي', 'سفلي', 'الفكين معاً'], default: null },
    subType: String,
    
    notes: String,
    sharedToWhatsApp: { type: Boolean, default: false },
    date: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Treatment', treatmentSchema);
