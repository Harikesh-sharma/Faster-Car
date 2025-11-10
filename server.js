const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const app = express();

// --- Middleware ---
// Enable Cross-Origin Resource Sharing so your frontend can talk to this backend
app.use(cors());
// Allow the server to accept JSON in request bodies
app.use(express.json());

// --- Database Connection ---
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/faster_car';

mongoose.connect(MONGO_URI)
    .then(() => console.log('MongoDB connected successfully.'))
    .catch(err => console.error('MongoDB connection error:', err));

// --- API Routes ---
app.get('/', (req, res) => {
    res.send('Faster Car API is running!');
});

// Use the authentication routes for /api/auth
app.use('/api/auth', require('./auth.js'));
app.use('/api/user', require('./userRoutes.js'));
app.use('/api/cars', require('./cars.js'));
app.use('/api/admin', require('./adminRoutes.js'));
app.use('/api/payment', require('./paymentRoutes.js'));


// --- Start the Server ---
const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});