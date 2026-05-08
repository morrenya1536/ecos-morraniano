import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { usePlayerAccess } from '../../hooks/usePlayerAccess'

export default function PlayerAccess() {
  const navigate = useNavigate()
  const { acceder, error, cargando } = usePlayerAccess()
  const [form, setForm] = useState({ codigoGrupo: '', nombreEquipo: '' })

  const handleSubmit = async (e) => {
    e.preventDefault()
    const ok = await acceder(form)
    if (ok) navigate('/jugador')
  }

  return (
    <main className="page page--centered page--dark">
      <h1>Escape Room</h1>
      <p>Introduce el código de tu grupo para comenzar</p>

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
          placeholder="Nombre de tu equipo"
          value={form.nombreEquipo}
          onChange={(e) => setForm({ ...form, nombreEquipo: e.target.value })}
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
