import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import {
  getExperiencia,
  getEpocas,
  subscribeGruposByExperiencia,
  subscribeEquipos,
  createGrupo,
  deleteGrupo,
  updateGrupo,
  createEquipo,
  deleteEquipo,
} from '../../services/firestore'
import { generarCodigo } from '../../utils/helpers'
import LoadingScreen from '../../components/shared/LoadingScreen'

function ListaEquipos({ grupoId, epocas, modoGrupo }) {
  const [equipos, setEquipos] = useState([])
  const [cargando, setCargando] = useState(true)
  const [form, setForm] = useState({
    nombre: '',
    epocaAsignadaId: '',
    minJugadores: 3,
    maxJugadores: 6,
  })
  const [guardando, setGuardando] = useState(false)
  const [confirmar, setConfirmar] = useState(null)

  useEffect(() => {
    const unsub = subscribeEquipos(grupoId, (snap) => {
      setEquipos(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
      setCargando(false)
    })
    return unsub
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
          {equipos.map((eq) => (
            <div key={eq.id} className="equipo-item">
              <div className="equipo-item__info">
                <span className="equipo-item__nombre">{eq.nombre}</span>
                <code className="code-badge">{eq.codigo}</code>
                {modoGrupo === 'colaborativo' && eq.epocaAsignadaId && (
                  <span className="text-muted text-small">
                    {epocas.find((ep) => ep.id === eq.epocaAsignadaId)?.nombre ?? '—'}
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
            onChange={(e) => setForm({ ...form, nombre: e.target.value })}
            required
          />
          {modoGrupo === 'colaborativo' && (
            <select
              value={form.epocaAsignadaId}
              onChange={(e) => setForm({ ...form, epocaAsignadaId: e.target.value })}
            >
              <option value="">Fase asignada</option>
              {fasesIndividuales.map((ep) => (
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
            onChange={(e) => setForm({ ...form, minJugadores: Number(e.target.value) })}
            className="input--narrow"
          />
          <label className="text-small text-muted">Máx. jug.</label>
          <input
            type="number"
            min={form.minJugadores}
            max={20}
            value={form.maxJugadores}
            onChange={(e) => setForm({ ...form, maxJugadores: Number(e.target.value) })}
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

export default function GruposManager() {
  const { experienciaId } = useParams()
  const { coordinador } = useAuth()

  const [experiencia, setExperiencia] = useState(null)
  const [epocas, setEpocas] = useState([])
  const [grupos, setGrupos] = useState([])
  const [cargando, setCargando] = useState(true)
  const [expandido, setExpandido] = useState(null)
  const [formGrupo, setFormGrupo] = useState({ nombre: '', modo: 'competitivo' })
  const [guardandoGrupo, setGuardandoGrupo] = useState(false)
  const [confirmarEliminar, setConfirmarEliminar] = useState(null)

  useEffect(() => {
    Promise.all([
      getExperiencia(experienciaId),
      getEpocas(experienciaId),
    ]).then(([expSnap, epSnap]) => {
      if (expSnap.exists()) setExperiencia({ id: expSnap.id, ...expSnap.data() })
      setEpocas(epSnap.docs.map((d) => ({ id: d.id, ...d.data() })))
    })

    const unsub = subscribeGruposByExperiencia(experienciaId, (snap) => {
      const lista = snap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .sort((a, b) => (b.creadoEn?.seconds ?? 0) - (a.creadoEn?.seconds ?? 0))
      setGrupos(lista)
      setCargando(false)
    })
    return unsub
  }, [experienciaId])

  const handleCrearGrupo = async (e) => {
    e.preventDefault()
    if (!formGrupo.nombre.trim()) return
    setGuardandoGrupo(true)
    try {
      const ref = await createGrupo({
        nombre: formGrupo.nombre.trim(),
        modo: formGrupo.modo,
        codigo: generarCodigo(6),
        experienciaId,
        activo: true,
        creadoPor: coordinador.uid,
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

  const toggleActivo = (grupo) =>
    updateGrupo(grupo.id, { activo: !grupo.activo })

  if (cargando) return <LoadingScreen mensaje="Cargando grupos..." />

  return (
    <main className="page panel">
      <header className="page__header">
        <div>
          <Link to="/coordinador" className="back-link">← Volver</Link>
          <h1>Grupos</h1>
          {experiencia && <p className="text-muted">{experiencia.nombre}</p>}
        </div>
        <Link
          to={`/coordinador/experiencias/${experienciaId}`}
          className="btn btn--ghost btn--small"
        >
          Editar experiencia
        </Link>
      </header>

      <section className="page__content">
        <div className="card card--form">
          <h2>Nuevo grupo</h2>
          <form onSubmit={handleCrearGrupo} className="form-grupo-nuevo">
            <div className="form__row">
              <input
                type="text"
                placeholder="Nombre del grupo (ej: Salida 14 mayo)"
                value={formGrupo.nombre}
                onChange={(e) => setFormGrupo({ ...formGrupo, nombre: e.target.value })}
                required
              />
              <select
                value={formGrupo.modo}
                onChange={(e) => setFormGrupo({ ...formGrupo, modo: e.target.value })}
              >
                <option value="competitivo">Competitivo</option>
                <option value="colaborativo">Colaborativo</option>
              </select>
              <button type="submit" disabled={guardandoGrupo} className="btn">
                {guardandoGrupo ? 'Creando...' : 'Crear grupo'}
              </button>
            </div>
            <p className="form__help">
              {formGrupo.modo === 'colaborativo'
                ? 'Cada equipo juega una fase distinta y luego se unen en las fases conjuntas.'
                : 'Todos los equipos juegan todas las fases de forma independiente.'}
            </p>
          </form>
        </div>

        <div className="section-header" style={{ marginTop: '24px' }}>
          <h2>Grupos ({grupos.length})</h2>
        </div>

        {grupos.length === 0 ? (
          <div className="empty-state">
            <p>No hay grupos todavía. Crea el primero arriba.</p>
          </div>
        ) : (
          <div className="card-list">
            {grupos.map((grupo) => (
              <div key={grupo.id} className="card">
                <div className="card__header">
                  <div className="card__title-group">
                    <h3 className="card__title">{grupo.nombre}</h3>
                    <code className="code-badge code-badge--lg">{grupo.codigo}</code>
                    <span className={`modo-badge modo-badge--${grupo.modo ?? 'competitivo'}`}>
                      {grupo.modo === 'colaborativo' ? 'Colaborativo' : 'Competitivo'}
                    </span>
                    <button
                      onClick={() => toggleActivo(grupo)}
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
      </section>
    </main>
  )
}
