import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useGame } from '../../context/GameContext'
import { usePlayerAccess } from '../../hooks/usePlayerAccess'
import { getGrupoByCodigo, getEquipos, setIdiomaEquipo, setIdiomaGrupo } from '../../services/firestore'
import { IDIOMA_LABELS } from '../../utils/helpers'
import LoadingScreen from '../../components/shared/LoadingScreen'

export default function PlayerAccess() {
  const navigate = useNavigate()
  const { game, setSesion, resetGame } = useGame()
  const { acceder, error, cargando } = usePlayerAccess()
  const [form, setForm] = useState({ codigoGrupo: '', codigoEquipo: '' })
  const [pendingLang, setPendingLang] = useState(null) // { idiomas, grupoId, equipoId, modo }
  const [guardandoIdioma, setGuardandoIdioma] = useState(false)

  const [verificando, setVerificando] = useState(
    !!(game.grupoId && game.grupoCodigo && game.equipoId)
  )

  useEffect(() => {
    if (!game.grupoId || !game.grupoCodigo || !game.equipoId) return

    const validar = async () => {
      try {
        const snap = await getGrupoByCodigo(game.grupoCodigo)
        if (snap.empty || !snap.docs[0].data().activo) {
          resetGame(); setVerificando(false); return
        }
        const grupoDoc = snap.docs[0]
        const equiposSnap = await getEquipos(grupoDoc.id)
        const equipoDoc = equiposSnap.docs.find(d => d.id === game.equipoId)
        if (!equipoDoc) {
          resetGame(); setVerificando(false); return
        }
        const grupoData = grupoDoc.data()
        const equipoData = equipoDoc.data()
        const modo = grupoData.modo ?? 'competitivo'
        const idiomaElegido =
          game.idiomaElegido ||
          (modo === 'colaborativo' && grupoData.idiomaGrupo) ||
          equipoData.idiomaElegido ||
          'es'

        setSesion({
          grupoId: grupoDoc.id,
          grupoCodigo: game.grupoCodigo,
          equipoId: equipoDoc.id,
          equipoNombre: equipoData.nombre,
          experienciaId: grupoData.experienciaId,
          idiomaElegido,
        })
        navigate('/jugador', { replace: true })
      } catch {
        navigate('/jugador', { replace: true })
      }
    }

    validar()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const handleSubmit = async (e) => {
    e.preventDefault()
    const result = await acceder(form)
    if (!result) return

    const { idiomasDisponibles, idiomaElegido, grupoId, equipoId, modo } = result

    if (idiomaElegido || idiomasDisponibles.length <= 1) {
      const idioma = idiomaElegido ?? idiomasDisponibles[0] ?? 'es'
      setSesion({ idiomaElegido: idioma })
      navigate('/jugador')
    } else {
      setPendingLang({ idiomas: idiomasDisponibles, grupoId, equipoId, modo })
    }
  }

  const handleElegirIdioma = async (idioma) => {
    const { grupoId, equipoId, modo } = pendingLang
    setGuardandoIdioma(true)
    try {
      await setIdiomaEquipo(grupoId, equipoId, idioma)
      if (modo === 'colaborativo') await setIdiomaGrupo(grupoId, idioma)
      setSesion({ idiomaElegido: idioma })
      navigate('/jugador')
    } finally {
      setGuardandoIdioma(false)
    }
  }

  if (verificando) return <LoadingScreen mensaje="Verificando sesión..." />

  if (pendingLang) {
    return (
      <main className="page page--centered page--dark">
        <h1>Elige el idioma</h1>
        <p className="lang-selector__hint">Selecciona el idioma en el que queréis jugar la experiencia</p>
        <div className="lang-selector">
          {pendingLang.idiomas.map(lang => (
            <button
              key={lang}
              onClick={() => handleElegirIdioma(lang)}
              disabled={guardandoIdioma}
              className="btn btn--lang btn--large"
            >
              {IDIOMA_LABELS[lang] ?? lang.toUpperCase()}
            </button>
          ))}
        </div>
      </main>
    )
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
