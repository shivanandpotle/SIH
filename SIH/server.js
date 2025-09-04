// server.js (Updated to use environment variables)

require('dotenv').config(); // This must be at the very top to load the .env file
const express = require('express');
const cors = require('cors');
const turf = require('@turf/turf');
const mongoose = require('mongoose');
const path = require('path');

const app = express();

// Use the port from the .env file, or default to 3000 if it's not available
const PORT = process.env.PORT || 3000;

// --- Middleware ---
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// --- MongoDB Connection ---
const MONGO_URI = 'mongodb://127.0.0.1:27017/landMeasurements';

mongoose.connect(MONGO_URI)
  .then(() => console.log('Successfully connected to MongoDB'))
  .catch(err => console.error('MongoDB connection error:', err));

// --- Mongoose Schema and Model ---
const measurementSchema = new mongoose.Schema({
    coordinates: { type: [[[Number]]], required: true },
    areaHectares: { type: Number, required: true },
    perimeterMeters: { type: Number, required: true },
    timestamp: { type: Date, default: Date.now }
});

const Measurement = mongoose.model('Measurement', measurementSchema);

// --- API Endpoints ---
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.post('/api/calculate-area', async (req, res) => {
    const { coordinates } = req.body;
    if (!coordinates || !Array.isArray(coordinates) || coordinates.length < 4) {
        return res.status(400).json({ error: 'Invalid input. A closed polygon needs at least 4 points.' });
    }
    try {
        const polygon = turf.polygon([coordinates]);
        const areaSquareMeters = turf.area(polygon);
        const areaHectares = areaSquareMeters / 10000;
        const perimeterMeters = turf.length(polygon, { units: 'meters' });
        
        const newMeasurement = new Measurement({
            coordinates: [coordinates],
            areaHectares,
            perimeterMeters
        });
        await newMeasurement.save();
        res.json({ areaHectares, perimeterMeters });
    } catch (error) {
        console.error('Calculation Error:', error);
        res.status(500).json({ error: 'An error occurred during calculation.' });
    }
});

app.get('/api/history', async (req, res) => {
    try {
        const measurements = await Measurement.find().sort({ timestamp: -1 }).limit(10);
        res.json(measurements);
    } catch (error) {
        console.error('History Fetch Error:', error);
        res.status(500).json({ error: 'Failed to fetch history.' });
    }
});

// --- Start Server ---
app.listen(PORT, () => {
    console.log(`Server is running at http://localhost:${PORT}`);
});
