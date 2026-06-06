const mongoose = require('mongoose');

const labOrderSchema = new mongoose.Schema({
    clinicId: { type: mongoose.Schema.Types.ObjectId, ref: 'Clinic', required: true },
    labId: { type: mongoose.Schema.Types.ObjectId, ref: 'Lab', required: true },
    patientId: { type: mongoose.Schema.Types.ObjectId, ref: 'Patient', required: true },
    labName: { type: String, required: true },
    patientName: { type: String, required: true },
    teeth: { type: Array, default: [] },
    workType: { type: String, required: true },
    price: { type: Number, required: true },
    paid: { type: Number, default: 0 },
    remaining: { type: Number, default: 0 },
    notes: { type: String, default: '' },
    status: { type: String, enum: ['pending', 'completed', 'cancelled'], default: 'pending' },
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('LabOrder', labOrderSchema);
