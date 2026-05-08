import { Link } from 'react-router-dom'
import { useGame } from '../../context/GameContext'

export default function PlayerHome() {
  const { game, resetGame } = useGame()

  return (
    <main className="page page--dark">
      <header className="page__header">
        <h1>Equipo: {game.equipoNombre}</h1>
        <button onClick={resetGame} className="btn btn--ghost btn--small">Salir</button>
      </header>

      <section className="page__content">
        {/* Estado general: época activa, puntuación, progreso */}
        <div className="placeholder">
          <p>Experiencia activa</p>
          <p>Grupo: {game.grupoCodigo}</p>
          {game.epocaActualId && (
            <Link to={`/jugador/epoca/${game.epocaActualId}`} className="btn btn--primary">
              Continuar
            </Link>
          )}
        </div>
      </section>
    </main>
  )
}
