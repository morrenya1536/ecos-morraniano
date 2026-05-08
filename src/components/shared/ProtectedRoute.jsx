import { Navigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useGame } from '../../context/GameContext'
import LoadingScreen from './LoadingScreen'

export function RutaCoordinador({ children }) {
  const { coordinador, cargando } = useAuth()
  if (cargando) return <LoadingScreen />
  if (!coordinador) return <Navigate to="/login" replace />
  return children
}

export function RutaJugador({ children }) {
  const { game } = useGame()
  if (!game.grupoId) return <Navigate to="/acceso" replace />
  return children
}
