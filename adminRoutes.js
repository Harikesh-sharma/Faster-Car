const express = require('express');
const router = express.Router();
const User = require('./User.js');
const Purchase = require('./Purchase.js');
const Transaction = require('./Transaction.js');

// --- @route   POST /api/admin/clear-all-data ---
// --- @desc    Deletes all data from the main collections for testing purposes ---
// --- @access  Protected by a simple secret key ---
router.post('/clear-all-data', async (req, res) => {
    const { secret } = req.body;

    // IMPORTANT: This is a simple secret for local testing.
    // In a real production app, you would use proper admin roles and authentication.
    if (secret !== 'FASTER_CAR_RESET_2024') {
        return res.status(403).json({ message: 'Forbidden: Invalid secret key.' });
    }

    try {
        await User.deleteMany({});
        await Purchase.deleteMany({});
        await Transaction.deleteMany({});
        res.json({ message: 'All user, purchase, and transaction data has been cleared from the database.' });
    } catch (error) {
        console.error('Error clearing data:', error);
        res.status(500).json({ message: 'Server error while clearing data.' });
    }
});

module.exports = router;