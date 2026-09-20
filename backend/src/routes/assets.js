const express = require('express');
const pool = require('../db');
const redisClient = require('../redisClient');
const authenticate = require('../middleware/auth');

const router = express.Router();
router.use(authenticate); // every asset route requires a valid JWT

// GET /api/assets - list all assets (cached in Redis for 30s)
router.get('/', async (req, res) => {
  try {
    const cached = await redisClient.get('assets:all');
    if (cached) {
      return res.json({ source: 'cache', data: JSON.parse(cached) });
    }

    const result = await pool.query(
      'SELECT * FROM assets ORDER BY created_at DESC'
    );

    await redisClient.setEx('assets:all', 30, JSON.stringify(result.rows));
    res.json({ source: 'db', data: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch assets' });
  }
});

// POST /api/assets - log a new device
router.post('/', async (req, res) => {
  const { hostname, ram_gb, os, serial_number, assigned_to } = req.body;

  if (!hostname || !serial_number) {
    return res.status(400).json({ error: 'hostname and serial_number are required' });
  }

  try {
    const result = await pool.query(
      `INSERT INTO assets (hostname, ram_gb, os, serial_number, assigned_to)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [hostname, ram_gb, os, serial_number, assigned_to || null]
    );

    await redisClient.del('assets:all'); // invalidate cache
    res.status(201).json({ asset: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create asset' });
  }
});

// PUT /api/assets/:id - update an asset (e.g. reassign to a user)
router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const { hostname, ram_gb, os, serial_number, assigned_to } = req.body;

  try {
    const result = await pool.query(
      `UPDATE assets SET hostname = $1, ram_gb = $2, os = $3, serial_number = $4, assigned_to = $5
       WHERE id = $6 RETURNING *`,
      [hostname, ram_gb, os, serial_number, assigned_to, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Asset not found' });
    }

    await redisClient.del('assets:all');
    res.json({ asset: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update asset' });
  }
});

// DELETE /api/assets/:id
router.delete('/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const result = await pool.query('DELETE FROM assets WHERE id = $1 RETURNING id', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Asset not found' });
    }

    await redisClient.del('assets:all');
    res.json({ message: 'Asset deleted' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete asset' });
  }
});

module.exports = router;
