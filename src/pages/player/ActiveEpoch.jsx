import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import { MapContainer, TileLayer, CircleMarker, Popup, useMap } from 'react-leaflet'
import {
  MultiFormatReader,
  BinaryBitmap,
  HybridBinarizer,
  HTMLCanvasElementLuminanceSource,
} from '@zxing/library'
import { useGame } from '../../context/GameContext'
import {
  subscribeProgresoEpoca,
  registrarAyuda,
  pausarEpoca,
  reanudarEpoca,
} from '../../services/firestore'
import { getDocs, collection } from 'firebase/firestore'
import { db } from '../../services/firebase'

// ─── Helpers ──────────────────────────────────────────────────────────────────
function useElapsedActivo(progreso) {
  const [elapsed, setElapsed] = useState(0)
  const tiempoAcumuladoMs = progreso?.tiempoAcumuladoMs ?? null
  const inicioActualMs = progreso?.inicioActual?.toMillis?.() ?? null
  const estado = progreso?.estado ?? null
  const tiempoInicioMs = progreso?.tiempoInicio?.toMillis?.() ?? null

  useEffect(() => {
    if (tiempoAcumuladoMs !== null) {
      if (!inicioActualMs || estado !== 'activo') {
        setElapsed(Math.floor(tiempoAcumuladoMs / 1000))
        return
      }
      const tick = () => setElapsed(Math.floor((tiempoAcumuladoMs + Date.now() - inicioActualMs) / 1000))
      tick()
      const id = setInterval(tick, 1000)
      return () => clearInterval(id)
    }
    // Legacy schema fallback
    if (!tiempoInicioMs) return
    const tick = () => setElapsed(Math.floor((Date.now() - tiempoInicioMs) / 1000))
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [tiempoAcumuladoMs, inicioActualMs, estado, tiempoInicioMs])

  return elapsed
}

function formatTime(s) {
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  if (h > 0) return `${h}h ${String(m).padStart(2, '0')}m ${String(sec).padStart(2, '0')}s`
  return `${String(m).padStart(2, '0')}m ${String(sec).padStart(2, '0')}s`
}

function mensajeCamara(err) {
  const msg = String(err?.message ?? err)
  if (/NotAllowedError|PermissionDenied/i.test(msg))
    return 'Permiso de cámara denegado. Ve a los ajustes del navegador para permitir el acceso.'
  if (/NotFoundError|DevicesNotFound|Requested device not found/i.test(msg))
    return 'No se encontró ninguna cámara en este dispositivo.'
  if (/NotReadableError|TrackStart|Could not start video source/i.test(msg))
    return 'La cámara está en uso por otra aplicación. Ciérrala e inténtalo de nuevo.'
  return 'No se pudo acceder a la cámara. Comprueba los permisos e inténtalo de nuevo.'
}

// ─── Map auto-recenter ─────────────────────────────────────────────────────────
function RecenterMap({ lat, lng }) {
  const map = useMap()
  useEffect(() => { if (lat && lng) map.setView([lat, lng], map.getZoom()) }, [lat, lng, map])
  return null
}

// ─── Pause bar ─────────────────────────────────────────────────────────────────
function PauseBar({ estado, onPausar, onReanudar, loading }) {
  if (!estado || estado === 'completado') return null
  return (
    <div className={`pause-bar${estado === 'pausado' ? ' pause-bar--pausado' : ''}`}>
      {estado === 'pausado' ? (
        <>
          <span className="pause-bar__label">⏸ Fase pausada</span>
          <button className="btn btn--ghost btn--small" onClick={onReanudar} disabled={loading}>
            {loading ? '...' : '▶ Reanudar'}
          </button>
        </>
      ) : (
        <button className="btn btn--ghost btn--small pause-bar__btn" onClick={onPausar} disabled={loading}>
          {loading ? '...' : '⏸ Pausar'}
        </button>
      )}
    </div>
  )
}

const TIENE_BARCODE_DETECTOR = typeof BarcodeDetector !== 'undefined'

// ─── Tab QR ───────────────────────────────────────────────────────────────────
function TabQR({ puntos, puntosCompletados, progreso, onPuntoConfirmado }) {
  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const loopRef = useRef(null)
  const streamRef = useRef(null)
  const mountedRef = useRef(true)
  const procesandoRef = useRef(false)
  const puntosRef = useRef(puntos)
  const completadosRef = useRef(puntosCompletados)
  useEffect(() => { puntosRef.current = puntos }, [puntos])
  useEffect(() => { completadosRef.current = puntosCompletados }, [puntosCompletados])

  const [estado, setEstado] = useState('idle')
  const [errorCamara, setErrorCamara] = useState('')
  const [mensajeScan, setMensajeScan] = useState(null)

  const pendingPunto = puntos.find(p => !puntosCompletados.includes(p.id))
  const elapsed = useElapsedActivo(progreso)
  const penalizacionMinutos = progreso?.penalizacionMinutos ?? 0

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      clearTimeout(loopRef.current)
      streamRef.current?.getTracks().forEach(t => t.stop())
      streamRef.current = null
    }
  }, [])

  const detener = () => {
    clearTimeout(loopRef.current)
    streamRef.current?.getTracks().forEach(t => t.stop())
    streamRef.current = null
    if (videoRef.current) videoRef.current.srcObject = null
    procesandoRef.current = false
    setEstado('idle')
    setMensajeScan(null)
  }

  const procesarEscaneo = (rawValue) => {
    if (procesandoRef.current) return
    procesandoRef.current = true
    const scannedId = rawValue.trim()
    const todosPuntos = puntosRef.current
    const completados = completadosRef.current
    if (!todosPuntos.some(p => p.id === scannedId)) {
      setMensajeScan({ texto: 'QR no reconocido. Este código no pertenece a esta época.', tipo: 'error' })
      setTimeout(() => { setMensajeScan(null); procesandoRef.current = false }, 3000)
      return
    }
    const puntoActual = todosPuntos.find(p => !completados.includes(p.id))
    if (!puntoActual || scannedId !== puntoActual.id) {
      setMensajeScan({ texto: 'Este no es el punto que buscas. Sigue explorando.', tipo: 'error' })
      setTimeout(() => { setMensajeScan(null); procesandoRef.current = false }, 3000)
      return
    }
    onPuntoConfirmado(scannedId)
  }

  const iniciarBucleBarcode = (video) => {
    let detector
    try { detector = new BarcodeDetector({ formats: ['qr_code'] }) } catch { return false }
    const tick = async () => {
      if (!streamRef.current) return
      try {
        const barcodes = await detector.detect(video)
        if (barcodes.length > 0) procesarEscaneo(barcodes[0].rawValue)
      } catch { }
      loopRef.current = setTimeout(tick, 300)
    }
    tick()
    return true
  }

  const iniciarBucleZxing = (video) => {
    const reader = new MultiFormatReader()
    const canvas = canvasRef.current
    const tick = () => {
      if (!streamRef.current) return
      const w = video.videoWidth, h = video.videoHeight
      if (w && h) {
        if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h }
        canvas.getContext('2d').drawImage(video, 0, 0, w, h)
        try {
          const source = new HTMLCanvasElementLuminanceSource(canvas)
          procesarEscaneo(reader.decode(new BinaryBitmap(new HybridBinarizer(source))).getText())
        } catch { }
      }
      loopRef.current = setTimeout(tick, 300)
    }
    tick()
  }

  const iniciar = async () => {
    if (streamRef.current || estado === 'iniciando') return
    setEstado('iniciando')
    setErrorCamara('')
    setMensajeScan(null)
    procesandoRef.current = false
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
      if (!mountedRef.current) { stream.getTracks().forEach(t => t.stop()); return }
      streamRef.current = stream
      const video = videoRef.current
      video.srcObject = stream
      await video.play()
      setEstado('activo')
      if (TIENE_BARCODE_DETECTOR && iniciarBucleBarcode(video)) return
      iniciarBucleZxing(video)
    } catch (err) {
      if (!mountedRef.current) return
      setErrorCamara(mensajeCamara(err))
      setEstado('error')
    }
  }

  if (!pendingPunto) {
    return (
      <div className="tab-content tab-content--center">
        <p className="text-success text-center">Todos los puntos completados.</p>
      </div>
    )
  }

  return (
    <div className="tab-content tab-qr">
      <div className="qr-tramo-timer">
        <span className="qr-tramo-timer__label">Tiempo de tramo</span>
        <span className="qr-tramo-timer__value">{formatTime(elapsed + penalizacionMinutos * 60)}</span>
      </div>
      <p className="tab-qr__hint">
        Busca el QR en la localización y escanéalo para desbloquear los puzzles.
      </p>
      <video
        ref={videoRef}
        className={`qr-reader-box${estado === 'activo' ? ' qr-reader-box--activo' : ''}`}
        playsInline
        muted
      />
      <canvas ref={canvasRef} style={{ display: 'none' }} />
      {estado === 'activo' && (
        <p className="qr-scan-label">
          <span className="qr-scan-dot" /> Cámara activa — apunta al código QR
        </p>
      )}
      {mensajeScan && (
        <p className={`qr-scan-msg qr-scan-msg--${mensajeScan.tipo}`}>{mensajeScan.texto}</p>
      )}
      {estado === 'error' && (
        <div className="qr-error-box">
          <p>{errorCamara}</p>
          {errorCamara.includes('ajustes') && (
            <p className="qr-error-box__instrucciones">
              iOS: Ajustes → Safari → Cámara → Permitir<br />
              Android: toca el icono de candado en la barra de dirección → Permisos → Cámara
            </p>
          )}
        </div>
      )}
      <div className="tab-qr__actions">
        {estado === 'activo'
          ? <button type="button" onClick={detener} className="btn btn--ghost">Detener cámara</button>
          : (
            <button
              type="button"
              onClick={iniciar}
              disabled={estado === 'iniciando'}
              className="btn btn--primary"
            >
              {estado === 'iniciando' ? 'Activando...' : 'Activar cámara'}
            </button>
          )
        }
        <button
          type="button"
          className="btn btn--ghost btn--small"
          onClick={() => onPuntoConfirmado(pendingPunto.id)}
        >
          Continuar puzzle sin escanear
        </button>
      </div>
    </div>
  )
}

