import { useEffect, useState, useMemo, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useCoordinator } from '../../hooks/useCoordinator'
import {
  subscribeExperiencias,
  subscribeGruposAll,
  subscribeGruposByExperiencia,
  subscribeEquipos,
  subscribeProgresoEpoca,
  subscribeProgreso,
  resetearFase,
  getEpocas,
  createGrupo,
  deleteGrupo,
  updateGrupo,
  createEquipo,
  deleteEquipo,
} from '../../services/firestore'
import { generarCodigo } from '../../utils/helpers'
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

// ─── Tab Partidas: EquipoRow ───────────────────────────────────────────────

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

// ─── Tab Partidas: GrupoEstadoTracker (worker sin UI) ─────────────────────

function GrupoEstadoTracker({ grupo, onEstadoChange }) {
  const modoGrupo = grupo.modo ?? 'competitivo'
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
          const fin = epocasNormales.every(ep =>
            equipos.some(eq =>
              (progresoPorEquipo[eq.id] ?? []).some(p => p.id === ep.id && p.estado === 'completado')
            )
          )
          estado = fin ? 'finalizado' : 'en-curso'
        }
      } else {
        if (!epocas.length) {
          estado = 'en-curso'
        } else {
          const fin = equipos.every(eq =>
            epocas.every(ep =>
              (progresoPorEquipo[eq.id] ?? []).some(p => p.id === ep.id && p.estado === 'completado')
            )
          )
          estado = fin ? 'finalizado' : 'en-curso'
        }
      }
    }

    onEstadoChange(grupo.id, estado)
  }, [equipos, epocas, progresoPorEquipo, modoGrupo, grupo.id, onEstadoChange])

  return null
}

// ─── Tab Partidas: GrupoCardDisplay (tarjeta colapsable visible) ──────────

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

// ─── Tab Partidas ──────────────────────────────────────────────────────────

const SECCIONES_PARTIDAS = [
  { key: 'en-curso',   label: 'En curso' },
  { key: 'pendiente',  label: 'Pendientes' },
  { key: 'finalizado', label: 'Finalizadas' },
]

