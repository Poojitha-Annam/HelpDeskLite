const express = require('express')
const db = require('../db')
const verifyToken = require('../middleware/auth')

const router = express.Router()

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/tickets
// Who can use it: Users only (role === 'User')
// Security: The token's user id must match the user_id in the request body.
//           This prevents User A from creating a ticket on behalf of User B.
// ─────────────────────────────────────────────────────────────────────────────
router.post('/', verifyToken, async (req, res) => {
  try {
    // Only the 'User' role can submit tickets
    if (req.user.role !== 'User') {
      return res.status(403).json({ message: 'Only users can create tickets.' })
    }

    const { user_id, title, category, priority, description } = req.body

    // The logged-in user can only create tickets for themselves
    if (req.user.id !== Number(user_id)) {
      return res.status(403).json({ message: 'You can only create tickets for yourself.' })
    }

    if (!user_id || !title?.trim() || !category || !priority || !description?.trim()) {
      return res.status(400).json({ message: 'Please fill in all fields.' })
    }

    const allowedPriorities = ['Low', 'Medium', 'High']
    if (!allowedPriorities.includes(priority)) {
      return res.status(400).json({ message: 'Invalid priority.' })
    }

    const allowedCategories = ['Technical & Software', 'Account', 'Network', 'Other']
    if (!allowedCategories.includes(category)) {
      return res.status(400).json({ message: 'Invalid category.' })
    }

    const [result] = await db.query(
      `INSERT INTO tickets (user_id, title, category, priority, description)
       VALUES (?, ?, ?, ?, ?)`,
      [user_id, title.trim(), category, priority, description.trim()]
    )

    res.status(201).json({
      message: 'Ticket created successfully!',
      ticketId: result.insertId,
    })
  } catch (error) {
    console.error('Create ticket error:', error.message)
    res.status(500).json({ message: 'Failed to create ticket.' })
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/tickets/user/:userId
// Who can use it: The user whose id matches the URL parameter
// Security: Prevents User A from reading User B's tickets by changing the URL
// ─────────────────────────────────────────────────────────────────────────────
router.get('/user/:userId', verifyToken, async (req, res) => {
  try {
    // The logged-in user can only fetch their own tickets
    if (req.user.id !== Number(req.params.userId)) {
      return res.status(403).json({ message: 'Access denied.' })
    }

    const [tickets] = await db.query(
      `SELECT id, title, category, priority, description, status, created_at
       FROM tickets
       WHERE user_id = ?
       ORDER BY created_at DESC`,
      [req.params.userId]
    )

    res.json(tickets)
  } catch (error) {
    console.error('Fetch tickets error:', error.message)
    res.status(500).json({ message: 'Failed to fetch tickets.' })
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/tickets/:ticketId/status
// Who can use it: Supporters only
// Security: Only supporters can update a status, and only on tickets assigned to them
// ─────────────────────────────────────────────────────────────────────────────
router.patch('/:ticketId/status', verifyToken, async (req, res) => {
  try {
    // Only supporters can change ticket status
    if (req.user.role !== 'Supporter') {
      return res.status(403).json({ message: 'Only supporters can update ticket status.' })
    }

    const { status } = req.body
    const { ticketId } = req.params

    const allowedStatuses = ['Open', 'In Progress', 'Resolved']
    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({ message: 'Invalid ticket status.' })
    }

    // Verify this ticket is actually assigned to the logged-in supporter
    const [tickets] = await db.query(
      'SELECT id FROM tickets WHERE id = ? AND assigned_to = ?',
      [ticketId, req.user.id]
    )

    if (tickets.length === 0) {
      return res.status(403).json({
        message: 'You can only update status for tickets assigned to you.',
      })
    }

    await db.query('UPDATE tickets SET status = ? WHERE id = ?', [status, ticketId])

    res.json({ message: 'Ticket status updated successfully!' })
  } catch (error) {
    console.error('Update ticket status error:', error.message)
    res.status(500).json({ message: 'Failed to update ticket status.' })
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/tickets/assigned/:userId
// Who can use it: Supporters only (and only for their own user id)
// ─────────────────────────────────────────────────────────────────────────────
router.get('/assigned/:userId', verifyToken, async (req, res) => {
  try {
    if (req.user.role !== 'Supporter') {
      return res.status(403).json({ message: 'Access denied.' })
    }

    // A supporter can only fetch their own assigned tickets
    if (req.user.id !== Number(req.params.userId)) {
      return res.status(403).json({ message: 'Access denied.' })
    }

    const [tickets] = await db.query(
      `SELECT
         t.id, t.user_id, t.title, t.category, t.priority,
         t.description, t.status, t.created_at, t.assigned_to,
         customer.full_name AS customer_name
       FROM tickets t
       JOIN users customer ON t.user_id = customer.id
       WHERE t.assigned_to = ?
       ORDER BY t.created_at DESC`,
      [req.params.userId]
    )

    res.json(tickets)
  } catch (error) {
    console.error('Fetch assigned tickets error:', error.message)
    res.status(500).json({ message: 'Failed to fetch assigned tickets.' })
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/tickets/manager/all
// Who can use it: Managers only
// ─────────────────────────────────────────────────────────────────────────────
router.get('/manager/all', verifyToken, async (req, res) => {
  try {
    if (req.user.role !== 'Manager') {
      return res.status(403).json({ message: 'Access denied. Managers only.' })
    }

    const [tickets] = await db.query(`
      SELECT
        t.id,
        t.user_id,
        t.title,
        t.category,
        t.priority,
        t.description,
        t.status,
        t.created_at,
        t.assigned_to,
        customer.full_name  AS customer_name,
        supporter.full_name AS supporter_name
      FROM tickets t
      JOIN  users customer  ON t.user_id    = customer.id
      LEFT JOIN users supporter ON t.assigned_to = supporter.id
      ORDER BY t.created_at DESC
    `)

    res.json(tickets)
  } catch (error) {
    console.error('Manager ticket fetch error:', error.message)
    res.status(500).json({ message: 'Failed to fetch all tickets.' })
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/tickets/manager/supporters
// Who can use it: Managers only
// ─────────────────────────────────────────────────────────────────────────────
router.get('/manager/supporters', verifyToken, async (req, res) => {
  try {
    if (req.user.role !== 'Manager') {
      return res.status(403).json({ message: 'Access denied. Managers only.' })
    }

    const [supporters] = await db.query(`
      SELECT id, full_name, email
      FROM users
      WHERE role = 'Supporter'
      ORDER BY full_name
    `)

    res.json(supporters)
  } catch (error) {
    console.error('Supporter fetch error:', error.message)
    res.status(500).json({ message: 'Failed to fetch supporters.' })
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/tickets/:ticketId/assign
// Who can use it: Managers only
// ─────────────────────────────────────────────────────────────────────────────
router.patch('/:ticketId/assign', verifyToken, async (req, res) => {
  try {
    if (req.user.role !== 'Manager') {
      return res.status(403).json({ message: 'Access denied. Managers only.' })
    }

    const { supporterId } = req.body
    const { ticketId } = req.params

    if (!supporterId) {
      return res.status(400).json({ message: 'Please select a supporter.' })
    }

    // Make sure the chosen account is actually a Supporter
    const [supporters] = await db.query(
      "SELECT id FROM users WHERE id = ? AND role = 'Supporter'",
      [supporterId]
    )

    if (supporters.length === 0) {
      return res.status(400).json({ message: 'Selected account is not a supporter.' })
    }

    const [result] = await db.query(
      'UPDATE tickets SET assigned_to = ? WHERE id = ?',
      [supporterId, ticketId]
    )

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Ticket not found.' })
    }

    res.json({ message: 'Ticket assigned successfully!' })
  } catch (error) {
    console.error('Ticket assignment error:', error.message)
    res.status(500).json({ message: 'Failed to assign ticket.' })
  }
})

module.exports = router

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/tickets/:ticketId/feedback
// Who can use it: Users only (the ticket owner)
// What it does:
//   1. Validates the ticket belongs to this user AND is currently Resolved
//   2. Saves the feedback message in ticket_feedback table
//   3. Reopens the ticket (status → Open) — same ticket ID, same assigned_to
//   All three steps run inside a database transaction so they either
//   all succeed or all roll back together.
// ─────────────────────────────────────────────────────────────────────────────
router.post('/:ticketId/feedback', verifyToken, async (req, res) => {
  if (req.user.role !== 'User') {
    return res.status(403).json({ message: 'Only customers can submit feedback.' })
  }

  const { message } = req.body
  const { ticketId } = req.params

  if (!message || !message.trim()) {
    return res.status(400).json({ message: 'Feedback message cannot be empty.' })
  }

  // Get a dedicated connection so we can use a transaction
  const conn = await db.getConnection()
  try {
    await conn.beginTransaction()

    // Verify ticket belongs to this user and is Resolved
    const [rows] = await conn.query(
      'SELECT id, user_id, status FROM tickets WHERE id = ?',
      [ticketId]
    )

    if (rows.length === 0) {
      await conn.rollback()
      return res.status(404).json({ message: 'Ticket not found.' })
    }

    if (rows[0].user_id !== req.user.id) {
      await conn.rollback()
      return res.status(403).json({ message: 'This is not your ticket.' })
    }

    if (rows[0].status !== 'Resolved') {
      await conn.rollback()
      return res.status(400).json({ message: 'You can only reopen a Resolved ticket.' })
    }

    // Save feedback
    await conn.query(
      'INSERT INTO ticket_feedback (ticket_id, user_id, message) VALUES (?, ?, ?)',
      [ticketId, req.user.id, message.trim()]
    )

    // Reopen ticket — keep assigned_to unchanged so same supporter handles it
    await conn.query(
      "UPDATE tickets SET status = 'Open' WHERE id = ?",
      [ticketId]
    )

    await conn.commit()

    res.json({ message: 'Feedback submitted. Your ticket has been reopened.' })
  } catch (error) {
    await conn.rollback()
    console.error('Feedback submission error:', error.message)
    res.status(500).json({ message: 'Failed to submit feedback.' })
  } finally {
    conn.release()
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/tickets/:ticketId/feedback
// Who can use it: The ticket owner (User), assigned Supporter, or any Manager
// Returns all feedback messages for a ticket in chronological order
// ─────────────────────────────────────────────────────────────────────────────
router.get('/:ticketId/feedback', verifyToken, async (req, res) => {
  const { ticketId } = req.params

  try {
    // Fetch the ticket so we can do permission checks
    const [rows] = await db.query(
      'SELECT user_id, assigned_to FROM tickets WHERE id = ?',
      [ticketId]
    )

    if (rows.length === 0) {
      return res.status(404).json({ message: 'Ticket not found.' })
    }

    const ticket = rows[0]
    const { role, id: userId } = req.user

    const isOwner     = role === 'User'      && ticket.user_id     === userId
    const isSupporter = role === 'Supporter' && ticket.assigned_to === userId
    const isManager   = role === 'Manager'

    if (!isOwner && !isSupporter && !isManager) {
      return res.status(403).json({ message: 'Access denied.' })
    }

    const [feedback] = await db.query(
      `SELECT f.id, f.message, f.submitted_at, u.full_name AS customer_name
       FROM ticket_feedback f
       JOIN users u ON f.user_id = u.id
       WHERE f.ticket_id = ?
       ORDER BY f.submitted_at ASC`,
      [ticketId]
    )

    res.json(feedback)
  } catch (error) {
    console.error('Fetch feedback error:', error.message)
    res.status(500).json({ message: 'Failed to fetch feedback.' })
  }
})
