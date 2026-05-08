import { Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useCoordinator } from '../../hooks/useCoordinator'

export default function CoordinatorHome() {
  const { coordinador } = useAuth()
  const { logout } = useCoordinator()

  return (
    <main className="page">
      <header className="page__header">
        <h1>Panel de Coordinador</h1>
        <button onClick={logout} className="btn btn--ghost">Salir</button>
      </header>

      <section className="page__content">
        <p>Bienvenido, {coordinador?.email}</p>
        {/* Lista de experiencias — próximamente */}
        <div className="placeholder">
          <p>Lista de experiencias</p>
          <Link to="/coordinador/experiencias/nueva" className="btn">
            + Nueva experiencia
          </Link>
        </div>
      </section>
    </main>
  )
}
