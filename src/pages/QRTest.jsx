import { useState, useEffect, useRef } from 'react'
import {
  MultiFormatReader,
  BinaryBitmap,
  HybridBinarizer,
  HTMLCanvasElementLuminanceSource,
} from '@zxing/library'

const TIENE_BARCODE_DETECTOR = typeof BarcodeDetector !== 'undefined'

function ts() {
  return new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

function BtnEstilo({ onClick, children, color = '#6c63ff', small = false }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: small ? '7px 12px' : '11px 16px',
        background: color,
        color: '#fff',
        border: 'none',
        borderRadius: '8px',
        fontSize: small ? '0.75rem' : '0.9rem',
        cursor: 'pointer',
        flex: 1,
      }}
    >
      {children}
    </button>
  )
}

export default function QRTest() {
  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const loopRef = useRef(null)

  const [logs, setLogs] = useState([])
  const [resultado, setResultado] = useState(null)
  const [activo, setActivo] = useState(false)
  const [errorCamara, setErrorCamara] = useState(null)

  const addLog = (msg) =>
    setLogs(prev => [...prev.slice(-59), `${ts()} ${msg}`])

  // Diagnóstico inicial al cargar
  useEffect(() => {
    addLog(`BarcodeDetector: ${TIENE_BARCODE_DETECTOR ? 'SÍ disponible' : 'NO disponible'}`)
    addLog(`UA: ${navigator.userAgent.slice(0, 150)}`)
    addLog(`Plataforma: ${navigator.platform ?? 'desconocida'}`)
    addLog(`HTTPS: ${location.protocol === 'https:' ? 'sí' : 'NO — necesario para cámara'}`)

    if (TIENE_BARCODE_DETECTOR) {
      BarcodeDetector.getSupportedFormats()
        .then(f => addLog(`Formatos BarcodeDetector: ${f.join(', ')}`))
        .catch(e => addLog(`getSupportedFormats error: ${e.message}`))
    }

    return () => {
      clearTimeout(loopRef.current)
      const video = videoRef.current
      if (video?.srcObject) {
        video.srcObject.getTracks().forEach(t => t.stop())
        video.srcObject = null
      }
    }
  }, [])

  const detener = () => {
    clearTimeout(loopRef.current)
    const video = videoRef.current
    if (video?.srcObject) {
      video.srcObject.getTracks().forEach(t => t.stop())
      video.srcObject = null
    }
    setActivo(false)
    addLog('Cámara detenida')
  }

  const iniciar = async () => {
    setErrorCamara(null)
    setResultado(null)
    addLog('Solicitando acceso a la cámara...')

    try {
      const constraints = {
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
      }
      addLog(`Constraints: ${JSON.stringify(constraints.video)}`)

      const stream = await navigator.mediaDevices.getUserMedia(constraints)
      const video = videoRef.current
      video.srcObject = stream
      await video.play()
      setActivo(true)

      const track = stream.getVideoTracks()[0]
      const settings = track.getSettings()
      addLog(`Cámara activa — label: ${track.label || 'sin label'}`)
      addLog(`Resolución: ${settings.width ?? '?'}x${settings.height ?? '?'}`)
      addLog(`facingMode real: ${settings.facingMode ?? 'no reportado'}`)
      addLog(`frameRate: ${settings.frameRate ?? '?'}`)

      if (TIENE_BARCODE_DETECTOR) {
        addLog('Modo de escaneo: BarcodeDetector nativo')
        escanearConBarcodeDetector(video)
      } else {
        addLog('Modo de escaneo: canvas + @zxing/library')
        escanearConCanvas(video)
      }
    } catch (err) {
      setErrorCamara(`${err.name}: ${err.message}`)
      addLog(`ERROR ${err.name}: ${err.message}`)
    }
  }

  const escanearConBarcodeDetector = (video) => {
    let detector
    try {
      detector = new BarcodeDetector({ formats: ['qr_code'] })
      addLog('BarcodeDetector instanciado correctamente')
    } catch (err) {
      addLog(`BarcodeDetector instancia error: ${err.message}`)
      addLog('Cambiando a fallback @zxing...')
      escanearConCanvas(video)
      return
    }

    let intentos = 0
    const tick = async () => {
      if (!video.srcObject) return
      intentos++
      try {
        const barcodes = await detector.detect(video)
        if (barcodes.length > 0) {
          const val = barcodes[0].rawValue
          setResultado(val)
          addLog(`✓ QR detectado (intento #${intentos}): ${val}`)
          // Seguir escaneando por si hay más
        }
      } catch (err) {
        // NotFoundException por frame es normal — solo loguear errores raros
        if (err.name !== 'NotSupportedError' && intentos % 50 === 0) {
          addLog(`Frame error (${intentos}): ${err.name}`)
        }
      }
      if (intentos % 50 === 0) addLog(`BarcodeDetector: ${intentos} intentos...`)
      loopRef.current = setTimeout(tick, 300)
    }
    tick()
  }

  const escanearConCanvas = (video) => {
    let reader
    try {
      reader = new MultiFormatReader()
      addLog('MultiFormatReader (@zxing) instanciado correctamente')
    } catch (err) {
      addLog(`MultiFormatReader error: ${err.message}`)
      return
    }

    const canvas = canvasRef.current
    let intentos = 0

    const tick = () => {
      if (!video.srcObject) return
      intentos++

      const w = video.videoWidth
      const h = video.videoHeight
      if (!w || !h) {
        if (intentos === 1) addLog('Esperando dimensiones del vídeo...')
        loopRef.current = setTimeout(tick, 200)
        return
      }

      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w
        canvas.height = h
        addLog(`Canvas ajustado a ${w}x${h}`)
      }

      try {
        canvas.getContext('2d').drawImage(video, 0, 0, w, h)
        const source = new HTMLCanvasElementLuminanceSource(canvas)
        const bitmap = new BinaryBitmap(new HybridBinarizer(source))
        const result = reader.decode(bitmap)
        const val = result.getText()
        setResultado(val)
        addLog(`✓ QR detectado canvas (intento #${intentos}): ${val}`)
      } catch {
        // NotFoundException por frame, completamente normal
      }

      if (intentos % 50 === 0) addLog(`@zxing canvas: ${intentos} intentos...`)
      loopRef.current = setTimeout(tick, 300)
    }
    tick()
  }

  const copiarLogs = () => {
    const texto = [...logs].join('\n')
    navigator.clipboard.writeText(texto)
      .then(() => addLog('Logs copiados al portapapeles'))
      .catch(() => addLog('No se pudo copiar (clipboard requiere HTTPS o permiso)'))
  }

  const logsInvertidos = [...logs].reverse()

  return (
    <div style={{
      padding: '16px',
      fontFamily: '"Courier New", monospace',
      maxWidth: '520px',
      margin: '0 auto',
      color: '#e0e0e0',
      background: '#0d0d0d',
      minHeight: '100dvh',
      boxSizing: 'border-box',
    }}>
      <h1 style={{ fontSize: '1.05rem', marginBottom: '12px', color: '#fff', borderBottom: '1px solid #333', paddingBottom: '8px' }}>
        Diagnóstico QR — Solo desarrollo
      </h1>

      {/* Estado del dispositivo */}
      <div style={{ marginBottom: '10px', padding: '10px 12px', background: '#161616', borderRadius: '8px', fontSize: '0.8rem', lineHeight: 1.7 }}>
        <div>
          BarcodeDetector:{' '}
          <strong style={{ color: TIENE_BARCODE_DETECTOR ? '#69f0ae' : '#ffb74d' }}>
            {TIENE_BARCODE_DETECTOR ? '✓ disponible (nativo)' : '✗ no disponible (fallback @zxing)'}
          </strong>
        </div>
        <div style={{ color: '#888', fontSize: '0.7rem', wordBreak: 'break-all', marginTop: '2px' }}>
          {navigator.userAgent.slice(0, 100)}{navigator.userAgent.length > 100 ? '…' : ''}
        </div>
      </div>

      {/* Vídeo */}
      <video
        ref={videoRef}
        playsInline
        muted
        style={{
          width: '100%',
          maxHeight: '300px',
          objectFit: 'cover',
          borderRadius: '8px',
          background: '#111',
          display: 'block',
          marginBottom: '8px',
          border: activo ? '2px solid #69f0ae' : '2px solid #333',
        }}
      />
      {/* Canvas oculto para el fallback @zxing */}
      <canvas ref={canvasRef} style={{ display: 'none' }} />

      {/* Resultado */}
      {resultado && (
        <div style={{
          padding: '12px',
          background: '#0a2e0a',
          border: '2px solid #4caf50',
          borderRadius: '8px',
          marginBottom: '8px',
          fontSize: '1rem',
          fontWeight: 'bold',
          wordBreak: 'break-all',
          color: '#69f0ae',
        }}>
          ✓ QR detectado:<br />
          <span style={{ fontSize: '0.85rem' }}>{resultado}</span>
        </div>
      )}

      {/* Error cámara */}
      {errorCamara && (
        <div style={{
          padding: '10px 12px',
          background: '#2a0010',
          border: '1px solid #e94560',
          borderRadius: '8px',
          marginBottom: '8px',
          fontSize: '0.82rem',
          color: '#ff8a8a',
          lineHeight: 1.5,
        }}>
          {errorCamara}
        </div>
      )}

      {/* Botones */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
        {!activo
          ? <BtnEstilo onClick={iniciar} color="#6c63ff">Iniciar cámara</BtnEstilo>
          : <BtnEstilo onClick={detener} color="#444">Detener cámara</BtnEstilo>
        }
        <BtnEstilo onClick={copiarLogs} color="#2a2a2a" small>Copiar logs</BtnEstilo>
        <BtnEstilo onClick={() => setLogs([])} color="#1a1a1a" small>Limpiar</BtnEstilo>
      </div>

      {/* Log en pantalla */}
      <div style={{
        background: '#050505',
        border: '1px solid #1e1e1e',
        borderRadius: '8px',
        padding: '8px',
        fontSize: '0.68rem',
        maxHeight: '320px',
        overflowY: 'auto',
        lineHeight: 1.5,
      }}>
        <div style={{ color: '#444', marginBottom: '6px' }}>── logs ({logs.length}) ──</div>
        {logsInvertidos.length === 0 && (
          <div style={{ color: '#444' }}>(sin logs — pulsa "Iniciar cámara")</div>
        )}
        {logsInvertidos.map((log, i) => (
          <div
            key={i}
            style={{
              color: log.includes('ERROR') ? '#ff6b6b'
                : log.includes('✓') ? '#69f0ae'
                : log.includes('NO') || log.includes('error') ? '#ffb74d'
                : '#7a7a7a',
              marginBottom: '1px',
            }}
          >
            {log}
          </div>
        ))}
      </div>
    </div>
  )
}
