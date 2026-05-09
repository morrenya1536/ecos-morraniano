import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useCoordinator } from '../../hooks/useCoordinator'
import {
  subscribeExperiencias,
  subscribeGruposAll,
  subscribeEquipos,
  subscribeProgresoEpoca,
  subscribeProgreso,
  resetearFase,
} from '../../services/firestore'
import LoadingScreen from '../../components/shared/LoadingScreen'

function formatTime(s) {
  if (!s && s !== 0) return '--'
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  if (h > 0) return `${h}h ${String(m).padStart(2, '0')}m ${String(sec).padStart(2, '0')}s`
  return `${String(m).padStart(2, '0')}m ${String(sec).padStart(2, '0')}s`
}

function useElapsedCoord(progreso) {
  const [elapsed, setElapsed] = useState(0)
  const acumulado = progreso?.tiempoAcumuladoMs ?? null
  const inicioMs = progreso?.inicioActual?.toMillis?.() ?? null
  const estado = progreso?.estado ?? null

  useEffect(() => {
    if (acumulado === null) return
    if (!inicioMs || estado !== 'activo') {
      setElapsed(Math.floor(acumulado / 1000))
      return
    }
    const tick = () => setElapsed(Math.floor((acumulado + Date.now() - inicioMs) / 1000))
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [acumulado, inicioMs, estado])

  return elapsed
}

function EquipoRow({ grupoId, equipo, modoGrupo }) {
  // undefined = cargando (suscripción no ha respondido aún)
  // null = confirmado sin progreso
  // object = progreso real
  const [progreso, setProgreso] = useState(undefined)
  const [epocaActivaId, setEpocaActivaId] = useState(null)
  const elapsed = useElapsedCoord(progreso ?? null)
  const [confirmando, setConfirmando] = useState(false)
  const [reseteando, setReseteando] = useState(false)

  useEffect(() => {
    if (!grupoId || !equipo.id) {
      setProgreso(null)
      return
    }

    const epocaAsignada = equipo.epocaAsignadaId || null

    if (modoGrupo === 'colaborativo' && epocaAsignada) {
      // Colaborativo con fase asignada: escuchar esa época concreta
      const ruta = `grupos/${grupoId}/equipos/${equipo.id}/progreso/${epocaAsignada}`
      console.log('[CoordPanel] Suscribiendo doc:', ruta)
      setEpocaActivaId(epocaAsignada)
      return subscribeProgresoEpoca(grupoId, equipo.id, epocaAsignada, snap => {
        const data = snap.exists() ? snap.data() : null
        console.log('[CoordPanel] Snapshot recibido:', ruta, snap.exists() ? data?.estado : '(no existe)')
        setProgreso(data)
      })
    }

    // Competitivo o sin época asignada: escuchar toda la colección de progreso
    const ruta = `grupos/${grupoId}/equipos/${equipo.id}/progreso`
    console.log('[CoordPanel] Suscribiendo colección:', ruta)
    return subscribeProgreso(grupoId, equipo.id, snap => {
      if (snap.empty) {
        console.log('[CoordPanel] Colección vacía:', ruta)
        setEpocaActivaId(null)
        setProgreso(null)
        return
      }
      const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }))
      console.log('[CoordPanel] Docs progreso:', ruta, docs.map(d => `${d.id.slice(0, 6)}:${d.estado}`))
      // Prioridad: activo/pausado → después el más reciente completado
      const vivo = docs.find(d => d.estado === 'activo' || d.estado === 'pausado')
      const ref = vivo ?? [...docs].sort(
        (a, b) => (b.tiempoAcumuladoMs ?? 0) - (a.tiempoAcumuladoMs ?? 0)
      )[0]
      setEpocaActivaId(ref.id)
      setProgreso(ref)
    })
  }, [grupoId, equipo.id, modoGrupo, equipo.epocaAsignadaId])

  const estado = progreso?.estado ?? null
  const estadoLabel = estado === 'activo' ? 'Activo'
    : estado === 'pausado' ? 'Pausado'
    : estado === 'completado' ? 'Completado'
    : progreso === null ? 'No iniciado'
    : '…'

  // En colaborativo, la época a resetear es siempre la asignada;
  // en competitivo, la que hayamos detectado como activa
  const epocaResetId = (modoGrupo === 'colaborativo' ? equipo.epocaAsignadaId : epocaActivaId) || null

  const handleResetear = async () => {
    if (!epocaResetId) return
    setReseteando(true)
    try {
      await resetearFase(grupoId, equipo.id, epocaResetId)
      setConfirmando(false)
    } finally {
      setReseteando(false)
    }
  }

  return (
    <div className="partida-equipo">
      <div className="partida-equipo__info">
        <span className="partida-equipo__nombre">{equipo.nombre}</span>
        {progreso !== undefined && (
          <span className={`estado-badge estado-badge--${estado ?? 'no-iniciado'}`}>
            {estadoLabel}
          </span>
        )}
        {progreso && estado === 'activo' && (
          <span className="partida-equipo__tiempo">{formatTime(elapsed)}</span>
        )}
      </div>

      {/* El botón de resetear aparece siempre que haya época identificada */}
      {epocaResetId && !confirmando && (
        <button
          onClick={() => setConfirmando(true)}
          className="btn btn--ghost btn--small"
        >
          Resetear
        </button>
      )}
      {confirmando && (
        <div className="partida-equipo__confirm">
          <span className="text-muted text-small">
            ¿Resetear la fase de «{equipo.nombre}»? El equipo tendrá que empezar desde el principio.
          </span>
          <button
            onClick={handleResetear}
            disabled={reseteando}
            className="btn btn--danger btn--small"
          >
            {reseteando ? '...' : 'Sí, resetear'}
          </button>
          <button onClick={() => setConfirmando(false)} className="btn btn--ghost btn--small">
            Cancelar
          </button>
        </div>
      )}
    </div>
  )
}

