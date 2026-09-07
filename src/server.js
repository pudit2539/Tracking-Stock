require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const apiRoutes = require('./routes/api');
const webhookRoutes = require('./routes/webhook');
const cronService = require('./services/cronService');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static frontend assets
app.use(express.static(path.join(__dirname, '../public')));

// API Routes
app.use('/api', apiRoutes);
app.use('/api/line', webhookRoutes);

// Fallback to index.html for SPA-like navigation
app.use((req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// Start server
app.listen(PORT, () => {
  console.log('====================================================');
  console.log(`🚀 Expiration & Stock Tracking System is running!`);
  console.log(`🌐 Local Web URL: http://localhost:${PORT}`);
  console.log('====================================================');

  // Initialize automated daily cron scheduler
  cronService.setupCron();
});
