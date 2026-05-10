import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import {
  getExperiencia,
  createExperiencia,
  updateExperiencia,
} from '../../services/firestore'
import { uploadImagen } from '../../services/storage'
import LoadingScreen from '../../components/shared/LoadingScreen'
import EpochBuilder from '../../components/coordinator/EpochBuilder'
import { CampoTraducible } from '../../components/shared/CampoTraducible'
import { getText } from '../../utils/helpers'

const FORM_VACIO = { nombre: {}, descripcion: {}, activa: false }
const TODOS_IDIOMAS = ['es', 'ca', 'en']
const IDIOMA_NOMBRE = { es: 'Castellano (ES)', ca: 'Català (CA)', en: 'English (EN)' }

export default function ExperienceBuilder() {
  const { experienciaId } = useParams()
  const esNueva = experienciaId === 'nueva'
  const navigate = useNavigate()
  const { coordinador } = useAuth()

  const [form, setForm] = useState(FORM_VACIO)
  const [imagenFile, setImagenFile] = useState(null)
  const [imagenPreview, setImagenPreview] = useState(null)
  const [imagenUrlActual, setImagenUrlActual] = useState(null)
  const [cargando, setCargando] = useState(!esNueva)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState(null)
  const [guardado, setGuardado] = useState(false)
  const [idiomasDisponibles, setIdiomasDisponibles] = useState(['es'])

  // Zona de juego
  const [zonaJuego, setZonaJuego] = useState([])
  const [nuevoLat, setNuevoLat] = useState('')
  const [nuevoLng, setNuevoLng] = useState('')
  const [guardandoZona, setGuardandoZona] = useState(false)

  useEffect(() => {
    if (esNueva) return
    getExperiencia(experienciaId).then((snap) => {
      if (!snap.exists()) { navigate('/coordinador', { replace: true }); return }
      const d = snap.data()
      setForm({
        nombre: d.nombre ?? {},
        descripcion: d.descripcion ?? {},
        activa: d.activa ?? false,
      })
      setImagenUrlActual(d.imagenPortadaUrl ?? null)
      setZonaJuego(d.zonaJuego ?? [])
      setIdiomasDisponibles(d.idiomasDisponibles ?? ['es'])
      setCargando(false)
    })
  }, [experienciaId, esNueva, navigate])

  const guardarZona = async (nuevaZona) => {
    setGuardandoZona(true)
    try { await updateExperiencia(experienciaId, { zonaJuego: nuevaZona }) }
    finally { setGuardandoZona(false) }
  }

  const añadirCoordenada = async () => {
    const lat = parseFloat(nuevoLat)
    const lng = parseFloat(nuevoLng)
    if (isNaN(lat) || isNaN(lng)) return
    const nueva = [...zonaJuego, { lat, lng }]
    setZonaJuego(nueva)
    setNuevoLat('')
    setNuevoLng('')
    await guardarZona(nueva)
  }

  const eliminarCoordenada = async (idx) => {
    const nueva = zonaJuego.filter((_, i) => i !== idx)
    setZonaJuego(nueva)
    await guardarZona(nueva)
  }

  const handleImagen = (e) => {
    const file = e.target.files[0]
    if (!file) return
    setImagenFile(file)
    setImagenPreview(URL.createObjectURL(file))
  }

  const toggleIdioma = async (lang) => {
    const nuevo = idiomasDisponibles.includes(lang)
      ? idiomasDisponibles.filter(l => l !== lang)
      : [...idiomasDisponibles, lang]
    if (nuevo.length === 0) return // al menos 1 idioma
    setIdiomasDisponibles(nuevo)
    if (!esNueva) {
      await updateExperiencia(experienciaId, { idiomasDisponibles: nuevo })
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!getText(form.nombre, idiomasDisponibles[0]).trim()) return
    setError(null)
    setGuardando(true)
    try {
      let id = experienciaId

      if (esNueva) {
        const ref = await createExperiencia({ ...form, idiomasDisponibles, creadoPor: coordinador.uid })
        id = ref.id
      } else {
        await updateExperiencia(id, { ...form, idiomasDisponibles })
      }

      if (imagenFile) {
        const url = await uploadImagen(`experiencias/${id}/portada`, imagenFile)
        await updateExperiencia(id, { imagenPortadaUrl: url })
        setImagenFile(null)
        setImagenUrlActual(url)
        setImagenPreview(null)
      }

      if (esNueva) {
        // Navega a edición para que el coordinador pueda añadir épocas inmediatamente
        navigate(`/coordinador/experiencias/${id}`)
      } else {
        setGuardado(true)
        setTimeout(() => setGuardado(false), 2500)
      }
    } catch {
      setError('Error al guardar. Inténtalo de nuevo.')
    } finally {
      setGuardando(false)
    }
  }

  if (cargando) return <LoadingScreen mensaje="Cargando experiencia..." />

  return (
    <main className="page panel">
      <header className="page__header">
        <div>
          <Link to="/coordinador" className="back-link">← Volver</Link>
          <h1>{esNueva ? 'Nueva experiencia' : 'Editar experiencia'}</h1>
        </div>
        {!esNueva && (
          <Link to={`/coordinador/grupos/${experienciaId}`} className="btn btn--ghost btn--small">
            Gestionar grupos
          </Link>
        )}
      </header>

      {/* ── Formulario de info básica ─────────────────────────────── */}
      <form onSubmit={handleSubmit} className="form form--builder">
        <CampoTraducible
          label="Nombre"
          campo={form.nombre}
          onChange={v => setForm(f => ({ ...f, nombre: v }))}
          idiomas={idiomasDisponibles}
          placeholder="Ej: Els Ecos de Morraniano"
          required
        />

        <CampoTraducible
          label="Descripción"
          campo={form.descripcion}
          onChange={v => setForm(f => ({ ...f, descripcion: v }))}
          idiomas={idiomasDisponibles}
          tipo="textarea"
          rows={3}
          placeholder="Descripción breve de la experiencia"
        />

        <div className="form__group">
          <label className="form__label">Imagen de portada</label>
          {(imagenPreview || imagenUrlActual) && (
            <img
              src={imagenPreview ?? imagenUrlActual}
              alt="Portada"
              className="imagen-preview"
            />
          )}
          <input
            type="file"
            accept="image/*"
            onChange={handleImagen}
            className="input--file"
          />
        </div>

        <div className="form__group form__group--row">
          <label className="form__label">Experiencia activa</label>
          <label className="toggle">
            <input
              type="checkbox"
              checked={form.activa}
              onChange={(e) => setForm({ ...form, activa: e.target.checked })}
            />
            <span className="toggle__slider" />
          </label>
        </div>

        <div className="form__group">
          <label className="form__label">Idiomas disponibles</label>
          <p className="form__hint">Activa los idiomas en los que quieres crear el contenido. Debe haber al menos uno.</p>
          <div className="idiomas-selector">
            {TODOS_IDIOMAS.map(lang => (
              <label key={lang} className={`idioma-opcion${idiomasDisponibles.includes(lang) ? ' idioma-opcion--activo' : ''}`}>
                <input
                  type="checkbox"
                  checked={idiomasDisponibles.includes(lang)}
                  onChange={() => toggleIdioma(lang)}
                  disabled={idiomasDisponibles.includes(lang) && idiomasDisponibles.length === 1}
                />
                <span>{IDIOMA_NOMBRE[lang]}</span>
              </label>
            ))}
          </div>
        </div>

        {error && <p className="error">{error}</p>}
        {guardado && <p className="success">✓ Cambios guardados</p>}

        <div className="form__actions">
          <Link to="/coordinador" className="btn btn--ghost">Cancelar</Link>
          <button type="submit" disabled={guardando} className="btn btn--primary">
            {guardando ? 'Guardando...' : esNueva ? 'Crear y continuar' : 'Guardar'}
          </button>
        </div>
      </form>

      {/* ── Zona de juego ─────────────────────────────────────────── */}
      {!esNueva && (
        <div className="builder-section-wrapper">
          <hr className="builder-divider" />
          <div className="builder-section">
            <div className="section-header">
              <h2>Zona de juego</h2>
              {guardandoZona && <span className="text-muted text-small">Guardando...</span>}
            </div>
            <p className="form__hint">
              Define el perímetro de la zona de juego. La última coordenada se conectará
              automáticamente con la primera para cerrar el polígono.
            </p>

            {zonaJuego.length === 0 ? (
              <p className="text-muted text-small">Sin coordenadas todavía.</p>
            ) : (
              <div className="zona-lista">
                {zonaJuego.map((coord, idx) => (
                  <div key={idx} className="zona-coord">
                    <span className="zona-coord__idx">{idx + 1}</span>
                    <code className="zona-coord__val">
                      {coord.lat.toFixed(6)}, {coord.lng.toFixed(6)}
                    </code>
                    <button
                      type="button"
                      onClick={() => eliminarCoordenada(idx)}
                      className="btn btn--ghost btn--small btn--icon"
                      title="Eliminar coordenada"
                    >✕</button>
                  </div>
                ))}
              </div>
            )}

            <div className="zona-añadir">
              <input
                type="number"
                step="any"
                value={nuevoLat}
                onChange={e => setNuevoLat(e.target.value)}
                placeholder="Latitud"
                className="zona-input"
              />
              <input
                type="number"
                step="any"
                value={nuevoLng}
                onChange={e => setNuevoLng(e.target.value)}
                placeholder="Longitud"
                className="zona-input"
              />
              <button
                type="button"
                onClick={añadirCoordenada}
                disabled={!nuevoLat || !nuevoLng || guardandoZona}
                className="btn btn--small"
              >
                + Añadir coordenada
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Gestor de épocas (fuera del <form> para evitar anidamiento) */}
      {!esNueva && (
        <div className="builder-section-wrapper">
          <hr className="builder-divider" />
          <EpochBuilder experienciaId={experienciaId} idiomasDisponibles={idiomasDisponibles} />
        </div>
      )}
    </main>
  )
}
