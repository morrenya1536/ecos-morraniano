import { useParams } from 'react-router-dom'

export default function Ranking() {
  const { experienciaId } = useParams()

  return (
    <main className="page page--dark">
      <header className="page__header">
        <h1>Ranking</h1>
      </header>

      <section className="page__content">
        {/* Tabla de ranking en tiempo real — próximamente */}
        <div className="placeholder">
          <p>Ranking de la experiencia: <strong>{experienciaId}</strong></p>
          <p>Aquí aparecerán los equipos ordenados por puntuación y tiempo</p>
        </div>
      </section>
    </main>
  )
}
