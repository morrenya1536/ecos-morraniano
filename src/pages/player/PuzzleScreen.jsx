import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  MultiFormatReader,
  BinaryBitmap,
  HybridBinarizer,
  HTMLCanvasElementLuminanceSource,
} from '@zxing/library'
import { useGame } from '../../context/GameContext'
import { getText } from '../../utils/helpers'
import {
  marcarPuntoCompletado,
  marcarPuzzleCompletado,
  getProgresoEpoca,
  pausarEpoca,
  reanudarEpoca,
} from '../../services/firestore'
import { getDocs, collection, doc, getDoc } from 'firebase/firestore'
import { db } from '../../services/firebase'

function normalizar(text) {
  return (text ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

const TIENE_BARCODE_DETECTOR = typeof BarcodeDetector !== 'undefined'

const TABS = [
  { id: 'pistas',  label: 'Pistas',   icon: '↗' },
  { id: 'mapa',    label: 'Mapa',     icon: '◈' },
  { id: 'qr',      label: 'Escanear', icon: '▣' },
  { id: 'tiempo',  label: 'Tiempo',   icon: '⏱' },
  { id: 'ayuda',   label: 'Ayuda',    icon: '?' },
]

// ─── QR puzzle scanner ────────────────────────────────────────────────────────
function QRPuzzleInput({ respuestaCorrecta, onCorrecto }) {
  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const loopRef = useRef(null)
  const streamRef = useRef(null)
  const mountedRef = useRef(true)
  const [estado, setEstado] = useState('idle')
  const [error, setError] = useState(null)

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
    setEstado('idle')
  }

  const procesarQR = (valor) => {
    if (valor.trim() === respuestaCorrecta.trim()) {
      detener()
      onCorrecto()
    } else {
      setError('QR incorrecto. Busca el QR correcto en el entorno.')
      setTimeout(() => setError(null), 3000)
    }
  }

  const iniciarBucleBarcode = (video) => {
    let detector
    try { detector = new BarcodeDetector({ formats: ['qr_code'] }) } catch { return false }
    const tick = async () => {
      if (!streamRef.current) return
      try {
        const barcodes = await detector.detect(video)
        if (barcodes.length > 0) procesarQR(barcodes[0].rawValue)
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
          procesarQR(reader.decode(new BinaryBitmap(new HybridBinarizer(source))).getText())
        } catch { }
      }
      loopRef.current = setTimeout(tick, 300)
    }
    tick()
  }

  const iniciar = async () => {
    if (streamRef.current || estado === 'iniciando') return
    setEstado('iniciando')
    setError(null)
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
    } catch {
      if (!mountedRef.current) return
      setError('No se pudo acceder a la cámara. Comprueba los permisos.')
      setEstado('error')
    }
  }

  return (
    <div className="puzzle-qr">
      <video
        ref={videoRef}
        className={`qr-reader-box qr-reader-box--small${estado === 'activo' ? ' qr-reader-box--activo' : ''}`}
        playsInline
        muted
      />
      <canvas ref={canvasRef} style={{ display: 'none' }} />
      {error && <p className="form__error">{error}</p>}
      {estado === 'activo'
        ? <button onClick={detener} className="btn btn--ghost">Detener</button>
        : (
          <button onClick={iniciar} disabled={estado === 'iniciando'} className="btn btn--primary">
            {estado === 'iniciando' ? 'Activando...' : 'Escanear QR'}
          </button>
        )
      }
    </div>
  )
}

// ─── Input para un paso de secuencia ─────────────────────────────────────────
function PasoInput({ paso, onCorrecto }) {
  const [respuesta, setRespuesta] = useState('')
  const [error, setError] = useState(null)

  if (paso.tipo === 'escanear_qr') {
    return <QRPuzzleInput respuestaCorrecta={paso.respuestaCorrecta} onCorrecto={onCorrecto} />
  }

  const submit = (e) => {
    e.preventDefault()
    if (normalizar(respuesta) === normalizar(paso.respuestaCorrecta)) {
      onCorrecto()
    } else {
      setError('Respuesta incorrecta, inténtalo de nuevo.')
    }
  }

  return (
    <form onSubmit={submit} className="puzzle-form">
      <div className="form__group">
        <input
          type={paso.tipo === 'numerica' ? 'number' : 'text'}
          value={respuesta}
          onChange={e => { setRespuesta(e.target.value); setError(null) }}
          placeholder="Tu respuesta..."
          className="puzzle-input"
          autoFocus
        />
      </div>
      {error && <p className="form__error">{error}</p>}
      <button type="submit" className="btn btn--primary" disabled={!respuesta.trim()}>
        Confirmar
      </button>
    </form>
  )
}

