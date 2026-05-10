import { createContext, useContext, useReducer, useEffect } from 'react'

const STORAGE_KEY = 'erb_sesion_jugador'

const GameContext = createContext(null)

const initialState = {
  grupoId: null,
  grupoCodigo: null,
  equipoId: null,
  equipoNombre: null,
  experienciaId: null,
  epocaActualId: null,
  progreso: null,
  grupoModo: null,
  faseAsignadaId: null,
  epocaConjunta: false,
  idiomaElegido: 'es',
}

function cargarDesdeStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return { ...initialState, ...JSON.parse(raw) }
  } catch {}
  return initialState
}

function gameReducer(state, action) {
  switch (action.type) {
    case 'SET_SESION':
      return { ...state, ...action.payload }
    case 'SET_PROGRESO':
      return { ...state, progreso: action.payload }
    case 'AVANZAR_EPOCA':
      return { ...state, epocaActualId: action.payload }
    case 'RESET':
      return initialState
    default:
      return state
  }
}

export function GameProvider({ children }) {
  const [game, dispatch] = useReducer(gameReducer, undefined, cargarDesdeStorage)

  // Persistir en localStorage cada vez que cambia el estado (sin progreso, que se recarga de Firestore)
  useEffect(() => {
    if (!game.grupoId) return
    try {
      const { progreso, ...toSave } = game
      localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave))
    } catch {}
  }, [game])

  const setSesion = (datos) => dispatch({ type: 'SET_SESION', payload: datos })
  const setProgreso = (progreso) => dispatch({ type: 'SET_PROGRESO', payload: progreso })
  const avanzarEpoca = (epocaId) => dispatch({ type: 'AVANZAR_EPOCA', payload: epocaId })
  const resetGame = () => {
    try { localStorage.removeItem(STORAGE_KEY) } catch {}
    dispatch({ type: 'RESET' })
  }

  return (
    <GameContext.Provider value={{ game, setSesion, setProgreso, avanzarEpoca, resetGame }}>
      {children}
    </GameContext.Provider>
  )
}

export const useGame = () => useContext(GameContext)
