import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useGame } from '../../context/GameContext'
import {
  completarEpoca,
  getProgresoEpoca,
  subscribeEquipos,
  subscribeProgresoEpoca,
} from '../../services/firestore'
import { getDocs, getDoc, doc, collection } from 'firebase/firestore'
import { db } from '../../services/firebase'

function formatTime(s) {
  if (!s && s !== 0) return '--'
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  if (h > 0) return `${h}h ${String(m).padStart(2, '0')}m ${String(sec).padStart(2, '0')}s`
  return `${String(m).padStart(2, '0')}m ${String(sec).padStart(2, '0')}s`
}

function OtroEquipo({ equipo, grupoId, epocaId }) {
  const [prog, setProg] = useState(null)
  useEffect(() => {
    return subscribeProgresoEpoca(grupoId, equipo.id, epocaId, snap => {
      if (snap.exists()) setProg(snap.data())
    })
  }, [grupoId, equipo.id, epocaId])

  const estado = prog?.estado ?? 'sin empezar'
  const puntos = prog?.puntosCompletados?.length ?? 0
  const badgeClass = estado === 'completado' ? 'completada' : estado === 'activo' ? 'activa' : 'bloqueada'

  return (
    <div className="otro-equipo">
      <span className="otro-equipo__nombre">{equipo.nombre}</span>
      <span className={`estado-badge estado-badge--${badgeClass}`}>
        {estado === 'completado' ? '✓ Completado' : estado === 'activo' ? `${puntos} punto${puntos !== 1 ? 's' : ''}` : 'Sin empezar'}
      </span>
    </div>
  )
}

export default function EpochComplete() {
  const { epocaId } = useParams()
  const { game } = useGame()
  const navigate = useNavigate()
  const [epoca, setEpoca] = useState(null)
  const [progreso, setProgreso] = useState(null)
  const [epocas, setEpocas] = useState([])
  const [otrosEquipos, setOtrosEquipos] = useState([])
  const [tiempoSegundos, setTiempoSegundos] = useState(null)
  const [listo, setListo] = useState(false)

  // Load epoch data + mark completed
  useEffect(() => {
    if (!game.grupoId || !game.equipoId || !game.experienciaId || !epocaId) return

    const init = async () => {
      // Load epoch for video desenlace
      const epocaSnap = await getDoc(
        doc(db, 'experiencias', game.experienciaId, 'epocas', epocaId)
      )
      if (epocaSnap.exists()) setEpoca({ id: epocaSnap.id, ...epocaSnap.data() })

      // Load progreso + mark done
      const snap = await getProgresoEpoca(game.grupoId, game.equipoId, epocaId)
      if (snap.exists()) {
        const data = snap.data()
        setProgreso(data)
        if (data.estado !== 'completado') {
          await completarEpoca(game.grupoId, game.equipoId, epocaId)
        }
        if (data.tiempoInicio) {
          const finMs = data.tiempoFin?.toMillis?.() ?? Date.now()
          const bruto = Math.floor((finMs - data.tiempoInicio.toMillis()) / 1000)
          setTiempoSegundos(bruto + (data.penalizacionMinutos ?? 0) * 60)
        }
      }
      setListo(true)
    }
    init()
  }, [game.grupoId, game.equipoId, game.experienciaId, epocaId])

  // Load epochs for next navigation
  useEffect(() => {
    if (!game.experienciaId) return
    getDocs(collection(db, 'experiencias', game.experienciaId, 'epocas')).then(snap => {
      setEpocas(
        snap.docs
          .map(d => ({ id: d.id, ...d.data() }))
          .sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0))
      )
    })
  }, [game.experienciaId])

  // Subscribe to other teams
  useEffect(() => {
    if (!game.grupoId) return
    return subscribeEquipos(game.grupoId, snap => {
      setOtrosEquipos(
        snap.docs
          .map(d => ({ id: d.id, ...d.data() }))
          .filter(e => e.id !== game.equipoId)
      )
    })
  }, [game.grupoId, game.equipoId])

  const currentIdx = epocas.findIndex(e => e.id === epocaId)
  const nextEpoca = epocas[currentIdx + 1] ?? null
  const isLast = listo && currentIdx === epocas.length - 1 && epocas.length > 0

  const handleContinuar = () => {
    if (nextEpoca) {
      navigate(`/jugador/briefing/${nextEpoca.id}`)
    } else {
      navigate('/jugador')
    }
  }

  return (
    <div className="page page--dark epoch-complete">
      {/* Desenlace video */}
      {epoca?.desenlaceVideoUrl && (
        <div className="epoch-complete__desenlace">
          <video
            src={epoca.desenlaceVideoUrl}
            controls
            autoPlay
            playsInline
            className="media-player"
          />
        </div>
      )}

      <div className="epoch-complete__hero">
        <div className="epoch-complete__check">✓</div>
        <h1 className="epoch-complete__titulo">¡Época completada!</h1>
        {tiempoSegundos !== null && (
          <p className="epoch-complete__tiempo">{formatTime(tiempoSegundos)}</p>
        )}
      </div>

      <div className="epoch-complete__stats">
        <div className="stat-item">
          <span className="stat-item__value">{progreso?.puntosCompletados?.length ?? 0}</span>
          <span className="stat-item__label">Puntos</span>
        </div>
        <div className="stat-item">
          <span className="stat-item__value">{progreso?.puzzlesCompletados?.length ?? 0}</span>
          <span className="stat-item__label">Puzzles</span>
        </div>
        <div className="stat-item">
          <span className="stat-item__value">{Object.keys(progreso?.ayudasUsadas ?? {}).length}</span>
          <span className="stat-item__label">Ayudas</span>
        </div>
        {(progreso?.penalizacionMinutos ?? 0) > 0 && (
          <div className="stat-item stat-item--penalty">
            <span className="stat-item__value">+{progreso.penalizacionMinutos} min</span>
            <span className="stat-item__label">Penalización</span>
          </div>
        )}
      </div>

      {/* Coin instructions */}
      <div className="moneda-instrucciones">
        <p className="moneda-instrucciones__titulo">Moneda de la época</p>
        <p className="moneda-instrucciones__texto">
          Entrega la moneda física que encontrasteis al coordinador para validar la época completada.
          Sin la moneda no se registrará el tiempo.
        </p>
      </div>

      {otrosEquipos.length > 0 && (
        <div className="epoch-complete__otros">
          <p className="tab-section-title">Otros equipos</p>
          {otrosEquipos.map(eq => (
            <OtroEquipo
              key={eq.id}
              equipo={eq}
              grupoId={game.grupoId}
              epocaId={epocaId}
            />
          ))}
        </div>
      )}

      <div className="epoch-complete__footer">
        <button
          onClick={handleContinuar}
          disabled={!listo}
          className="btn btn--primary btn--large"
        >
          {!listo
            ? 'Guardando...'
            : isLast
              ? 'Finalizar experiencia'
              : nextEpoca
                ? `Continuar: ${nextEpoca.nombre}`
                : 'Volver al inicio'}
        </button>
      </div>
    </div>
  )
}
