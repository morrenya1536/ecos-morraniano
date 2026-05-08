import { createBrowserRouter, Navigate } from 'react-router-dom'
import { RutaCoordinador, RutaJugador } from './components/shared/ProtectedRoute'

import CoordinatorLogin from './pages/coordinator/CoordinatorLogin'
import CoordinatorHome from './pages/coordinator/CoordinatorHome'
import ExperienceBuilder from './pages/coordinator/ExperienceBuilder'
import PlayerAccess from './pages/player/PlayerAccess'
import PlayerHome from './pages/player/PlayerHome'
import ActiveEpoch from './pages/player/ActiveEpoch'
import Ranking from './pages/Ranking'
import NotFound from './pages/NotFound'

export const router = createBrowserRouter([
  {
    path: '/',
    element: <Navigate to="/acceso" replace />,
  },
  {
    path: '/login',
    element: <CoordinatorLogin />,
  },
  {
    path: '/coordinador',
    element: (
      <RutaCoordinador>
        <CoordinatorHome />
      </RutaCoordinador>
    ),
  },
  {
    path: '/coordinador/experiencias/:experienciaId',
    element: (
      <RutaCoordinador>
        <ExperienceBuilder />
      </RutaCoordinador>
    ),
  },
  {
    path: '/acceso',
    element: <PlayerAccess />,
  },
  {
    path: '/jugador',
    element: (
      <RutaJugador>
        <PlayerHome />
      </RutaJugador>
    ),
  },
  {
    path: '/jugador/epoca/:epocaId',
    element: (
      <RutaJugador>
        <ActiveEpoch />
      </RutaJugador>
    ),
  },
  {
    path: '/ranking/:experienciaId',
    element: <Ranking />,
  },
  {
    path: '*',
    element: <NotFound />,
  },
])
