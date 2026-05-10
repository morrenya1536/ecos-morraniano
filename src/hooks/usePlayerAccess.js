import { useState } from 'react'
import { getGrupoByCodigo, getEquipos, getExperiencia } from '../services/firestore'
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
      if (snapshot.empty) { setError('Código de grupo no válido'); return null }

      const grupoDoc = snapshot.docs[0]
      const grupo = { id: grupoDoc.id, ...grupoDoc.data() }

      if (!grupo.activo) { setError('Este grupo no está activo'); return null }

      const equiposSnap = await getEquipos(grupo.id)
      const equipoDoc = equiposSnap.docs.find(
        d => d.data().codigo === codigoEquipo.toUpperCase()
      )
      if (!equipoDoc) { setError('Código de equipo incorrecto'); return null }

      // Cargar idiomas de la experiencia
      const expSnap = await getExperiencia(grupo.experienciaId)
      const idiomasDisponibles = expSnap.exists()
        ? (expSnap.data().idiomasDisponibles ?? ['es'])
        : ['es']

      // Idioma ya elegido (colaborativo: grupoIdiomaGrupo; competitivo: equipoIdiomaElegido)
      const modo = grupo.modo ?? 'competitivo'
      const idiomaElegido =
        (modo === 'colaborativo' && grupo.idiomaGrupo) ||
        equipoDoc.data().idiomaElegido ||
        null

      setSesion({
        grupoId: grupo.id,
        grupoCodigo: codigoGrupo.toUpperCase(),
        equipoId: equipoDoc.id,
        equipoNombre: equipoDoc.data().nombre,
        experienciaId: grupo.experienciaId,
      })

      return { idiomasDisponibles, idiomaElegido, grupoId: grupo.id, equipoId: equipoDoc.id, modo }
    } catch {
      setError('Error al conectar. Comprueba tu conexión')
      return null
    } finally {
      setCargando(false)
    }
  }

  return { acceder, error, cargando }
}
