import { useState } from 'react'
import { apiFetch } from '../api'

function CreateTicket({ user, onTicketCreated, onCancel }) {
  const [title, setTitle] = useState('')
  const [category, setCategory] = useState('Technical & Software')
  const [priority, setPriority] = useState('Medium')
  const [description, setDescription] = useState('')
  const [message, setMessage] = useState('')
  const [isError, setIsError] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setMessage('')
    setIsError(false)

    // Frontend validation
    if (!title.trim()) {
      setIsError(true)
      setMessage('Please enter a ticket title.')
      return
    }
    if (!description.trim()) {
      setIsError(true)
      setMessage('Please enter a description.')
      return
    }

    setLoading(true)

    try {
      const response = await apiFetch('/api/tickets', {
        method: 'POST',
        body: JSON.stringify({
          user_id: user.id,
          title,
          category,
          priority,
          description,
        }),
      })

      const data = await response.json()

      if (response.ok) {
        setMessage('Ticket submitted successfully!')
        setIsError(false)
        setTimeout(() => onTicketCreated(), 1000)
      } else {
        setIsError(true)
        setMessage(data.message || 'Failed to create ticket.')
      }
    } catch {
      setIsError(true)
      setMessage('Cannot connect to the server.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="register-container">
      <h1>Create a Ticket</h1>
      <p>Tell us what support you need.</p>

      <form onSubmit={handleSubmit}>
        <label htmlFor="ticketTitle">Ticket Title</label>
        <input
          id="ticketTitle"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Briefly describe the issue"
          maxLength={150}
          required
        />

        <label htmlFor="ticketCategory">Category</label>
        <select
          id="ticketCategory"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
        >
          <option>Technical &amp; Software</option>
          <option>Account</option>
          <option>Network</option>
          <option>Other</option>
        </select>

        <label htmlFor="ticketPriority">Priority</label>
        <select
          id="ticketPriority"
          value={priority}
          onChange={(e) => setPriority(e.target.value)}
        >
          <option>Low</option>
          <option>Medium</option>
          <option>High</option>
        </select>

        <label htmlFor="ticketDescription">Description</label>
        <textarea
          id="ticketDescription"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Explain the problem in detail"
          rows={5}
          required
        />

        <button type="submit" disabled={loading}>
          {loading ? 'Submitting...' : 'Submit Ticket'}
        </button>

        <button type="button" className="switch-button" onClick={onCancel}>
          Cancel
        </button>
      </form>

      {message && (
        <p
          role={isError ? 'alert' : 'status'}
          style={{ color: isError ? '#c0392b' : '#16804a' }}
        >
          {message}
        </p>
      )}
    </main>
  )
}

export default CreateTicket
