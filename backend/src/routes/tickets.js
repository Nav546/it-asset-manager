const express = require('express');
const pool = require('../db');
const authenticate = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

// GET /api/tickets - list all tickets, optionally filter by status
router.get('/', async (req, res) => {
  const { status } = req.query;

  try {
    const result = status
      ? await pool.query('SELECT * FROM tickets WHERE status = $1 ORDER BY created_at DESC', [status])
      : await pool.query('SELECT * FROM tickets ORDER BY created_at DESC');

    res.json({ data: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch tickets' });
  }
});

// POST /api/tickets - create a new incident ticket
router.post('/', async (req, res) => {
  const { title, description, priority, asset_id } = req.body;

  if (!title) {
    return res.status(400).json({ error: 'title is required' });
  }

  try {
    const result = await pool.query(
      `INSERT INTO tickets (title, description, priority, status, asset_id, created_by)
       VALUES ($1, $2, $3, 'open', $4, $5) RETURNING *`,
      [title, description || null, priority || 'medium', asset_id || null, req.user.id]
    );

    res.status(201).json({ ticket: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create ticket' });
  }
});

// PUT /api/tickets/:id - update ticket status / details
router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const { title, description, priority, status } = req.body;

  const validStatuses = ['open', 'in_progress', 'resolved', 'closed'];
  if (status && !validStatuses.includes(status)) {
    return res.status(400).json({ error: `status must be one of: ${validStatuses.join(', ')}` });
  }

  try {
    const result = await pool.query(
      `UPDATE tickets SET title = $1, description = $2, priority = $3, status = $4, updated_at = NOW()
       WHERE id = $5 RETURNING *`,
      [title, description, priority, status, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Ticket not found' });
    }

    res.json({ ticket: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update ticket' });
  }
});

module.exports = router;
