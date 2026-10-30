import { useState } from 'react'
import { apiFetch } from '../api'

function Login({ onLoginSuccess, onSwitchToRegister }) {
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
      const response = await apiFetch('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      })

      const data = await response.json()

      if (response.ok) {
        // Pass both the user object AND the token up to App.jsx
        onLoginSuccess(data.user, data.token)
      } else {
        setIsError(true)
        setMessage(data.message || 'Login failed.')
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
      <p>Welcome back! Sign in to continue.</p>

      <form onSubmit={handleSubmit}>
        <label htmlFor="loginEmail">Email</label>
        <input
          id="loginEmail"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Enter your email"
          required
        />

        <label htmlFor="loginPassword">Password</label>
        <input
          id="loginPassword"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Enter your password"
          required
        />

        <button type="submit" disabled={loading}>
          {loading ? 'Signing in...' : 'Login'}
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
        Don't have an account?{' '}
        <button
          type="button"
          className="switch-button"
          onClick={onSwitchToRegister}
        >
          Register
        </button>
      </p>
    </main>
  )
}

export default Login
