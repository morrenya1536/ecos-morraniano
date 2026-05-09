import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useGame } from '../../context/GameContext'
import { getExperiencia, subscribeEpocas, subscribeProgreso } from '../../services/firestore'

function GlobalTimer({ progresos }) {
  const [elapsed, setElapsed] = useState(null)

  useEffect(() => {
    const inicios = Object.values(progresos)
      .filter(p => p.tiempoInicio)
      .map(p => p.tiempoInicio.toMillis())
    if (inicios.length === 0) { setElapsed(null); return }
    const start = Math.min(...inicios)
    const tick = () => setElapsed(Math.floor((Date.now() - start) / 1000))
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

function ModalConfirmacion({ epoca, onConfirmar, onCancelar }) {
  return (
    <div className="modal-overlay" onClick={onCancelar}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <h2 className="modal__titulo">¿Preparados?</h2>
        <p className="modal__texto">
          Vais a empezar <strong>{epoca.nombre}</strong>.<br />
          El cronómetro arrancará al pulsar "Empezar" y no se puede pausar.
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
  const { game, resetGame } = useGame()
  const navigate = useNavigate()
  const [experiencia, setExperiencia] = useState(null)
  const [epocas, setEpocas] = useState([])
  const [progresos, setProgresos] = useState({})
  const [cargando, setCargando] = useState(true)
  const [modalEpoca, setModalEpoca] = useState(null)

  useEffect(() => {
    if (!game.experienciaId) return
    getExperiencia(game.experienciaId).then(snap => {
      if (snap.exists()) setExperiencia({ id: snap.id, ...snap.data() })
      setCargando(false)
    })
  }, [game.experienciaId])

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

  useEffect(() => {
    if (!game.grupoId || !game.equipoId) return
    return subscribeProgreso(game.grupoId, game.equipoId, snap => {
      const map = {}
      snap.docs.forEach(d => { map[d.id] = d.data() })
      setProgresos(map)
    })
  }, [game.grupoId, game.equipoId])

  const getEstado = (epoca, idx) => {
    const prog = progresos[epoca.id]
    if (prog?.estado === 'completado') return 'completada'
    if (prog?.estado === 'activo') return 'activa'
    if (idx === 0) return 'disponible'
    const anterior = epocas[idx - 1]
    if (progresos[anterior?.id]?.estado === 'completado') return 'disponible'
    return 'bloqueada'
  }

  const getMotivoBloqueo = (idx) => {
    if (idx === 0) return null
    return `Disponible al completar ${epocas[idx - 1]?.nombre}`
  }

  const handleClickEpoca = (epoca, estado, idx) => {
    if (estado === 'bloqueada') return
    if (estado === 'completada') {
      navigate(`/jugador/epoca/${epoca.id}/completada`)
      return
    }
    if (estado === 'activa') {
      navigate(`/jugador/epoca/${epoca.id}`)
      return
    }
    setModalEpoca(epoca)
  }

  const confirmarEmpezar = () => {
    const epoca = modalEpoca
    setModalEpoca(null)
    navigate(`/jugador/briefing/${epoca.id}`)
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
      {modalEpoca && (
        <ModalConfirmacion
          epoca={modalEpoca}
          onConfirmar={confirmarEmpezar}
          onCancelar={() => setModalEpoca(null)}
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
        {epocas.map((epoca, idx) => {
          const estado = getEstado(epoca, idx)
          const prog = progresos[epoca.id]
          return (
            <div
              key={epoca.id}
              className={`epoca-card epoca-card--${estado}`}
              onClick={() => handleClickEpoca(epoca, estado, idx)}
              role={estado !== 'bloqueada' ? 'button' : undefined}
            >
              <div className="epoca-card__header">
                <span className="epoca-card__num">{idx + 1}</span>
                <div className="epoca-card__info">
                  <h2 className="epoca-card__nombre">{epoca.nombre}</h2>
                  {estado === 'bloqueada' && (
                    <p className="epoca-card__bloqueo">{getMotivoBloqueo(idx)}</p>
                  )}
                  {estado !== 'bloqueada' && epoca.descripcion && (
                    <p className="epoca-card__desc">{epoca.descripcion}</p>
                  )}
                </div>
                <span className={`estado-badge estado-badge--${estado}`}>
                  {estado === 'completada' && '✓'}
                  {estado === 'activa' && '▶'}
                  {estado === 'disponible' && '→'}
                  {estado === 'bloqueada' && '🔒'}
                </span>
              </div>
              {prog?.estado === 'completada' && (
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
        {epocas.length === 0 && (
          <div className="empty-state">
            <p>No hay épocas disponibles todavía.</p>
          </div>
        )}
      </section>
    </main>
  )
}
