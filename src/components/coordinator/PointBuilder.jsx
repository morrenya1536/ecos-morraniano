import { useState, useEffect, useRef } from 'react'
import { QRCodeCanvas } from 'qrcode.react'
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
  pistaEntradaTexto: '',
  pistaEntradaVideoUrl: '',
  pistaEntradaImagenUrl: '',
}

function FormPunto({ initial, onGuardar, onCancelar }) {
  const [form, setForm] = useState(initial)
  const [llegadaFile, setLlegadaFile] = useState(null)
  const [llegadaPreview, setLlegadaPreview] = useState(null)
  const [pistaFile, setPistaFile] = useState(null)
  const [pistaPreview, setPistaPreview] = useState(null)
  const [guardando, setGuardando] = useState(false)
  const s = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handleLlegadaImagen = (e) => {
    const file = e.target.files[0]
    if (!file) return
    setLlegadaFile(file)
    setLlegadaPreview(URL.createObjectURL(file))
  }

  const handlePistaImagen = (e) => {
    const file = e.target.files[0]
    if (!file) return
    setPistaFile(file)
    setPistaPreview(URL.createObjectURL(file))
  }

  const submit = async (e) => {
    e.preventDefault()
    setGuardando(true)
    try { await onGuardar(form, { llegadaFile, pistaFile }) }
    finally { setGuardando(false) }
  }

  return (
    <form onSubmit={submit} className="builder-form">

      {/* ── Datos generales ──────────────────────────────────────── */}
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

      {/* ── Pista de entrada ─────────────────────────────────────── */}
      <div className="builder-form__section">
        <p className="builder-form__section-title">Pista de entrada</p>
        <p className="form__hint">
          Esta pista se muestra al jugador cuando se desbloquea este punto.
          Para el primer punto de la época, es la pista inicial que reciben en el briefing.
        </p>
        <div className="form__group">
          <label className="form__label">Texto de la pista</label>
          <textarea
            rows={3}
            value={form.pistaEntradaTexto}
            onChange={e => s('pistaEntradaTexto', e.target.value)}
            placeholder="Descripción, acertijo o indicación para llegar a este punto"
          />
        </div>
        <div className="form-grid-2">
          <div className="form__group">
            <label className="form__label">URL del vídeo</label>
            <input
              type="url"
              value={form.pistaEntradaVideoUrl}
              onChange={e => s('pistaEntradaVideoUrl', e.target.value)}
              placeholder="https://..."
            />
          </div>
          <div className="form__group">
            <label className="form__label">Imagen</label>
            {(pistaPreview || form.pistaEntradaImagenUrl) && (
              <img
                src={pistaPreview ?? form.pistaEntradaImagenUrl}
                alt="Pista de entrada"
                className="imagen-preview"
              />
            )}
            <input
              type="file"
              accept="image/*"
              onChange={handlePistaImagen}
              className="input--file"
            />
          </div>
        </div>
      </div>

      {/* ── Contenido de llegada ──────────────────────────────────── */}
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
          {(llegadaPreview || form.llegadaImagenUrl) && (
            <img
              src={llegadaPreview ?? form.llegadaImagenUrl}
              alt="Llegada"
              className="imagen-preview"
            />
          )}
          <input
            type="file"
            accept="image/*"
            onChange={handleLlegadaImagen}
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

function ModalQr({ puntoId, onCerrar }) {
  const canvasRef = useRef(null)

  const descargar = () => {
    const canvas = canvasRef.current
    if (!canvas) return
    const url = canvas.toDataURL('image/png')
    const a = document.createElement('a')
    a.href = url
    a.download = `qr-${puntoId}.png`
    a.click()
  }

  const imprimir = () => {
    const canvas = canvasRef.current
    if (!canvas) return
    const url = canvas.toDataURL('image/png')
    const win = window.open('', '_blank')
    win.document.write(
      `<!DOCTYPE html><html><head><title>QR — ${puntoId}</title></head>` +
      `<body style="text-align:center;padding:40px;font-family:monospace">` +
      `<img src="${url}" style="display:block;margin:0 auto"/>` +
      `<p style="margin-top:16px;font-size:12px;word-break:break-all">${puntoId}</p>` +
      `</body></html>`
    )
    win.document.close()
    win.focus()
    win.print()
  }

  return (
    <div className="modal-overlay" onClick={onCerrar}>
      <div className="modal modal--qr" onClick={e => e.stopPropagation()}>
        <div className="modal__header">
          <h3 className="modal__titulo">QR del punto</h3>
          <button type="button" onClick={onCerrar} className="btn btn--ghost btn--icon">✕</button>
        </div>
        <div className="modal__body--center">
          <QRCodeCanvas ref={canvasRef} value={puntoId} size={220} level="M" />
          <code className="modal__codigo">{puntoId}</code>
        </div>
        <div className="modal__footer">
          <button type="button" onClick={descargar} className="btn btn--ghost btn--small">
            Descargar QR
          </button>
          <button type="button" onClick={imprimir} className="btn btn--ghost btn--small">
            Imprimir QR
          </button>
        </div>
      </div>
    </div>
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
  const [qrPuntoId, setQrPuntoId] = useState(null)

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

  const handleCrear = async (data, { llegadaFile, pistaFile }) => {
    const ref = await createPunto(experienciaId, epocaId, {
      nombre: data.nombre,
      lat: data.lat ? Number(data.lat) : null,
      lng: data.lng ? Number(data.lng) : null,
      tipo: data.tipo,
      llegadaTexto: data.llegadaTexto,
      llegadaVideoUrl: data.llegadaVideoUrl,
      orden: nextOrden,
      pistaEntrada: {
        texto: data.pistaEntradaTexto,
        videoUrl: data.pistaEntradaVideoUrl,
        imagenUrl: '',
      },
    })

    // Las imágenes se suben después de tener el ID del punto
    const imageUpdates = {}
    if (llegadaFile) {
      imageUpdates.llegadaImagenUrl = await uploadImagen(
        `experiencias/${experienciaId}/epocas/${epocaId}/puntos/${ref.id}/llegada`,
        llegadaFile
      )
    }
    if (pistaFile) {
      // Dot notation para actualizar solo el campo anidado sin sobrescribir los demás
      imageUpdates['pistaEntrada.imagenUrl'] = await uploadImagen(
        `experiencias/${experienciaId}/epocas/${epocaId}/puntos/${ref.id}/pistaEntrada`,
        pistaFile
      )
    }
    if (Object.keys(imageUpdates).length > 0) {
      await updatePunto(experienciaId, epocaId, ref.id, imageUpdates)
    }

    setCreando(false)
    setExpandidoId(ref.id)
  }

  const handleEditar = async (puntoId, data, { llegadaFile, pistaFile }) => {
    // Subir imágenes primero para incluir las URLs en la escritura final
    let llegadaImagenUrl = data.llegadaImagenUrl ?? ''
    let pistaImagenUrl = data.pistaEntradaImagenUrl ?? ''

    if (llegadaFile) {
      llegadaImagenUrl = await uploadImagen(
        `experiencias/${experienciaId}/epocas/${epocaId}/puntos/${puntoId}/llegada`,
        llegadaFile
      )
    }
    if (pistaFile) {
      pistaImagenUrl = await uploadImagen(
        `experiencias/${experienciaId}/epocas/${epocaId}/puntos/${puntoId}/pistaEntrada`,
        pistaFile
      )
    }

    await updatePunto(experienciaId, epocaId, puntoId, {
      nombre: data.nombre,
      lat: data.lat ? Number(data.lat) : null,
      lng: data.lng ? Number(data.lng) : null,
      tipo: data.tipo,
      llegadaTexto: data.llegadaTexto,
      llegadaVideoUrl: data.llegadaVideoUrl,
      llegadaImagenUrl,
      pistaEntrada: {
        texto: data.pistaEntradaTexto,
        videoUrl: data.pistaEntradaVideoUrl,
        imagenUrl: pistaImagenUrl,
      },
    })
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
      {qrPuntoId && (
        <ModalQr puntoId={qrPuntoId} onCerrar={() => setQrPuntoId(null)} />
      )}

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
                {idx === 0 && (
                  <span className="badge badge--inicio" title="Su pista de entrada es la pista inicial de la época">
                    Inicio
                  </span>
                )}
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
                  onClick={() => setQrPuntoId(punto.id)}
                  className="btn btn--ghost btn--small"
                >
                  Ver QR
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
                initial={{
                  ...PUNTO_VACIO,
                  ...punto,
                  lat: punto.lat ?? '',
                  lng: punto.lng ?? '',
                  pistaEntradaTexto: punto.pistaEntrada?.texto ?? '',
                  pistaEntradaVideoUrl: punto.pistaEntrada?.videoUrl ?? '',
                  pistaEntradaImagenUrl: punto.pistaEntrada?.imagenUrl ?? '',
                }}
                onGuardar={(data, files) => handleEditar(punto.id, data, files)}
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
