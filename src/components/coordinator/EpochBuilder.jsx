import { useState, useEffect } from 'react'
import {
  subscribeEpocas,
  createEpoca,
  updateEpoca,
  deleteEpoca,
} from '../../services/firestore'
import { uploadImagen } from '../../services/storage'
import { TabsIdioma, toMulti } from '../shared/TabsIdioma'
import { getText } from '../../utils/helpers'
import PointBuilder from './PointBuilder'

const TIPOS = {
  logica: 'Lógica',
  observacion: 'Observación',
  fisico: 'Físico',
  nocturno: 'Nocturno',
}

const DESENLACE_VACIO = { texto: {}, videoUrl: '', imagenUrl: '' }

const EPOCA_VACIA = {
  nombre: {},
  descripcion: {},
  tipo: 'logica',
  conjunta: false,
  briefingTexto: {},
  briefingVideoUrl: '',
  desenlace: DESENLACE_VACIO,
  prerequisitos: [],
}

function FormEpoca({ initial, idiomas, epocas, epocaId, onGuardar, onCancelar }) {
  const [form, setForm] = useState({
    ...initial,
    desenlace: initial.desenlace ?? DESENLACE_VACIO,
    prerequisitos: initial.prerequisitos ?? [],
  })
  const [idiomaActivo, setIdiomaActivo] = useState(idiomas[0] ?? 'es')
  const [videoFile, setVideoFile] = useState(null)
  const [desenlaceImagenFile, setDesenlaceImagenFile] = useState(null)
  const [guardando, setGuardando] = useState(false)

  const s = (k, v) => setForm(f => ({ ...f, [k]: v }))
  const sDesenlace = (k, v) => setForm(f => ({ ...f, desenlace: { ...f.desenlace, [k]: v } }))

  // Editar un campo multiidioma en el idioma activo
  const sMulti = (key, value) => setForm(f => ({
    ...f,
    [key]: { ...toMulti(f[key], idiomas), [idiomaActivo]: value },
  }))
  const sDesenlaceMulti = (key, value) => setForm(f => ({
    ...f,
    desenlace: {
      ...f.desenlace,
      [key]: { ...toMulti(f.desenlace?.[key], idiomas), [idiomaActivo]: value },
    },
  }))

  const opcionesPrerequisito = (epocas ?? []).filter(e => e.id !== epocaId)

  const togglePrerequisito = (id) => {
    setForm(f => {
      const prev = f.prerequisitos ?? []
      return {
        ...f,
        prerequisitos: prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id],
      }
    })
  }

  const submit = async (e) => {
    e.preventDefault()
    setGuardando(true)
    try { await onGuardar(form, videoFile, desenlaceImagenFile) }
    finally { setGuardando(false) }
  }

  const nombreActivo = toMulti(form.nombre, idiomas)[idiomaActivo] ?? ''
  const descripcionActivo = toMulti(form.descripcion, idiomas)[idiomaActivo] ?? ''
  const briefingTextoActivo = toMulti(form.briefingTexto, idiomas)[idiomaActivo] ?? ''
  const desenlaceTextoActivo = toMulti(form.desenlace?.texto, idiomas)[idiomaActivo] ?? ''

  return (
    <form onSubmit={submit} className="builder-form">
      {/* ── Selector de idioma ───────────────────────────────────── */}
      {idiomas.length > 1 && (
        <div className="builder-form__idioma-bar">
          <span className="builder-form__idioma-label">Editando en:</span>
          <TabsIdioma idiomas={idiomas} activo={idiomaActivo} onChange={setIdiomaActivo} />
        </div>
      )}

      <div className="builder-form__section">
        <div className="form-grid-2">
          <div className="form__group">
            <label className="form__label">Nombre *</label>
            <input
              type="text"
              value={nombreActivo}
              onChange={e => sMulti('nombre', e.target.value)}
              placeholder="Ej: La Era Romana"
              required={idiomaActivo === (idiomas[0] ?? 'es')}
            />
          </div>
          <div className="form__group">
            <label className="form__label">Tipo predominante</label>
            <select value={form.tipo} onChange={e => s('tipo', e.target.value)}>
              {Object.entries(TIPOS).map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="form__group">
          <label className="form__label">Descripción</label>
          <textarea
            rows={2}
            value={descripcionActivo}
            onChange={e => sMulti('descripcion', e.target.value)}
            placeholder="Contexto narrativo de la fase"
          />
        </div>
        <div className="form__group form__group--row">
          <label className="form__label">¿Fase conjunta? <span className="text-muted">(todos los equipos juntos)</span></label>
          <label className="toggle">
            <input type="checkbox" checked={form.conjunta} onChange={e => s('conjunta', e.target.checked)} />
            <span className="toggle__slider" />
          </label>
        </div>
      </div>

      {opcionesPrerequisito.length > 0 && (
        <div className="builder-form__section">
          <p className="builder-form__section-title">Prerequisitos</p>
          <p className="builder-form__section-help">
            Esta fase se desbloquea cuando se completen:
          </p>
          <div className="prerequisitos-lista">
            {opcionesPrerequisito.map(e => (
              <label key={e.id} className="prerequisito-item">
                <input
                  type="checkbox"
                  checked={(form.prerequisitos ?? []).includes(e.id)}
                  onChange={() => togglePrerequisito(e.id)}
                />
                <span>{getText(e.nombre, idiomas[0] ?? 'es') || '(sin nombre)'}</span>
              </label>
            ))}
          </div>
          {(form.prerequisitos ?? []).length === 0 && (
            <p className="form__hint">Sin prerequisitos: la fase estará disponible desde el inicio.</p>
          )}
        </div>
      )}

      <div className="builder-form__section">
        <p className="builder-form__section-title">Briefing</p>
        <div className="form__group">
          <label className="form__label">Texto del briefing</label>
          <textarea
            rows={3}
            value={briefingTextoActivo}
            onChange={e => sMulti('briefingTexto', e.target.value)}
            placeholder="Narración introductoria que verán los jugadores al inicio de la fase"
          />
        </div>
        <div className="form-grid-2">
          <div className="form__group">
            <label className="form__label">URL del vídeo de briefing</label>
            <input
              type="url"
              value={form.briefingVideoUrl}
              onChange={e => s('briefingVideoUrl', e.target.value)}
              placeholder="https://youtube.com/..."
            />
          </div>
          <div className="form__group">
            <label className="form__label">o subir archivo de vídeo</label>
            <input
              type="file"
              accept="video/*"
              onChange={e => setVideoFile(e.target.files[0] ?? null)}
              className="input--file"
            />
            {videoFile && <span className="text-small text-muted">{videoFile.name}</span>}
          </div>
        </div>
      </div>

      <div className="builder-form__section">
        <p className="builder-form__section-title">Desenlace</p>
        <p className="builder-form__section-help">
          Este contenido se muestra al jugador cuando completa todos los puntos y puzzles de la época.
        </p>
        <div className="form__group">
          <label className="form__label">Texto del desenlace</label>
          <textarea
            rows={3}
            value={desenlaceTextoActivo}
            onChange={e => sDesenlaceMulti('texto', e.target.value)}
            placeholder="Narración final que verán los jugadores al completar la fase"
          />
        </div>
        <div className="form-grid-2">
          <div className="form__group">
            <label className="form__label">URL del vídeo del desenlace</label>
            <input
              type="url"
              value={form.desenlace.videoUrl}
              onChange={e => sDesenlace('videoUrl', e.target.value)}
              placeholder="https://..."
            />
          </div>
          <div className="form__group">
            <label className="form__label">Imagen del desenlace (opcional)</label>
            <input
              type="file"
              accept="image/*"
              onChange={e => setDesenlaceImagenFile(e.target.files[0] ?? null)}
              className="input--file"
            />
            {form.desenlace.imagenUrl && !desenlaceImagenFile && (
              <span className="text-small text-muted">Imagen guardada</span>
            )}
            {desenlaceImagenFile && <span className="text-small text-muted">{desenlaceImagenFile.name}</span>}
          </div>
        </div>
      </div>

      <div className="form__actions">
        <button type="button" onClick={onCancelar} className="btn btn--ghost btn--small">
          Cancelar
        </button>
        <button type="submit" disabled={guardando} className="btn btn--primary btn--small">
          {guardando ? 'Guardando...' : 'Guardar fase'}
        </button>
      </div>
    </form>
  )
}

