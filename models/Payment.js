const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema({
    id: { type: String, required: true },
    treatmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Treatment', required: true },
    clinicId: { type: mongoose.Schema.Types.ObjectId, ref: 'Clinic', required: true },
    amount: { type: Number, required: true, min: 0 },
    type: { type: String, enum: ['payment', 'refund'], required: true },
    note: { type: String, default: '' },
    date: { type: Date, default: Date.now },
    isSynced: { type: Number, default: 1 }
});

module.exports = mongoose.model('Payment', paymentSchema);