// ─── Secuencia colaborativa ordenada ─────────────────────────────────────────
function SecuenciaColaborativa({ secuencia, onCorrecto }) {
  const [pasoActual, setPasoActual] = useState(0)
  const [countdown, setCountdown] = useState(null)
  const [mensaje, setMensaje] = useState(null)

  useEffect(() => {
    if (countdown === null || countdown <= 0) return
    const id = setTimeout(() => setCountdown(c => c - 1), 1000)
    return () => clearTimeout(id)
  }, [countdown])

  useEffect(() => {
    if (countdown !== 0) return
    setPasoActual(0)
    setCountdown(null)
    setMensaje('Tiempo agotado. Volved a empezar la secuencia.')
  }, [countdown])

  const handlePasoCorrecto = () => {
    if (pasoActual === secuencia.length - 1) {
      onCorrecto()
      return
    }
    const siguientePaso = secuencia[pasoActual + 1]
    setMensaje(null)
    setPasoActual(i => i + 1)
    setCountdown(siguientePaso.tiempoLimite > 0 ? siguientePaso.tiempoLimite : null)
  }

  const paso = secuencia[pasoActual]

  return (
    <div className="secuencia-colaborativa">
      <div className="secuencia__progreso">
        Paso {pasoActual + 1} de {secuencia.length}
      </div>
      {mensaje && (
        <p className="secuencia__mensaje-error">{mensaje}</p>
      )}
      {countdown !== null && (
        <div className="secuencia__countdown">
          Tiempo restante: <strong>{countdown}s</strong>
        </div>
      )}
      <PasoInput key={pasoActual} paso={paso} onCorrecto={handlePasoCorrecto} />
    </div>
  )
}

