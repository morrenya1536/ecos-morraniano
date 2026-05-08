import { useState } from 'react'
import { getGrupoByCodigo, getEquipos, createEquipo } from '../services/firestore'
import { useGame } from '../context/GameContext'

export function usePlayerAccess() {
  const { setSesion } = useGame()
  const [error, setError] = useState(null)
  const [cargando, setCargando] = useState(false)

  const acceder = async ({ codigoGrupo, nombreEquipo }) => {
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

      // Crear o reutilizar equipo
      const equiposSnap = await getEquipos(grupo.id)
      const existente = equiposSnap.docs.find(
        (d) => d.data().nombre.toLowerCase() === nombreEquipo.toLowerCase()
      )

      let equipoId
      if (existente) {
        equipoId = existente.id
      } else {
        const ref = await createEquipo(grupo.id, { nombre: nombreEquipo })
        equipoId = ref.id
      }

      setSesion({
        grupoId: grupo.id,
        grupoCodigo: codigoGrupo.toUpperCase(),
        equipoId,
        equipoNombre: nombreEquipo,
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
