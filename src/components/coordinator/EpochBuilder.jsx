import { useState, useEffect } from 'react'
import {
  subscribeEpocas,
  createEpoca,
  updateEpoca,
  deleteEpoca,
} from '../../services/firestore'
import { uploadImagen } from '../../services/storage'
import PointBuilder from './PointBuilder'

const TIPOS = {
  logica: 'Lógica',
  observacion: 'Observación',
  fisico: 'Físico',
  nocturno: 'Nocturno',
}

const EPOCA_VACIA = {
  nombre: '',
  descripcion: '',
  tipo: 'logica',
  conjunta: false,
  briefingTexto: '',
  briefingVideoUrl: '',
}

function FormEpoca({ initial, onGuardar, onCancelar }) {
  const [form, setForm] = useState(initial)
  const [videoFile, setVideoFile] = useState(null)
  const [guardando, setGuardando] = useState(false)
  const s = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const submit = async (e) => {
    e.preventDefault()
    setGuardando(true)
    try { await onGuardar(form, videoFile) }
    finally { setGuardando(false) }
  }

  return (
    <form onSubmit={submit} className="builder-form">
      <div className="builder-form__section">
        <div className="form-grid-2">
          <div className="form__group">
            <label className="form__label">Nombre *</label>
            <input
              type="text"
              value={form.nombre}
              onChange={e => s('nombre', e.target.value)}
              placeholder="Ej: La Era Romana"
              required
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
            value={form.descripcion}
            onChange={e => s('descripcion', e.target.value)}
            placeholder="Contexto narrativo de la época"
          />
        </div>
        <div className="form__group form__group--row">
          <label className="form__label">¿Época conjunta? <span className="text-muted">(todos los equipos juntos)</span></label>
          <label className="toggle">
            <input type="checkbox" checked={form.conjunta} onChange={e => s('conjunta', e.target.checked)} />
            <span className="toggle__slider" />
          </label>
        </div>
      </div>

      <div className="builder-form__section">
        <p className="builder-form__section-title">Briefing</p>
        <div className="form__group">
          <label className="form__label">Texto del briefing</label>
          <textarea
            rows={3}
            value={form.briefingTexto}
            onChange={e => s('briefingTexto', e.target.value)}
            placeholder="Narración introductoria que verán los jugadores al inicio de la época"
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

      <div className="form__actions">
        <button type="button" onClick={onCancelar} className="btn btn--ghost btn--small">
          Cancelar
        </button>
        <button type="submit" disabled={guardando} className="btn btn--primary btn--small">
          {guardando ? 'Guardando...' : 'Guardar época'}
        </button>
      </div>
    </form>
  )
}

export default function EpochBuilder({ experienciaId }) {
  const [epocas, setEpocas] = useState([])
  const [creando, setCreando] = useState(false)
  const [editandoId, setEditandoId] = useState(null)
  const [expandidaId, setExpandidaId] = useState(null)
  const [confirmar, setConfirmar] = useState(null)

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

  const handleCrear = async (data, videoFile) => {
    const ref = await createEpoca(experienciaId, { ...data, orden: nextOrden })
    if (videoFile) {
      const url = await uploadImagen(
        `experiencias/${experienciaId}/epocas/${ref.id}/briefing`,
        videoFile
      )
      await updateEpoca(experienciaId, ref.id, { briefingVideoUrl: url })
    }
    setCreando(false)
    setExpandidaId(ref.id)
  }

  const handleEditar = async (epocaId, data, videoFile) => {
    const updates = { ...data }
    if (videoFile) {
      updates.briefingVideoUrl = await uploadImagen(
        `experiencias/${experienciaId}/epocas/${epocaId}/briefing`,
        videoFile
      )
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
        <h2>Épocas ({epocas.length})</h2>
        <button
          type="button"
          onClick={() => { setCreando(c => !c); setEditandoId(null) }}
          className="btn btn--small"
        >
          {creando ? 'Cancelar' : '+ Época'}
        </button>
      </div>

      {creando && (
        <FormEpoca
          initial={EPOCA_VACIA}
          onGuardar={handleCrear}
          onCancelar={() => setCreando(false)}
        />
      )}

      {epocas.length === 0 && !creando && (
        <div className="empty-state">
          <p>No hay épocas todavía. Añade la primera.</p>
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
                <strong>{epoca.nombre}</strong>
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
                    title="Eliminar época"
                  >✕</button>
                )}
              </div>
            </div>

            {editandoId === epoca.id && (
              <FormEpoca
                initial={epoca}
                onGuardar={(data, file) => handleEditar(epoca.id, data, file)}
                onCancelar={() => setEditandoId(null)}
              />
            )}

            {expandidaId === epoca.id && (
              <div className="builder-children">
                <PointBuilder experienciaId={experienciaId} epocaId={epoca.id} />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
