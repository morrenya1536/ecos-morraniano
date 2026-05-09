import { useState } from 'react'
import { getGrupoByCodigo, getEquipos } from '../services/firestore'
import { useGame } from '../context/GameContext'

export function usePlayerAccess() {
  const { setSesion } = useGame()
  const [error, setError] = useState(null)
  const [cargando, setCargando] = useState(false)

  const acceder = async ({ codigoGrupo, codigoEquipo }) => {
    setError(null)
    setCargando(true)
    try {
      const snapshot = await getGrupoByCodigo(codigoGrupo.toUpperCase())
      if (snapshot.empty) {
        setError('Código de grupo no válido')
        return false
      }

      const grupoDoc = snapshot.docs[0]
      const grupo = { id: grupoDoc.id, ...grupoDoc.data() }

      if (!grupo.activo) {
        setError('Este grupo no está activo')
        return false
      }

      const equiposSnap = await getEquipos(grupo.id)
      const equipoDoc = equiposSnap.docs.find(
        (d) => d.data().codigo === codigoEquipo.toUpperCase()
      )

      if (!equipoDoc) {
        setError('Código de equipo incorrecto')
        return false
      }

      setSesion({
        grupoId: grupo.id,
        grupoCodigo: codigoGrupo.toUpperCase(),
        equipoId: equipoDoc.id,
        equipoNombre: equipoDoc.data().nombre,
        experienciaId: grupo.experienciaId,
      })

      return true
    } catch (e) {
      setError('Error al conectar. Comprueba tu conexión')
      return false
    } finally {
      setCargando(false)
    }
  }

  return { acceder, error, cargando }
}
