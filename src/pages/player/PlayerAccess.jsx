import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { usePlayerAccess } from '../../hooks/usePlayerAccess'

export default function PlayerAccess() {
  const navigate = useNavigate()
  const { acceder, error, cargando } = usePlayerAccess()
  const [form, setForm] = useState({ codigoGrupo: '', codigoEquipo: '' })

  const handleSubmit = async (e) => {
    e.preventDefault()
    const ok = await acceder(form)
    if (ok) navigate('/jugador')
  }

  return (
    <main className="page page--centered page--dark">
      <h1>Escape Room</h1>
      <p>Introduce los códigos de tu equipo para comenzar</p>

      <form onSubmit={handleSubmit} className="form">
        <input
          type="text"
          placeholder="Código del grupo (ej: ABC123)"
          value={form.codigoGrupo}
          onChange={(e) => setForm({ ...form, codigoGrupo: e.target.value.toUpperCase() })}
          maxLength={6}
          required
        />
        <input
          type="text"
          placeholder="Código del equipo (ej: XZ42)"
          value={form.codigoEquipo}
          onChange={(e) => setForm({ ...form, codigoEquipo: e.target.value.toUpperCase() })}
          required
        />
        {error && <p className="error">{error}</p>}
        <button type="submit" disabled={cargando} className="btn btn--primary btn--large">
          {cargando ? 'Conectando...' : 'Unirse'}
        </button>
      </form>

      <p className="link-small">
        ¿Eres coordinador? <a href="/login">Accede aquí</a>
      </p>
    </main>
  )
}