export default function EpochBuilder({ experienciaId, idiomasDisponibles = ['es'] }) {
  const [epocas, setEpocas] = useState([])
  const [creando, setCreando] = useState(false)
  const [editandoId, setEditandoId] = useState(null)
  const [expandidaId, setExpandidaId] = useState(null)
  const [confirmar, setConfirmar] = useState(null)

  const idiomas = idiomasDisponibles.length > 0 ? idiomasDisponibles : ['es']

  useEffect(() => {
    return subscribeEpocas(experienciaId, (snap) => {
      setEpocas(
        snap.docs
          .map(d => ({ id: d.id, ...d.data() }))
          .sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0))
      )
    })
  }, [experienciaId])

  const nextOrden = epocas.length === 0
    ? 0
    : Math.max(...epocas.map(e => e.orden ?? 0)) + 1

  const handleCrear = async (data, briefingVideoFile, desenlaceImagenFile) => {
    const ref = await createEpoca(experienciaId, { ...data, orden: nextOrden })
    const updates = {}
    if (briefingVideoFile) {
      updates.briefingVideoUrl = await uploadImagen(
        `experiencias/${experienciaId}/epocas/${ref.id}/briefing`,
        briefingVideoFile
      )
    }
    if (desenlaceImagenFile) {
      updates.desenlace = {
        ...data.desenlace,
        imagenUrl: await uploadImagen(
          `experiencias/${experienciaId}/epocas/${ref.id}/desenlace-imagen`,
          desenlaceImagenFile
        ),
      }
    }
    if (Object.keys(updates).length > 0) {
      await updateEpoca(experienciaId, ref.id, updates)
    }
    setCreando(false)
    setExpandidaId(ref.id)
  }

  const handleEditar = async (epocaId, data, briefingVideoFile, desenlaceImagenFile) => {
    const updates = { ...data }
    if (briefingVideoFile) {
      updates.briefingVideoUrl = await uploadImagen(
        `experiencias/${experienciaId}/epocas/${epocaId}/briefing`,
        briefingVideoFile
      )
    }
    if (desenlaceImagenFile) {
      updates.desenlace = {
        ...data.desenlace,
        imagenUrl: await uploadImagen(
          `experiencias/${experienciaId}/epocas/${epocaId}/desenlace-imagen`,
          desenlaceImagenFile
        ),
      }
    }
    await updateEpoca(experienciaId, epocaId, updates)
    setEditandoId(null)
  }

  const handleEliminar = async (epocaId) => {
    await deleteEpoca(experienciaId, epocaId)
    setConfirmar(null)
    if (expandidaId === epocaId) setExpandidaId(null)
    if (editandoId === epocaId) setEditandoId(null)
  }

  const swap = async (a, b) => Promise.all([
    updateEpoca(experienciaId, a.id, { orden: b.orden }),
    updateEpoca(experienciaId, b.id, { orden: a.orden }),
  ])

  return (
    <div className="builder-section">
      <div className="section-header">
        <h2>Fases ({epocas.length})</h2>
        <button
          type="button"
          onClick={() => { setCreando(c => !c); setEditandoId(null) }}
          className="btn btn--small"
        >
          {creando ? 'Cancelar' : '+ Fase'}
        </button>
      </div>

      {creando && (
        <FormEpoca
          initial={EPOCA_VACIA}
          idiomas={idiomas}
          epocas={epocas}
          epocaId={null}
          onGuardar={handleCrear}
          onCancelar={() => setCreando(false)}
        />
      )}

      {epocas.length === 0 && !creando && (
        <div className="empty-state">
          <p>No hay fases todavía. Añade la primera.</p>
        </div>
      )}

      <div className="builder-list">
        {epocas.map((epoca, idx) => (
          <div key={epoca.id} className="builder-item builder-item--epoch">
            <div className="builder-item__header">
              <div className="builder-item__meta">
                <span className="reorder-btns">
                  <button
                    type="button"
                    onClick={() => swap(epocas[idx], epocas[idx - 1])}
                    disabled={idx === 0}
                    className="btn btn--icon btn--ghost"
                    title="Subir"
                  >↑</button>
                  <button
                    type="button"
                    onClick={() => swap(epocas[idx], epocas[idx + 1])}
                    disabled={idx === epocas.length - 1}
                    className="btn btn--icon btn--ghost"
                    title="Bajar"
                  >↓</button>
                </span>
                <span className="builder-orden">{idx + 1}</span>
                <strong>{getText(epoca.nombre, idiomas[0] ?? 'es') || '(sin nombre)'}</strong>
                <span className={`tipo-badge tipo-badge--${epoca.tipo}`}>
                  {TIPOS[epoca.tipo] ?? epoca.tipo}
                </span>
                {epoca.conjunta && <span className="badge badge--conjunta">Conjunta</span>}
              </div>
              <div className="card__actions">
                <button
                  type="button"
                  onClick={() => setExpandidaId(expandidaId === epoca.id ? null : epoca.id)}
                  className="btn btn--ghost btn--small"
                >
                  {expandidaId === epoca.id ? 'Cerrar' : 'Puntos'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEditandoId(editandoId === epoca.id ? null : epoca.id)
                    setCreando(false)
                  }}
                  className="btn btn--ghost btn--small"
                >
                  Editar
                </button>
                {confirmar === epoca.id ? (
                  <>
                    <button
                      type="button"
                      onClick={() => handleEliminar(epoca.id)}
                      className="btn btn--danger btn--small"
                    >Eliminar</button>
                    <button
                      type="button"
                      onClick={() => setConfirmar(null)}
                      className="btn btn--ghost btn--small"
                    >Cancelar</button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirmar(epoca.id)}
                    className="btn btn--ghost btn--small btn--icon"
                    title="Eliminar fase"
                  >✕</button>
                )}
              </div>
            </div>

            {editandoId === epoca.id && (
              <FormEpoca
                initial={epoca}
                idiomas={idiomas}
                epocas={epocas}
                epocaId={epoca.id}
                onGuardar={(data, bf, dif) => handleEditar(epoca.id, data, bf, dif)}
                onCancelar={() => setEditandoId(null)}
              />
            )}

            {expandidaId === epoca.id && (
              <div className="builder-children">
                <PointBuilder
                  experienciaId={experienciaId}
                  epocaId={epoca.id}
                  idiomasDisponibles={idiomas}
                />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
