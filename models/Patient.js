const mongoose = require('mongoose');

const patientSchema = new mongoose.Schema({
    // ===== الحقول الموجودة =====
    clinicId: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'Clinic', 
        required: false
    },
    name: { 
        type: String, 
        required: true 
    },
    phone: { 
        type: String, 
        required: true,
        unique: false
    },
    age: Number,
    gender: { 
        type: String, 
        enum: ['ذكر', 'أنثى', 'غير محدد'],
        default: 'غير محدد'
    },
    medicalHistory: String,
    notes: String,
    createdAt: { 
        type: Date, 
        default: Date.now 
    },
    
    // ===== الحقول الجديدة للمرضى العامين =====
    address: {
        type: String,
        trim: true,
        default: ''
    },
    description: {
        type: String,
        trim: true,
        default: '',
        maxlength: [500, 'الوصف لا يتجاوز 500 حرف']
    },
    willPay: {
        type: Boolean,
        default: true
    },
    isBooked: {
        type: Boolean,
        default: false
    },
    isHidden: {                    // ✅ حقل جديد: إخفاء البيانات
        type: Boolean,
        default: false
    },
    registeredBy: {
        type: String,
        enum: ['public', 'university_student', 'clinic_owner', 'secretary', 'doctor'],
        default: 'public'
    },
    bookingUpdatedAt: {
        type: Date,
        default: null
    },
    
    // ===== حقل للتمييز بين مرضى العيادة والمرضى العامين =====
    isPublic: {
        type: Boolean,
        default: false
    }
}, {
    timestamps: true
});

// ✅ إضافة فهارس للبحث السريع
patientSchema.index({ clinicId: 1, phone: 1 });
patientSchema.index({ isBooked: 1 });
patientSchema.index({ isHidden: 1 });      // ✅ فهرس جديد
patientSchema.index({ isPublic: 1 });
patientSchema.index({ createdAt: -1 });

// ✅ دالة لجلب مرضى العيادة فقط
patientSchema.statics.getClinicPatients = function(clinicId) {
    return this.find({ 
        clinicId: clinicId,
        isPublic: { $ne: true }
    }).sort({ createdAt: -1 });
};

// ✅ دالة لجلب المرضى العامين (بدون عيادة)
patientSchema.statics.getPublicPatients = function() {
    return this.find({ 
        isPublic: true 
    }).sort({ createdAt: -1 });
};

// ✅ دالة لتحديث حالة الحجز
patientSchema.methods.toggleBooking = function() {
    this.isBooked = !this.isBooked;
    this.bookingUpdatedAt = new Date();
    return this.save();
};

// ✅ دالة لتحديث حالة الإخفاء
patientSchema.methods.toggleHide = function() {
    this.isHidden = !this.isHidden;
    return this.save();
};

// ✅ دالة لجلب المرضى غير المحجوزين
patientSchema.statics.getPendingPatients = function(clinicId = null) {
    const query = { isBooked: false };
    if (clinicId) query.clinicId = clinicId;
    return this.find(query).sort({ createdAt: -1 });
};

// ✅ دالة لجلب المرضى المحجوزين
patientSchema.statics.getBookedPatients = function(clinicId = null) {
    const query = { isBooked: true };
    if (clinicId) query.clinicId = clinicId;
    return this.find(query).sort({ createdAt: -1 });
};

// ✅ دالة لإحصائيات المرضى
patientSchema.statics.getStats = async function(clinicId = null) {
    const query = clinicId ? { clinicId } : {};
    
    const [total, booked, pending, today, hidden] = await Promise.all([
        this.countDocuments(query),
        this.countDocuments({ ...query, isBooked: true }),
        this.countDocuments({ ...query, isBooked: false }),
        this.countDocuments({
            ...query,
            createdAt: {
                $gte: new Date(new Date().setHours(0, 0, 0, 0)),
                $lt: new Date(new Date().setHours(23, 59, 59, 999))
            }
        }),
        this.countDocuments({ ...query, isHidden: true })  // ✅ إحصائيات المخفيين
    ]);
    
    return { total, booked, pending, today, hidden };
};

module.exports = mongoose.model('Patient', patientSchema);
