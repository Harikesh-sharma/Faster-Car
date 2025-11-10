const express = require('express');
const router = express.Router();
const auth = require('./authMiddleware.js');
const bcrypt = require('bcryptjs');
const User = require('./User.js'); // This now correctly refers to the User model file
const Purchase = require('./Purchase.js');
const Transaction = require('./Transaction.js');

// --- @route   GET /api/user/data ---
// --- @desc    Get all data for the logged-in user (for dashboard/profile) ---
// --- @access  Private ---
router.get('/data', auth, async (req, res) => {
    try {
        // 1. Fetch user data, excluding the password
        const user = await User.findById(req.user.id).select('-password');
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // 2. Fetch user's purchased cars
        const purchases = await Purchase.find({ user: req.user.id }).sort({ purchaseDate: -1 });
        // 2.5 Fetch user's transactions
        const transactions = await Transaction.find({ user: req.user.id }).sort({ date: -1 });

        // 3. Send all data back to the client
        res.json({
            user,
            purchases,
            transactions,
        });

    } catch (error) {
        console.error(error.message);
        res.status(500).send('Server Error');
    }
});

// --- @route   POST /api/user/collect-income ---
// --- @desc    Calculate and add daily income for the user ---
// --- @access  Private ---
router.post('/collect-income', auth, async (req, res) => {
    try {
        const user = await User.findById(req.user.id);
        const purchases = await Purchase.find({ user: req.user.id });

        const today = new Date();
        today.setHours(0, 0, 0, 0); // Normalize to midnight

        // Use the user's last collection date, or yesterday if they've never collected
        let lastCollectionDate = user.lastIncomeCollection || new Date(today.getTime() - (24 * 60 * 60 * 1000));
        lastCollectionDate.setHours(0, 0, 0, 0);

        const timeDiff = today.getTime() - lastCollectionDate.getTime();
        const daysToCollect = Math.floor(timeDiff / (1000 * 3600 * 24));

        if (daysToCollect <= 0) {
            return res.json({ message: 'No income to collect today.' });
        }

        let totalIncomeToCollect = 0;
        const now = new Date();

        purchases.forEach(purchase => {
            // Only add income for active (non-expired) cars
            if (now < purchase.expiresAt) {
                totalIncomeToCollect += purchase.dailyIncome;
            }
        });

        totalIncomeToCollect *= daysToCollect;

        if (totalIncomeToCollect > 0) {
            user.balance += totalIncomeToCollect;
            user.earnings += totalIncomeToCollect;
            user.lastIncomeCollection = today;
            await user.save();
        }

        res.json({ message: `Collected ₹${totalIncomeToCollect.toFixed(2)}`, collectedAmount: totalIncomeToCollect });
    } catch (error) {
        console.error(error.message);
        res.status(500).send('Server Error');
    }
});


// --- @route   POST /api/user/recharge ---
// --- @desc    Recharge the user's account and handle referral bonus ---
// --- @access  Private ---
router.post('/recharge', auth, async (req, res) => {
    const { amount } = req.body;

    if (!amount || amount <= 0) {
        return res.status(400).json({ message: 'Invalid recharge amount.' });
    }

    try {
        const user = await User.findById(req.user.id);

        // 1. Update the user's balance
        user.balance += amount;

        // 2. Create a transaction record for the user
        const userTransaction = new Transaction({
            user: user.id,
            type: 'Recharge',
            amount: amount,
        });

        // 3. Handle Referral Bonus Logic
        if (user.referrerMobile) {
            const referrer = await User.findOne({ mobileNumber: user.referrerMobile });
            if (referrer) {
                let bonusPercentage = 0;
                if (amount >= 7800) bonusPercentage = 0.10;
                else if (amount >= 2800) bonusPercentage = 0.07;
                else if (amount >= 275) bonusPercentage = 0.05;

                const bonusAmount = amount * bonusPercentage;

                if (bonusAmount > 0) {
                    referrer.balance += bonusAmount;
                    referrer.earnings += bonusAmount;

                    const referrerTransaction = new Transaction({
                        user: referrer.id,
                        type: 'Referral Bonus',
                        amount: bonusAmount,
                        details: { from: user.fullName || user.mobileNumber },
                    });
                    await referrerTransaction.save();
                    await referrer.save();
                }
            }
        }

        await user.save();
        await userTransaction.save();

        res.json({ message: 'Recharge successful!', newBalance: user.balance });
    } catch (error) {
        console.error(error.message);
        res.status(500).send('Server Error');
    }
});


