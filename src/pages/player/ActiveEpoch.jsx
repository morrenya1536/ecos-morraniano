import { useParams } from 'react-router-dom'
import { useGame } from '../../context/GameContext'

export default function ActiveEpoch() {
  const { epocaId } = useParams()
  const { game } = useGame()

  return (
    <main className="page page--dark page--fullscreen">
      {/* Mapa Leaflet, QR scanner, puzzles — próximamente */}
      <div className="placeholder">
        <p>Época activa: <strong>{epocaId}</strong></p>
        <p>Equipo: {game.equipoNombre}</p>
        <p>Aquí irá el mapa y los puzzles</p>
      </div>
    </main>
  )
}
