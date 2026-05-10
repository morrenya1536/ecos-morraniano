import { useState, useEffect } from 'react'
import {
  subscribePuzzles,
  createPuzzle,
  updatePuzzle,
  deletePuzzle,
} from '../../services/firestore'
import { uploadImagen } from '../../services/storage'
import { TabsIdioma, toMulti } from '../shared/TabsIdioma'
import { getText } from '../../utils/helpers'

const TIPOS_RESPUESTA = {
  numerica: 'Numérica',
  texto_libre: 'Texto libre',
  confirmacion_fisica: 'Confirmación física',
  colaborativa: 'Colaborativa',
  escanear_qr: 'Escanear QR',
}

function CampoRespuesta({ tipo, valor, onChange }) {
  if (tipo === 'numerica' || tipo === 'texto_libre') {
    return (
      <div className="form__group">
        <label className="form__label">Respuesta correcta</label>
        <input
          type="text"
          value={valor}
          onChange={e => onChange(e.target.value)}
          placeholder={tipo === 'numerica' ? '42' : 'respuesta...'}
        />
      </div>
    )
  }
  if (tipo === 'escanear_qr') {
    return (
      <div className="form__group">
        <label className="form__label">ID del QR esperado</label>
        <input
          type="text"
          value={valor}
          onChange={e => onChange(e.target.value)}
          placeholder="puntoId del QR que el jugador debe escanear"
        />
      </div>
    )
  }
  if (tipo === 'confirmacion_fisica' || tipo === 'colaborativa') {
    return (
      <div className="form__group">
        <label className="form__label">Código de confirmación</label>
        <input
          type="text"
          value={valor}
          onChange={e => onChange(e.target.value)}
          placeholder="Ej: MORR42"
        />
        <span className="form__hint">
          Número o palabra corta que estará grabada/escrita en el elemento físico.
          El jugador deberá introducirla para confirmar que estuvo allí.
        </span>
      </div>
    )
  }
  return null
}

const PUZZLE_VACIO = {
  enunciado: '',
  tipoRespuesta: 'texto_libre',
  respuestaCorrecta: '',
  contenidoTexto: '',
  contenidoVideoUrl: '',
  ayuda1: '',
  ayuda2: '',
  ayuda3: '',
  penalizacionMinutos: 5,
  accesibilidadDaltonismo: '',
  accesibilidadSordera: '',
  accesibilidadMovilidad: '',
  secuenciaOrdenada: false,
  secuencia: [],
}

