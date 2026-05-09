import { createBrowserRouter, Navigate } from 'react-router-dom'
import { RutaCoordinador, RutaJugador } from './components/shared/ProtectedRoute'

import CoordinatorLogin from './pages/coordinator/CoordinatorLogin'
import CoordinatorHome from './pages/coordinator/CoordinatorHome'
import ExperienceBuilder from './pages/coordinator/ExperienceBuilder'
import GruposManager from './pages/coordinator/GruposManager'
import PlayerAccess from './pages/player/PlayerAccess'
import PlayerHome from './pages/player/PlayerHome'
import BriefingScreen from './pages/player/BriefingScreen'
import ActiveEpoch from './pages/player/ActiveEpoch'
import PuzzleScreen from './pages/player/PuzzleScreen'
import EpochComplete from './pages/player/EpochComplete'
import Ranking from './pages/Ranking'
import QRTest from './pages/QRTest'
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
    path: '/jugador/briefing/:epocaId',
    element: <RutaJugador><BriefingScreen /></RutaJugador>,
  },
  {
    path: '/jugador/epoca/:epocaId',
    element: <RutaJugador><ActiveEpoch /></RutaJugador>,
  },
  {
    path: '/jugador/puzzle/:epocaId/:puntoId',
    element: <RutaJugador><PuzzleScreen /></RutaJugador>,
  },
  {
    path: '/jugador/epoca/:epocaId/completada',
    element: <RutaJugador><EpochComplete /></RutaJugador>,
  },

  // ── Público ────────────────────────────────────────────────────────────
  { path: '/ranking/:experienciaId/:grupoId', element: <Ranking /> },
  { path: '/ranking/:experienciaId', element: <Ranking /> },
  { path: '/qr-test', element: <QRTest /> },
  { path: '*', element: <NotFound /> },
])
