require('dotenv').config();
const express = require('express');
const cors = require('cors');
const pool = require('./src/db');
const redisClient = require('./src/redisClient');

const authRoutes = require('./src/routes/auth');
const assetRoutes = require('./src/routes/assets');
const ticketRoutes = require('./src/routes/tickets');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// Health check endpoint - used by docker-compose healthcheck
app.get('/api/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    await redisClient.ping();
    res.json({ status: 'ok', db: 'connected', redis: 'connected' });
  } catch (err) {
    res.status(503).json({ status: 'error', message: err.message });
  }
});

app.use('/api/auth', authRoutes);
app.use('/api/assets', assetRoutes);
app.use('/api/tickets', ticketRoutes);

app.listen(PORT, () => {
  console.log(`Backend API listening on port ${PORT}`);
});