function FormPuzzle({ initial, idiomas, onGuardar, onCancelar }) {
  const [form, setForm] = useState(initial)
  const [idiomaActivo, setIdiomaActivo] = useState(idiomas[0] ?? 'es')
  const [imagenFile, setImagenFile] = useState(null)
  const [imagenPreview, setImagenPreview] = useState(null)
  const [guardando, setGuardando] = useState(false)
  const s = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const sMulti = (key, value) => setForm(f => ({
    ...f,
    [key]: { ...toMulti(f[key], idiomas), [idiomaActivo]: value },
  }))

  const updatePaso = (i, key, val) => setForm(f => ({
    ...f,
    secuencia: f.secuencia.map((p, j) => j === i ? { ...p, [key]: val } : p),
  }))
  const addPaso = () => setForm(f => ({
    ...f,
    secuencia: [...f.secuencia, { tipo: 'numerica', respuestaCorrecta: '', tiempoLimite: 0 }],
  }))
  const removePaso = (i) => setForm(f => ({
    ...f,
    secuencia: f.secuencia.filter((_, j) => j !== i),
  }))


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

  const enunciadoActivo = toMulti(form.enunciado, idiomas)[idiomaActivo] ?? ''
  const ayuda1Activo = toMulti(form.ayuda1, idiomas)[idiomaActivo] ?? ''
  const ayuda2Activo = toMulti(form.ayuda2, idiomas)[idiomaActivo] ?? ''
  const ayuda3Activo = toMulti(form.ayuda3, idiomas)[idiomaActivo] ?? ''
  const respuestaMultiActivo = form.tipoRespuesta === 'texto_libre'
    ? (toMulti(form.respuestaCorrecta, idiomas)[idiomaActivo] ?? '')
    : null

  return (
    <form onSubmit={submit} className="builder-form">

      {/* ── Selector de idioma ───────────────────────────────────── */}
      {idiomas.length > 1 && (
        <div className="builder-form__idioma-bar">
          <span className="builder-form__idioma-label">Editando en:</span>
          <TabsIdioma idiomas={idiomas} activo={idiomaActivo} onChange={setIdiomaActivo} />
        </div>
      )}

      {/* ── Contenido ───────────────────────────────────────────── */}
      <div className="builder-form__section">
        <p className="builder-form__section-title">Contenido del puzzle</p>
        <div className="form__group">
          <label className="form__label">Enunciado *</label>
          <textarea
            rows={3}
            value={enunciadoActivo}
            onChange={e => sMulti('enunciado', e.target.value)}
            placeholder="Pregunta o reto que deben resolver los jugadores"
            required={idiomaActivo === (idiomas[0] ?? 'es')}
          />
        </div>
        <div className="form__group">
          <label className="form__label">Texto adicional</label>
          <textarea
            rows={2}
            value={form.contenidoTexto}
            onChange={e => s('contenidoTexto', e.target.value)}
            placeholder="Información extra, pistas contextuales..."
          />
        </div>
        <div className="form-grid-2">
          <div className="form__group">
            <label className="form__label">URL del vídeo</label>
            <input
              type="url"
              value={form.contenidoVideoUrl}
              onChange={e => s('contenidoVideoUrl', e.target.value)}
              placeholder="https://..."
            />
          </div>
          <div className="form__group">
            <label className="form__label">Imagen</label>
            {(imagenPreview || form.contenidoImagenUrl) && (
              <img
                src={imagenPreview ?? form.contenidoImagenUrl}
                alt="Contenido"
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
        <div className="form-grid-2">
          <div className="form__group">
            <label className="form__label">Tipo de respuesta</label>
            <select value={form.tipoRespuesta} onChange={e => s('tipoRespuesta', e.target.value)}>
              {Object.entries(TIPOS_RESPUESTA).map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </select>
          </div>
          {form.tipoRespuesta === 'texto_libre' ? (
            <div className="form__group">
              <label className="form__label">Respuesta correcta</label>
              <input
                type="text"
                value={respuestaMultiActivo}
                onChange={e => setForm(f => ({
                  ...f,
                  respuestaCorrecta: { ...toMulti(f.respuestaCorrecta, idiomas), [idiomaActivo]: e.target.value },
                }))}
                placeholder="respuesta..."
              />
            </div>
          ) : (
            <CampoRespuesta
              tipo={form.tipoRespuesta}
              valor={typeof form.respuestaCorrecta === 'string' ? form.respuestaCorrecta : (getText(form.respuestaCorrecta, idiomas[0]) ?? '')}
              onChange={v => s('respuestaCorrecta', v)}
            />
          )}
        </div>
      </div>

      {/* ── Secuencia colaborativa ──────────────────────────────── */}
      {form.tipoRespuesta === 'colaborativa' && (
        <div className="builder-form__section">
          <p className="builder-form__section-title">Secuencia de pasos</p>
          <div className="form__group form__group--row">
            <label className="form__label">¿Secuencia ordenada?</label>
            <label className="toggle">
              <input
                type="checkbox"
                checked={!!form.secuenciaOrdenada}
                onChange={e => s('secuenciaOrdenada', e.target.checked)}
              />
              <span className="toggle__slider" />
            </label>
          </div>
          {form.secuenciaOrdenada && (
            <div className="secuencia-builder">
              {(form.secuencia ?? []).map((paso, i) => (
                <div key={i} className="secuencia-paso">
                  <div className="secuencia-paso__header">
                    <span className="secuencia-paso__num">Paso {i + 1}</span>
                    <button
                      type="button"
                      onClick={() => removePaso(i)}
                      className="btn btn--ghost btn--small btn--icon"
                      title="Eliminar paso"
                    >✕</button>
                  </div>
                  <div className="form-grid-2">
                    <div className="form__group">
                      <label className="form__label">Tipo de respuesta</label>
                      <select
                        value={paso.tipo}
                        onChange={e => updatePaso(i, 'tipo', e.target.value)}
                      >
                        <option value="numerica">Numérica</option>
                        <option value="texto_libre">Texto libre</option>
                        <option value="escanear_qr">Escanear QR</option>
                      </select>
                    </div>
                    <div className="form__group">
                      <label className="form__label">Respuesta correcta</label>
                      <input
                        type="text"
                        value={paso.respuestaCorrecta}
                        onChange={e => updatePaso(i, 'respuestaCorrecta', e.target.value)}
                        placeholder={
                          paso.tipo === 'numerica' ? '42'
                          : paso.tipo === 'escanear_qr' ? 'puntoId del QR'
                          : 'respuesta...'
                        }
                      />
                    </div>
                  </div>
                  <div className="form__group" style={{ maxWidth: '220px' }}>
                    <label className="form__label">Tiempo límite (seg, 0 = sin límite)</label>
                    <input
                      type="number"
                      min={0}
                      value={paso.tiempoLimite}
                      onChange={e => updatePaso(i, 'tiempoLimite', Number(e.target.value))}
                    />
                  </div>
                </div>
              ))}
              <button type="button" onClick={addPaso} className="btn btn--ghost btn--small">
                + Añadir paso
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── Ayudas ──────────────────────────────────────────────── */}
      <div className="builder-form__section">
        <p className="builder-form__section-title">Ayudas</p>
        <div className="form__group">
          <label className="form__label">Ayuda nivel 1 <span className="text-muted">(sin penalización)</span></label>
          <textarea
            rows={2}
            value={ayuda1Activo}
            onChange={e => sMulti('ayuda1', e.target.value)}
            placeholder="Pista suave"
          />
        </div>
        <div className="form__group">
          <label className="form__label">Ayuda nivel 2 <span className="text-muted">(sin penalización)</span></label>
          <textarea
            rows={2}
            value={ayuda2Activo}
            onChange={e => sMulti('ayuda2', e.target.value)}
            placeholder="Pista más directa"
          />
        </div>
        <div className="form__group">
          <label className="form__label">Ayuda nivel 3 <span className="text-muted">(con penalización)</span></label>
          <textarea
            rows={2}
            value={ayuda3Activo}
            onChange={e => sMulti('ayuda3', e.target.value)}
            placeholder="Pista que revela casi la solución"
          />
        </div>
        <div className="form__group" style={{ maxWidth: '200px' }}>
          <label className="form__label">Penalización ayuda 3 (minutos)</label>
          <input
            type="number"
            min={0}
            max={60}
            value={form.penalizacionMinutos}
            onChange={e => s('penalizacionMinutos', Number(e.target.value))}
          />
        </div>
      </div>

      {/* ── Accesibilidad ───────────────────────────────────────── */}
      <div className="builder-form__section">
        <p className="builder-form__section-title">Versiones accesibles</p>
        <div className="form__group">
          <label className="form__label">Daltonismo <span className="text-muted">(descripción alternativa de colores)</span></label>
          <textarea
            rows={2}
            value={form.accesibilidadDaltonismo}
            onChange={e => s('accesibilidadDaltonismo', e.target.value)}
            placeholder="Describe el contenido sin depender de colores"
          />
        </div>
        <div className="form__group">
          <label className="form__label">Sordera <span className="text-muted">(transcripción del audio)</span></label>
          <textarea
            rows={2}
            value={form.accesibilidadSordera}
            onChange={e => s('accesibilidadSordera', e.target.value)}
            placeholder="Transcripción o descripción del contenido de audio/vídeo"
          />
        </div>
        <div className="form__group">
          <label className="form__label">Movilidad reducida <span className="text-muted">(descripción alternativa)</span></label>
          <textarea
            rows={2}
            value={form.accesibilidadMovilidad}
            onChange={e => s('accesibilidadMovilidad', e.target.value)}
            placeholder="Versión del puzzle para personas con movilidad reducida"
          />
        </div>
      </div>

      <div className="form__actions">
        <button type="button" onClick={onCancelar} className="btn btn--ghost btn--small">
          Cancelar
        </button>
        <button type="submit" disabled={guardando} className="btn btn--primary btn--small">
          {guardando ? 'Guardando...' : 'Guardar puzzle'}
        </button>
      </div>
    </form>
  )
}

export default function PuzzleBuilder({ experienciaId, epocaId, puntoId, idiomasDisponibles = ['es'] }) {
  const idiomas = idiomasDisponibles.length > 0 ? idiomasDisponibles : ['es']
  const [puzzles, setPuzzles] = useState([])
  const [creando, setCreando] = useState(false)
  const [editandoId, setEditandoId] = useState(null)
  const [confirmar, setConfirmar] = useState(null)

  useEffect(() => {
    return subscribePuzzles(experienciaId, epocaId, puntoId, (snap) => {
      setPuzzles(
        snap.docs
          .map(d => ({ id: d.id, ...d.data() }))
          .sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0))
      )
    })
  }, [experienciaId, epocaId, puntoId])

  const nextOrden = puzzles.length === 0
    ? 0
    : Math.max(...puzzles.map(p => p.orden ?? 0)) + 1

  const handleCrear = async (data, imagenFile) => {
    const ref = await createPuzzle(experienciaId, epocaId, puntoId, {
      ...data,
      orden: nextOrden,
    })
    if (imagenFile) {
      const url = await uploadImagen(
        `experiencias/${experienciaId}/epocas/${epocaId}/puntos/${puntoId}/puzzles/${ref.id}/contenido`,
        imagenFile
      )
      await updatePuzzle(experienciaId, epocaId, puntoId, ref.id, { contenidoImagenUrl: url })
    }
    setCreando(false)
  }

  const handleEditar = async (puzzleId, data, imagenFile) => {
    const updates = { ...data }
    if (imagenFile) {
      updates.contenidoImagenUrl = await uploadImagen(
        `experiencias/${experienciaId}/epocas/${epocaId}/puntos/${puntoId}/puzzles/${puzzleId}/contenido`,
        imagenFile
      )
    }
    await updatePuzzle(experienciaId, epocaId, puntoId, puzzleId, updates)
    setEditandoId(null)
  }

  const handleEliminar = async (puzzleId) => {
    await deletePuzzle(experienciaId, epocaId, puntoId, puzzleId)
    setConfirmar(null)
    if (editandoId === puzzleId) setEditandoId(null)
  }

  const swap = async (a, b) => Promise.all([
    updatePuzzle(experienciaId, epocaId, puntoId, a.id, { orden: b.orden }),
    updatePuzzle(experienciaId, epocaId, puntoId, b.id, { orden: a.orden }),
  ])

  return (
    <div className="builder-section builder-section--nested">
      <div className="section-header">
        <h4>Puzzles ({puzzles.length})</h4>
        <button
          type="button"
          onClick={() => { setCreando(c => !c); setEditandoId(null) }}
          className="btn btn--small"
        >
          {creando ? 'Cancelar' : '+ Puzzle'}
        </button>
      </div>

      {creando && (
        <FormPuzzle
          initial={PUZZLE_VACIO}
          idiomas={idiomas}
          onGuardar={handleCrear}
          onCancelar={() => setCreando(false)}
        />
      )}

      {puzzles.length === 0 && !creando && (
        <div className="empty-state">
          <p>No hay puzzles en este punto.</p>
        </div>
      )}

      <div className="builder-list">
        {puzzles.map((puzzle, idx) => (
          <div key={puzzle.id} className="builder-item builder-item--puzzle">
            <div className="builder-item__header">
              <div className="builder-item__meta">
                <span className="reorder-btns">
                  <button
                    type="button"
                    onClick={() => swap(puzzles[idx], puzzles[idx - 1])}
                    disabled={idx === 0}
                    className="btn btn--icon btn--ghost"
                  >↑</button>
                  <button
                    type="button"
                    onClick={() => swap(puzzles[idx], puzzles[idx + 1])}
                    disabled={idx === puzzles.length - 1}
                    className="btn btn--icon btn--ghost"
                  >↓</button>
                </span>
                <span className="builder-orden">{idx + 1}</span>
                <span className="puzzle-enunciado">{getText(puzzle.enunciado, idiomas[0] ?? 'es') || '(sin enunciado)'}</span>
                <span className={`tipo-badge tipo-badge--${puzzle.tipoRespuesta}`}>
                  {TIPOS_RESPUESTA[puzzle.tipoRespuesta] ?? puzzle.tipoRespuesta}
                </span>
              </div>
              <div className="card__actions">
                <button
                  type="button"
                  onClick={() => {
                    setEditandoId(editandoId === puzzle.id ? null : puzzle.id)
                    setCreando(false)
                  }}
                  className="btn btn--ghost btn--small"
                >
                  {editandoId === puzzle.id ? 'Cerrar' : 'Editar'}
                </button>
                {confirmar === puzzle.id ? (
                  <>
                    <button
                      type="button"
                      onClick={() => handleEliminar(puzzle.id)}
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
                    onClick={() => setConfirmar(puzzle.id)}
                    className="btn btn--ghost btn--small btn--icon"
                    title="Eliminar puzzle"
                  >✕</button>
                )}
              </div>
            </div>

            {editandoId === puzzle.id && (
              <FormPuzzle
                initial={{ ...PUZZLE_VACIO, ...puzzle }}
                idiomas={idiomas}
                onGuardar={(data, file) => handleEditar(puzzle.id, data, file)}
                onCancelar={() => setEditandoId(null)}
              />
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