// --- @route   POST /api/user/settings ---
// --- @desc    Update user bank details and passwords ---
// --- @access  Private ---
router.post('/settings', auth, async (req, res) => {
    const {
        accountNumber,
        ifscCode,
        currentLoginPassword,
        newLoginPassword,
        loginPwForWithdrawal,
        newWithdrawalPassword
    } = req.body;

    try {
        const user = await User.findById(req.user.id);

        // --- Update Bank Details ---
        if (accountNumber && ifscCode) {
            user.bankDetails = { account: accountNumber, ifsc: ifscCode };
            await user.save();
            return res.json({ message: 'Bank details updated successfully.' });
        }

        // --- Update Login Password ---
        if (currentLoginPassword && newLoginPassword) {
            const isMatch = await bcrypt.compare(currentLoginPassword, user.password);
            if (!isMatch) {
                return res.status(400).json({ message: 'Current login password is incorrect.' });
            }
            user.password = newLoginPassword; // The pre-save hook will hash it
            await user.save();
            return res.json({ message: 'Login password updated successfully.' });
        }

        // --- Update Withdrawal Password ---
        if (loginPwForWithdrawal && newWithdrawalPassword) {
            const isMatch = await bcrypt.compare(loginPwForWithdrawal, user.password);
            if (!isMatch) {
                return res.status(400).json({ message: 'Incorrect login password for authorization.' });
            }
            // In a real app, this should also be hashed. Storing as plain text for simplicity based on original design.
            user.withdrawalPassword = newWithdrawalPassword;
            await user.save();
            return res.json({ message: 'Withdrawal password updated successfully.' });
        }

        res.status(400).json({ message: 'Invalid request.' });

    } catch (error) {
        console.error(error.message);
        res.status(500).send('Server Error');
    }
});


// --- @route   POST /api/user/withdraw ---
// --- @desc    Process a withdrawal request ---
// --- @access  Private ---
router.post('/withdraw', auth, async (req, res) => {
    const { amount, password } = req.body;

    try {
        const user = await User.findById(req.user.id);

        if (!user.withdrawalPassword) {
            return res.status(400).json({ message: 'You have not set a withdrawal password. Please set one in Bank Settings.' });
        }
        if (user.withdrawalPassword !== password) {
            return res.status(400).json({ message: 'Incorrect withdrawal password.' });
        }
        if (!amount || amount <= 0 || amount > user.earnings) {
            return res.status(400).json({ message: 'Invalid withdrawal amount or insufficient earnings.' });
        }
        if (amount < 220) {
            return res.status(400).json({ message: 'Minimum withdrawal amount is ₹220.' });
        }

        // All checks passed
        user.balance -= amount;
        user.earnings -= amount;

        const newTransaction = new Transaction({
            user: user.id,
            type: 'Withdrawal',
            amount: amount,
            details: { account: user.bankDetails.account, ifsc: user.bankDetails.ifsc }
        });

        await user.save();
        await newTransaction.save();

        res.json({ message: 'Withdrawal request submitted successfully!', newBalance: user.balance, newEarnings: user.earnings });

    } catch (error) {
        console.error(error.message);
        res.status(500).send('Server Error');
    }
});

// --- @route   GET /api/user/team ---
// --- @desc    Get the user's referral team ---
// --- @access  Private ---
router.get('/team', auth, async (req, res) => {
    try {
        const user = await User.findById(req.user.id);
        const team = await User.find({ referrerMobile: user.mobileNumber }).select('fullName createdAt');
        res.json(team);
    } catch (error) {
        console.error(error.message);
        res.status(500).send('Server Error');
    }
});

module.exports = router;