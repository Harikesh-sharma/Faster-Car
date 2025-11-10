const express = require('express');
const router = express.Router();
const auth = require('./authMiddleware.js');
const User = require('./User.js');
const Purchase = require('./Purchase.js');
const Transaction = require('./Transaction.js');

// Hardcoded car data for validation on the server
const carStoreData = {
    "Daily profit car #1": { price: 275, daily: 55, cycle: 365 },
    "Daily profit car #2": { price: 499, daily: 110, cycle: 365 },
    "Daily profit car #3": { price: 2800, daily: 145, cycle: 365 },
    "Daily profit car #4": { price: 7800, daily: 1100, cycle: 365 },
    "Daily profit car #5": { price: 111000, daily: 2400, cycle: 365 },
};

// --- @route   POST /api/cars/purchase ---
// --- @desc    Purchase a car for the logged-in user ---
// --- @access  Private ---
router.post('/purchase', auth, async (req, res) => {
    const { carName } = req.body;

    try {
        // 1. Validate car data on the server
        const carData = carStoreData[carName];
        if (!carData) {
            return res.status(400).json({ message: 'Invalid car selected.' });
        }

        // 2. Get user and check for duplicate purchase
        const user = await User.findById(req.user.id);
        const existingPurchase = await Purchase.findOne({ user: req.user.id, carName: carName });

        if (existingPurchase) {
            return res.status(400).json({ message: 'You have already purchased this car.' });
        }

        // 3. Check if user has sufficient balance
        if (user.balance < carData.price) {
            return res.status(400).json({ message: 'Insufficient balance.' });
        }

        // 4. All checks passed, proceed with purchase
        // Deduct balance
        user.balance -= carData.price;

        // Create new Purchase document
        const expirationDate = new Date();
        expirationDate.setDate(expirationDate.getDate() + carData.cycle);

        const newPurchase = new Purchase({
            user: req.user.id,
            carName: carName,
            price: carData.price,
            cycleDays: carData.cycle,
            dailyIncome: carData.daily,
            expiresAt: expirationDate,
        });

        // Create new Transaction document
        const newTransaction = new Transaction({
            user: req.user.id,
            type: 'Purchase',
            amount: carData.price,
            details: { carName: carName },
        });

        // 5. Save all changes to the database
        await user.save();
        await newPurchase.save();
        await newTransaction.save();

        res.json({ message: 'Purchase successful!' });
    } catch (error) {
        console.error(error.message);
        res.status(500).send('Server Error');
    }
});

module.exports = router;