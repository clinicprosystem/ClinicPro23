const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    name: { type: String, required: true },
    phone: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    role: { 
        type: String, 
        enum: ['master_admin', 'clinic_owner', 'doctor', 'secretary', 'university_student'],
        default: 'clinic_owner'
    },
    subscriptionType: { type: String, enum: ['trial', 'monthly', 'yearly', 'university_student'], default: 'trial' },  // ✅ أضف هذا
    clinicId: { type: mongoose.Schema.Types.ObjectId, ref: 'Clinic', default: null },
    isMasterAdmin: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('User', userSchema);
