const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('./User.js');

// --- @route   POST /api/auth/register ---
// --- @desc    Register a new user ---
router.post('/register', async (req, res) => {
    const { fullName, mobileNumber, password, referralCode } = req.body;

    try {
        // 1. Check if user already exists
        let user = await User.findOne({ mobileNumber });
        if (user) {
            return res.status(400).json({ message: 'User with this mobile number already exists.' });
        }

        // 2. Check if referrer exists (if a code is provided)
        if (referralCode && referralCode !== 'ADMIN001') {
            const referrer = await User.findOne({ mobileNumber: referralCode });
            if (!referrer) {
                return res.status(400).json({ message: 'Invalid referral code.' });
            }
        }

        // 3. Create a new user instance
        user = new User({
            fullName,
            mobileNumber,
            password, // The password will be hashed by the pre-save hook in the model
            referrerMobile: referralCode,
        });

        // 4. Save the user to the database
        await user.save();

        res.status(201).json({ message: 'Registration successful!' });

    } catch (error) {
        console.error(error.message);
        res.status(500).send('Server Error');
    }
});

// --- @route   POST /api/auth/login ---
// --- @desc    Authenticate user and get token ---
router.post('/login', async (req, res) => {
    const { mobileNumber, password } = req.body;

    try {
        // 1. Check if user exists
        const user = await User.findOne({ mobileNumber });
        if (!user) {
            return res.status(400).json({ message: 'Invalid credentials.' });
        }

        // 2. Compare the provided password with the hashed password in the database
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(400).json({ message: 'Invalid credentials.' });
        }

        // 3. If credentials are correct, create a JWT payload
        const payload = {
            user: {
                id: user.id, // Mongoose adds an 'id' getter to the schema
            },
        };

        // 4. Sign the token
        jwt.sign(
            payload,
            process.env.JWT_SECRET || 'a-very-secret-key', // Use an environment variable for your secret
            { expiresIn: '7d' }, // Token expires in 7 days
            (err, token) => {
                if (err) throw err;
                // 5. Send the token back to the client
                res.json({ token });
            }
        );

    } catch (error) {
        console.error(error.message);
        res.status(500).send('Server Error');
    }
});

module.exports = router;