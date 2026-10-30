import { useState } from 'react'
import { apiFetch } from '../api'

function Register({ onRegisterSuccess, onSwitchToLogin }) {
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState('')
  const [isError, setIsError] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setMessage('')
    setIsError(false)
    setLoading(true)

    try {
      const response = await apiFetch('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({ full_name: fullName, email, password }),
      })

      const data = await response.json()

      if (response.ok) {
        setMessage('Account created! Redirecting to login...')
        setIsError(false)
        setFullName('')
        setEmail('')
        setPassword('')
        setTimeout(() => onRegisterSuccess(), 1200)
      } else {
        setIsError(true)
        setMessage(data.message || 'Registration failed.')
      }
    } catch {
      setIsError(true)
      setMessage('Cannot connect to the server. Is the backend running?')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="register-container">
      <h1>HelpDesk Lite</h1>
      <p>Create your account to submit support tickets</p>

      <form onSubmit={handleSubmit}>
        <label htmlFor="fullName">Full Name</label>
        <input
          id="fullName"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          placeholder="Enter your full name"
          required
        />

        <label htmlFor="registerEmail">Email</label>
        <input
          id="registerEmail"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Enter your email"
          required
        />

        <label htmlFor="registerPassword">Password</label>
        <input
          id="registerPassword"
          type="password"
          minLength={6}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="At least 6 characters"
          required
        />

        <button type="submit" disabled={loading}>
          {loading ? 'Creating account...' : 'Register'}
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

      <p className="form-switch">
        Already have an account?{' '}
        <button type="button" className="switch-button" onClick={onSwitchToLogin}>
          Login
        </button>
      </p>
    </main>
  )
}

export default Register
