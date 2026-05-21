const mongoose = require('mongoose');

const clinicSchema = new mongoose.Schema({
    name: { type: String, required: true },
    address: String,
    phone: { type: String, required: true, unique: true },
    ownerName: { type: String, required: true },
    
    // الاشتراكات
    trialEndDate: { type: Date, required: true },
    subscriptionEndDate: { type: Date, default: null },
    subscriptionType: { type: String, enum: ['trial', 'monthly', 'yearly'], default: 'trial' },
    isActive: { type: Boolean, default: true },
    isFrozen: { type: Boolean, default: false },
    
    // الأطباء
    doctors: [{
        doctorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        name: String,
        percentage: Number,
        isActive: { type: Boolean, default: true }
    }],
    
    // الخدمات
    services: [{
        name: String,
        price: Number,
        category: { type: String, enum: ['teeth', 'arch'], default: 'teeth' },
        isActive: { type: Boolean, default: true }
    }],
    
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Clinic', clinicSchema);
