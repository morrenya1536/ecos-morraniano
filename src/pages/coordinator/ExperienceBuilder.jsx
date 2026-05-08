import { useParams } from 'react-router-dom'

export default function ExperienceBuilder() {
  const { experienciaId } = useParams()
  const esNueva = experienciaId === 'nueva'

  return (
    <main className="page">
      <header className="page__header">
        <h1>{esNueva ? 'Nueva experiencia' : 'Editar experiencia'}</h1>
      </header>

      <section className="page__content">
        {/* Tabs: Info general | Épocas | Grupos | Ranking */}
        <div className="placeholder">
          <p>Builder de experiencia: <strong>{experienciaId}</strong></p>
          <p>Aquí irá el editor de épocas → puntos → puzzles</p>
        </div>
      </section>
    </main>
  )
}
