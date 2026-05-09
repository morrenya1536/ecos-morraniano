import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { MapContainer, TileLayer, CircleMarker, Popup, useMap } from 'react-leaflet'
import { Html5Qrcode } from 'html5-qrcode'
import { useGame } from '../../context/GameContext'
import {
  subscribeProgresoEpoca,
  registrarAyuda,
} from '../../services/firestore'
import { getDocs, collection } from 'firebase/firestore'
import { db } from '../../services/firebase'

// ─── Helpers ──────────────────────────────────────────────────────────────────
function useElapsed(tsMillis) {
  const [elapsed, setElapsed] = useState(0)
  useEffect(() => {
    if (!tsMillis) return
    const tick = () => setElapsed(Math.floor((Date.now() - tsMillis) / 1000))
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [tsMillis])
  return elapsed
}

function formatTime(s) {
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  if (h > 0) return `${h}h ${String(m).padStart(2, '0')}m ${String(sec).padStart(2, '0')}s`
  return `${String(m).padStart(2, '0')}m ${String(sec).padStart(2, '0')}s`
}

// ─── Map auto-recenter ─────────────────────────────────────────────────────────
function RecenterMap({ lat, lng }) {
  const map = useMap()
  useEffect(() => { if (lat && lng) map.setView([lat, lng], map.getZoom()) }, [lat, lng, map])
  return null
}

// ─── Epoch header timer bar ───────────────────────────────────────────────────
function EpochTimerBar({ tiempoInicioMillis, penalizacionMinutos = 0 }) {
  const elapsed = useElapsed(tiempoInicioMillis)
  const total = elapsed + (penalizacionMinutos * 60)
  return (
    <div className="epoch-timer-bar">
      <span className="epoch-timer-bar__elapsed">{formatTime(elapsed)}</span>
      {penalizacionMinutos > 0 && (
        <span className="epoch-timer-bar__penalty">+{penalizacionMinutos} min</span>
      )}
      <span className="epoch-timer-bar__total">{formatTime(total)} total</span>
    </div>
  )
}

// ─── Tab QR ───────────────────────────────────────────────────────────────────
function TabQR({ puntos, puntosCompletados, tiempoInicioMillis, penalizacionMinutos, onScanSuccess }) {
  const scannerRef = useRef(null)
  const qrRef = useRef(null)
  const [scanError, setScanError] = useState(null)
  const [activo, setActivo] = useState(false)
  const pendingPunto = puntos.find(p => !puntosCompletados.includes(p.id))
  const elapsed = useElapsed(tiempoInicioMillis)

  const startScanner = useCallback(async () => {
    if (!scannerRef.current) return
    setScanError(null)
    try {
      qrRef.current = new Html5Qrcode('qr-reader')
      await qrRef.current.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        (decoded) => {
          qrRef.current?.stop().catch(() => {})
          setActivo(false)
          onScanSuccess(decoded.trim())
        },
        () => {}
      )
      setActivo(true)
    } catch {
      setScanError('No se pudo acceder a la cámara. Comprueba los permisos.')
    }
  }, [onScanSuccess])

  const stopScanner = useCallback(() => {
    qrRef.current?.stop().then(() => {
      qrRef.current?.clear()
      qrRef.current = null
    }).catch(() => {})
    setActivo(false)
  }, [])

  useEffect(() => () => stopScanner(), [stopScanner])

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
      <div id="qr-reader" ref={scannerRef} className="qr-reader-box" />
      {scanError && <p className="form__error">{scanError}</p>}
      <div className="tab-qr__actions">
        {!activo
          ? <button onClick={startScanner} className="btn btn--primary">Activar cámara</button>
          : <button onClick={stopScanner} className="btn btn--ghost">Detener</button>
        }
      </div>
    </div>
  )
}

