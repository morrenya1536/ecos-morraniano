import { RouterProvider } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { GameProvider } from './context/GameContext'
import { router } from './router'
import 'leaflet/dist/leaflet.css'
import './index.css'

export default function App() {
  return (
    <AuthProvider>
      <GameProvider>
        <RouterProvider router={router} />
      </GameProvider>
    </AuthProvider>
  )
}