function TabPartidas({ grupos, experiencias }) {
  const [estadosGrupo, setEstadosGrupo] = useState({})
  const [seccionesAbiertas, setSeccionesAbiertas] = useState({
    'en-curso': true,
    pendiente: true,
    finalizado: false,
  })

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
      {gruposActivos.map(g => (
        <GrupoEstadoTracker key={g.id} grupo={g} onEstadoChange={handleEstadoChange} />
      ))}

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

// ─── Tab Grupos: ListaEquipos ──────────────────────────────────────────────

function ListaEquipos({ grupoId, epocas, modoGrupo }) {
  const [equipos, setEquipos] = useState([])
  const [cargando, setCargando] = useState(true)
  const [form, setForm] = useState({ nombre: '', epocaAsignadaId: '', minJugadores: 3, maxJugadores: 6 })
  const [guardando, setGuardando] = useState(false)
  const [confirmar, setConfirmar] = useState(null)

  useEffect(() => {
    return subscribeEquipos(grupoId, snap => {
      setEquipos(snap.docs.map(d => ({ id: d.id, ...d.data() })))
      setCargando(false)
    })
  }, [grupoId])

  const handleAddEquipo = async (e) => {
    e.preventDefault()
    if (!form.nombre.trim()) return
    setGuardando(true)
    try {
      await createEquipo(grupoId, { ...form, codigo: generarCodigo(4) })
      setForm({ nombre: '', epocaAsignadaId: '', minJugadores: 3, maxJugadores: 6 })
    } finally {
      setGuardando(false)
    }
  }

  if (cargando) return <p className="text-muted text-small">Cargando equipos...</p>

  const fasesIndividuales = epocas.filter(e => !e.conjunta)

  return (
    <div className="equipos-section">
      {equipos.length === 0 ? (
        <p className="text-muted text-small">Sin equipos. Añade el primero abajo.</p>
      ) : (
        <div className="equipos-list">
          {equipos.map(eq => (
            <div key={eq.id} className="equipo-item">
              <div className="equipo-item__info">
                <span className="equipo-item__nombre">{eq.nombre}</span>
                <code className="code-badge">{eq.codigo}</code>
                {modoGrupo === 'colaborativo' && eq.epocaAsignadaId && (
                  <span className="text-muted text-small">
                    {epocas.find(ep => ep.id === eq.epocaAsignadaId)?.nombre ?? '—'}
                  </span>
                )}
                <span className="text-muted text-small">
                  {eq.minJugadores}–{eq.maxJugadores} jug.
                </span>
              </div>
              {confirmar === eq.id ? (
                <span className="confirm-inline">
                  <button
                    onClick={() => { deleteEquipo(grupoId, eq.id); setConfirmar(null) }}
                    className="btn btn--danger btn--small"
                  >
                    Eliminar
                  </button>
                  <button onClick={() => setConfirmar(null)} className="btn btn--ghost btn--small">
                    Cancelar
                  </button>
                </span>
              ) : (
                <button
                  onClick={() => setConfirmar(eq.id)}
                  className="btn btn--ghost btn--small btn--icon"
                  title="Eliminar equipo"
                >
                  ✕
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      <form onSubmit={handleAddEquipo} className="form-equipo">
        <p className="form__label">Añadir equipo</p>
        <div className="form__row">
          <input
            type="text"
            placeholder="Nombre del equipo"
            value={form.nombre}
            onChange={e => setForm({ ...form, nombre: e.target.value })}
            required
          />
          {modoGrupo === 'colaborativo' && (
            <select
              value={form.epocaAsignadaId}
              onChange={e => setForm({ ...form, epocaAsignadaId: e.target.value })}
            >
              <option value="">Fase asignada</option>
              {fasesIndividuales.map(ep => (
                <option key={ep.id} value={ep.id}>{ep.nombre}</option>
              ))}
            </select>
          )}
        </div>
        <div className="form__row form__row--compact">
          <label className="text-small text-muted">Mín. jug.</label>
          <input
            type="number"
            min={1}
            max={form.maxJugadores}
            value={form.minJugadores}
            onChange={e => setForm({ ...form, minJugadores: Number(e.target.value) })}
            className="input--narrow"
          />
          <label className="text-small text-muted">Máx. jug.</label>
          <input
            type="number"
            min={form.minJugadores}
            max={20}
            value={form.maxJugadores}
            onChange={e => setForm({ ...form, maxJugadores: Number(e.target.value) })}
            className="input--narrow"
          />
          <button type="submit" disabled={guardando} className="btn btn--small">
            {guardando ? '...' : 'Añadir'}
          </button>
        </div>
      </form>
    </div>
  )
}

// ─── Tab Grupos: GruposDeExperiencia ──────────────────────────────────────

function GruposDeExperiencia({ experiencia, coordinadorUid }) {
  const [epocas, setEpocas] = useState([])
  const [grupos, setGrupos] = useState([])
  const [cargando, setCargando] = useState(true)
  const [expandido, setExpandido] = useState(null)
  const [formGrupo, setFormGrupo] = useState({ nombre: '', modo: 'competitivo' })
  const [guardandoGrupo, setGuardandoGrupo] = useState(false)
  const [confirmarEliminar, setConfirmarEliminar] = useState(null)

  useEffect(() => {
    getEpocas(experiencia.id)
      .then(snap => setEpocas(snap.docs.map(d => ({ id: d.id, ...d.data() }))))
      .catch(() => {})
    return subscribeGruposByExperiencia(experiencia.id, snap => {
      setGrupos(
        snap.docs
          .map(d => ({ id: d.id, ...d.data() }))
          .sort((a, b) => (b.creadoEn?.seconds ?? 0) - (a.creadoEn?.seconds ?? 0))
      )
      setCargando(false)
    })
  }, [experiencia.id])

  const handleCrearGrupo = async (e) => {
    e.preventDefault()
    if (!formGrupo.nombre.trim()) return
    setGuardandoGrupo(true)
    try {
      const ref = await createGrupo({
        nombre: formGrupo.nombre.trim(),
        modo: formGrupo.modo,
        codigo: generarCodigo(6),
        experienciaId: experiencia.id,
        activo: true,
        creadoPor: coordinadorUid,
      })
      setFormGrupo({ nombre: '', modo: 'competitivo' })
      setExpandido(ref.id)
    } finally {
      setGuardandoGrupo(false)
    }
  }

  const handleEliminarGrupo = async (grupoId) => {
    await deleteGrupo(grupoId)
    setConfirmarEliminar(null)
    if (expandido === grupoId) setExpandido(null)
  }

  return (
    <div className="grupos-experiencia">
      {cargando ? (
        <p className="text-muted text-small">Cargando grupos...</p>
      ) : grupos.length === 0 ? (
        <p className="text-muted text-small">Sin grupos todavía.</p>
      ) : (
        <div className="card-list">
          {grupos.map(grupo => (
            <div key={grupo.id} className="card">
              <div className="card__header">
                <div className="card__title-group">
                  <h3 className="card__title">{grupo.nombre}</h3>
                  <code className="code-badge code-badge--lg">{grupo.codigo}</code>
                  <span className={`modo-badge modo-badge--${grupo.modo ?? 'competitivo'}`}>
                    {grupo.modo === 'colaborativo' ? 'Colaborativo' : 'Competitivo'}
                  </span>
                  <button
                    onClick={() => updateGrupo(grupo.id, { activo: !grupo.activo })}
                    className={`badge badge--btn ${grupo.activo ? 'badge--active' : 'badge--inactive'}`}
                    title="Clic para cambiar estado"
                  >
                    {grupo.activo ? 'Activo' : 'Inactivo'}
                  </button>
                </div>
                <div className="card__actions">
                  <button
                    onClick={() => setExpandido(expandido === grupo.id ? null : grupo.id)}
                    className="btn btn--ghost btn--small"
                  >
                    {expandido === grupo.id ? 'Cerrar' : 'Equipos'}
                  </button>
                  {confirmarEliminar === grupo.id ? (
                    <>
                      <button
                        onClick={() => handleEliminarGrupo(grupo.id)}
                        className="btn btn--danger btn--small"
                      >
                        Confirmar
                      </button>
                      <button
                        onClick={() => setConfirmarEliminar(null)}
                        className="btn btn--ghost btn--small"
                      >
                        Cancelar
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => setConfirmarEliminar(grupo.id)}
                      className="btn btn--ghost btn--small btn--icon"
                      title="Eliminar grupo"
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>

              {expandido === grupo.id && (
                <div className="card__body">
                  <ListaEquipos
                    grupoId={grupo.id}
                    epocas={epocas}
                    modoGrupo={grupo.modo ?? 'competitivo'}
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <form onSubmit={handleCrearGrupo} className="form-grupo-nuevo">
        <div className="form__row">
          <input
            type="text"
            placeholder="Nombre del grupo (ej: Salida 14 mayo)"
            value={formGrupo.nombre}
            onChange={e => setFormGrupo({ ...formGrupo, nombre: e.target.value })}
            required
          />
          <select
            value={formGrupo.modo}
            onChange={e => setFormGrupo({ ...formGrupo, modo: e.target.value })}
          >
            <option value="competitivo">Competitivo</option>
            <option value="colaborativo">Colaborativo</option>
          </select>
          <button type="submit" disabled={guardandoGrupo} className="btn btn--small">
            {guardandoGrupo ? '...' : '+ Nuevo grupo'}
          </button>
        </div>
        {formGrupo.modo === 'colaborativo' && (
          <p className="form__help">
            Cada equipo juega una fase distinta y luego se unen en las fases conjuntas.
          </p>
        )}
      </form>
    </div>
  )
}

// ─── Tab Grupos ────────────────────────────────────────────────────────────

function TabGrupos({ experiencias, coordinadorUid }) {
  if (!experiencias.length) {
    return <div className="empty-state"><p>No hay experiencias creadas.</p></div>
  }

  return (
    <div className="grupos-todas-experiencias">
      {experiencias.map(exp => (
        <section key={exp.id} className="grupos-exp-seccion">
          <div className="grupos-exp-seccion__header">
            <h2 className="grupos-exp-seccion__titulo">{exp.nombre}</h2>
            <span className={`badge ${exp.activa ? 'badge--active' : 'badge--inactive'}`}>
              {exp.activa ? 'Activa' : 'Inactiva'}
            </span>
            <Link
              to={`/coordinador/experiencias/${exp.id}`}
              className="btn btn--ghost btn--small"
            >
              Editar
            </Link>
          </div>
          <GruposDeExperiencia experiencia={exp} coordinadorUid={coordinadorUid} />
        </section>
      ))}
    </div>
  )
}

// ─── Tab Experiencias ──────────────────────────────────────────────────────

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
          <TabGrupos experiencias={experiencias} coordinadorUid={coordinador?.uid} />
        )}
        {activeTab === 'experiencias' && (
          <TabExperiencias experiencias={experiencias} />
        )}
      </section>
    </main>
  )
}
