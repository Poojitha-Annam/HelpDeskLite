import { useCallback, useEffect, useState } from 'react'
import CreateTicket from './CreateTicket'
import { apiFetch } from '../api'

function Dashboard({ user, onLogout }) {
  const [tickets, setTickets]               = useState([])
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [selectedTicket, setSelectedTicket] = useState(null)
  const [loading, setLoading]               = useState(true)
  const [refreshing, setRefreshing]         = useState(false)
  const [error, setError]                   = useState('')

  // ── Ticket status filter: 'all' | 'Open' | 'In Progress' | 'Resolved' ───
  const [ticketFilter, setTicketFilter] = useState('all')

  // Feedback state
  const [showFeedbackForm, setShowFeedbackForm] = useState(false)
  const [feedbackMessage, setFeedbackMessage]   = useState('')
  const [feedbackHistory, setFeedbackHistory]   = useState([])
  const [feedbackLoading, setFeedbackLoading]   = useState(false)
  const [feedbackSubmitting, setFeedbackSubmitting] = useState(false)
  const [feedbackResult, setFeedbackResult]     = useState(null) // { text, isError }

  // ── Fetch all tickets ────────────────────────────────────────────────────
  const fetchTickets = useCallback(async (silent = false) => {
    try {
      setError('')
      if (!silent) setLoading(true)
      else setRefreshing(true)

      const response = await apiFetch(`/api/tickets/user/${user.id}`)
      const data = await response.json()

      if (!response.ok) throw new Error(data.message || 'Failed to load tickets.')

      setTickets(data)
      setSelectedTicket(prev =>
        prev ? (data.find(t => t.id === prev.id) || prev) : null
      )
    } catch (err) {
      setError(err.message || 'Cannot connect to the server.')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [user.id])

  useEffect(() => { fetchTickets() }, [fetchTickets])

  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') fetchTickets(true)
    }
    document.addEventListener('visibilitychange', handleVisibility)
    return () => document.removeEventListener('visibilitychange', handleVisibility)
  }, [fetchTickets])

  useEffect(() => {
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') fetchTickets(true)
    }, 30000)
    return () => clearInterval(interval)
  }, [fetchTickets])

  // ── Fetch feedback history for the selected ticket ───────────────────────
  const fetchFeedback = useCallback(async (ticketId) => {
    setFeedbackLoading(true)
    try {
      const res  = await apiFetch(`/api/tickets/${ticketId}/feedback`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.message)
      setFeedbackHistory(data)
    } catch {
      setFeedbackHistory([])
    } finally {
      setFeedbackLoading(false)
    }
  }, [])

  // When a ticket is selected, load its feedback history automatically
  useEffect(() => {
    if (selectedTicket) {
      setShowFeedbackForm(false)
      setFeedbackMessage('')
      setFeedbackResult(null)
      fetchFeedback(selectedTicket.id)
    }
  }, [selectedTicket, fetchFeedback])

  // ── Submit feedback + reopen ticket ─────────────────────────────────────
  const handleFeedbackSubmit = async (e) => {
    e.preventDefault()
    if (!feedbackMessage.trim()) return

    setFeedbackSubmitting(true)
    setFeedbackResult(null)

    try {
      const res  = await apiFetch(`/api/tickets/${selectedTicket.id}/feedback`, {
        method: 'POST',
        body: JSON.stringify({ message: feedbackMessage }),
      })
      const data = await res.json()

      if (!res.ok) throw new Error(data.message || 'Failed to submit feedback.')

      setFeedbackResult({ text: data.message, isError: false })
      setFeedbackMessage('')
      setShowFeedbackForm(false)

      // Refresh ticket list so the status badge updates to Open
      await fetchTickets(true)
      await fetchFeedback(selectedTicket.id)
    } catch (err) {
      setFeedbackResult({ text: err.message || 'Could not submit feedback.', isError: true })
    } finally {
      setFeedbackSubmitting(false)
    }
  }

  if (showCreateForm) {
    return (
      <CreateTicket
        user={user}
        onTicketCreated={() => {
          setShowCreateForm(false)
          setLoading(true)
          fetchTickets()
        }}
        onCancel={() => setShowCreateForm(false)}
      />
    )
  }

  const openCount     = tickets.filter(t => t.status === 'Open').length
  const progressCount = tickets.filter(t => t.status === 'In Progress').length
  const resolvedCount = tickets.filter(t => t.status === 'Resolved').length

  return (
    <div className="dashboard-layout">
      <aside className="sidebar">
        <h2>HelpDesk Lite</h2>
        <nav>
          <a href="#overview" className="active">Overview</a>
          <a href="#tickets">My Tickets</a>
        </nav>
      </aside>

      <main className="dashboard-main" id="overview">
        <header className="dashboard-header">
          <div>
            <h1>Dashboard</h1>
            <p>Welcome back, {user.full_name}!</p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button
              type="button"
              className="refresh-button"
              onClick={() => fetchTickets(true)}
              disabled={refreshing}
              title="Refresh tickets"
            >
              {refreshing ? '↻ Refreshing…' : '↻ Refresh'}
            </button>
            <button className="logout-button" onClick={onLogout}>Logout</button>
            <span className="user-badge">{user.full_name.charAt(0).toUpperCase()}</span>
          </div>
        </header>

        <button type="button" className="btn-create-ticket" onClick={() => setShowCreateForm(true)}>
          + Create New Ticket
        </button>

        <section className="summary-cards">
          <article className="summary-card">
            <span>Total Tickets</span>
            <h2>{tickets.length}</h2>
          </article>
          <article className="summary-card">
            <span>Open</span>
            <h2>{openCount}</h2>
          </article>
          <article className="summary-card">
            <span>In Progress</span>
            <h2>{progressCount}</h2>
          </article>
          <article className="summary-card">
            <span>Resolved</span>
            <h2>{resolvedCount}</h2>
          </article>
        </section>

        <section className="tickets-section" id="tickets">
          <h2>My Support Tickets</h2>

          {loading && <p>Loading tickets...</p>}
          {error   && <p role="alert" style={{ color: '#c0392b' }}>{error}</p>}

          {!loading && !error && tickets.length === 0 && (
            <p>You haven't created any tickets yet. Use the button above to get started!</p>
          )}

          {/* ── Status filter bar ── */}
          {!loading && !error && tickets.length > 0 && (
            <div className="ticket-filter-bar">
              {['all', 'Open', 'In Progress', 'Resolved'].map(f => (
                <button
                  key={f}
                  type="button"
                  className={`ticket-filter-btn ticket-filter-btn--${f === 'all' ? 'all' : f.toLowerCase().replace(' ', '-')}${ticketFilter === f ? ' active' : ''}`}
                  onClick={() => setTicketFilter(f)}
                >
                  {f === 'all' ? 'All' : f}
                  <span className="ticket-filter-count">
                    {f === 'all'
                      ? tickets.length
                      : tickets.filter(t => t.status === f).length}
                  </span>
                </button>
              ))}
            </div>
          )}

          {/* ── Filtered ticket list ── */}
          {!loading && !error && (() => {
            const filtered = ticketFilter === 'all'
              ? tickets
              : tickets.filter(t => t.status === ticketFilter)

            if (filtered.length === 0 && tickets.length > 0) {
              return (
                <p className="ticket-group-empty">
                  No {ticketFilter} tickets found.
                </p>
              )
            }

            return filtered.map(ticket => (
              <article
                className="ticket-row"
                key={ticket.id}
                onClick={() => setSelectedTicket(ticket)}
                role="button"
                tabIndex={0}
                onKeyDown={event => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault()
                    setSelectedTicket(ticket)
                  }
                }}
              >
                <div className="ticket-info">
                  <strong>{ticket.title}</strong>
                  <span>HD-{ticket.id} · {ticket.category}</span>
                </div>

                <span className={`ticket-status ${ticket.status.toLowerCase().replace(' ', '-')}`}>
                  {ticket.status}
                </span>

                <span className={`ticket-priority ${ticket.priority.toLowerCase()}`}>
                  {ticket.priority}
                </span>
              </article>
            ))
          })()}
        </section>

        {/* ── Ticket detail panel ── */}
        {selectedTicket && (
          <section className="ticket-details">
            <div className="ticket-details-header">
              <h2>Ticket Details — HD-{selectedTicket.id}</h2>
              <button type="button" className="btn-close" onClick={() => setSelectedTicket(null)}>Close</button>
            </div>

            <h3>{selectedTicket.title}</h3>
            <p><strong>Description:</strong> {selectedTicket.description}</p>
            <p><strong>Category:</strong> {selectedTicket.category}</p>
            <p><strong>Priority:</strong> {selectedTicket.priority}</p>
            <p><strong>Status:</strong> {selectedTicket.status}</p>
            <p>
              <strong>Created:</strong>{' '}
              {new Date(selectedTicket.created_at).toLocaleString()}
            </p>

            <p style={{ marginTop: '14px', fontSize: '13px', color: '#778197' }}>
              ℹ️ Only your assigned support agent can update the ticket status.
            </p>

            {/* ── Previous feedback history ── */}
            {feedbackLoading && (
              <p style={{ marginTop: '16px', fontSize: '13px', color: '#778197' }}>
                Loading feedback history...
              </p>
            )}

            {!feedbackLoading && feedbackHistory.length > 0 && (
              <div className="feedback-history">
                <h4>📋 Your Previous Feedback</h4>
                {feedbackHistory.map(fb => (
                  <div className="feedback-item" key={fb.id}>
                    <p className="feedback-text">"{fb.message}"</p>
                    <span className="feedback-date">
                      Submitted on {new Date(fb.submitted_at).toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {/* ── Feedback result message ── */}
            {feedbackResult && (
              <p
                role={feedbackResult.isError ? 'alert' : 'status'}
                className={feedbackResult.isError ? 'feedback-msg error' : 'feedback-msg success'}
              >
                {feedbackResult.text}
              </p>
            )}

            {/* ── "Still Facing This Issue?" button — only for Resolved tickets ── */}
            {selectedTicket.status === 'Resolved' && !showFeedbackForm && (
              <button
                type="button"
                className="btn-reopen"
                onClick={() => setShowFeedbackForm(true)}
              >
                😟 Still Facing This Issue?
              </button>
            )}

            {/* ── Feedback form ── */}
            {showFeedbackForm && selectedTicket.status === 'Resolved' && (
              <form className="feedback-form" onSubmit={handleFeedbackSubmit}>
                <label htmlFor="feedbackMsg">
                  Describe what's still not working:
                </label>
                <textarea
                  id="feedbackMsg"
                  rows={4}
                  value={feedbackMessage}
                  onChange={e => setFeedbackMessage(e.target.value)}
                  placeholder="e.g. The issue came back after restarting my computer..."
                  required
                />
                <div className="feedback-form-actions">
                  <button type="submit" className="btn-submit-feedback" disabled={feedbackSubmitting}>
                    {feedbackSubmitting ? 'Submitting…' : '🔁 Submit & Reopen Ticket'}
                  </button>
                  <button
                    type="button"
                    className="btn-cancel-feedback"
                    onClick={() => {
                      setShowFeedbackForm(false)
                      setFeedbackMessage('')
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            )}
          </section>
        )}

        <footer className="dashboard-footer">HelpDesk Lite · Support made simple</footer>
      </main>
    </div>
  )
}

export default Dashboard
