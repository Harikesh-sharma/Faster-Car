const express = require('express');
const router = express.Router();
const Razorpay = require('razorpay');
const crypto = require('crypto');
const auth = require('./authMiddleware.js');
const User = require('./User.js');
const Transaction = require('./Transaction.js');

// Initialize Razorpay instance
// IMPORTANT: Replace these with your actual Key ID and Key Secret from the Razorpay dashboard
// It's best practice to store these in environment variables (.env file)
const razorpayInstance = new Razorpay({
    key_id: 'rzp_test_R9gu7rbC2p8saU', // Replace with your actual Key ID
    key_secret: 'jnAvO1J3CbF3ZCACmxR1bNtP' // <-- IMPORTANT: Replace this with your actual Key Secret from Razorpay
});

// --- @route   POST /api/payment/create-order ---
// --- @desc    Create a Razorpay order ---
router.post('/create-order', auth, async (req, res) => {
    const { amount } = req.body;

    if (!amount || amount <= 0) {
        return res.status(400).json({ message: 'Invalid amount.' });
    }

    const options = {
        amount: Number(amount) * 100, // Amount in the smallest currency unit (paise for INR)
        currency: 'INR',
        receipt: `receipt_order_${new Date().getTime()}`
    };

    try {
        const order = await razorpayInstance.orders.create(options);
        res.json(order);
    } catch (error) {
        console.error('Razorpay order creation error:', error);
        res.status(500).send('Error creating payment order.');
    }
});

// --- @route   POST /api/payment/verify-payment ---
// --- @desc    Verify the payment and update user balance ---
router.post('/verify-payment', auth, async (req, res) => {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, amount } = req.body;

    try {
        // 1. Verify the signature
        const hmac = crypto.createHmac('sha256', 'jnAvO1J3CbF3ZCACmxR1bNtP'); // Use the same secret key as the instance
        hmac.update(razorpay_order_id + "|" + razorpay_payment_id);
        const generated_signature = hmac.digest('hex');

        if (generated_signature !== razorpay_signature) {
            return res.status(400).json({ message: 'Payment verification failed. Invalid signature.' });
        }

        // 2. Signature is valid, now update the user's balance (this is the recharge logic)
        const user = await User.findById(req.user.id);
        user.balance += Number(amount);

        const newTransaction = new Transaction({
            user: user.id,
            type: 'Recharge',
            amount: Number(amount),
            details: { paymentId: razorpay_payment_id }
        });

        // You can also add your referral bonus logic here if needed

        await user.save();
        await newTransaction.save();

        res.json({
            message: 'Payment verified successfully and balance updated.',
            newBalance: user.balance
        });

    } catch (error) {
        console.error('Payment verification error:', error);
        res.status(500).send('Server Error');
    }
});

module.exports = router;