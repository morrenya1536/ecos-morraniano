import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useCoordinator } from '../../hooks/useCoordinator'

export default function CoordinatorLogin() {
  const navigate = useNavigate()
  const { coordinador, cargando: cargandoAuth } = useAuth()
  const { login, error, cargando } = useCoordinator()
  const [form, setForm] = useState({ email: '', password: '' })

  // Redirige en cuanto Firebase confirma la sesión (nuevo login o ya estaba logueado)
  useEffect(() => {
    if (!cargandoAuth && coordinador) navigate('/coordinador', { replace: true })
  }, [coordinador, cargandoAuth, navigate])

  const handleSubmit = async (e) => {
    e.preventDefault()
    await login(form.email, form.password)
  }

  return (
    <main className="page page--centered">
      <div className="login-brand">
        <h1>Escape Room Builder</h1>
        <p className="text-muted">Panel de coordinador</p>
      </div>
      <form onSubmit={handleSubmit} className="form">
        <input
          type="email"
          placeholder="Email"
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
          autoComplete="email"
          required
        />
        <input
          type="password"
          placeholder="Contraseña"
          value={form.password}
          onChange={(e) => setForm({ ...form, password: e.target.value })}
          autoComplete="current-password"
          required
        />
        {error && <p className="error">{error}</p>}
        <button type="submit" disabled={cargando} className="btn btn--primary btn--large">
          {cargando ? 'Entrando...' : 'Entrar'}
        </button>
      </form>
    </main>
  )
}
