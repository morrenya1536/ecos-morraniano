import { useState, useEffect } from 'react'
import {
  subscribePuntos,
  createPunto,
  updatePunto,
  deletePunto,
} from '../../services/firestore'
import { uploadImagen } from '../../services/storage'
import PuzzleBuilder from './PuzzleBuilder'

const TIPOS_PUNTO = {
  normal: 'Normal',
  colaborativo: 'Colaborativo',
}

const PUNTO_VACIO = {
  nombre: '',
  lat: '',
  lng: '',
  tipo: 'normal',
  llegadaTexto: '',
  llegadaVideoUrl: '',
}

function FormPunto({ initial, onGuardar, onCancelar }) {
  const [form, setForm] = useState(initial)
  const [imagenFile, setImagenFile] = useState(null)
  const [imagenPreview, setImagenPreview] = useState(null)
  const [guardando, setGuardando] = useState(false)
  const s = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handleImagen = (e) => {
    const file = e.target.files[0]
    if (!file) return
    setImagenFile(file)
    setImagenPreview(URL.createObjectURL(file))
  }

  const submit = async (e) => {
    e.preventDefault()
    setGuardando(true)
    try { await onGuardar(form, imagenFile) }
    finally { setGuardando(false) }
  }

  return (
    <form onSubmit={submit} className="builder-form">
      <div className="builder-form__section">
        <div className="form-grid-2">
          <div className="form__group">
            <label className="form__label">Nombre interno *</label>
            <input
              type="text"
              value={form.nombre}
              onChange={e => s('nombre', e.target.value)}
              placeholder="Ej: Puerta del castillo"
              required
            />
          </div>
          <div className="form__group">
            <label className="form__label">Tipo</label>
            <select value={form.tipo} onChange={e => s('tipo', e.target.value)}>
              {Object.entries(TIPOS_PUNTO).map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="form-grid-2">
          <div className="form__group">
            <label className="form__label">Latitud</label>
            <input
              type="number"
              step="any"
              value={form.lat}
              onChange={e => s('lat', e.target.value)}
              placeholder="41.3825"
            />
          </div>
          <div className="form__group">
            <label className="form__label">Longitud</label>
            <input
              type="number"
              step="any"
              value={form.lng}
              onChange={e => s('lng', e.target.value)}
              placeholder="2.1769"
            />
          </div>
        </div>
      </div>

      <div className="builder-form__section">
        <p className="builder-form__section-title">Contenido de llegada</p>
        <div className="form__group">
          <label className="form__label">Texto de llegada</label>
          <textarea
            rows={3}
            value={form.llegadaTexto}
            onChange={e => s('llegadaTexto', e.target.value)}
            placeholder="Texto o narración que verán los jugadores al llegar al punto"
          />
        </div>
        <div className="form__group">
          <label className="form__label">URL del vídeo de llegada</label>
          <input
            type="url"
            value={form.llegadaVideoUrl}
            onChange={e => s('llegadaVideoUrl', e.target.value)}
            placeholder="https://..."
          />
        </div>
        <div className="form__group">
          <label className="form__label">Imagen de llegada</label>
          {(imagenPreview || form.llegadaImagenUrl) && (
            <img
              src={imagenPreview ?? form.llegadaImagenUrl}
              alt="Llegada"
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
      </div>

      <div className="form__actions">
        <button type="button" onClick={onCancelar} className="btn btn--ghost btn--small">
          Cancelar
        </button>
        <button type="submit" disabled={guardando} className="btn btn--primary btn--small">
          {guardando ? 'Guardando...' : 'Guardar punto'}
        </button>
      </div>
    </form>
  )
}

function QrInfo({ puntoId }) {
  const [copiado, setCopiado] = useState(false)

  const copiar = () => {
    navigator.clipboard.writeText(puntoId).then(() => {
      setCopiado(true)
      setTimeout(() => setCopiado(false), 2000)
    })
  }

  return (
    <div className="qr-info">
      <span className="qr-info__label">QR — ID del punto:</span>
      <code className="qr-info__code">{puntoId}</code>
      <button type="button" onClick={copiar} className="btn btn--ghost btn--small">
        {copiado ? '✓ Copiado' : 'Copiar'}
      </button>
    </div>
  )
}

export default function PointBuilder({ experienciaId, epocaId }) {
  const [puntos, setPuntos] = useState([])
  const [creando, setCreando] = useState(false)
  const [editandoId, setEditandoId] = useState(null)
  const [expandidoId, setExpandidoId] = useState(null)
  const [confirmar, setConfirmar] = useState(null)

  useEffect(() => {
    return subscribePuntos(experienciaId, epocaId, (snap) => {
      setPuntos(
        snap.docs
          .map(d => ({ id: d.id, ...d.data() }))
          .sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0))
      )
    })
  }, [experienciaId, epocaId])

  const nextOrden = puntos.length === 0
    ? 0
    : Math.max(...puntos.map(p => p.orden ?? 0)) + 1

  const handleCrear = async (data, imagenFile) => {
    const ref = await createPunto(experienciaId, epocaId, {
      ...data,
      lat: data.lat ? Number(data.lat) : null,
      lng: data.lng ? Number(data.lng) : null,
      orden: nextOrden,
    })
    if (imagenFile) {
      const url = await uploadImagen(
        `experiencias/${experienciaId}/epocas/${epocaId}/puntos/${ref.id}/llegada`,
        imagenFile
      )
      await updatePunto(experienciaId, epocaId, ref.id, { llegadaImagenUrl: url })
    }
    setCreando(false)
    setExpandidoId(ref.id)
  }

  const handleEditar = async (puntoId, data, imagenFile) => {
    const updates = {
      ...data,
      lat: data.lat ? Number(data.lat) : null,
      lng: data.lng ? Number(data.lng) : null,
    }
    if (imagenFile) {
      updates.llegadaImagenUrl = await uploadImagen(
        `experiencias/${experienciaId}/epocas/${epocaId}/puntos/${puntoId}/llegada`,
        imagenFile
      )
    }
    await updatePunto(experienciaId, epocaId, puntoId, updates)
    setEditandoId(null)
  }

  const handleEliminar = async (puntoId) => {
    await deletePunto(experienciaId, epocaId, puntoId)
    setConfirmar(null)
    if (expandidoId === puntoId) setExpandidoId(null)
    if (editandoId === puntoId) setEditandoId(null)
  }

  const swap = async (a, b) => Promise.all([
    updatePunto(experienciaId, epocaId, a.id, { orden: b.orden }),
    updatePunto(experienciaId, epocaId, b.id, { orden: a.orden }),
  ])

  return (
    <div className="builder-section builder-section--nested">
      <div className="section-header">
        <h3>Puntos ({puntos.length})</h3>
        <button
          type="button"
          onClick={() => { setCreando(c => !c); setEditandoId(null) }}
          className="btn btn--small"
        >
          {creando ? 'Cancelar' : '+ Punto'}
        </button>
      </div>

      {creando && (
        <FormPunto
          initial={PUNTO_VACIO}
          onGuardar={handleCrear}
          onCancelar={() => setCreando(false)}
        />
      )}

      {puntos.length === 0 && !creando && (
        <div className="empty-state">
          <p>No hay puntos en esta época.</p>
        </div>
      )}

      <div className="builder-list">
        {puntos.map((punto, idx) => (
          <div key={punto.id} className="builder-item builder-item--punto">
            <div className="builder-item__header">
              <div className="builder-item__meta">
                <span className="reorder-btns">
                  <button
                    type="button"
                    onClick={() => swap(puntos[idx], puntos[idx - 1])}
                    disabled={idx === 0}
                    className="btn btn--icon btn--ghost"
                  >↑</button>
                  <button
                    type="button"
                    onClick={() => swap(puntos[idx], puntos[idx + 1])}
                    disabled={idx === puntos.length - 1}
                    className="btn btn--icon btn--ghost"
                  >↓</button>
                </span>
                <span className="builder-orden">{idx + 1}</span>
                <strong>{punto.nombre}</strong>
                <span className={`tipo-badge tipo-badge--${punto.tipo}`}>
                  {TIPOS_PUNTO[punto.tipo] ?? punto.tipo}
                </span>
                {punto.lat && punto.lng && (
                  <span className="text-muted text-small">
                    {Number(punto.lat).toFixed(5)}, {Number(punto.lng).toFixed(5)}
                  </span>
                )}
              </div>
              <div className="card__actions">
                <button
                  type="button"
                  onClick={() => setExpandidoId(expandidoId === punto.id ? null : punto.id)}
                  className="btn btn--ghost btn--small"
                >
                  {expandidoId === punto.id ? 'Cerrar' : 'Puzzles'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEditandoId(editandoId === punto.id ? null : punto.id)
                    setCreando(false)
                  }}
                  className="btn btn--ghost btn--small"
                >
                  Editar
                </button>
                {confirmar === punto.id ? (
                  <>
                    <button
                      type="button"
                      onClick={() => handleEliminar(punto.id)}
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
                    onClick={() => setConfirmar(punto.id)}
                    className="btn btn--ghost btn--small btn--icon"
                    title="Eliminar punto"
                  >✕</button>
                )}
              </div>
            </div>

            {editandoId === punto.id && (
              <FormPunto
                initial={{ ...PUNTO_VACIO, ...punto, lat: punto.lat ?? '', lng: punto.lng ?? '' }}
                onGuardar={(data, file) => handleEditar(punto.id, data, file)}
                onCancelar={() => setEditandoId(null)}
              />
            )}

            {expandidoId === punto.id && (
              <div className="builder-children">
                <QrInfo puntoId={punto.id} />
                <PuzzleBuilder
                  experienciaId={experienciaId}
                  epocaId={epocaId}
                  puntoId={punto.id}
                />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
