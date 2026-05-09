import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useGame } from '../../context/GameContext'
import {
  getProgresoEpoca,
  initProgresoEpoca,
  subscribeEquipos,
  marcarEquipoListo,
  subscribeFaseConjunta,
} from '../../services/firestore'
import { getDocs, collection } from 'firebase/firestore'
import { db } from '../../services/firebase'

export default function BriefingScreen() {
  const { epocaId } = useParams()
  const { game, setSesion } = useGame()
  const navigate = useNavigate()
  const [epoca, setEpoca] = useState(null)
  const [primerPunto, setPrimerPunto] = useState(null)
  const [cargando, setCargando] = useState(true)
  const [empezando, setEmpezando] = useState(false)

  // Joint phase state
  const [esConjunta, setEsConjunta] = useState(false)
  const [todosEquipos, setTodosEquipos] = useState([])
  const [equiposListos, setEquiposListos] = useState({})
  const [yoListo, setYoListo] = useState(false)

  useEffect(() => {
    if (!game.experienciaId || !epocaId || !game.grupoId || !game.equipoId) return

    const load = async () => {
      const epocasSnap = await getDocs(
        collection(db, 'experiencias', game.experienciaId, 'epocas')
      )
      const epocaData = epocasSnap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .find(e => e.id === epocaId)
      setEpoca(epocaData)

      const conjunta = !!(epocaData?.conjunta && game.grupoModo === 'colaborativo')
      setEsConjunta(conjunta)
      const equipoIdProgreso = conjunta ? 'conjunto' : game.equipoId

      // Check if progreso already active → skip briefing
      const progSnap = await getProgresoEpoca(game.grupoId, equipoIdProgreso, epocaId)
      if (progSnap.exists() && (progSnap.data().estado === 'activo' || progSnap.data().estado === 'pausado')) {
        setSesion({ epocaConjunta: conjunta })
        navigate(`/jugador/epoca/${epocaId}`, { replace: true })
        return
      }

      // Load first punto
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
  }, [epocaId, game.experienciaId, game.grupoId, game.equipoId, game.grupoModo, navigate, setSesion])

  // Subscribe to equipos and readiness doc (joint phases only)
  useEffect(() => {
    if (!esConjunta || !game.grupoId) return
    const unsub1 = subscribeEquipos(game.grupoId, snap => {
      setTodosEquipos(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    })
    const unsub2 = subscribeFaseConjunta(game.grupoId, epocaId, snap => {
      setEquiposListos(snap.exists() ? (snap.data().equiposListos ?? {}) : {})
    })
    return () => { unsub1(); unsub2() }
  }, [esConjunta, game.grupoId, epocaId])

  const handleConfirmarPresencia = async () => {
    setYoListo(true)
    await marcarEquipoListo(game.grupoId, epocaId, game.equipoId)
  }

  const todosListos = esConjunta && todosEquipos.length > 0 &&
    todosEquipos.every(eq => eq.id in equiposListos)

  const handleEmpezar = async () => {
    setEmpezando(true)
    const equipoIdProgreso = esConjunta ? 'conjunto' : game.equipoId
    await initProgresoEpoca(game.grupoId, equipoIdProgreso, epocaId, {
      experienciaId: game.experienciaId,
      epocaId,
      grupoId: game.grupoId,
      equipoId: equipoIdProgreso,
      equipoNombre: esConjunta ? 'conjunto' : game.equipoNombre,
    })
    setSesion({ epocaConjunta: esConjunta })
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

        {esConjunta && (
          <div className="briefing__conjunta">
            <p className="texto-conjunto">Fase conjunta — todos los equipos juntos</p>
            <div className="waiting-inline">
              <p className="waiting-inline__texto">Confirmad vuestra presencia antes de empezar:</p>
              <div className="waiting-inline__equipos">
                {todosEquipos.map(eq => {
                  const listo = eq.id in equiposListos
                  return (
                    <div key={eq.id} className={`waiting-equipo ${listo ? 'waiting-equipo--done' : ''}`}>
                      <span className="waiting-equipo__nombre">{eq.nombre}</span>
                      <span className={`estado-badge estado-badge--${listo ? 'completada' : 'activa'}`}>
                        {listo ? '✓' : '...'}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="briefing__footer">
        {esConjunta ? (
          <>
            {!yoListo && !(game.equipoId in equiposListos) && (
              <button
                onClick={handleConfirmarPresencia}
                className="btn btn--ghost btn--large"
              >
                Confirmar presencia
              </button>
            )}
            <button
              onClick={handleEmpezar}
              disabled={!todosListos || empezando}
              className="btn btn--primary btn--large"
            >
              {empezando ? 'Iniciando...' : todosListos ? 'Empezar fase conjunta' : 'Esperando equipos...'}
            </button>
          </>
        ) : (
          <button
            onClick={handleEmpezar}
            disabled={empezando}
            className="btn btn--primary btn--large"
          >
            {empezando ? 'Iniciando...' : 'Entendido, empezamos'}
          </button>
        )}
      </div>
    </main>
  )
}
