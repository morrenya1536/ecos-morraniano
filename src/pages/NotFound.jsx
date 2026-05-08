import { Link } from 'react-router-dom'

export default function NotFound() {
  return (
    <main className="page page--centered">
      <h1>404</h1>
      <p>Página no encontrada</p>
      <Link to="/acceso" className="btn">Volver al inicio</Link>
    </main>
  )
}
