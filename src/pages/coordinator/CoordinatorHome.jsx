import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useCoordinator } from '../../hooks/useCoordinator'
import { subscribeExperiencias } from '../../services/firestore'
import LoadingScreen from '../../components/shared/LoadingScreen'

export default function CoordinatorHome() {
  const { coordinador } = useAuth()
  const { logout } = useCoordinator()
  const [experiencias, setExperiencias] = useState([])
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    const unsubscribe = subscribeExperiencias((snap) => {
      setExperiencias(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
      setCargando(false)
    })
    return unsubscribe
  }, [])

  if (cargando) return <LoadingScreen mensaje="Cargando experiencias..." />

  return (
    <main className="page panel">
      <header className="page__header">
        <div>
          <h1>Panel de Coordinador</h1>
          <p className="text-muted">{coordinador?.email}</p>
        </div>
        <button onClick={logout} className="btn btn--ghost btn--small">Cerrar sesión</button>
      </header>

      <section className="page__content">
        <div className="section-header">
          <h2>Experiencias</h2>
          <Link to="/coordinador/experiencias/nueva" className="btn btn--small">
            + Nueva
          </Link>
        </div>

        {experiencias.length === 0 ? (
          <div className="empty-state">
            <p>Aún no hay experiencias.</p>
            <Link to="/coordinador/experiencias/nueva" className="btn">
              Crear primera experiencia
            </Link>
          </div>
        ) : (
          <div className="card-list">
            {experiencias.map((exp) => (
              <div key={exp.id} className="card">
                <div className="card__header">
                  <div className="card__title-group">
                    <h3 className="card__title">{exp.nombre}</h3>
                    <span className={`badge ${exp.activa ? 'badge--active' : 'badge--inactive'}`}>
                      {exp.activa ? 'Activa' : 'Inactiva'}
                    </span>
                  </div>
                  <div className="card__actions">
                    <Link
                      to={`/coordinador/grupos/${exp.id}`}
                      className="btn btn--ghost btn--small"
                    >
                      Grupos
                    </Link>
                    <Link
                      to={`/coordinador/experiencias/${exp.id}`}
                      className="btn btn--small"
                    >
                      Editar
                    </Link>
                  </div>
                </div>
                {exp.descripcion && (
                  <p className="card__desc">{exp.descripcion}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  )
}
