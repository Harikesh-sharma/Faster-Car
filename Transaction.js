const mongoose = require('mongoose');

const TransactionSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    type: { type: String, required: true, enum: ['Recharge', 'Withdrawal', 'Purchase', 'Referral Bonus', 'Daily Income'] },
    amount: { type: Number, required: true },
    date: { type: Date, default: Date.now },
    details: {
        carName: { type: String },
        from: { type: String }, // For referral bonus
    }
});

module.exports = mongoose.model('Transaction', TransactionSchema);