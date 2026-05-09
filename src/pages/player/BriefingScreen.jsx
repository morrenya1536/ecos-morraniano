import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useGame } from '../../context/GameContext'
import {
  getProgresoEpoca,
  initProgresoEpoca,
} from '../../services/firestore'
import { getDocs, collection } from 'firebase/firestore'
import { db } from '../../services/firebase'

export default function BriefingScreen() {
  const { epocaId } = useParams()
  const { game } = useGame()
  const navigate = useNavigate()
  const [epoca, setEpoca] = useState(null)
  const [primerPunto, setPrimerPunto] = useState(null)
  const [cargando, setCargando] = useState(true)
  const [empezando, setEmpezando] = useState(false)

  useEffect(() => {
    if (!game.experienciaId || !epocaId) return

    const load = async () => {
      // Check if progreso already exists → skip briefing
      const progSnap = await getProgresoEpoca(game.grupoId, game.equipoId, epocaId)
      if (progSnap.exists() && progSnap.data().estado === 'activo') {
        navigate(`/jugador/epoca/${epocaId}`, { replace: true })
        return
      }

      // Load epoch
      const epocasSnap = await getDocs(
        collection(db, 'experiencias', game.experienciaId, 'epocas')
      )
      const epocaData = epocasSnap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .find(e => e.id === epocaId)
      setEpoca(epocaData)

      // Load first punto (orden = 0 or minimum)
      const puntosSnap = await getDocs(
        collection(db, 'experiencias', game.experienciaId, 'epocas', epocaId, 'puntos')
      )
      const puntos = puntosSnap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0))
      if (puntos.length > 0) setPrimerPunto(puntos[0])

      setCargando(false)
    }
    load()
  }, [epocaId, game.experienciaId, game.grupoId, game.equipoId, navigate])

  const handleEmpezar = async () => {
    setEmpezando(true)
    await initProgresoEpoca(game.grupoId, game.equipoId, epocaId, {
      experienciaId: game.experienciaId,
      epocaId,
      grupoId: game.grupoId,
      equipoId: game.equipoId,
      equipoNombre: game.equipoNombre,
    })
    navigate(`/jugador/epoca/${epocaId}`)
  }

  if (cargando) {
    return <div className="page page--dark"><div className="loading-screen"><div className="spinner" /></div></div>
  }

  return (
    <main className="page page--dark briefing">
      <header className="briefing__header">
        <button
          onClick={() => navigate('/jugador')}
          className="btn btn--ghost btn--small"
        >← Volver</button>
        <h1 className="briefing__titulo">{epoca?.nombre}</h1>
      </header>

      <div className="briefing__content">
        {epoca?.briefingVideoUrl && (
          <div className="briefing__video">
            <video
              src={epoca.briefingVideoUrl}
              controls
              playsInline
              className="media-player"
            />
          </div>
        )}

        {epoca?.briefingTexto && (
          <div className="briefing__narrativa">
            <p>{epoca.briefingTexto}</p>
          </div>
        )}

        {/* Primera pista: la del primer punto */}
        {primerPunto?.pistaEntrada && (
          <div className="briefing__pista">
            <p className="briefing__pista-label">Tu primera misión:</p>
            {primerPunto.pistaEntrada.imagenUrl && (
              <img
                src={primerPunto.pistaEntrada.imagenUrl}
                alt="Pista inicial"
                className="media-image"
              />
            )}
            {primerPunto.pistaEntrada.videoUrl && (
              <video
                src={primerPunto.pistaEntrada.videoUrl}
                controls
                playsInline
                className="media-player"
              />
            )}
            {primerPunto.pistaEntrada.texto && (
              <p className="briefing__pista-texto">{primerPunto.pistaEntrada.texto}</p>
            )}
          </div>
        )}
      </div>

      <div className="briefing__footer">
        <button
          onClick={handleEmpezar}
          disabled={empezando}
          className="btn btn--primary btn--large"
        >
          {empezando ? 'Iniciando...' : 'Entendido, empezamos'}
        </button>
      </div>
    </main>
  )
}
