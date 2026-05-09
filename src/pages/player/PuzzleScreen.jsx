import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Html5Qrcode } from 'html5-qrcode'
import { useGame } from '../../context/GameContext'
import {
  marcarPuntoCompletado,
  marcarPuzzleCompletado,
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

function QRPuzzleInput({ respuestaCorrecta, onCorrecto }) {
  const scannerRef = useRef(null)
  const qrRef = useRef(null)
  const [activo, setActivo] = useState(false)
  const [error, setError] = useState(null)

  const start = async () => {
    setError(null)
    try {
      qrRef.current = new Html5Qrcode('puzzle-qr-reader')
      await qrRef.current.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 200, height: 200 } },
        (decoded) => {
          qrRef.current?.stop().catch(() => {})
          setActivo(false)
          if (decoded.trim() === respuestaCorrecta.trim()) {
            onCorrecto()
          } else {
            setError('QR incorrecto. Busca el QR correcto en el entorno.')
          }
        },
        () => {}
      )
      setActivo(true)
    } catch {
      setError('No se pudo acceder a la cámara.')
    }
  }

  const stop = () => {
    qrRef.current?.stop().then(() => { qrRef.current?.clear(); qrRef.current = null }).catch(() => {})
    setActivo(false)
  }

  useEffect(() => () => stop(), [])

  return (
    <div className="puzzle-qr">
      <div id="puzzle-qr-reader" ref={scannerRef} className="qr-reader-box qr-reader-box--small" />
      {error && <p className="form__error">{error}</p>}
      {!activo
        ? <button onClick={start} className="btn btn--primary">Escanear QR</button>
        : <button onClick={stop} className="btn btn--ghost">Detener</button>
      }
    </div>
  )
}

function PuzzleForm({ puzzle, onCorrecto }) {
  const [respuesta, setRespuesta] = useState('')
  const [error, setError] = useState(null)

  const submit = (e) => {
    e.preventDefault()
    if (normalizar(respuesta) === normalizar(puzzle.respuestaCorrecta)) {
      onCorrecto()
    } else {
      setError('Respuesta incorrecta, inténtalo de nuevo.')
    }
  }

  if (puzzle.tipoRespuesta === 'escanear_qr') {
    return <QRPuzzleInput respuestaCorrecta={puzzle.respuestaCorrecta} onCorrecto={onCorrecto} />
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

export default function PuzzleScreen() {
  const { epocaId, puntoId } = useParams()
  const { game } = useGame()
  const navigate = useNavigate()
  const [punto, setPunto] = useState(null)
  const [puzzles, setPuzzles] = useState([])
  const [puzzleIdx, setPuzzleIdx] = useState(0)
  const [llegadaVista, setLlegadaVista] = useState(false)
  const [completado, setCompletado] = useState(false)
  const [siguientePista, setSiguientePista] = useState(null)
  const [cargando, setCargando] = useState(true)
  const [guardando, setGuardando] = useState(false)

  useEffect(() => {
    if (!game.experienciaId || !epocaId || !puntoId) return
    const load = async () => {
      const puntoSnap = await getDoc(
        doc(db, 'experiencias', game.experienciaId, 'epocas', epocaId, 'puntos', puntoId)
      )
      if (puntoSnap.exists()) setPunto({ id: puntoSnap.id, ...puntoSnap.data() })

      const puzzlesSnap = await getDocs(
        collection(db, 'experiencias', game.experienciaId, 'epocas', epocaId, 'puntos', puntoId, 'puzzles')
      )
      setPuzzles(
        puzzlesSnap.docs
          .map(d => ({ id: d.id, ...d.data() }))
          .sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0))
      )
      setCargando(false)
    }
    load()
  }, [game.experienciaId, epocaId, puntoId])

  const handlePuzzleCorrecto = async () => {
    setGuardando(true)
    const pz = puzzles[puzzleIdx]
    await marcarPuzzleCompletado(game.grupoId, game.equipoId, epocaId, pz.id)

    if (puzzleIdx < puzzles.length - 1) {
      setPuzzleIdx(i => i + 1)
      setGuardando(false)
    } else {
      // All puzzles done — mark punto completed and find next pista
      await marcarPuntoCompletado(game.grupoId, game.equipoId, epocaId, puntoId)

      // Load all puntos to find next one
      const puntosSnap = await getDocs(
        collection(db, 'experiencias', game.experienciaId, 'epocas', epocaId, 'puntos')
      )
      const allPuntos = puntosSnap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0))
      const currentIdx = allPuntos.findIndex(p => p.id === puntoId)
      const next = allPuntos[currentIdx + 1]
      if (next) setSiguientePista(next.pistaEntrada ?? null)

      setCompletado(true)
      setGuardando(false)
    }
  }

  if (cargando) {
    return <div className="page page--dark"><div className="loading-screen"><div className="spinner" /></div></div>
  }

  const puzzle = puzzles[puzzleIdx]

  if (completado) {
    return (
      <div className="page page--dark puzzle-completado">
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
            {siguientePista.texto && (
              <p className="puzzle-completado__pista-texto">{siguientePista.texto}</p>
            )}
          </div>
        ) : (
          <p className="text-muted">Este es el último punto de la época.</p>
        )}

        <button
          onClick={() => navigate(`/jugador/epoca/${epocaId}`)}
          className="btn btn--primary btn--large"
        >
          {siguientePista ? 'Seguir buscando' : 'Ver resultado de la época'}
        </button>
      </div>
    )
  }

  return (
    <div className="page page--dark puzzle-screen">
      <header className="puzzle-screen__header">
        <button onClick={() => navigate(`/jugador/epoca/${epocaId}`)} className="btn btn--ghost btn--small">
          ← Volver
        </button>
        <span className="puzzle-screen__progress">
          {puzzleIdx + 1} / {puzzles.length || 1}
        </span>
      </header>

      {!llegadaVista ? (
        /* Llegada content shown first */
        <div className="puzzle-screen__llegada">
          <h2 className="puzzle-screen__llegada-titulo">¡Encontraste el punto!</h2>
          {punto?.llegadaImagenUrl && (
            <img src={punto.llegadaImagenUrl} alt="" className="media-image" />
          )}
          {punto?.llegadaVideoUrl && (
            <video src={punto.llegadaVideoUrl} controls playsInline className="media-player" />
          )}
          {punto?.llegadaTexto && (
            <p className="puzzle-screen__llegada-texto">{punto.llegadaTexto}</p>
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
        /* Puzzle solving */
        <div className="puzzle-screen__puzzle">
          <p className="puzzle-screen__enunciado">{puzzle.enunciado}</p>
          {puzzle.contenidoImagenUrl && (
            <img src={puzzle.contenidoImagenUrl} alt="" className="media-image" />
          )}
          {puzzle.contenidoVideoUrl && (
            <video src={puzzle.contenidoVideoUrl} controls playsInline className="media-player" />
          )}
          {puzzle.contenidoTexto && (
            <p className="puzzle-screen__contenido-texto">{puzzle.contenidoTexto}</p>
          )}
          {guardando
            ? <div className="spinner" />
            : <PuzzleForm puzzle={puzzle} onCorrecto={handlePuzzleCorrecto} />
          }
        </div>
      ) : (
        /* No puzzles — auto complete */
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
  )
}
