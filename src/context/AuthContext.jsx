import { createContext, useContext, useEffect, useState } from 'react'
import { onAuthChange } from '../services/auth'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [coordinador, setCoordinador] = useState(null)
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    const unsubscribe = onAuthChange((user) => {
      setCoordinador(user)
      setCargando(false)
    })
    return unsubscribe
  }, [])

  return (
    <AuthContext.Provider value={{ coordinador, cargando }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
