require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const apiRoutes = require('../src/routes/api');
const webhookRoutes = require('../src/routes/webhook');

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// API Routes
app.use('/api', apiRoutes);
app.use('/api/line', webhookRoutes);

// Export for Vercel Serverless Function
module.exports = app;
