const mongoose = require('mongoose');

const PurchaseSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    carName: { type: String, required: true },
    price: { type: Number, required: true },
    purchaseDate: { type: Date, default: Date.now },
    cycleDays: { type: Number, required: true },
    dailyIncome: { type: Number, required: true },
    expiresAt: { type: Date, required: true },
});

module.exports = mongoose.model('Purchase', PurchaseSchema);