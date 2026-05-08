import { useState } from 'react'
import { loginCoordinador, logoutCoordinador } from '../services/auth'

export function useCoordinator() {
  const [error, setError] = useState(null)
  const [cargando, setCargando] = useState(false)

  const login = async (email, password) => {
    setError(null)
    setCargando(true)
    try {
      await loginCoordinador(email, password)
      // el redirect lo maneja useEffect en CoordinatorLogin vía AuthContext
    } catch (e) {
      setError(mensajeError(e.code))
    } finally {
      setCargando(false)
    }
  }

  const logout = () => logoutCoordinador()

  return { login, logout, error, cargando }
}

function mensajeError(code) {
  const errores = {
    'auth/invalid-credential': 'Email o contraseña incorrectos',
    'auth/too-many-requests': 'Demasiados intentos. Espera unos minutos',
    'auth/network-request-failed': 'Error de conexión',
  }
  return errores[code] ?? 'Error al iniciar sesión'
}