// ─── Tab Pistas ───────────────────────────────────────────────────────────────
function TabPistas({ puntos, puntosCompletados, puzzlesCompletados, experienciaId, epocaId, onPuntoConfirmado }) {
  const [puntoPuzzles, setPuntoPuzzles] = useState({})
  const loadedRef = useRef(new Set())
  const completadosSet = new Set(puzzlesCompletados)
  const pendingPunto = puntos.find(p => !puntosCompletados.includes(p.id))

  useEffect(() => {
    if (!experienciaId || !epocaId) return
    puntos.forEach(p => {
      if (!puntosCompletados.includes(p.id) && p.id !== pendingPunto?.id) return
      if (loadedRef.current.has(p.id)) return
      loadedRef.current.add(p.id)
      getDocs(collection(db, 'experiencias', experienciaId, 'epocas', epocaId, 'puntos', p.id, 'puzzles'))
        .then(snap => setPuntoPuzzles(prev => ({
          ...prev,
          [p.id]: snap.docs
            .map(d => ({ id: d.id, ...d.data() }))
            .sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0)),
        })))
    })
  }, [puntos, puntosCompletados, pendingPunto?.id, experienciaId, epocaId])

  const displayPuntos = puntos.filter(p => puntosCompletados.includes(p.id) || p.id === pendingPunto?.id)

  return (
    <div className="tab-content tab-pistas">
      {displayPuntos.length === 0 && (
        <p className="text-muted text-center">Cargando pistas...</p>
      )}
      {displayPuntos.map(p => {
        const isDone = puntosCompletados.includes(p.id)
        const puzzles = puntoPuzzles[p.id] ?? []
        const firstActiveIdx = !isDone ? puzzles.findIndex(pz => !completadosSet.has(pz.id)) : -1
        const hasStarted = !isDone && puzzles.some(pz => completadosSet.has(pz.id))

        return (
          <div key={p.id} className={`pista-card ${isDone ? 'pista-card--completada' : 'pista-card--activa'}`}>
            <span className={`pista-card__badge${isDone ? '' : ' pista-card__badge--activo'}`}>
              {isDone ? '✓ Completado' : '▶ Activo'}
            </span>
            {p.pistaEntrada?.imagenUrl && (
              <img src={p.pistaEntrada.imagenUrl} alt="Pista" className="media-image" />
            )}
            {p.pistaEntrada?.videoUrl && (
              <video src={p.pistaEntrada.videoUrl} controls playsInline className="media-player" />
            )}
            {p.pistaEntrada?.texto && (
              <p className="pista-card__texto">{p.pistaEntrada.texto}</p>
            )}
            {puzzles.length > 0 && (
              <div className="pista-card__puzzles">
                {puzzles.map((pz, idx) => {
                  const pzDone = completadosSet.has(pz.id)
                  if (!isDone && !pzDone && idx !== firstActiveIdx) return null
                  return (
                    <div
                      key={pz.id}
                      className={`pista-puzzle ${pzDone || isDone ? 'pista-puzzle--completado' : 'pista-puzzle--activo'}`}
                    >
                      <span className="pista-puzzle__enunciado">{pz.enunciado}</span>
                      {(pzDone || isDone) && pz.respuestaCorrecta && (
                        <span className="pista-puzzle__respuesta">→ {pz.respuestaCorrecta}</span>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
            {!isDone && (
              <button
                className="btn btn--primary btn--small"
                style={{ marginTop: 'var(--gap)' }}
                onClick={() => onPuntoConfirmado(p.id)}
              >
                {hasStarted ? 'Continuar puzzle' : 'Ir al puzzle'}
              </button>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ─── Tab Mapa ─────────────────────────────────────────────────────────────────
function TabMapa({ puntos, puntosCompletados }) {
  const pendingPunto = puntos.find(p => !puntosCompletados.includes(p.id))
  const center = pendingPunto?.lat
    ? [Number(pendingPunto.lat), Number(pendingPunto.lng)]
    : [41.3825, 2.1769]

  return (
    <div className="tab-content tab-mapa">
      <MapContainer
        center={center}
        zoom={17}
        style={{ height: '100%', width: '100%' }}
        zoomControl
      >
        <TileLayer
          url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
          attribution="Tiles © Esri"
          maxZoom={19}
        />
        <RecenterMap lat={center[0]} lng={center[1]} />
        {puntos.map(p => {
          if (!p.lat || !p.lng) return null
          const done = puntosCompletados.includes(p.id)
          return (
            <CircleMarker
              key={p.id}
              center={[Number(p.lat), Number(p.lng)]}
              radius={10}
              pathOptions={{
                color: done ? '#4caf50' : '#e94560',
                fillColor: done ? '#4caf50' : '#e94560',
                fillOpacity: 0.85,
                weight: 2,
              }}
            >
              <Popup>{done ? `✓ ${p.nombre}` : '?'}</Popup>
            </CircleMarker>
          )
        })}
      </MapContainer>
    </div>
  )
}

// ─── Tab Ayuda ────────────────────────────────────────────────────────────────
function TabAyuda({ puntos, puntosCompletados, puzzlesCompletados, progreso, epocaId, experienciaId, grupoId, equipoId }) {
  const pendingPunto = puntos.find(p => !puntosCompletados.includes(p.id))
  const [puzzles, setPuzzles] = useState([])
  const [mostradas, setMostradas] = useState({})
  const [confirmar, setConfirmar] = useState(null)

  useEffect(() => {
    if (!pendingPunto || !experienciaId) return
    setPuzzles([])
    getDocs(
      collection(db, 'experiencias', experienciaId, 'epocas', epocaId, 'puntos', pendingPunto.id, 'puzzles')
    ).then(snap => {
      setPuzzles(
        snap.docs
          .map(d => ({ id: d.id, ...d.data() }))
          .sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0))
      )
    })
  }, [pendingPunto?.id, epocaId, experienciaId])

  const sinProgreso = !progreso ||
    ((progreso.puntosCompletados ?? []).length === 0 &&
     (progreso.puzzlesCompletados ?? []).length === 0)

  if (!pendingPunto) {
    return (
      <div className="tab-content tab-content--center">
        <p className="text-success text-center">Todos los puntos completados.</p>
      </div>
    )
  }

  if (sinProgreso) {
    return (
      <div className="tab-content tab-content--center">
        <p className="text-muted text-center">Dirígete al primer punto para comenzar.</p>
      </div>
    )
  }

  const puzzleActual = puzzles.find(pz => !puzzlesCompletados.includes(pz.id))
  const tieneAyudas = puzzleActual && (puzzleActual.ayuda1 || puzzleActual.ayuda2 || puzzleActual.ayuda3)
  const ayudasUsadas = progreso?.ayudasUsadas ?? {}

  const revelar = async (puzzleId, nivel, penalizacion) => {
    if (nivel === 3 && penalizacion > 0 && confirmar?.puzzleId !== puzzleId) {
      setConfirmar({ puzzleId, nivel, penalizacion })
      return
    }
    setConfirmar(null)
    setMostradas(prev => ({ ...prev, [puzzleId]: Math.max(prev[puzzleId] ?? 0, nivel) }))
    await registrarAyuda(grupoId, equipoId, epocaId, puzzleId, nivel, nivel === 3 ? penalizacion : 0)
  }

  return (
    <div className="tab-content tab-ayuda">
      {confirmar && (
        <div className="modal-overlay">
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2 className="modal__titulo">¿Confirmar penalización?</h2>
            <p className="modal__texto">
              Esta ayuda tiene una penalización de <strong>{confirmar.penalizacion} minutos</strong> sobre el tiempo total.
            </p>
            <div className="modal__actions">
              <button className="btn btn--ghost" onClick={() => setConfirmar(null)}>Cancelar</button>
              <button className="btn btn--danger" onClick={() => revelar(confirmar.puzzleId, confirmar.nivel, confirmar.penalizacion)}>
                Aceptar (+{confirmar.penalizacion} min)
              </button>
            </div>
          </div>
        </div>
      )}

      <p className="tab-section-title">{pendingPunto.nombre}</p>

      {!puzzleActual && puzzles.length > 0 && (
        <p className="text-muted text-center" style={{ marginTop: '2rem' }}>
          Todos los puzzles de este punto están resueltos.
        </p>
      )}
      {!puzzleActual && puzzles.length === 0 && (
        <p className="text-muted text-center" style={{ marginTop: '2rem' }}>Cargando...</p>
      )}
      {puzzleActual && !tieneAyudas && (
        <p className="text-muted text-center" style={{ marginTop: '2rem' }}>
          No hay ayudas disponibles para esta prueba.
        </p>
      )}

      {puzzleActual && tieneAyudas && (() => {
        const pz = puzzleActual
        const nivelMostrado = Math.max(mostradas[pz.id] ?? 0, ayudasUsadas[pz.id] ?? 0)
        return (
          <div className="ayuda-bloque">
            <p className="ayuda-bloque__titulo">
              {pz.enunciado?.slice(0, 80)}{(pz.enunciado?.length ?? 0) > 80 ? '…' : ''}
            </p>
            {[1, 2, 3].map(nivel => {
              const texto = pz[`ayuda${nivel}`]
              if (!texto) return null
              const visible = nivelMostrado >= nivel
              return (
                <div key={nivel} className={`ayuda-item ${visible ? 'ayuda-item--visible' : ''}`}>
                  <div className="ayuda-item__header">
                    <span className="ayuda-item__nivel">
                      Ayuda {nivel}
                      {nivel === 3 && pz.penalizacionMinutos > 0 && (
                        <span className="ayuda-item__penalty"> (−{pz.penalizacionMinutos} min)</span>
                      )}
                    </span>
                    {!visible && (
                      <button
                        className="btn btn--ghost btn--small"
                        onClick={() => revelar(pz.id, nivel, nivel === 3 ? (pz.penalizacionMinutos ?? 0) : 0)}
                      >
                        Revelar
                      </button>
                    )}
                  </div>
                  {visible && <p className="ayuda-item__texto">{texto}</p>}
                </div>
              )
            })}
          </div>
        )
      })()}
    </div>
  )
}

// ─── Tab Tiempo ───────────────────────────────────────────────────────────────
function TabTiempo({ progreso }) {
  const elapsed = useElapsedActivo(progreso)
  const penalizacion = progreso?.penalizacionMinutos ?? 0
  const isPaused = progreso?.estado === 'pausado'

  return (
    <div className="tab-content tab-tiempo">
      <div className="tiempo-display">
        <p className="tiempo-display__label">Tiempo activo en esta fase</p>
        <p className="tiempo-display__value">{formatTime(elapsed)}</p>
        {isPaused && <p className="tiempo-display__pausado">⏸ Fase pausada</p>}
        {penalizacion > 0 && (
          <>
            <p className="tiempo-display__penalizacion">+ {penalizacion} min penalización</p>
            <p className="tiempo-display__total">Total: {formatTime(elapsed + penalizacion * 60)}</p>
          </>
        )}
      </div>
      <div className="tiempo-stats">
        <div className="tiempo-stat">
          <span className="tiempo-stat__value">{progreso?.puntosCompletados?.length ?? 0}</span>
          <span className="tiempo-stat__label">Puntos completados</span>
        </div>
        <div className="tiempo-stat">
          <span className="tiempo-stat__value">{progreso?.puzzlesCompletados?.length ?? 0}</span>
          <span className="tiempo-stat__label">Puzzles resueltos</span>
        </div>
        <div className="tiempo-stat">
          <span className="tiempo-stat__value">{Object.keys(progreso?.ayudasUsadas ?? {}).length}</span>
          <span className="tiempo-stat__label">Ayudas usadas</span>
        </div>
      </div>
    </div>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────
const TABS = [
  { id: 'pistas',  label: 'Pistas',   icon: '↗' },
  { id: 'mapa',    label: 'Mapa',     icon: '◈' },
  { id: 'qr',      label: 'Escanear', icon: '▣' },
  { id: 'tiempo',  label: 'Tiempo',   icon: '⏱' },
  { id: 'ayuda',   label: 'Ayuda',    icon: '?' },
]

export default function ActiveEpoch() {
  const { epocaId } = useParams()
  const { game } = useGame()
  const navigate = useNavigate()
  const location = useLocation()
  const [activeTab, setActiveTab] = useState(location.state?.activeTab ?? 'pistas')
  const [puntos, setPuntos] = useState([])
  const [progreso, setProgreso] = useState(null)
  const [pauseLoading, setPauseLoading] = useState(false)

  const equipoIdProgreso = game.grupoModo === 'colaborativo' && game.epocaConjunta
    ? 'conjunto'
    : game.equipoId

  useEffect(() => {
    if (!game.experienciaId || !epocaId) return
    getDocs(
      collection(db, 'experiencias', game.experienciaId, 'epocas', epocaId, 'puntos')
    ).then(snap => {
      setPuntos(
        snap.docs
          .map(d => ({ id: d.id, ...d.data() }))
          .sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0))
      )
    })
  }, [game.experienciaId, epocaId])

  useEffect(() => {
    if (!game.grupoId || !equipoIdProgreso || !epocaId) return
    return subscribeProgresoEpoca(game.grupoId, equipoIdProgreso, epocaId, snap => {
      if (snap.exists()) setProgreso(snap.data())
    })
  }, [game.grupoId, equipoIdProgreso, epocaId])

  useEffect(() => {
    if (!progreso || puntos.length === 0) return
    const completados = progreso.puntosCompletados ?? []
    if (puntos.every(p => completados.includes(p.id))) {
      navigate(`/jugador/epoca/${epocaId}/completada`, { replace: true })
    }
  }, [progreso, puntos, epocaId, navigate])

  const handlePuntoConfirmado = (puntoId) => {
    navigate(`/jugador/puzzle/${epocaId}/${puntoId}`)
  }

  const handlePausar = async () => {
    setPauseLoading(true)
    try { await pausarEpoca(game.grupoId, equipoIdProgreso, epocaId) } finally { setPauseLoading(false) }
  }
  const handleReanudar = async () => {
    setPauseLoading(true)
    try { await reanudarEpoca(game.grupoId, equipoIdProgreso, epocaId) } finally { setPauseLoading(false) }
  }

  const puntosCompletados = progreso?.puntosCompletados ?? []
  const puzzlesCompletados = progreso?.puzzlesCompletados ?? []

  return (
    <div className="active-epoch">
      <PauseBar
        estado={progreso?.estado}
        onPausar={handlePausar}
        onReanudar={handleReanudar}
        loading={pauseLoading}
      />
      <div className="active-epoch__content">
        {activeTab === 'pistas' && (
          <TabPistas
            puntos={puntos}
            puntosCompletados={puntosCompletados}
            puzzlesCompletados={puzzlesCompletados}
            experienciaId={game.experienciaId}
            epocaId={epocaId}
            onPuntoConfirmado={handlePuntoConfirmado}
          />
        )}
        {activeTab === 'qr' && (
          <TabQR
            puntos={puntos}
            puntosCompletados={puntosCompletados}
            progreso={progreso}
            onPuntoConfirmado={handlePuntoConfirmado}
          />
        )}
        {activeTab === 'mapa' && (
          <TabMapa puntos={puntos} puntosCompletados={puntosCompletados} />
        )}
        {activeTab === 'ayuda' && (
          <TabAyuda
            puntos={puntos}
            puntosCompletados={puntosCompletados}
            puzzlesCompletados={puzzlesCompletados}
            progreso={progreso}
            epocaId={epocaId}
            experienciaId={game.experienciaId}
            grupoId={game.grupoId}
            equipoId={equipoIdProgreso}
          />
        )}
        {activeTab === 'tiempo' && (
          <TabTiempo progreso={progreso} />
        )}
      </div>

      <nav className="epoch-nav">
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`epoch-nav__btn ${activeTab === tab.id ? 'epoch-nav__btn--active' : ''}`}
          >
            <span className="epoch-nav__icon">{tab.icon}</span>
            <span className="epoch-nav__label">{tab.label}</span>
          </button>
        ))}
      </nav>
    </div>
  )
}
