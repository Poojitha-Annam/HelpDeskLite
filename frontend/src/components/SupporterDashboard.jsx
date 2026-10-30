import { useCallback, useEffect, useState } from 'react'
import { apiFetch } from '../api'

function SupporterDashboard({ user, onLogout }) {
  const [tickets, setTickets]               = useState([])
  const [loading, setLoading]               = useState(true)
  const [error, setError]                   = useState('')
  const [selectedTicket, setSelectedTicket] = useState(null)
  const [statusMessage, setStatusMessage]   = useState('')
  const [isStatusError, setIsStatusError]   = useState(false)
  const [updatingStatus, setUpdatingStatus] = useState(false)

  // ── Ticket status filter: 'all' | 'Open' | 'In Progress' | 'Resolved' ───
  const [ticketFilter, setTicketFilter] = useState('all')

  // Feedback state
  const [feedbackHistory, setFeedbackHistory] = useState([])
  const [feedbackLoading, setFeedbackLoading] = useState(false)

  const fetchTickets = useCallback(async () => {
    try {
      setError('')
      const response = await apiFetch(`/api/tickets/assigned/${user.id}`)
      const data = await response.json()
      if (!response.ok) throw new Error(data.message || 'Failed to load tickets.')
      setTickets(data)
    } catch (err) {
      setError(err.message || 'Cannot connect to the server.')
    } finally {
      setLoading(false)
    }
  }, [user.id])

  useEffect(() => { fetchTickets() }, [fetchTickets])

  // Fetch feedback history for the selected ticket
  const fetchFeedback = useCallback(async (ticketId) => {
    setFeedbackLoading(true)
    try {
      const res  = await apiFetch(`/api/tickets/${ticketId}/feedback`)
      const data = await res.json()
      setFeedbackHistory(res.ok ? data : [])
    } catch {
      setFeedbackHistory([])
    } finally {
      setFeedbackLoading(false)
    }
  }, [])

  useEffect(() => {
    if (selectedTicket) {
      setStatusMessage('')
      fetchFeedback(selectedTicket.id)
    }
  }, [selectedTicket, fetchFeedback])

  const updateStatus = async (ticketId, newStatus) => {
    setStatusMessage('')
    setIsStatusError(false)
    setUpdatingStatus(true)

    try {
      const response = await apiFetch(`/api/tickets/${ticketId}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: newStatus }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.message || 'Failed to update status.')

      setIsStatusError(false)
      setStatusMessage('Status updated successfully!')

      // Refresh list and keep the panel open with updated data
      setLoading(true)
      await fetchTickets()

      // Update the selectedTicket object so the displayed status reflects the change
      setSelectedTicket(prev => prev ? { ...prev, status: newStatus } : null)
    } catch (err) {
      setIsStatusError(true)
      setStatusMessage(err.message || 'Could not update ticket status.')
    } finally {
      setUpdatingStatus(false)
    }
  }

  const openCount     = tickets.filter(t => t.status === 'Open').length
  const progressCount = tickets.filter(t => t.status === 'In Progress').length
  const resolvedCount = tickets.filter(t => t.status === 'Resolved').length

  return (
    <div className="dashboard-layout">
      <aside className="sidebar">
        <h2>HelpDesk Lite</h2>
        <p>Support Portal</p>
        <nav>
          <a href="#support-overview" className="active">Overview</a>
          <a href="#assigned-tickets">Assigned Tickets</a>
        </nav>
      </aside>

      <main className="dashboard-main" id="support-overview">
        <header className="dashboard-header">
          <div>
            <h1>Supporter Dashboard</h1>
            <p>Welcome back, {user.full_name}!</p>
            {user.category && (
              <p style={{ fontSize: '13px', color: '#6366f1', fontWeight: 600, marginTop: '4px' }}>
                Category: {user.category}
              </p>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button className="logout-button" onClick={onLogout}>Logout</button>
            <span className="user-badge">{user.full_name.charAt(0).toUpperCase()}</span>
          </div>
        </header>

        <section className="summary-cards">
          <article className="summary-card">
            <span>Assigned Tickets</span>
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

        <section className="tickets-section" id="assigned-tickets">
          <h2>My Assigned Tickets</h2>

          {loading && <p>Loading assigned tickets...</p>}
          {error   && <p role="alert" style={{ color: '#c0392b' }}>{error}</p>}

          {!loading && !error && tickets.length === 0 && (
            <p>No tickets have been assigned to you yet.</p>
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
                  No {ticketFilter} tickets assigned to you.
                </p>
              )
            }

            return filtered.map(ticket => (
              <article className="ticket-row" key={ticket.id}>
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

                <button
                  type="button"
                  className="btn-view"
                  onClick={() => {
                    setStatusMessage('')
                    setSelectedTicket(ticket)
                  }}
                >
                  View / Update
                </button>
              </article>
            ))
          })()}
        </section>

        {selectedTicket && (
          <section className="ticket-details">
            <div className="ticket-details-header">
              <h2>Ticket HD-{selectedTicket.id}</h2>
              <button
                type="button"
                className="btn-close"
                onClick={() => {
                  setSelectedTicket(null)
                  setStatusMessage('')
                }}
              >
                Close
              </button>
            </div>

            <h3>{selectedTicket.title}</h3>

            <p><strong>Description:</strong> {selectedTicket.description}</p>
            <p><strong>Category:</strong> {selectedTicket.category}</p>
            <p><strong>Priority:</strong> {selectedTicket.priority}</p>
            <p><strong>Current Status:</strong> {selectedTicket.status}</p>
            <p>
              <strong>Created:</strong>{' '}
              {new Date(selectedTicket.created_at).toLocaleString()}
            </p>

            {/* Feedback history from customer */}
            {feedbackLoading && (
              <p style={{ marginTop: '14px', fontSize: '13px', color: '#778197' }}>
                Loading customer feedback...
              </p>
            )}

            {!feedbackLoading && feedbackHistory.length > 0 && (
              <div className="feedback-history">
                <h4>⚠️ Customer Feedback (Ticket Reopened)</h4>
                {feedbackHistory.map(fb => (
                  <div className="feedback-item" key={fb.id}>
                    <p className="feedback-text">"{fb.message}"</p>
                    <span className="feedback-date">
                      {fb.customer_name} · {new Date(fb.submitted_at).toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
            )}

            <div style={{ marginTop: '18px' }}>
              <label htmlFor="supportTicketStatus" style={{ fontWeight: 600, fontSize: '14px' }}>
                Update Status
              </label>
              <div style={{ display: 'flex', gap: '10px', marginTop: '8px', flexWrap: 'wrap' }}>
                <select
                  id="supportTicketStatus"
                  className="status-select"
                  value={selectedTicket.status}
                  disabled={updatingStatus}
                  onChange={e => updateStatus(selectedTicket.id, e.target.value)}
                >
                  <option value="Open">Open</option>
                  <option value="In Progress">In Progress</option>
                  <option value="Resolved">Resolved</option>
                </select>
                {updatingStatus && (
                  <span style={{ alignSelf: 'center', color: '#778197', fontSize: '13px' }}>
                    Saving...
                  </span>
                )}
              </div>

              {statusMessage && (
                <p
                  role={isStatusError ? 'alert' : 'status'}
                  style={{
                    marginTop: '10px',
                    fontSize: '13px',
                    color: isStatusError ? '#c0392b' : '#16804a',
                  }}
                >
                  {statusMessage}
                </p>
              )}
            </div>
          </section>
        )}

        <footer className="dashboard-footer">HelpDesk Lite · Support made simple</footer>
      </main>
    </div>
  )
}

export default SupporterDashboard
