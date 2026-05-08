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

const FORM_VACIO = { nombre: '', descripcion: '', activa: false }

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

  useEffect(() => {
    if (esNueva) return
    getExperiencia(experienciaId).then((snap) => {
      if (!snap.exists()) { navigate('/coordinador', { replace: true }); return }
      const d = snap.data()
      setForm({
        nombre: d.nombre ?? '',
        descripcion: d.descripcion ?? '',
        activa: d.activa ?? false,
      })
      setImagenUrlActual(d.imagenPortadaUrl ?? null)
      setCargando(false)
    })
  }, [experienciaId, esNueva, navigate])

  const handleImagen = (e) => {
    const file = e.target.files[0]
    if (!file) return
    setImagenFile(file)
    setImagenPreview(URL.createObjectURL(file))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.nombre.trim()) return
    setError(null)
    setGuardando(true)
    try {
      let id = experienciaId

      if (esNueva) {
        const ref = await createExperiencia({ ...form, creadoPor: coordinador.uid })
        id = ref.id
      } else {
        await updateExperiencia(id, form)
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
        <div className="form__group">
          <label className="form__label">Nombre *</label>
          <input
            type="text"
            value={form.nombre}
            onChange={(e) => setForm({ ...form, nombre: e.target.value })}
            placeholder="Ej: Els Ecos de Morraniano"
            required
          />
        </div>

        <div className="form__group">
          <label className="form__label">Descripción</label>
          <textarea
            value={form.descripcion}
            onChange={(e) => setForm({ ...form, descripcion: e.target.value })}
            placeholder="Descripción breve de la experiencia"
            rows={3}
          />
        </div>

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

        {error && <p className="error">{error}</p>}
        {guardado && <p className="success">✓ Cambios guardados</p>}

        <div className="form__actions">
          <Link to="/coordinador" className="btn btn--ghost">Cancelar</Link>
          <button type="submit" disabled={guardando} className="btn btn--primary">
            {guardando ? 'Guardando...' : esNueva ? 'Crear y continuar' : 'Guardar'}
          </button>
        </div>
      </form>

      {/* ── Gestor de épocas (fuera del <form> para evitar anidamiento) */}
      {!esNueva && (
        <div className="builder-section-wrapper">
          <hr className="builder-divider" />
          <EpochBuilder experienciaId={experienciaId} />
        </div>
      )}
    </main>
  )
}
