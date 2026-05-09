import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useGame } from '../../context/GameContext'
import { usePlayerAccess } from '../../hooks/usePlayerAccess'
import { getGrupoByCodigo, getEquipos } from '../../services/firestore'
import LoadingScreen from '../../components/shared/LoadingScreen'

export default function PlayerAccess() {
  const navigate = useNavigate()
  const { game, setSesion, resetGame } = useGame()
  const { acceder, error, cargando } = usePlayerAccess()
  const [form, setForm] = useState({ codigoGrupo: '', codigoEquipo: '' })

  // true mientras comprobamos si hay sesión guardada válida
  const [verificando, setVerificando] = useState(
    !!(game.grupoId && game.grupoCodigo && game.equipoId)
  )

  useEffect(() => {
    if (!game.grupoId || !game.grupoCodigo || !game.equipoId) return

    const validar = async () => {
      try {
        const snap = await getGrupoByCodigo(game.grupoCodigo)

        if (snap.empty || !snap.docs[0].data().activo) {
          resetGame()
          setVerificando(false)
          return
        }

        const grupoDoc = snap.docs[0]
        const equiposSnap = await getEquipos(grupoDoc.id)
        const equipoDoc = equiposSnap.docs.find(d => d.id === game.equipoId)

        if (!equipoDoc) {
          resetGame()
          setVerificando(false)
          return
        }

        // Sesión válida — refrescar datos básicos y redirigir
        setSesion({
          grupoId: grupoDoc.id,
          grupoCodigo: game.grupoCodigo,
          equipoId: equipoDoc.id,
          equipoNombre: equipoDoc.data().nombre,
          experienciaId: grupoDoc.data().experienciaId,
        })
        navigate('/jugador', { replace: true })
      } catch {
        // Error de red: confiar en la sesión cacheada y dejar pasar
        navigate('/jugador', { replace: true })
      }
    }

    validar()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const handleSubmit = async (e) => {
    e.preventDefault()
    const ok = await acceder(form)
    if (ok) navigate('/jugador')
  }

  if (verificando) return <LoadingScreen mensaje="Verificando sesión..." />

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
