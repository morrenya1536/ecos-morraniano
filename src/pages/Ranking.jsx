import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { subscribeRanking } from '../services/firestore'

function formatTime(s) {
  if (!s && s !== 0) return '--'
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  if (h > 0) return `${h}h ${String(m).padStart(2, '0')}m ${String(sec).padStart(2, '0')}s`
  return `${String(m).padStart(2, '0')}m ${String(sec).padStart(2, '0')}s`
}

export default function Ranking() {
  const { experienciaId } = useParams()
  const [entradas, setEntradas] = useState([])
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    if (!experienciaId) return
    return subscribeRanking(experienciaId, snap => {
      setEntradas(
        snap.docs
          .map(d => ({ id: d.id, ...d.data() }))
          .sort((a, b) => (a.tiempo ?? Infinity) - (b.tiempo ?? Infinity))
      )
      setCargando(false)
    })
  }, [experienciaId])

  return (
    <main className="page page--dark ranking-page">
      <header className="page__header">
        <h1>Clasificación</h1>
      </header>

      <section className="page__content">
        {cargando ? (
          <div className="loading-screen"><div className="spinner" /></div>
        ) : entradas.length === 0 ? (
          <div className="empty-state">
            <p>Aún no hay resultados registrados.</p>
          </div>
        ) : (
          <div className="ranking-list">
            {entradas.map((r, i) => (
              <div key={r.id} className={`ranking-item ranking-item--pos-${i + 1}`}>
                <span className="ranking-item__pos">#{i + 1}</span>
                <div className="ranking-item__info">
                  <span className="ranking-item__nombre">{r.equipoNombre}</span>
                  {r.puntuacion != null && (
                    <span className="ranking-item__puntos text-muted text-small">
                      {r.puntuacion} punto{r.puntuacion !== 1 ? 's' : ''}
                    </span>
                  )}
                </div>
                <span className="ranking-item__tiempo">{formatTime(r.tiempo)}</span>
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  )
}