// ─── Puzzle form ──────────────────────────────────────────────────────────────
function PuzzleForm({ puzzle, idioma, onCorrecto }) {
  const [respuesta, setRespuesta] = useState('')
  const [error, setError] = useState(null)

  if (
    puzzle.tipoRespuesta === 'colaborativa' &&
    puzzle.secuenciaOrdenada &&
    puzzle.secuencia?.length > 0
  ) {
    return <SecuenciaColaborativa secuencia={puzzle.secuencia} onCorrecto={onCorrecto} />
  }

  const submit = (e) => {
    e.preventDefault()
    const correcta = getText(puzzle.respuestaCorrecta, idioma)
    if (normalizar(respuesta) === normalizar(correcta)) {
      onCorrecto()
    } else {
      setError('Respuesta incorrecta, inténtalo de nuevo.')
    }
  }

  if (puzzle.tipoRespuesta === 'escanear_qr') {
    return <QRPuzzleInput respuestaCorrecta={getText(puzzle.respuestaCorrecta, idioma)} onCorrecto={onCorrecto} />
  }

  return (
    <form onSubmit={submit} className="puzzle-form">
      <div className="form__group">
        {puzzle.tipoRespuesta === 'numerica' ? (
          <input
            type="number"
            value={respuesta}
            onChange={e => { setRespuesta(e.target.value); setError(null) }}
            placeholder="Tu respuesta..."
            className="puzzle-input"
            autoFocus
          />
        ) : (
          <input
            type="text"
            value={respuesta}
            onChange={e => { setRespuesta(e.target.value); setError(null) }}
            placeholder={
              puzzle.tipoRespuesta === 'confirmacion_fisica' || puzzle.tipoRespuesta === 'colaborativa'
                ? 'Código de confirmación...'
                : 'Tu respuesta...'
            }
            className="puzzle-input"
            autoFocus
          />
        )}
      </div>
      {error && <p className="form__error">{error}</p>}
      <button type="submit" className="btn btn--primary" disabled={!respuesta.trim()}>
        Confirmar
      </button>
    </form>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function PuzzleScreen() {
  const { epocaId, puntoId } = useParams()
  const { game } = useGame()
  const navigate = useNavigate()
  const idioma = game.idiomaElegido ?? 'es'
  const equipoIdProgreso = game.grupoModo === 'colaborativo' && game.epocaConjunta
    ? 'conjunto'
    : game.equipoId
  const [punto, setPunto] = useState(null)
  const [puzzles, setPuzzles] = useState([])
  const [puzzleIdx, setPuzzleIdx] = useState(0)
  const [llegadaVista, setLlegadaVista] = useState(false)
  const [completado, setCompletado] = useState(false)
  const [siguientePista, setSiguientePista] = useState(null)
  const [modalCambioTipo, setModalCambioTipo] = useState(null)
  const [cargando, setCargando] = useState(true)
  const [guardando, setGuardando] = useState(false)

  useEffect(() => {
    if (!game.experienciaId || !epocaId || !puntoId || !game.grupoId || !equipoIdProgreso) return
    const load = async () => {
      const [puntoSnap, puzzlesSnap, progresoSnap] = await Promise.all([
        getDoc(doc(db, 'experiencias', game.experienciaId, 'epocas', epocaId, 'puntos', puntoId)),
        getDocs(collection(db, 'experiencias', game.experienciaId, 'epocas', epocaId, 'puntos', puntoId, 'puzzles')),
        getProgresoEpoca(game.grupoId, equipoIdProgreso, epocaId),
      ])

      if (puntoSnap.exists()) setPunto({ id: puntoSnap.id, ...puntoSnap.data() })

      const loadedPuzzles = puzzlesSnap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0))
      setPuzzles(loadedPuzzles)

      if (progresoSnap.exists()) {
        const completadosSet = new Set(progresoSnap.data().puzzlesCompletados ?? [])
        const firstIdx = loadedPuzzles.findIndex(pz => !completadosSet.has(pz.id))
        if (firstIdx > 0) {
          setPuzzleIdx(firstIdx)
          setLlegadaVista(true)
        } else if (firstIdx === -1 && loadedPuzzles.length > 0) {
          setLlegadaVista(true)
        }
      }

      setCargando(false)
    }
    load()
  }, [game.experienciaId, epocaId, puntoId, game.grupoId, equipoIdProgreso])

  const handlePuzzleCorrecto = async () => {
    setGuardando(true)
    const pz = puzzles[puzzleIdx]
    await marcarPuzzleCompletado(game.grupoId, equipoIdProgreso, epocaId, pz.id)

    if (puzzleIdx < puzzles.length - 1) {
      setPuzzleIdx(i => i + 1)
      setGuardando(false)
    } else {
      await marcarPuntoCompletado(game.grupoId, equipoIdProgreso, epocaId, puntoId)
      const puntosSnap = await getDocs(
        collection(db, 'experiencias', game.experienciaId, 'epocas', epocaId, 'puntos')
      )
      const allPuntos = puntosSnap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0))
      const currentIdx = allPuntos.findIndex(p => p.id === puntoId)
      const next = allPuntos[currentIdx + 1]
      if (next && punto?.tipo && next.tipo && punto.tipo !== next.tipo) {
        await pausarEpoca(game.grupoId, equipoIdProgreso, epocaId)
        setModalCambioTipo({ siguientePista: next.pistaEntrada ?? null, nuevoTipo: next.tipo })
      } else {
        if (next) setSiguientePista(next.pistaEntrada ?? null)
        setCompletado(true)
      }
      setGuardando(false)
    }
  }

  const navigateToTab = (tabId) => {
    navigate(`/jugador/epoca/${epocaId}`, { state: { activeTab: tabId } })
  }

  const bottomNav = (
    <nav className="epoch-nav">
      {TABS.map(tab => (
        <button key={tab.id} onClick={() => navigateToTab(tab.id)} className="epoch-nav__btn">
          <span className="epoch-nav__icon">{tab.icon}</span>
          <span className="epoch-nav__label">{tab.label}</span>
        </button>
      ))}
    </nav>
  )

  if (cargando) {
    return (
      <div className="page page--dark">
        <div className="loading-screen"><div className="spinner" /></div>
      </div>
    )
  }

  const puzzle = puzzles[puzzleIdx]

  if (modalCambioTipo) {
    const esNocturno = modalCambioTipo.nuevoTipo === 'nocturno'
    return (
      <div className="active-epoch">
        <div className="active-epoch__content">
          <div className="modal-cambio-tipo">
            <div className="modal-cambio-tipo__icono">{esNocturno ? '🌙' : '☀️'}</div>
            <h2 className="modal-cambio-tipo__titulo">
              {esNocturno ? '¡Llega la noche!' : '¡Sale el sol!'}
            </h2>
            <p className="modal-cambio-tipo__texto">
              {esNocturno
                ? 'El siguiente punto es nocturno. Continúa cuando anochezca.'
                : 'El siguiente punto es diurno. ¡Continúa cuando sea de día!'}
            </p>
            {modalCambioTipo.siguientePista && (
              <div className="puzzle-completado__pista">
                <p className="puzzle-completado__pista-label">Tu siguiente pista:</p>
                {modalCambioTipo.siguientePista.imagenUrl && (
                  <img src={modalCambioTipo.siguientePista.imagenUrl} alt="" className="media-image" />
                )}
                {modalCambioTipo.siguientePista.videoUrl && (
                  <video src={modalCambioTipo.siguientePista.videoUrl} controls playsInline className="media-player" />
                )}
                {getText(modalCambioTipo.siguientePista.texto, idioma) && (
                  <p className="puzzle-completado__pista-texto">{getText(modalCambioTipo.siguientePista.texto, idioma)}</p>
                )}
              </div>
            )}
            <button
              className="btn btn--primary btn--large"
              onClick={async () => {
                await reanudarEpoca(game.grupoId, equipoIdProgreso, epocaId)
                setSiguientePista(modalCambioTipo.siguientePista)
                setModalCambioTipo(null)
                setCompletado(true)
              }}
            >
              ¡Entendido! Continuar
            </button>
          </div>
        </div>
        {bottomNav}
      </div>
    )
  }

  if (completado) {
    return (
      <div className="active-epoch">
        <div className="active-epoch__content">
          <div className="puzzle-completado">
            <div className="puzzle-completado__icon">✓</div>
            <h2 className="puzzle-completado__titulo">¡Punto completado!</h2>
            {siguientePista ? (
              <div className="puzzle-completado__pista">
                <p className="puzzle-completado__pista-label">Tu siguiente pista:</p>
                {siguientePista.imagenUrl && (
                  <img src={siguientePista.imagenUrl} alt="" className="media-image" />
                )}
                {siguientePista.videoUrl && (
                  <video src={siguientePista.videoUrl} controls playsInline className="media-player" />
                )}
                {getText(siguientePista.texto, idioma) && (
                  <p className="puzzle-completado__pista-texto">{getText(siguientePista.texto, idioma)}</p>
                )}
              </div>
            ) : (
              <p className="text-muted">Este es el último punto de la fase.</p>
            )}
            <button
              onClick={() => navigate(`/jugador/epoca/${epocaId}`)}
              className="btn btn--primary btn--large"
            >
              {siguientePista ? 'Seguir buscando' : 'Ver resultado de la fase'}
            </button>
          </div>
        </div>
        {bottomNav}
      </div>
    )
  }

  return (
    <div className="active-epoch">
      <div className="active-epoch__content">
        <div className="puzzle-screen">
          <header className="puzzle-screen__header">
            <button
              onClick={() => navigate(`/jugador/epoca/${epocaId}`)}
              className="btn btn--ghost btn--small"
            >
              ← Volver
            </button>
            <span className="puzzle-screen__progress">
              {puzzleIdx + 1} / {puzzles.length || 1}
            </span>
          </header>

          {!llegadaVista ? (
            <div className="puzzle-screen__llegada">
              <h2 className="puzzle-screen__llegada-titulo">¡Encontraste el punto!</h2>
              {punto?.llegadaImagenUrl && (
                <img src={punto.llegadaImagenUrl} alt="" className="media-image" />
              )}
              {punto?.llegadaVideoUrl && (
                <video src={punto.llegadaVideoUrl} controls playsInline className="media-player" />
              )}
              {getText(punto?.llegadaTexto, idioma) && (
                <p className="puzzle-screen__llegada-texto">{getText(punto.llegadaTexto, idioma)}</p>
              )}
              <button
                onClick={() => setLlegadaVista(true)}
                className="btn btn--primary btn--large"
              >
                {puzzles.length > 0 ? 'Resolver puzzles' : 'Completar punto'}
              </button>
              {puzzles.length === 0 && (
                <p className="text-muted" style={{ marginTop: '0.5rem' }}>No hay puzzles en este punto.</p>
              )}
            </div>
          ) : puzzle ? (
            <div className="puzzle-screen__puzzle">
              <p className="puzzle-screen__enunciado">{getText(puzzle.enunciado, idioma)}</p>
              {puzzle.contenidoImagenUrl && (
                <img src={puzzle.contenidoImagenUrl} alt="" className="media-image" />
              )}
              {puzzle.contenidoVideoUrl && (
                <video src={puzzle.contenidoVideoUrl} controls playsInline className="media-player" />
              )}
              {getText(puzzle.contenidoTexto, idioma) && (
                <p className="puzzle-screen__contenido-texto">{getText(puzzle.contenidoTexto, idioma)}</p>
              )}
              {guardando
                ? <div className="spinner" />
                : <PuzzleForm puzzle={puzzle} idioma={idioma} onCorrecto={handlePuzzleCorrecto} />
              }
            </div>
          ) : (
            <div className="puzzle-screen__llegada">
              <button
                onClick={handlePuzzleCorrecto}
                className="btn btn--primary btn--large"
                disabled={guardando}
              >
                {guardando ? 'Guardando...' : 'Marcar como completado'}
              </button>
            </div>
          )}
        </div>
      </div>
      {bottomNav}
    </div>
  )
}
