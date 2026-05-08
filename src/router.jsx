import { createBrowserRouter, Navigate } from 'react-router-dom'
import { RutaCoordinador, RutaJugador } from './components/shared/ProtectedRoute'

import CoordinatorLogin from './pages/coordinator/CoordinatorLogin'
import CoordinatorHome from './pages/coordinator/CoordinatorHome'
import ExperienceBuilder from './pages/coordinator/ExperienceBuilder'
import GruposManager from './pages/coordinator/GruposManager'
import PlayerAccess from './pages/player/PlayerAccess'
import PlayerHome from './pages/player/PlayerHome'
import ActiveEpoch from './pages/player/ActiveEpoch'
import Ranking from './pages/Ranking'
import NotFound from './pages/NotFound'

export const router = createBrowserRouter([
  { path: '/', element: <Navigate to="/acceso" replace /> },

  // ── Coordinador ────────────────────────────────────────────────────────
  { path: '/login', element: <CoordinatorLogin /> },
  {
    path: '/coordinador',
    element: <RutaCoordinador><CoordinatorHome /></RutaCoordinador>,
  },
  {
    path: '/coordinador/experiencias/:experienciaId',
    element: <RutaCoordinador><ExperienceBuilder /></RutaCoordinador>,
  },
  {
    path: '/coordinador/grupos/:experienciaId',
    element: <RutaCoordinador><GruposManager /></RutaCoordinador>,
  },

  // ── Jugador ────────────────────────────────────────────────────────────
  { path: '/acceso', element: <PlayerAccess /> },
  {
    path: '/jugador',
    element: <RutaJugador><PlayerHome /></RutaJugador>,
  },
  {
    path: '/jugador/epoca/:epocaId',
    element: <RutaJugador><ActiveEpoch /></RutaJugador>,
  },

  // ── Público ────────────────────────────────────────────────────────────
  { path: '/ranking/:experienciaId', element: <Ranking /> },
  { path: '*', element: <NotFound /> },
])
