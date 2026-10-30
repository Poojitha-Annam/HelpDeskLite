import { useState } from 'react'
import Login from './components/Login'
import Register from './components/Register'
import Dashboard from './components/Dashboard'
import SupporterDashboard from './components/SupporterDashboard'
import ManagerDashboard from './components/ManagerDashboard'
import './App.css'

function App() {
  // Try to restore a previous session from localStorage on first load.
  // This means the user stays logged in after a page refresh.
  const [user, setUser] = useState(() => {
    try {
      const saved = localStorage.getItem('helpdesk_user')
      return saved ? JSON.parse(saved) : null
    } catch {
      return null
    }
  })

  // Start on the login page unless we already have a restored session.
  const [page, setPage] = useState(() => {
    const saved = localStorage.getItem('helpdesk_user')
    return saved ? 'dashboard' : 'register'
  })

  // Called by Login.jsx after a successful login.
  // Saves both the token and the user object to localStorage.
  const handleLoginSuccess = (userData, token) => {
    localStorage.setItem('helpdesk_token', token)
    localStorage.setItem('helpdesk_user', JSON.stringify(userData))
    setUser(userData)
    setPage('dashboard')
  }

  // Called by the Logout button in any dashboard.
  // Clears everything from localStorage so the session truly ends.
  const handleLogout = () => {
    localStorage.removeItem('helpdesk_token')
    localStorage.removeItem('helpdesk_user')
    setUser(null)
    setPage('login')
  }

  if (page === 'dashboard' && user) {
    if (user.role === 'Supporter') {
      return (
        <SupporterDashboard
          user={user}
          onLogout={handleLogout}
        />
      )
    }

    if (user.role === 'Manager') {
      return (
        <ManagerDashboard
          user={user}
          onLogout={handleLogout}
        />
      )
    }

    return <Dashboard user={user} onLogout={handleLogout} />
  }

  if (page === 'login') {
    return (
      <Login
        onLoginSuccess={handleLoginSuccess}
        onSwitchToRegister={() => setPage('register')}
      />
    )
  }

  return (
    <Register
      onRegisterSuccess={() => setPage('login')}
      onSwitchToLogin={() => setPage('login')}
    />
  )
}

export default App
