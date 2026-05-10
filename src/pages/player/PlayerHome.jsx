import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useGame } from '../../context/GameContext'
import { getText } from '../../utils/helpers'
import {
  getExperiencia,
  subscribeEpocas,
  subscribeProgreso,
  subscribeProgresoConjunto,
  subscribeEquipos,
  subscribeProgresoEpoca,
  getGrupo,
  getEquipo,
} from '../../services/firestore'

function GlobalTimer({ progresos }) {
  const [elapsed, setElapsed] = useState(null)

  useEffect(() => {
    // New schema: use inicioActual + tiempoAcumuladoMs
    // Legacy fallback: tiempoInicio
    const calcBase = () => {
      let base = 0
      let startMs = null
      Object.values(progresos).forEach(p => {
        if (!p) return
        if ('tiempoAcumuladoMs' in p) {
          base += p.tiempoAcumuladoMs ?? 0
          if (p.inicioActual && p.estado === 'activo') {
            const t = p.inicioActual.toMillis()
            startMs = startMs === null ? t : Math.min(startMs, t)
          }
        } else if (p.tiempoInicio) {
          const t = p.tiempoInicio.toMillis()
          startMs = startMs === null ? t : Math.min(startMs, t)
        }
      })
      return { base, startMs }
    }
    const { base, startMs } = calcBase()
    if (startMs === null && base === 0) { setElapsed(null); return }
    const tick = () => {
      const current = startMs ? base + Date.now() - startMs : base
      setElapsed(Math.floor(current / 1000))
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [progresos])

  if (elapsed === null) return null

  const h = Math.floor(elapsed / 3600)
  const m = Math.floor((elapsed % 3600) / 60)
  const s = elapsed % 60
  const label = h > 0
    ? `${h}h ${String(m).padStart(2, '0')}m ${String(s).padStart(2, '0')}s`
    : `${String(m).padStart(2, '0')}m ${String(s).padStart(2, '0')}s`

  return (
    <div className="global-timer">
      <span className="global-timer__icon">⏱</span>
      <span className="global-timer__value">{label}</span>
    </div>
  )
}

function ModalConfirmacion({ fase, idioma, onConfirmar, onCancelar }) {
  return (
    <div className="modal-overlay" onClick={onCancelar}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <h2 className="modal__titulo">¿Preparados?</h2>
        <p className="modal__texto">
          Vais a empezar <strong>{getText(fase.nombre, idioma)}</strong>.<br />
          El cronómetro arrancará al pulsar "Empezar".
        </p>
        <div className="modal__actions">
          <button className="btn btn--ghost" onClick={onCancelar}>Espera</button>
          <button className="btn btn--primary" onClick={onConfirmar}>Empezar</button>
        </div>
      </div>
    </div>
  )
}

export default function PlayerHome() {
  const { game, setSesion, resetGame } = useGame()
  const navigate = useNavigate()

  const [experiencia, setExperiencia] = useState(null)
  const [epocas, setEpocas] = useState([])
  const [progresos, setProgresos] = useState({})
  const [progresosLoaded, setProgresosLoaded] = useState(false)
  const [grupoModo, setGrupoModo] = useState(null)
  const [faseAsignadaId, setFaseAsignadaId] = useState(null)
  const [todosEquipos, setTodosEquipos] = useState([])
  const [otrosEquiposProgreso, setOtrosEquiposProgreso] = useState({})
  const [cargando, setCargando] = useState(true)
  const [modalFase, setModalFase] = useState(null)

  // Load experience, group mode, and assigned fase
  useEffect(() => {
    if (!game.experienciaId || !game.grupoId || !game.equipoId) return
    Promise.all([
      getExperiencia(game.experienciaId),
      getGrupo(game.grupoId),
      getEquipo(game.grupoId, game.equipoId),
    ]).then(([expSnap, grupoSnap, equipoSnap]) => {
      if (expSnap.exists()) setExperiencia({ id: expSnap.id, ...expSnap.data() })
      const modo = grupoSnap.exists() ? (grupoSnap.data().modo ?? 'competitivo') : 'competitivo'
      const faseId = equipoSnap.exists() ? (equipoSnap.data().epocaAsignadaId ?? null) : null
      setGrupoModo(modo)
      setFaseAsignadaId(faseId)
      setSesion({ grupoModo: modo, faseAsignadaId: faseId })
      setCargando(false)
    })
  }, [game.experienciaId, game.grupoId, game.equipoId])

  // Subscribe to epochs
  useEffect(() => {
    if (!game.experienciaId) return
    return subscribeEpocas(game.experienciaId, snap => {
      setEpocas(
        snap.docs
          .map(d => ({ id: d.id, ...d.data() }))
          .sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0))
      )
    })
  }, [game.experienciaId])

  // Subscribe to individual progreso
  useEffect(() => {
    if (!game.grupoId || !game.equipoId) return
    return subscribeProgreso(game.grupoId, game.equipoId, snap => {
      const map = {}
      snap.docs.forEach(d => { map[d.id] = d.data() })
      setProgresos(prev => ({ ...prev, ...map }))
      setProgresosLoaded(true)
    })
  }, [game.grupoId, game.equipoId])

  // Subscribe to joint progreso
  useEffect(() => {
    if (!game.grupoId) return
    return subscribeProgresoConjunto(game.grupoId, snap => {
      const map = {}
      snap.docs.forEach(d => { map[d.id] = d.data() })
      setProgresos(prev => ({ ...prev, ...map }))
    })
  }, [game.grupoId])

  // Subscribe to all equipos (for collaborative unlock)
  useEffect(() => {
    if (!game.grupoId) return
    return subscribeEquipos(game.grupoId, snap => {
      setTodosEquipos(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    })
  }, [game.grupoId])

  // Subscribe to other teams' progreso when in collaborative mode and my fase is done
  const miProgFaseAsignada = faseAsignadaId ? progresos[faseAsignadaId] : null
  const miFaseCompletada = miProgFaseAsignada?.estado === 'completado'

  useEffect(() => {
    if (grupoModo !== 'colaborativo' || !miFaseCompletada || !game.grupoId) return
    const otros = todosEquipos.filter(e => e.id !== game.equipoId)
    if (!otros.length) return
    const unsubs = otros.map(eq => {
      const faseId = eq.epocaAsignadaId
      if (!faseId) return () => {}
      return subscribeProgresoEpoca(game.grupoId, eq.id, faseId, snap => {
        setOtrosEquiposProgreso(prev => ({
          ...prev,
          [eq.id]: snap.exists() ? snap.data() : null,
        }))
      })
    })
    return () => unsubs.forEach(u => u())
  }, [grupoModo, miFaseCompletada, todosEquipos, game.grupoId, game.equipoId])

  // Auto-navigate for single-fase experience
  useEffect(() => {
    if (!progresosLoaded || cargando || !grupoModo || epocas.length === 0) return
    const fasesInd = epocas.filter(e => !e.conjunta)
    if (fasesInd.length !== 1) return
    const fase = fasesInd[0]
    const prog = progresos[fase.id]
    if (!prog) {
      navigate(`/jugador/briefing/${fase.id}`, { replace: true })
    } else if (prog.estado === 'activo' || prog.estado === 'pausado') {
      navigate(`/jugador/epoca/${fase.id}`, { replace: true })
    }
  }, [progresosLoaded, cargando, grupoModo, epocas, progresos, navigate])

  // Computed: are all other teams done with their individual phases?
  const otros = todosEquipos.filter(e => e.id !== game.equipoId)
  const todasFasesAsignadasCompletadas = grupoModo === 'colaborativo' &&
    miFaseCompletada &&
    otros.length > 0 &&
    otros.every(eq => {
      if (!eq.epocaAsignadaId) return true
      return otrosEquiposProgreso[eq.id]?.estado === 'completado'
    })

  // Which phases to show
  const fasesParaMostrar = useMemo(() => {
    if (!grupoModo) return epocas
    if (grupoModo === 'competitivo') return epocas.filter(e => !e.conjunta)
    // Collaborative
    const miFase = epocas.find(e => e.id === faseAsignadaId)
    const result = miFase ? [miFase] : []
    if (todasFasesAsignadasCompletadas) {
      return [...result, ...epocas.filter(e => e.conjunta)]
    }
    return result
  }, [grupoModo, epocas, faseAsignadaId, todasFasesAsignadasCompletadas])

  const isPrerequisitoCumplido = (prereqId) => {
    if (progresos[prereqId]?.estado === 'completado') return true
    if (grupoModo === 'colaborativo') {
      for (const [eqId, prog] of Object.entries(otrosEquiposProgreso)) {
        const equipo = todosEquipos.find(e => e.id === eqId)
        if (equipo?.epocaAsignadaId === prereqId && prog?.estado === 'completado') return true
      }
    }
    return false
  }

  const idioma = game.idiomaElegido ?? 'es'

  const getMensajeBloqueo = (fase) => {
    const prereqs = fase.prerequisitos ?? []
    const pendientes = prereqs.filter(id => !isPrerequisitoCumplido(id))
    if (pendientes.length > 0) {
      const nombres = pendientes
        .map(id => getText(epocas.find(e => e.id === id)?.nombre, idioma) || id)
        .join(', ')
      return `Completa primero: ${nombres}`
    }
    if (fase.conjunta) return 'Se desbloqueará cuando todos los equipos completen sus fases.'
    return 'Completa tu fase asignada primero.'
  }

  const getEstado = (fase) => {
    const prog = progresos[fase.id]
    if (prog?.estado === 'completado') return 'completada'
    if (prog?.estado === 'activo' || prog?.estado === 'pausado') return 'activa'

    const prereqs = fase.prerequisitos ?? []
    if (prereqs.length > 0 && prereqs.some(id => !isPrerequisitoCumplido(id))) {
      return 'bloqueada'
    }

    if (!grupoModo) {
      // Legacy sequential
      const idx = epocas.findIndex(e => e.id === fase.id)
      if (idx === 0) return 'disponible'
      return progresos[epocas[idx - 1]?.id]?.estado === 'completado' ? 'disponible' : 'bloqueada'
    }
    if (grupoModo === 'competitivo') return 'disponible'
    if (grupoModo === 'colaborativo') {
      if (fase.conjunta) return todasFasesAsignadasCompletadas ? 'disponible' : 'bloqueada'
      return 'disponible'
    }
    return 'disponible'
  }

  const handleClickFase = (fase) => {
    const estado = getEstado(fase)
    if (estado === 'bloqueada') return
    if (estado === 'completada') {
      navigate(`/jugador/epoca/${fase.id}/completada`)
      return
    }
    if (estado === 'activa') {
      navigate(`/jugador/epoca/${fase.id}`)
      return
    }
    setModalFase(fase)
  }

  const confirmarEmpezar = () => {
    const fase = modalFase
    setModalFase(null)
    navigate(`/jugador/briefing/${fase.id}`)
  }

  if (cargando) {
    return (
      <div className="page page--dark">
        <div className="loading-screen"><div className="spinner" /></div>
      </div>
    )
  }

  return (
    <main className="page page--dark player-home">
      {modalFase && (
        <ModalConfirmacion
          fase={modalFase}
          idioma={idioma}
          onConfirmar={confirmarEmpezar}
          onCancelar={() => setModalFase(null)}
        />
      )}

      <header className="player-home__header">
        <div className="player-home__info">
          <p className="player-home__experiencia">{experiencia?.nombre ?? '…'}</p>
          <h1 className="player-home__equipo">{game.equipoNombre}</h1>
          <span className="code-badge">{game.grupoCodigo}</span>
        </div>
        <button onClick={resetGame} className="btn btn--ghost btn--small">Salir</button>
      </header>

      <GlobalTimer progresos={progresos} />

      <section className="player-home__epocas">
        {fasesParaMostrar.map((fase) => {
          const estado = getEstado(fase)
          const prog = progresos[fase.id]
          return (
            <div
              key={fase.id}
              className={`epoca-card epoca-card--${estado}`}
              onClick={() => handleClickFase(fase)}
              role={estado !== 'bloqueada' ? 'button' : undefined}
            >
              <div className="epoca-card__header">
                <div className="epoca-card__info">
                  <h2 className="epoca-card__nombre">{getText(fase.nombre, idioma)}</h2>
                  {fase.conjunta && (
                    <span className="texto-conjunto">Fase conjunta</span>
                  )}
                  {estado === 'bloqueada' && (
                    <p className="epoca-card__bloqueo">
                      {getMensajeBloqueo(fase)}
                    </p>
                  )}
                  {estado !== 'bloqueada' && getText(fase.descripcion, idioma) && (
                    <p className="epoca-card__desc">{getText(fase.descripcion, idioma)}</p>
                  )}
                </div>
                <span className={`estado-badge estado-badge--${estado}`}>
                  {estado === 'completada' && '✓'}
                  {estado === 'activa' && '▶'}
                  {estado === 'disponible' && '→'}
                  {estado === 'bloqueada' && '🔒'}
                </span>
              </div>
              {prog?.estado === 'completado' && (
                <div className="epoca-card__stats">
                  <span>{prog.puntosCompletados?.length ?? 0} puntos</span>
                  {prog.penalizacionMinutos > 0 && (
                    <span className="text-muted">+{prog.penalizacionMinutos} min penalización</span>
                  )}
                </div>
              )}
            </div>
          )
        })}

        {fasesParaMostrar.length === 0 && !cargando && (
          <div className="empty-state">
            {grupoModo === 'colaborativo' && !faseAsignadaId
              ? <p>No tienes ninguna fase asignada. Contacta con el coordinador.</p>
              : <p>No hay fases disponibles todavía.</p>
            }
          </div>
        )}

        {grupoModo === 'colaborativo' && miFaseCompletada && !todasFasesAsignadasCompletadas && (
          <div className="waiting-inline">
            <p className="waiting-inline__texto">
              Esperando a los otros equipos para continuar con las fases conjuntas...
            </p>
            <div className="waiting-inline__equipos">
              {otros.map(eq => {
                const done = otrosEquiposProgreso[eq.id]?.estado === 'completado'
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
      </section>
    </main>
  )
}
