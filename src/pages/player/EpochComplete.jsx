import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useGame } from '../../context/GameContext'
import {
  completarEpoca,
  getProgresoEpoca,
  subscribeEquipos,
  subscribeProgresoEpoca,
  writeRanking,
  subscribeRanking,
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
  const [todosEquipos, setTodosEquipos] = useState([])
  const [tiempoSegundos, setTiempoSegundos] = useState(null)
  const [listo, setListo] = useState(false)

  // Collaborative waiting state
  const [otrosProgreso, setOtrosProgreso] = useState({})
  const [rankingData, setRankingData] = useState([])

  const isCompetitivo = game.grupoModo === 'competitivo' || !game.grupoModo
  const otrosEquipos = todosEquipos.filter(e => e.id !== game.equipoId)

  const equipoIdProgreso = game.grupoModo === 'colaborativo' && game.epocaConjunta
    ? 'conjunto'
    : game.equipoId

  useEffect(() => {
    if (!game.grupoId || !game.equipoId || !game.experienciaId || !epocaId) return

    const init = async () => {
      const epocaSnap = await getDoc(
        doc(db, 'experiencias', game.experienciaId, 'epocas', epocaId)
      )
      if (epocaSnap.exists()) setEpoca({ id: epocaSnap.id, ...epocaSnap.data() })

      let snap = await getProgresoEpoca(game.grupoId, equipoIdProgreso, epocaId)
      if (snap.exists()) {
        let data = snap.data()
        if (data.estado !== 'completado') {
          await completarEpoca(game.grupoId, equipoIdProgreso, epocaId)
          snap = await getProgresoEpoca(game.grupoId, equipoIdProgreso, epocaId)
          if (snap.exists()) data = snap.data()
        }
        setProgreso(data)
        if ('tiempoAcumuladoMs' in data) {
          const activo = Math.floor((data.tiempoAcumuladoMs ?? 0) / 1000)
          setTiempoSegundos(activo + (data.penalizacionMinutos ?? 0) * 60)
        } else if (data.tiempoInicio) {
          const finMs = data.tiempoFin?.toMillis?.() ?? Date.now()
          const bruto = Math.floor((finMs - data.tiempoInicio.toMillis()) / 1000)
          setTiempoSegundos(bruto + (data.penalizacionMinutos ?? 0) * 60)
        }
      }
      setListo(true)
    }
    init()
  }, [game.grupoId, game.equipoId, game.experienciaId, epocaId, equipoIdProgreso])

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

  // Subscribe to all teams in this group
  useEffect(() => {
    if (!game.grupoId) return
    return subscribeEquipos(game.grupoId, snap => {
      setTodosEquipos(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    })
  }, [game.grupoId])

  // Subscribe to other teams' progreso for collaborative waiting
  useEffect(() => {
    if (game.grupoModo !== 'colaborativo' || !game.grupoId || otrosEquipos.length === 0) return
    const unsubs = otrosEquipos.map(eq => {
      const faseId = eq.epocaAsignadaId
      if (!faseId) return () => {}
      return subscribeProgresoEpoca(game.grupoId, eq.id, faseId, snap => {
        setOtrosProgreso(prev => ({
          ...prev,
          [eq.id]: snap.exists() ? snap.data() : null,
        }))
      })
    })
    return () => unsubs.forEach(u => u())
  }, [game.grupoModo, game.grupoId, otrosEquipos])

  const currentIdx = epocas.findIndex(e => e.id === epocaId)
  const isLast = listo && currentIdx === epocas.length - 1 && epocas.length > 0
  const nextEpoca = epocas[currentIdx + 1] ?? null

  // Write ranking for competitive final epoch
  useEffect(() => {
    if (!isLast || !isCompetitivo || !listo || tiempoSegundos === null) return
    if (!game.grupoId || !game.equipoId || !game.experienciaId) return
    writeRanking(game.experienciaId, game.grupoId, game.equipoId, {
      equipoNombre: game.equipoNombre,
      experienciaId: game.experienciaId,
      tiempo: tiempoSegundos,
      puntuacion: progreso?.puntosCompletados?.length ?? 0,
    }).catch(() => {})
  }, [isLast, isCompetitivo, listo, tiempoSegundos])

  // Subscribe to ranking (competitive last epoch)
  useEffect(() => {
    if (!isLast || !isCompetitivo || !game.experienciaId || !game.grupoId) return
    return subscribeRanking(game.experienciaId, game.grupoId, snap => {
      setRankingData(
        snap.docs
          .map(d => ({ id: d.id, ...d.data() }))
          .sort((a, b) => {
            if (a.tiempo !== b.tiempo) return (a.tiempo ?? Infinity) - (b.tiempo ?? Infinity)
            return (a.fecha?.toMillis?.() ?? 0) - (b.fecha?.toMillis?.() ?? 0)
          })
      )
    })
  }, [isLast, isCompetitivo, game.experienciaId, game.grupoId])

  // Collaborative: are all other teams done with their individual phases?
  const todasFasesCompletadas = game.grupoModo === 'colaborativo' &&
    otrosEquipos.length > 0 &&
    otrosEquipos.every(eq => otrosProgreso[eq.id]?.estado === 'completado')

  const handleContinuar = () => {
    if (nextEpoca) {
      navigate(`/jugador/briefing/${nextEpoca.id}`)
    } else {
      navigate('/jugador')
    }
  }

  const desenlace = epoca?.desenlace

  const mostrarEsperaColaborativa = game.grupoModo === 'colaborativo' &&
    !game.epocaConjunta &&
    !todasFasesCompletadas &&
    listo

  // Build full ranking list merging finished teams + in-progress teams
  const rankingMap = Object.fromEntries(rankingData.map(r => [r.equipoId, r]))
  const rankingCompleto = [
    ...rankingData,
    ...todosEquipos
      .filter(eq => !(eq.id in rankingMap))
      .map(eq => ({ equipoId: eq.id, equipoNombre: eq.nombre, enCurso: true })),
  ]
  const myPosition = rankingCompleto.findIndex(r => r.equipoId === game.equipoId && !r.enCurso) + 1

  return (
    <div className="page page--dark epoch-complete">
      {desenlace?.videoUrl && (
        <div className="epoch-complete__desenlace">
          <video
            src={desenlace.videoUrl}
            controls
            autoPlay
            playsInline
            className="media-player"
          />
        </div>
      )}

      {!desenlace?.videoUrl && desenlace?.imagenUrl && (
        <div className="epoch-complete__desenlace-imagen">
          <img src={desenlace.imagenUrl} alt="Desenlace de la fase" className="media-imagen" />
        </div>
      )}

      {desenlace?.texto && (
        <div className="epoch-complete__desenlace-texto">
          <p>{desenlace.texto}</p>
        </div>
      )}

      <div className="epoch-complete__hero">
        <div className="epoch-complete__check">✓</div>
        <h1 className="epoch-complete__titulo">¡Fase completada!</h1>
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

      {/* Competitivo: clasificación del grupo */}
      {isLast && isCompetitivo && rankingCompleto.length > 0 && (
        <div className="epoch-complete__ranking">
          {myPosition > 0 && (
            <p className="epoch-complete__ranking-pos">
              Tu posición: <strong>#{myPosition}</strong>
            </p>
          )}
          <p className="tab-section-title">Clasificación del grupo</p>
          {rankingCompleto.map((r, i) => (
            <div
              key={r.equipoId}
              className={`ranking-item${r.equipoId === game.equipoId ? ' ranking-item--yo' : ''}${r.enCurso ? ' ranking-item--en-curso' : ` ranking-item--pos-${i + 1}`}`}
            >
              <span className="ranking-item__pos">{r.enCurso ? '—' : `#${i + 1}`}</span>
              <div className="ranking-item__info">
                <span className="ranking-item__nombre">{r.equipoNombre}</span>
              </div>
              <span className="ranking-item__tiempo">
                {r.enCurso ? 'En curso...' : formatTime(r.tiempo)}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Colaborativo: estado de otros equipos en su fase */}
      {game.grupoModo === 'colaborativo' && otrosEquipos.length > 0 && (
        <div className="epoch-complete__otros">
          <p className="tab-section-title">Otros equipos</p>
          {otrosEquipos.map(eq => (
            <OtroEquipo
              key={eq.id}
              equipo={eq}
              grupoId={game.grupoId}
              epocaId={eq.epocaAsignadaId ?? epocaId}
            />
          ))}
        </div>
      )}

      {/* Competitivo: estado de otros equipos en la misma fase */}
      {isCompetitivo && otrosEquipos.length > 0 && !isLast && (
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

      {mostrarEsperaColaborativa && (
        <div className="waiting-inline" style={{ marginTop: '24px' }}>
          <p className="waiting-inline__texto">
            Esperando a los otros equipos para las fases conjuntas...
          </p>
          <div className="waiting-inline__equipos">
            {otrosEquipos.map(eq => {
              const done = otrosProgreso[eq.id]?.estado === 'completado'
              return (
                <div key={eq.id} className={`waiting-equipo ${done ? 'waiting-equipo--done' : ''}`}>
                  <span className="waiting-equipo__nombre">{eq.nombre}</span>
                  <span className={`estado-badge estado-badge--${done ? 'completada' : 'activa'}`}>
                    {done ? '✓' : '...'}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      <div className="epoch-complete__footer">
        <button
          onClick={handleContinuar}
          disabled={!listo || (game.grupoModo === 'colaborativo' && !game.epocaConjunta && !todasFasesCompletadas && !!nextEpoca)}
          className="btn btn--primary btn--large"
        >
          {!listo
            ? 'Guardando...'
            : game.grupoModo === 'colaborativo' && !game.epocaConjunta && !todasFasesCompletadas && !!nextEpoca
              ? 'Esperando equipos...'
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
