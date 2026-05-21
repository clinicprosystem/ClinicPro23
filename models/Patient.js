const mongoose = require('mongoose');

const patientSchema = new mongoose.Schema({
    clinicId: { type: mongoose.Schema.Types.ObjectId, ref: 'Clinic', required: true },
    name: { type: String, required: true },
    phone: { type: String, required: true },
    age: Number,
    gender: { type: String, enum: ['ذكر', 'أنثى'] },
    medicalHistory: String,
    notes: String,
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Patient', patientSchema);