function GrupoCard({ grupo }) {
  const [equipos, setEquipos] = useState([])

  useEffect(() => {
    return subscribeEquipos(grupo.id, snap => {
      setEquipos(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    })
  }, [grupo.id])

  if (equipos.length === 0) return null

  const modoGrupo = grupo.modo ?? 'competitivo'

  return (
    <div className="partida-card">
      <div className="partida-card__header">
        <h3 className="partida-card__nombre">{grupo.nombre}</h3>
        <span className="modo-badge">
          {modoGrupo === 'colaborativo' ? 'Colaborativo' : 'Competitivo'}
        </span>
        <Link
          to={`/coordinador/grupos/${grupo.experienciaId}`}
          className="btn btn--ghost btn--small"
        >
          Gestionar
        </Link>
      </div>
      <div className="partida-card__equipos">
        {equipos.map(eq => (
          <EquipoRow
            key={eq.id}
            grupoId={grupo.id}
            equipo={eq}
            modoGrupo={modoGrupo}
          />
        ))}
      </div>
    </div>
  )
}

export default function CoordinatorHome() {
  const { coordinador } = useAuth()
  const { logout } = useCoordinator()
  const [experiencias, setExperiencias] = useState([])
  const [grupos, setGrupos] = useState([])
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    const unsubExp = subscribeExperiencias((snap) => {
      setExperiencias(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
      setCargando(false)
    })
    const unsubGrupos = subscribeGruposAll(snap => {
      setGrupos(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    })
    return () => { unsubExp(); unsubGrupos() }
  }, [])

  if (cargando) return <LoadingScreen mensaje="Cargando..." />

  const expActivasSet = new Set(experiencias.filter(e => e.activa).map(e => e.id))
  const gruposActivos = grupos.filter(g => expActivasSet.has(g.experienciaId))

  return (
    <main className="page panel">
      <header className="page__header">
        <div>
          <h1>Panel de Coordinador</h1>
          <p className="text-muted">{coordinador?.email}</p>
        </div>
        <button onClick={logout} className="btn btn--ghost btn--small">Cerrar sesión</button>
      </header>

      {/* ── Partidas activas ─────────────────────────────────────────── */}
      {gruposActivos.length > 0 && (
        <section className="page__content">
          <div className="section-header">
            <h2>Partidas activas</h2>
          </div>
          <div className="card-list">
            {gruposActivos.map(g => (
              <GrupoCard key={g.id} grupo={g} />
            ))}
          </div>
        </section>
      )}

      {/* ── Experiencias ─────────────────────────────────────────────── */}
      <section className="page__content">
        <div className="section-header">
          <h2>Experiencias</h2>
          <Link to="/coordinador/experiencias/nueva" className="btn btn--small">
            + Nueva
          </Link>
        </div>

        {experiencias.length === 0 ? (
          <div className="empty-state">
            <p>Aún no hay experiencias.</p>
            <Link to="/coordinador/experiencias/nueva" className="btn">
              Crear primera experiencia
            </Link>
          </div>
        ) : (
          <div className="card-list">
            {experiencias.map((exp) => (
              <div key={exp.id} className="card">
                <div className="card__header">
                  <div className="card__title-group">
                    <h3 className="card__title">{exp.nombre}</h3>
                    <span className={`badge ${exp.activa ? 'badge--active' : 'badge--inactive'}`}>
                      {exp.activa ? 'Activa' : 'Inactiva'}
                    </span>
                  </div>
                  <div className="card__actions">
                    <Link
                      to={`/coordinador/grupos/${exp.id}`}
                      className="btn btn--ghost btn--small"
                    >
                      Grupos
                    </Link>
                    <Link
                      to={`/coordinador/experiencias/${exp.id}`}
                      className="btn btn--small"
                    >
                      Editar
                    </Link>
                  </div>
                </div>
                {exp.descripcion && (
                  <p className="card__desc">{exp.descripcion}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  )
}
