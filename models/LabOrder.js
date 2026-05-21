const mongoose = require('mongoose');

const labOrderSchema = new mongoose.Schema({
    clinicId: { type: mongoose.Schema.Types.ObjectId, ref: 'Clinic', required: true },
    labId: { type: mongoose.Schema.Types.ObjectId, ref: 'Lab', required: true },
    patientId: { type: mongoose.Schema.Types.ObjectId, ref: 'Patient', required: true },
    
    labName: String,
    patientName: String,
    
    // تفاصيل الطلبية
    jaw: { type: String, enum: ['علوي', 'سفلي'], required: true },
    toothNumber: { type: Number, min: 1, max: 8 },
    workType: String, // 'تيجان', 'جسور', 'متحركات'...
    
    price: Number,
    paid: { type: Number, default: 0 },
    remaining: Number,
    
    status: { type: String, enum: ['pending', 'in_progress', 'completed', 'delivered'], default: 'pending' },
    notes: String,
    sharedToWhatsApp: { type: Boolean, default: false },
    createdAt: { type: Date, default: Date.now }
});

// قبل الحفظ، نحسب المتبقي تلقائياً
labOrderSchema.pre('save', function(next) {
    this.remaining = this.price - this.paid;
    next();
});

module.exports = mongoose.model('LabOrder', labOrderSchema);
