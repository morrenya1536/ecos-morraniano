import { createContext, useContext, useReducer } from 'react'

const GameContext = createContext(null)

const initialState = {
  grupoId: null,
  grupoCodigo: null,
  equipoId: null,
  equipoNombre: null,
  experienciaId: null,
  epocaActualId: null,
  progreso: null,
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
  const [game, dispatch] = useReducer(gameReducer, initialState)

  const setSesion = (datos) => dispatch({ type: 'SET_SESION', payload: datos })
  const setProgreso = (progreso) => dispatch({ type: 'SET_PROGRESO', payload: progreso })
  const avanzarEpoca = (epocaId) => dispatch({ type: 'AVANZAR_EPOCA', payload: epocaId })
  const resetGame = () => dispatch({ type: 'RESET' })

  return (
    <GameContext.Provider value={{ game, setSesion, setProgreso, avanzarEpoca, resetGame }}>
      {children}
    </GameContext.Provider>
  )
}

export const useGame = () => useContext(GameContext)
