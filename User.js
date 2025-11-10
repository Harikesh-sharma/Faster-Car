const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const UserSchema = new mongoose.Schema({
    fullName: { type: String, required: true },
    mobileNumber: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    withdrawalPassword: { type: String }, // Can be added later
    referrerMobile: { type: String },
    balance: { type: Number, default: 0 },
    earnings: { type: Number, default: 0 },
    bankDetails: {
        account: { type: String },
        ifsc: { type: String },
    },
    createdAt: { type: Date, default: Date.now },
    lastIncomeCollection: { type: Date },
});

// --- Mongoose Middleware to Hash Password Before Saving ---
// This 'pre-save' hook runs automatically before a user document is saved.
UserSchema.pre('save', async function (next) {
    // Only hash the password if it has been modified (or is new)
    if (!this.isModified('password')) {
        return next();
    }
    // Generate a salt and hash the password
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
});

module.exports = mongoose.model('User', UserSchema);