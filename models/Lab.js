const mongoose = require('mongoose');

const labSchema = new mongoose.Schema({
    clinicId: { type: mongoose.Schema.Types.ObjectId, ref: 'Clinic', required: true },
    name: { type: String, required: true },
    phone: { type: String, required: true },
    address: String,
    notes: String,
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Lab', labSchema);
