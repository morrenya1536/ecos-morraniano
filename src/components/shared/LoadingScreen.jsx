export default function LoadingScreen({ mensaje = 'Cargando...' }) {
  return (
    <div className="loading-screen">
      <div className="loading-spinner" />
      <p>{mensaje}</p>
    </div>
  )
}
