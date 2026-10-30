import { useCallback, useEffect, useState } from 'react'
import { Doughnut } from 'react-chartjs-2'
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend,
} from 'chart.js'
import { apiFetch } from '../api'

// Register required Chart.js components
ChartJS.register(ArcElement, Tooltip, Legend)

function ManagerDashboard({ user, onLogout }) {
  // ── Active section: 'tickets' | 'progress' | 'supporters' ───────────────
  const [activeSection, setActiveSection] = useState('tickets')

  const [tickets, setTickets]               = useState([])
  const [supporters, setSupporters]         = useState([])
  const [loading, setLoading]               = useState(true)
  const [error, setError]                   = useState('')
  const [selectedTicket, setSelectedTicket] = useState(null)
  const [assignments, setAssignments]       = useState({})
  const [savingTicket, setSavingTicket]     = useState(null)
  const [assignMsg, setAssignMsg]           = useState({})

  // Feedback state
  const [feedbackMap, setFeedbackMap] = useState({}) // { [ticketId]: feedbackArray }

  // Create Supporter state
  const [showCreateSupporter, setShowCreateSupporter] = useState(false)
  const [supName, setSupName]         = useState('')
  const [supEmail, setSupEmail]       = useState('')
  const [supPassword, setSupPassword] = useState('')
  const [supMsg, setSupMsg]           = useState('')
  const [supIsError, setSupIsError]   = useState(false)
  const [supLoading, setSupLoading]   = useState(false)

  // ── Ticket status filter: 'all' | 'Open' | 'In Progress' | 'Resolved' ───
  const [ticketFilter, setTicketFilter] = useState('all')

  // ── Navigate section: also close detail panel when switching ────────────
  const navigate = (section) => {
    setActiveSection(section)
    setSelectedTicket(null)
    setTicketFilter('all')          // reset filter when leaving tickets section
  }

  const handleCreateSupporter = async (e) => {
    e.preventDefault()
    setSupMsg('')
    setSupIsError(false)
    setSupLoading(true)
    try {
      const res = await apiFetch('/api/auth/register-supporter', {
        method: 'POST',
        body: JSON.stringify({ full_name: supName, email: supEmail, password: supPassword }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || 'Failed to create account.')
      setSupMsg(data.message)
      setSupIsError(false)
      setSupName('')
      setSupEmail('')
      setSupPassword('')
      // Refresh supporter list so new account appears in Assign dropdown
      await fetchManagerData()
    } catch (err) {
      setSupMsg(err.message)
      setSupIsError(true)
    } finally {
      setSupLoading(false)
    }
  }

  const fetchManagerData = useCallback(async () => {
    try {
      setError('')
      const [ticketRes, supporterRes] = await Promise.all([
        apiFetch('/api/tickets/manager/all'),
        apiFetch('/api/tickets/manager/supporters'),
      ])
      const ticketData    = await ticketRes.json()
      const supporterData = await supporterRes.json()

      if (!ticketRes.ok)    throw new Error(ticketData.message    || 'Failed to load tickets.')
      if (!supporterRes.ok) throw new Error(supporterData.message || 'Failed to load supporters.')

      setTickets(ticketData)
      setSupporters(supporterData)
    } catch (err) {
      setError(err.message || 'Cannot connect to the server.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchManagerData() }, [fetchManagerData])

  // When a ticket is selected, load its feedback
  useEffect(() => {
    if (!selectedTicket) return
    apiFetch(`/api/tickets/${selectedTicket.id}/feedback`)
      .then(r => r.json())
      .then(data => setFeedbackMap(prev => ({ ...prev, [selectedTicket.id]: Array.isArray(data) ? data : [] })))
      .catch(() => {})
  }, [selectedTicket])

  const assignTicket = async (ticketId) => {
    const supporterId = assignments[ticketId]
    setAssignMsg(prev => ({ ...prev, [ticketId]: null }))

    if (!supporterId) {
      setAssignMsg(prev => ({
        ...prev,
        [ticketId]: { text: 'Please select a supporter first.', isError: true },
      }))
      return
    }

    try {
      setSavingTicket(ticketId)
      const response = await apiFetch(`/api/tickets/${ticketId}/assign`, {
        method: 'PATCH',
        body: JSON.stringify({ supporterId: Number(supporterId) }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.message || 'Assignment failed.')

      setAssignMsg(prev => ({
        ...prev,
        [ticketId]: { text: data.message || 'Assigned successfully!', isError: false },
      }))
      setAssignments(prev => { const next = { ...prev }; delete next[ticketId]; return next })
      setLoading(true)
      await fetchManagerData()
    } catch (err) {
      setAssignMsg(prev => ({
        ...prev,
        [ticketId]: { text: err.message || 'Could not assign ticket.', isError: true },
      }))
    } finally {
      setSavingTicket(null)
    }
  }

  // ── Supporter work-progress stats (derived from loaded tickets) ──────────
  // Computed here so they update automatically whenever fetchManagerData() runs
  const supporterStats = supporters.map(s => {
    const assigned = tickets.filter(t => t.assigned_to === s.id)
    return {
      ...s,
      total:      assigned.length,
      resolved:   assigned.filter(t => t.status === 'Resolved').length,
      inProgress: assigned.filter(t => t.status === 'In Progress').length,
      open:       assigned.filter(t => t.status === 'Open').length,
    }
  })

  // ── Chart data ────────────────────────────────────────────────────────────
  const openCount     = tickets.filter(t => t.status === 'Open').length
  const progressCount = tickets.filter(t => t.status === 'In Progress').length
  const resolvedCount = tickets.filter(t => t.status === 'Resolved').length
  const totalCount    = tickets.length

  const resolutionPercent =
    totalCount > 0 ? Math.round((resolvedCount / totalCount) * 100) : 0

  const chartData = {
    labels: ['Open', 'In Progress', 'Resolved'],
    datasets: [
      {
        data: [openCount, progressCount, resolvedCount],
        backgroundColor: ['#f59e0b', '#6366f1', '#22c55e'],
        borderColor:     ['#ffffff', '#ffffff', '#ffffff'],
        borderWidth: 3,
        hoverOffset: 8,
      },
    ],
  }

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: true,
    cutout: '68%',
    plugins: {
      legend: {
        position: 'bottom',
        labels: { padding: 16, font: { size: 13 }, color: '#26324b' },
      },
      tooltip: {
        callbacks: {
          label: (ctx) => {
            const val = ctx.parsed
            const pct = totalCount > 0 ? Math.round((val / totalCount) * 100) : 0
            return `  ${ctx.label}: ${val} tickets (${pct}%)`
          },
        },
      },
    },
  }

  // ── Section titles for the header ─────────────────────────────────────────
  const sectionTitle = {
    tickets:    'Support Tickets',
    progress:   'Progress',
    supporters: 'Supporters',
  }

  return (
    <div className="dashboard-layout">
      {/* ── Sidebar ── */}
      <aside className="sidebar">
        <h2>HelpDesk Lite</h2>
        <p>Management Portal</p>
        <nav>
          <a
            href="#tickets"
            className={activeSection === 'tickets' ? 'active' : ''}
            onClick={e => { e.preventDefault(); navigate('tickets') }}
          >
            Support Tickets
          </a>
          <a
            href="#progress"
            className={activeSection === 'progress' ? 'active' : ''}
            onClick={e => { e.preventDefault(); navigate('progress') }}
          >
            Progress
          </a>
          <a
            href="#supporters"
            className={activeSection === 'supporters' ? 'active' : ''}
            onClick={e => { e.preventDefault(); navigate('supporters') }}
          >
            Supporters
          </a>
        </nav>
      </aside>

      {/* ── Main content ── */}
      <main className="dashboard-main">
        {/* Shared header */}
        <header className="dashboard-header">
          <div>
            <h1>{sectionTitle[activeSection]}</h1>
            <p>Welcome back, {user.full_name}!</p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button className="logout-button" onClick={onLogout}>Logout</button>
            <span className="user-badge">{user.full_name.charAt(0).toUpperCase()}</span>
          </div>
        </header>

        {/* ════════════════════════════════════════════════════════════════
            SECTION: Support Tickets  (grouped by status)
            ════════════════════════════════════════════════════════════════ */}
        {activeSection === 'tickets' && (
          <>
            {loading && <p style={{ marginTop: '20px' }}>Loading tickets...</p>}
            {error   && <p role="alert" style={{ color: '#c0392b', marginTop: '20px' }}>{error}</p>}

            {/* ── Status filter bar ── */}
            {!loading && !error && (
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

            {/* Reusable ticket-row renderer */}
            {!loading && !error && (() => {
              const renderTicketRow = (ticket) => (
                <article className="manager-ticket-row" key={ticket.id}>
                  <div className="manager-ticket-top">
                    <div className="ticket-info">
                      <strong>{ticket.title}</strong>
                      {feedbackMap[ticket.id]?.length > 0 && (
                        <span className="badge-reopened">↩ Reopened by Customer</span>
                      )}
                      <span>HD-{ticket.id} · {ticket.customer_name} · {ticket.category}</span>
                      <span>Assigned to: {ticket.supporter_name || 'Unassigned'}</span>
                    </div>

                    <span className={`ticket-status ${ticket.status.toLowerCase().replace(' ', '-')}`}>
                      {ticket.status}
                    </span>

                    <span className={`ticket-priority ${ticket.priority.toLowerCase()}`}>
                      {ticket.priority}
                    </span>

                    <button type="button" className="btn-view" onClick={() => setSelectedTicket(ticket)}>
                      Details
                    </button>
                  </div>

                  <div className="ticket-assignment">
                    <select
                      aria-label={`Choose supporter for ticket ${ticket.id}`}
                      value={
                        assignments[ticket.id] ??
                        (ticket.assigned_to ? String(ticket.assigned_to) : '')
                      }
                      onChange={e =>
                        setAssignments(prev => ({ ...prev, [ticket.id]: e.target.value }))
                      }
                    >
                      <option value="">— Select supporter —</option>
                      {supporters.map(s => (
                        <option key={s.id} value={String(s.id)}>{s.full_name}</option>
                      ))}
                    </select>

                    <button
                      type="button"
                      className="btn-assign"
                      disabled={savingTicket === ticket.id}
                      onClick={() => assignTicket(ticket.id)}
                    >
                      {savingTicket === ticket.id ? 'Saving...' : 'Assign'}
                    </button>
                  </div>

                  {assignMsg[ticket.id] && (
                    <p
                      role={assignMsg[ticket.id].isError ? 'alert' : 'status'}
                      style={{
                        marginTop: '6px',
                        fontSize: '13px',
                        color: assignMsg[ticket.id].isError ? '#c0392b' : '#16804a',
                      }}
                    >
                      {assignMsg[ticket.id].text}
                    </p>
                  )}
                </article>
              )

              const openTickets       = tickets.filter(t => t.status === 'Open')
              const inProgressTickets = tickets.filter(t => t.status === 'In Progress')
              const resolvedTickets   = tickets.filter(t => t.status === 'Resolved')

              const showOpen       = ticketFilter === 'all' || ticketFilter === 'Open'
              const showInProgress = ticketFilter === 'all' || ticketFilter === 'In Progress'
              const showResolved   = ticketFilter === 'all' || ticketFilter === 'Resolved'

              return (
                <>
                  {/* ── Open Tickets ── */}
                  {showOpen && (
                    <section className="tickets-section ticket-group">
                      <div className="ticket-group-header">
                        <h2>Open Tickets</h2>
                        <span className="ticket-group-count ticket-group-count--open">
                          {openTickets.length}
                        </span>
                      </div>
                      {openTickets.length === 0
                        ? <p className="ticket-group-empty">No open tickets.</p>
                        : openTickets.map(renderTicketRow)
                      }
                    </section>
                  )}

                  {/* ── In Progress Tickets ── */}
                  {showInProgress && (
                    <section className="tickets-section ticket-group">
                      <div className="ticket-group-header">
                        <h2>In Progress Tickets</h2>
                        <span className="ticket-group-count ticket-group-count--progress">
                          {inProgressTickets.length}
                        </span>
                      </div>
                      {inProgressTickets.length === 0
                        ? <p className="ticket-group-empty">No tickets currently in progress.</p>
                        : inProgressTickets.map(renderTicketRow)
                      }
                    </section>
                  )}

                  {/* ── Resolved Tickets ── */}
                  {showResolved && (
                    <section className="tickets-section ticket-group">
                      <div className="ticket-group-header">
                        <h2>Resolved Tickets</h2>
                        <span className="ticket-group-count ticket-group-count--resolved">
                          {resolvedTickets.length}
                        </span>
                      </div>
                      {resolvedTickets.length === 0
                        ? <p className="ticket-group-empty">No resolved tickets yet.</p>
                        : resolvedTickets.map(renderTicketRow)
                      }
                    </section>
                  )}
                </>
              )
            })()}

            {/* Ticket detail panel */}
            {selectedTicket && (
              <section className="ticket-details">
                <div className="ticket-details-header">
                  <h2>Ticket Details — HD-{selectedTicket.id}</h2>
                  <button type="button" className="btn-close" onClick={() => setSelectedTicket(null)}>Close</button>
                </div>

                <h3>{selectedTicket.title}</h3>
                <p><strong>Customer:</strong> {selectedTicket.customer_name}</p>
                <p><strong>Description:</strong> {selectedTicket.description}</p>
                <p><strong>Category:</strong> {selectedTicket.category}</p>
                <p><strong>Priority:</strong> {selectedTicket.priority}</p>
                <p><strong>Status:</strong> {selectedTicket.status}</p>
                <p>
                  <strong>Assigned supporter:</strong>{' '}
                  {selectedTicket.supporter_name || 'Unassigned'}
                </p>
                <p>
                  <strong>Created:</strong>{' '}
                  {new Date(selectedTicket.created_at).toLocaleString()}
                </p>

                {feedbackMap[selectedTicket.id]?.length > 0 && (
                  <div className="feedback-history">
                    <h4>⚠️ Customer Feedback (Ticket Reopened)</h4>
                    {feedbackMap[selectedTicket.id].map(fb => (
                      <div className="feedback-item" key={fb.id}>
                        <p className="feedback-text">"{fb.message}"</p>
                        <span className="feedback-date">
                          {fb.customer_name} · {new Date(fb.submitted_at).toLocaleString()}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            )}
          </>
        )}

        {/* ════════════════════════════════════════════════════════════════
            SECTION: Progress
            ════════════════════════════════════════════════════════════════ */}
        {activeSection === 'progress' && (
          <>
            {/* Summary cards */}
            <section className="summary-cards">
              <article className="summary-card">
                <span>Total Tickets</span>
                <h2>{totalCount}</h2>
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

            {/* Doughnut chart */}
            {loading && <p style={{ marginTop: '20px' }}>Loading data...</p>}
            {error   && <p role="alert" style={{ color: '#c0392b', marginTop: '20px' }}>{error}</p>}

            {!loading && !error && (
              <section className="chart-section">
                <h2>Ticket Resolution Overview</h2>
                <div className="chart-inner">
                  <div className="chart-canvas-wrap">
                    {totalCount === 0 ? (
                      <p style={{ color: '#778197', textAlign: 'center', paddingTop: '40px' }}>
                        No tickets yet — chart will appear once tickets are created.
                      </p>
                    ) : (
                      <Doughnut data={chartData} options={chartOptions} />
                    )}
                  </div>

                  <div className="chart-stats">
                    <div className="chart-stat-item">
                      <span className="chart-stat-dot" style={{ background: '#f59e0b' }} />
                      <div>
                        <p className="chart-stat-label">Open</p>
                        <p className="chart-stat-value">{openCount}</p>
                      </div>
                    </div>

                    <div className="chart-stat-item">
                      <span className="chart-stat-dot" style={{ background: '#6366f1' }} />
                      <div>
                        <p className="chart-stat-label">In Progress</p>
                        <p className="chart-stat-value">{progressCount}</p>
                      </div>
                    </div>

                    <div className="chart-stat-item">
                      <span className="chart-stat-dot" style={{ background: '#22c55e' }} />
                      <div>
                        <p className="chart-stat-label">Resolved</p>
                        <p className="chart-stat-value">{resolvedCount}</p>
                      </div>
                    </div>

                    <div className="chart-stat-resolution">
                      <p className="chart-stat-label">Resolution Rate</p>
                      <p className="chart-stat-big">{resolutionPercent}%</p>
                      <p className="chart-stat-sub">{resolvedCount} of {totalCount} tickets resolved</p>
                    </div>
                  </div>
                </div>
              </section>
            )}
          </>
        )}

        {/* ════════════════════════════════════════════════════════════════
            SECTION: Supporters
            ════════════════════════════════════════════════════════════════ */}
        {activeSection === 'supporters' && (
          <section className="tickets-section create-supporter-section">
            <div className="create-supporter-header">
              <h2>Supporter Accounts</h2>
              <button
                type="button"
                className="btn-view"
                onClick={() => {
                  setShowCreateSupporter(prev => !prev)
                  setSupMsg('')
                }}
              >
                {showCreateSupporter ? 'Hide Form' : '+ Create Supporter Account'}
              </button>
            </div>

            {/* Supporter progress cards */}
            {loading && <p style={{ marginTop: '16px' }}>Loading supporters...</p>}
            {error   && <p role="alert" style={{ color: '#c0392b', marginTop: '16px' }}>{error}</p>}

            {!loading && !error && supporterStats.length === 0 && (
              <p style={{ marginTop: '16px', color: '#778197' }}>No supporter accounts yet.</p>
            )}

            {!loading && !error && supporterStats.length > 0 && (
              <div className="supporter-progress-list">
                {supporterStats.map(s => (
                  <div key={s.id} className="supporter-progress-card">
                    {/* Card header */}
                    <div className="spc-header">
                      <span className="spc-avatar">{s.full_name.charAt(0).toUpperCase()}</span>
                      <div>
                        <p className="spc-name">{s.full_name}</p>
                        <p className="spc-email">{s.email}</p>
                      </div>
                    </div>

                    {/* Stat row */}
                    <div className="spc-stats">
                      <div className="spc-stat">
                        <span className="spc-stat-value">{s.total}</span>
                        <span className="spc-stat-label">Total Assigned</span>
                      </div>
                      <div className="spc-stat spc-stat--resolved">
                        <span className="spc-stat-value">{s.resolved}</span>
                        <span className="spc-stat-label">Resolved</span>
                      </div>
                      <div className="spc-stat spc-stat--progress">
                        <span className="spc-stat-value">{s.inProgress}</span>
                        <span className="spc-stat-label">In Progress</span>
                      </div>
                      <div className="spc-stat spc-stat--open">
                        <span className="spc-stat-value">{s.open}</span>
                        <span className="spc-stat-label">Open / Pending</span>
                      </div>
                    </div>

                    {/* Mini progress bar: resolved out of total */}
                    {s.total > 0 && (
                      <div className="spc-bar-wrap" title={`${Math.round((s.resolved / s.total) * 100)}% resolved`}>
                        <div
                          className="spc-bar-fill"
                          style={{ width: `${Math.round((s.resolved / s.total) * 100)}%` }}
                        />
                      </div>
                    )}
                    {s.total === 0 && (
                      <p className="spc-no-tickets">No tickets assigned yet</p>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Create supporter form */}
            {showCreateSupporter && (
              <form className="create-supporter-form" onSubmit={handleCreateSupporter}>
                <div className="create-supporter-fields">
                  <div className="csf-group">
                    <label htmlFor="supName">Full Name</label>
                    <input
                      id="supName"
                      type="text"
                      value={supName}
                      onChange={e => setSupName(e.target.value)}
                      placeholder="Enter full name"
                      required
                    />
                  </div>
                  <div className="csf-group">
                    <label htmlFor="supEmail">Email</label>
                    <input
                      id="supEmail"
                      type="email"
                      value={supEmail}
                      onChange={e => setSupEmail(e.target.value)}
                      placeholder="Enter email address"
                      required
                    />
                  </div>
                  <div className="csf-group">
                    <label htmlFor="supPassword">Password</label>
                    <input
                      id="supPassword"
                      type="password"
                      minLength={6}
                      value={supPassword}
                      onChange={e => setSupPassword(e.target.value)}
                      placeholder="At least 6 characters"
                      required
                    />
                  </div>
                </div>

                <div className="create-supporter-actions">
                  <button type="submit" className="btn-create-ticket" disabled={supLoading}>
                    {supLoading ? 'Creating...' : 'Create Supporter Account'}
                  </button>
                  <button
                    type="button"
                    className="btn-cancel-feedback"
                    onClick={() => {
                      setShowCreateSupporter(false)
                      setSupMsg('')
                      setSupName('')
                      setSupEmail('')
                      setSupPassword('')
                    }}
                  >
                    Cancel
                  </button>
                </div>

                {supMsg && (
                  <p
                    role={supIsError ? 'alert' : 'status'}
                    className={`feedback-msg ${supIsError ? 'error' : 'success'}`}
                  >
                    {supMsg}
                  </p>
                )}
              </form>
            )}
          </section>
        )}

        <footer className="dashboard-footer">HelpDesk Lite · Support made simple</footer>
      </main>
    </div>
  )
}

export default ManagerDashboard
