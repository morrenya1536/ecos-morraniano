import { useEffect, useState, useMemo, useCallback } from 'react'
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
  getEpocas,
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

// ─── EquipoRow — fila de equipo con estado en tiempo real ─────────────────

function EquipoRow({ grupoId, equipo, modoGrupo }) {
  const [progreso, setProgreso] = useState(undefined)
  const [epocaActivaId, setEpocaActivaId] = useState(null)
  const elapsed = useElapsedCoord(progreso ?? null)
  const [confirmando, setConfirmando] = useState(false)
  const [reseteando, setReseteando] = useState(false)

  useEffect(() => {
    if (!grupoId || !equipo.id) { setProgreso(null); return }
    const epocaAsignada = equipo.epocaAsignadaId || null

    if (modoGrupo === 'colaborativo' && epocaAsignada) {
      setEpocaActivaId(epocaAsignada)
      return subscribeProgresoEpoca(grupoId, equipo.id, epocaAsignada, snap => {
        setProgreso(snap.exists() ? snap.data() : null)
      })
    }

    return subscribeProgreso(grupoId, equipo.id, snap => {
      if (snap.empty) { setEpocaActivaId(null); setProgreso(null); return }
      const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }))
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

      {epocaResetId && !confirmando && (
        <button onClick={() => setConfirmando(true)} className="btn btn--ghost btn--small">
          Resetear
        </button>
      )}
      {confirmando && (
        <div className="partida-equipo__confirm">
          <span className="text-muted text-small">
            ¿Resetear la fase de «{equipo.nombre}»? El equipo tendrá que empezar desde el principio.
          </span>
          <button onClick={handleResetear} disabled={reseteando} className="btn btn--danger btn--small">
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

// ─── GrupoEstadoTracker — worker sin UI, siempre montado ──────────────────
// Suscribe a equipos + progreso + épocas y calcula el estado del grupo.
// Solo notifica al padre cuando todos los datos están cargados (nunca durante la carga).

function GrupoEstadoTracker({ grupo, onEstadoChange }) {
  const modoGrupo = grupo.modo ?? 'competitivo'

  // null = todavía no ha llegado la suscripción; [] = llegó vacío; [...] = datos reales
  const [equipos, setEquipos] = useState(null)
  const [epocas, setEpocas] = useState(null)
  const [progresoPorEquipo, setProgresoPorEquipo] = useState({})

  useEffect(() =>
    subscribeEquipos(grupo.id, snap => {
      setEquipos(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    }),
  [grupo.id])

  useEffect(() => {
    if (!grupo.experienciaId) { setEpocas([]); return }
    getEpocas(grupo.experienciaId)
      .then(snap => setEpocas(snap.docs.map(d => ({ id: d.id, ...d.data() }))))
      .catch(() => setEpocas([]))
  }, [grupo.experienciaId])

  // Reconstruir suscripciones de progreso cuando cambia la lista de equipos
  const equipoIdsKey = (equipos ?? []).map(e => e.id).sort().join(',')
  useEffect(() => {
    if (!equipos || !equipos.length) return
    const cancelFns = equipos.map(eq =>
      subscribeProgreso(grupo.id, eq.id, snap => {
        setProgresoPorEquipo(prev => ({
          ...prev,
          [eq.id]: snap.docs.map(d => ({ id: d.id, ...d.data() })),
        }))
      })
    )
    return () => cancelFns.forEach(c => c())
  }, [grupo.id, equipoIdsKey]) // eslint-disable-line react-hooks/exhaustive-deps

  // Solo calcular y notificar cuando TODOS los datos han llegado de Firestore
  useEffect(() => {
    if (equipos === null || epocas === null) return

    const todosCargados = equipos.every(eq => eq.id in progresoPorEquipo)
    if (!todosCargados) return

    let estado
    if (!equipos.length) {
      estado = 'pendiente'
    } else {
      const conProgreso = equipos.filter(eq => (progresoPorEquipo[eq.id] ?? []).length > 0)
      if (!conProgreso.length) {
        estado = 'pendiente'
      } else if (modoGrupo === 'colaborativo') {
        const epocasNormales = epocas.filter(e => !e.esConjunta)
        if (!epocasNormales.length) {
          estado = 'en-curso'
        } else {
          const finalizado = epocasNormales.every(epoca =>
            equipos.some(eq =>
              (progresoPorEquipo[eq.id] ?? []).some(p => p.id === epoca.id && p.estado === 'completado')
            )
          )
          estado = finalizado ? 'finalizado' : 'en-curso'
        }
      } else {
        // Competitivo: todos los equipos completaron todas las épocas
        if (!epocas.length) {
          estado = 'en-curso'
        } else {
          const finalizado = equipos.every(eq =>
            epocas.every(epoca =>
              (progresoPorEquipo[eq.id] ?? []).some(p => p.id === epoca.id && p.estado === 'completado')
            )
          )
          estado = finalizado ? 'finalizado' : 'en-curso'
        }
      }
    }

    onEstadoChange(grupo.id, estado)
  }, [equipos, epocas, progresoPorEquipo, modoGrupo, grupo.id, onEstadoChange])

  return null
}

// ─── GrupoCardDisplay — tarjeta colapsable visible ────────────────────────
// Solo gestiona la visualización. No tiene efecto sobre el estado de clasificación
// del grupo, por lo que puede montarse/desmontarse libremente.

function GrupoCardDisplay({ grupo }) {
  const modoGrupo = grupo.modo ?? 'competitivo'
  const [equipos, setEquipos] = useState([])
  const [abierto, setAbierto] = useState(false)

  useEffect(() =>
    subscribeEquipos(grupo.id, snap => {
      setEquipos(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    }),
  [grupo.id])

  return (
    <div className="partida-card">
      <button className="partida-card__toggle" onClick={() => setAbierto(v => !v)}>
        <span className="partida-card__nombre">{grupo.nombre}</span>
        <span className="modo-badge">
          {modoGrupo === 'colaborativo' ? 'Colaborativo' : 'Competitivo'}
        </span>
        {equipos.length > 0 && (
          <span className="text-muted text-small">{equipos.length} equipos</span>
        )}
        <span className="partida-card__chevron">{abierto ? '▲' : '▼'}</span>
      </button>

      {abierto && (
        <div className="partida-card__body">
          <div className="partida-card__body-actions">
            <Link to={`/coordinador/grupos/${grupo.experienciaId}`} className="btn btn--ghost btn--small">
              Gestionar
            </Link>
          </div>
          <div className="partida-card__equipos">
            {equipos.map(eq => (
              <EquipoRow key={eq.id} grupoId={grupo.id} equipo={eq} modoGrupo={modoGrupo} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── TabPartidas ───────────────────────────────────────────────────────────

const SECCIONES_PARTIDAS = [
  { key: 'en-curso',   label: 'En curso' },
  { key: 'pendiente',  label: 'Pendientes' },
  { key: 'finalizado', label: 'Finalizadas' },
]

function TabPartidas({ grupos, experiencias }) {
  // Solo contiene estados YA CONFIRMADOS (nunca 'loading').
  // Los trackers están siempre montados y actualizan este mapa cuando tienen datos completos.
  const [estadosGrupo, setEstadosGrupo] = useState({})
  const [seccionesAbiertas, setSeccionesAbiertas] = useState({
    'en-curso': true,
    pendiente: true,
    finalizado: false,
  })

  // Ignora el 'loading' inicial — solo acepta estados reales confirmados
  const handleEstadoChange = useCallback((grupoId, estado) => {
    setEstadosGrupo(prev => {
      if (prev[grupoId] === estado) return prev
      return { ...prev, [grupoId]: estado }
    })
  }, [])

  const expActivasSet = useMemo(
    () => new Set(experiencias.filter(e => e.activa).map(e => e.id)),
    [experiencias]
  )
  const gruposActivos = useMemo(
    () => grupos.filter(g => expActivasSet.has(g.experienciaId)),
    [grupos, expActivasSet]
  )

  const gruposPorEstado = useMemo(() => {
    const map = { 'en-curso': [], pendiente: [], finalizado: [] }
    gruposActivos.forEach(g => {
      const estado = estadosGrupo[g.id]
      if (estado) map[estado].push(g)
    })
    return map
  }, [gruposActivos, estadosGrupo])

  const nSinClasificar = gruposActivos.filter(g => !estadosGrupo[g.id]).length

  if (!gruposActivos.length) {
    return <div className="empty-state"><p>No hay partidas activas.</p></div>
  }

  return (
    <div className="partidas-secciones">
      {/* Trackers siempre montados — nulo en el DOM, calculan estado sin UI */}
      {gruposActivos.map(g => (
        <GrupoEstadoTracker key={g.id} grupo={g} onEstadoChange={handleEstadoChange} />
      ))}

      {/* Indicador mientras los trackers clasifican los grupos */}
      {nSinClasificar > 0 && (
        <p className="partidas-cargando text-muted text-small">Cargando partidas…</p>
      )}

      {SECCIONES_PARTIDAS.map(({ key, label }) => {
        const lista = gruposPorEstado[key]
        if (!lista.length) return null
        return (
          <section key={key} className="partidas-seccion">
            <button
              className="partidas-seccion__header"
              onClick={() => setSeccionesAbiertas(prev => ({ ...prev, [key]: !prev[key] }))}
            >
              <span className="partidas-seccion__titulo">{label}</span>
              <span className="partidas-seccion__count">{lista.length}</span>
              <span className="partidas-seccion__chevron">{seccionesAbiertas[key] ? '▲' : '▼'}</span>
            </button>
            {seccionesAbiertas[key] && (
              <div className="partidas-seccion__body">
                {lista.map(g => (
                  <GrupoCardDisplay key={g.id} grupo={g} />
                ))}
              </div>
            )}
          </section>
        )
      })}
    </div>
  )
}

// ─── TabGrupos ─────────────────────────────────────────────────────────────

function GrupoResumen({ grupo, expById }) {
  const [nEquipos, setNEquipos] = useState(null)
  const modoGrupo = grupo.modo ?? 'competitivo'
  const exp = expById[grupo.experienciaId]

  useEffect(() =>
    subscribeEquipos(grupo.id, snap => setNEquipos(snap.size)),
  [grupo.id])

  return (
    <div className="card">
      <div className="card__header">
        <div className="card__title-group">
          <h3 className="card__title">{grupo.nombre}</h3>
          <span className="modo-badge">
            {modoGrupo === 'colaborativo' ? 'Colaborativo' : 'Competitivo'}
          </span>
          {nEquipos !== null && (
            <span className="text-muted text-small">{nEquipos} equipos</span>
          )}
        </div>
        <div className="card__actions">
          <Link to={`/coordinador/grupos/${grupo.experienciaId}`} className="btn btn--ghost btn--small">
            Gestionar
          </Link>
        </div>
      </div>
      {exp && <p className="card__desc">{exp.nombre}</p>}
    </div>
  )
}

function TabGrupos({ grupos, experiencias }) {
  const expById = useMemo(() => {
    const m = {}
    experiencias.forEach(e => { m[e.id] = e })
    return m
  }, [experiencias])

  if (!grupos.length) {
    return <div className="empty-state"><p>No hay grupos creados.</p></div>
  }

  return (
    <div className="card-list">
      {grupos.map(g => (
        <GrupoResumen key={g.id} grupo={g} expById={expById} />
      ))}
    </div>
  )
}

// ─── TabExperiencias ───────────────────────────────────────────────────────

function TabExperiencias({ experiencias }) {
  return (
    <div>
      <div className="section-header" style={{ marginBottom: 'var(--gap)' }}>
        <span />
        <Link to="/coordinador/experiencias/nueva" className="btn btn--small">
          + Nueva
        </Link>
      </div>

      {!experiencias.length ? (
        <div className="empty-state">
          <p>Aún no hay experiencias.</p>
          <Link to="/coordinador/experiencias/nueva" className="btn">
            Crear primera experiencia
          </Link>
        </div>
      ) : (
        <div className="card-list">
          {experiencias.map(exp => (
            <div key={exp.id} className="card">
              <div className="card__header">
                <div className="card__title-group">
                  <h3 className="card__title">{exp.nombre}</h3>
                  <span className={`badge ${exp.activa ? 'badge--active' : 'badge--inactive'}`}>
                    {exp.activa ? 'Activa' : 'Inactiva'}
                  </span>
                </div>
                <div className="card__actions">
                  <Link to={`/coordinador/grupos/${exp.id}`} className="btn btn--ghost btn--small">
                    Grupos
                  </Link>
                  <Link to={`/coordinador/experiencias/${exp.id}`} className="btn btn--small">
                    Editar
                  </Link>
                </div>
              </div>
              {exp.descripcion && <p className="card__desc">{exp.descripcion}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── CoordinatorHome ───────────────────────────────────────────────────────

const TABS = [
  { key: 'partidas',     label: 'Partidas' },
  { key: 'grupos',       label: 'Grupos' },
  { key: 'experiencias', label: 'Experiencias' },
]

export default function CoordinatorHome() {
  const { coordinador } = useAuth()
  const { logout } = useCoordinator()
  const [experiencias, setExperiencias] = useState([])
  const [grupos, setGrupos] = useState([])
  const [cargando, setCargando] = useState(true)
  const [activeTab, setActiveTab] = useState('partidas')

  useEffect(() => {
    const unsubExp = subscribeExperiencias(snap => {
      setExperiencias(snap.docs.map(d => ({ id: d.id, ...d.data() })))
      setCargando(false)
    })
    const unsubGrupos = subscribeGruposAll(snap => {
      setGrupos(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    })
    return () => { unsubExp(); unsubGrupos() }
  }, [])

  if (cargando) return <LoadingScreen mensaje="Cargando..." />

  return (
    <main className="page panel">
      <header className="page__header">
        <div>
          <h1>Panel de Coordinador</h1>
          <p className="text-muted">{coordinador?.email}</p>
        </div>
        <button onClick={logout} className="btn btn--ghost btn--small">Cerrar sesión</button>
      </header>

      <nav className="coord-tabs">
        {TABS.map(tab => (
          <button
            key={tab.key}
            className={`coord-tab-btn${activeTab === tab.key ? ' coord-tab-btn--active' : ''}`}
            onClick={() => setActiveTab(tab.key)}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      <section className="page__content">
        {activeTab === 'partidas' && (
          <TabPartidas grupos={grupos} experiencias={experiencias} />
        )}
        {activeTab === 'grupos' && (
          <TabGrupos grupos={grupos} experiencias={experiencias} />
        )}
        {activeTab === 'experiencias' && (
          <TabExperiencias experiencias={experiencias} />
        )}
      </section>
    </main>
  )
}