// ─── Tab Pistas ───────────────────────────────────────────────────────────────
function TabPistas({ puntos, puntosCompletados }) {
  const completados = puntos.filter(p => puntosCompletados.includes(p.id))
  const pendingPunto = puntos.find(p => !puntosCompletados.includes(p.id))

  return (
    <div className="tab-content tab-pistas">
      {pendingPunto && (
        <div className="pista-card pista-card--activa">
          <p className="pista-card__label">Pista actual</p>
          {pendingPunto.pistaEntrada?.imagenUrl && (
            <img src={pendingPunto.pistaEntrada.imagenUrl} alt="Pista" className="media-image" />
          )}
          {pendingPunto.pistaEntrada?.videoUrl && (
            <video src={pendingPunto.pistaEntrada.videoUrl} controls playsInline className="media-player" />
          )}
          <p className="pista-card__texto">
            {pendingPunto.pistaEntrada?.texto || '(Sin texto de pista)'}
          </p>
        </div>
      )}
      {completados.length > 0 && (
        <>
          <p className="tab-section-title">Pistas anteriores</p>
          {completados.map(p => (
            <div key={p.id} className="pista-card pista-card--completada">
              <p className="pista-card__texto text-muted">
                {p.pistaEntrada?.texto || '—'}
              </p>
            </div>
          ))}
        </>
      )}
      {!pendingPunto && completados.length === 0 && (
        <p className="text-muted text-center">Cargando puntos...</p>
      )}
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
function TabAyuda({ puntos, puntosCompletados, progreso, epocaId, grupoId, equipoId }) {
  const pendingPunto = puntos.find(p => !puntosCompletados.includes(p.id))
  const [puzzles, setPuzzles] = useState([])
  const [mostradas, setMostradas] = useState({})
  const [confirmar, setConfirmar] = useState(null)

  useEffect(() => {
    if (!pendingPunto || !progreso?.experienciaId) return
    getDocs(
      collection(db, 'experiencias', progreso.experienciaId, 'epocas', epocaId, 'puntos', pendingPunto.id, 'puzzles')
    ).then(snap => {
      setPuzzles(
        snap.docs
          .map(d => ({ id: d.id, ...d.data() }))
          .sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0))
      )
    })
  }, [pendingPunto?.id, epocaId, progreso?.experienciaId])

  if (!pendingPunto) {
    return (
      <div className="tab-content tab-content--center">
        <p className="text-success text-center">Todos los puntos completados.</p>
      </div>
    )
  }

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

      {puzzles.length === 0 && (
        <p className="text-muted text-center" style={{ marginTop: '2rem' }}>
          Primero escanea el QR del punto para desbloquear las ayudas.
        </p>
      )}

      {puzzles.map((pz, idx) => {
        const nivelMostrado = Math.max(mostradas[pz.id] ?? 0, ayudasUsadas[pz.id] ?? 0)
        const tieneAyudas = pz.ayuda1 || pz.ayuda2 || pz.ayuda3
        if (!tieneAyudas) return null
        return (
          <div key={pz.id} className="ayuda-bloque">
            <p className="ayuda-bloque__titulo">
              Puzzle {idx + 1}: {pz.enunciado?.slice(0, 60)}{(pz.enunciado?.length ?? 0) > 60 ? '…' : ''}
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
      })}
    </div>
  )
}

// ─── Tab Tiempo ───────────────────────────────────────────────────────────────
function TabTiempo({ progreso }) {
  const inicioMillis = progreso?.tiempoInicio?.toMillis?.() ?? null
  const elapsed = useElapsed(inicioMillis)
  const penalizacion = progreso?.penalizacionMinutos ?? 0

  return (
    <div className="tab-content tab-tiempo">
      <div className="tiempo-display">
        <p className="tiempo-display__label">Tiempo en esta época</p>
        <p className="tiempo-display__value">{formatTime(elapsed)}</p>
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
  { id: 'qr',     label: 'Escanear', icon: '▣' },
  { id: 'pistas', label: 'Pistas',   icon: '↗' },
  { id: 'mapa',   label: 'Mapa',     icon: '◈' },
  { id: 'ayuda',  label: 'Ayuda',    icon: '?' },
  { id: 'tiempo', label: 'Tiempo',   icon: '⏱' },
]

export default function ActiveEpoch() {
  const { epocaId } = useParams()
  const { game } = useGame()
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState('pistas')
  const [puntos, setPuntos] = useState([])
  const [progreso, setProgreso] = useState(null)
  const [scanError, setScanError] = useState(null)

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
    if (!game.grupoId || !game.equipoId || !epocaId) return
    return subscribeProgresoEpoca(game.grupoId, game.equipoId, epocaId, snap => {
      if (snap.exists()) setProgreso(snap.data())
    })
  }, [game.grupoId, game.equipoId, epocaId])

  // Redirect to completion when all puntos done
  useEffect(() => {
    if (!progreso || puntos.length === 0) return
    const completados = progreso.puntosCompletados ?? []
    if (puntos.length > 0 && puntos.every(p => completados.includes(p.id))) {
      navigate(`/jugador/epoca/${epocaId}/completada`, { replace: true })
    }
  }, [progreso, puntos, epocaId, navigate])

  const handleScan = (scannedId) => {
    setScanError(null)
    const completados = progreso?.puntosCompletados ?? []
    const pendingPunto = puntos.find(p => !completados.includes(p.id))
    if (!pendingPunto) return
    if (scannedId === pendingPunto.id) {
      navigate(`/jugador/puzzle/${epocaId}/${pendingPunto.id}`)
    } else {
      setScanError('QR incorrecto. Sigue buscando el punto correcto.')
      setTimeout(() => setScanError(null), 4000)
    }
  }

  const puntosCompletados = progreso?.puntosCompletados ?? []
  const inicioMillis = progreso?.tiempoInicio?.toMillis?.() ?? null

  return (
    <div className="active-epoch">
      {scanError && (
        <div className="scan-error-banner" onClick={() => setScanError(null)}>
          {scanError}
        </div>
      )}

      <div className="active-epoch__content">
        {activeTab === 'qr' && (
          <TabQR
            puntos={puntos}
            puntosCompletados={puntosCompletados}
            tiempoInicioMillis={inicioMillis}
            penalizacionMinutos={progreso?.penalizacionMinutos ?? 0}
            onScanSuccess={handleScan}
          />
        )}
        {activeTab === 'pistas' && (
          <TabPistas puntos={puntos} puntosCompletados={puntosCompletados} />
        )}
        {activeTab === 'mapa' && (
          <TabMapa puntos={puntos} puntosCompletados={puntosCompletados} />
        )}
        {activeTab === 'ayuda' && (
          <TabAyuda
            puntos={puntos}
            puntosCompletados={puntosCompletados}
            progreso={progreso}
            epocaId={epocaId}
            grupoId={game.grupoId}
            equipoId={game.equipoId}
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
