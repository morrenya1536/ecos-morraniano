import { useState, useEffect } from 'react'
import { onSnapshot, collection, query, orderBy } from 'firebase/firestore'
import { db } from '../services/firebase'

export function useCollection(path, ...queryConstraints) {
  const [datos, setDatos] = useState([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!path) return

    const ref = collection(db, ...path.split('/'))
    const q = queryConstraints.length ? query(ref, ...queryConstraints) : ref

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        setDatos(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })))
        setCargando(false)
      },
      (err) => {
        setError(err.message)
        setCargando(false)
      }
    )

    return unsubscribe
  }, [path])

  return { datos, cargando, error }
}
