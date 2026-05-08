import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useCoordinator } from '../../hooks/useCoordinator'

export default function CoordinatorLogin() {
  const navigate = useNavigate()
  const { login, error, cargando } = useCoordinator()
  const [form, setForm] = useState({ email: '', password: '' })

  const handleSubmit = async (e) => {
    e.preventDefault()
    const ok = await login(form.email, form.password)
    if (ok !== undefined) navigate('/coordinador')
  }

  return (
    <main className="page page--centered">
      <h1>Coordinador</h1>
      <form onSubmit={handleSubmit} className="form">
        <input
          type="email"
          placeholder="Email"
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
          required
        />
        <input
          type="password"
          placeholder="Contraseña"
          value={form.password}
          onChange={(e) => setForm({ ...form, password: e.target.value })}
          required
        />
        {error && <p className="error">{error}</p>}
        <button type="submit" disabled={cargando}>
          {cargando ? 'Entrando...' : 'Entrar'}
        </button>
      </form>
    </main>
  )
}
