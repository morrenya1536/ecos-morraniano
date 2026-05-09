import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  serverTimestamp,
  arrayUnion,
  increment,
  runTransaction,
  Timestamp,
} from 'firebase/firestore'
import { db } from './firebase'

// ─── Experiencias ──────────────────────────────────────────────────────────
export const getExperiencias = () =>
  getDocs(query(collection(db, 'experiencias'), orderBy('creadoEn', 'desc')))

export const getExperiencia = (id) => getDoc(doc(db, 'experiencias', id))

export const createExperiencia = (data) =>
  addDoc(collection(db, 'experiencias'), { ...data, creadoEn: serverTimestamp() })

export const updateExperiencia = (id, data) =>
  updateDoc(doc(db, 'experiencias', id), data)

export const deleteExperiencia = (id) => deleteDoc(doc(db, 'experiencias', id))

export const subscribeExperiencias = (callback) =>
  onSnapshot(
    query(collection(db, 'experiencias'), orderBy('creadoEn', 'desc')),
    callback
  )

// ─── Épocas ────────────────────────────────────────────────────────────────
export const getEpocas = (experienciaId) =>
  getDocs(query(
    collection(db, 'experiencias', experienciaId, 'epocas'),
    orderBy('orden')
  ))

// Sin orderBy para evitar índice compuesto; se ordena en cliente
export const subscribeEpocas = (experienciaId, callback) =>
  onSnapshot(collection(db, 'experiencias', experienciaId, 'epocas'), callback)

export const createEpoca = (experienciaId, data) =>
  addDoc(collection(db, 'experiencias', experienciaId, 'epocas'), {
    ...data,
    creadoEn: serverTimestamp(),
  })

export const updateEpoca = (experienciaId, epocaId, data) =>
  updateDoc(doc(db, 'experiencias', experienciaId, 'epocas', epocaId), data)

export const deleteEpoca = (experienciaId, epocaId) =>
  deleteDoc(doc(db, 'experiencias', experienciaId, 'epocas', epocaId))

// ─── Puntos ────────────────────────────────────────────────────────────────
export const getPuntos = (experienciaId, epocaId) =>
  getDocs(query(
    collection(db, 'experiencias', experienciaId, 'epocas', epocaId, 'puntos'),
    orderBy('orden')
  ))

export const subscribePuntos = (experienciaId, epocaId, callback) =>
  onSnapshot(
    collection(db, 'experiencias', experienciaId, 'epocas', epocaId, 'puntos'),
    callback
  )

export const createPunto = (experienciaId, epocaId, data) =>
  addDoc(
    collection(db, 'experiencias', experienciaId, 'epocas', epocaId, 'puntos'),
    { ...data, creadoEn: serverTimestamp() }
  )

export const updatePunto = (experienciaId, epocaId, puntoId, data) =>
  updateDoc(
    doc(db, 'experiencias', experienciaId, 'epocas', epocaId, 'puntos', puntoId),
    data
  )

export const deletePunto = (experienciaId, epocaId, puntoId) =>
  deleteDoc(
    doc(db, 'experiencias', experienciaId, 'epocas', epocaId, 'puntos', puntoId)
  )

// ─── Puzzles ───────────────────────────────────────────────────────────────
const puzzlesCol = (expId, epId, ptId) =>
  collection(db, 'experiencias', expId, 'epocas', epId, 'puntos', ptId, 'puzzles')

const puzzleDoc = (expId, epId, ptId, pzId) =>
  doc(db, 'experiencias', expId, 'epocas', epId, 'puntos', ptId, 'puzzles', pzId)

export const subscribePuzzles = (experienciaId, epocaId, puntoId, callback) =>
  onSnapshot(puzzlesCol(experienciaId, epocaId, puntoId), callback)

export const createPuzzle = (experienciaId, epocaId, puntoId, data) =>
  addDoc(puzzlesCol(experienciaId, epocaId, puntoId), {
    ...data,
    creadoEn: serverTimestamp(),
  })

export const updatePuzzle = (experienciaId, epocaId, puntoId, puzzleId, data) =>
  updateDoc(puzzleDoc(experienciaId, epocaId, puntoId, puzzleId), data)

export const deletePuzzle = (experienciaId, epocaId, puntoId, puzzleId) =>
  deleteDoc(puzzleDoc(experienciaId, epocaId, puntoId, puzzleId))

// ─── Grupos ────────────────────────────────────────────────────────────────
export const getGrupoByCodigo = (codigo) =>
  getDocs(query(collection(db, 'grupos'), where('codigo', '==', codigo)))

export const createGrupo = (data) =>
  addDoc(collection(db, 'grupos'), { ...data, creadoEn: serverTimestamp() })

export const updateGrupo = (grupoId, data) =>
  updateDoc(doc(db, 'grupos', grupoId), data)

export const deleteGrupo = (grupoId) => deleteDoc(doc(db, 'grupos', grupoId))

export const subscribeGruposByExperiencia = (experienciaId, callback) =>
  onSnapshot(
    query(collection(db, 'grupos'), where('experienciaId', '==', experienciaId)),
    callback
  )

// ─── Equipos ───────────────────────────────────────────────────────────────
export const getEquipos = (grupoId) =>
  getDocs(collection(db, 'grupos', grupoId, 'equipos'))

export const createEquipo = (grupoId, data) =>
  addDoc(collection(db, 'grupos', grupoId, 'equipos'), {
    ...data,
    creadoEn: serverTimestamp(),
  })

export const updateEquipo = (grupoId, equipoId, data) =>
  updateDoc(doc(db, 'grupos', grupoId, 'equipos', equipoId), data)

export const deleteEquipo = (grupoId, equipoId) =>
  deleteDoc(doc(db, 'grupos', grupoId, 'equipos', equipoId))

export const subscribeEquipos = (grupoId, callback) =>
  onSnapshot(collection(db, 'grupos', grupoId, 'equipos'), callback)

// ─── Progreso de época ─────────────────────────────────────────────────────
const progresoDoc = (grupoId, equipoId, epocaId) =>
  doc(db, 'grupos', grupoId, 'equipos', equipoId, 'progreso', epocaId)

export const initProgresoEpoca = (grupoId, equipoId, epocaId, extra = {}) =>
  setDoc(progresoDoc(grupoId, equipoId, epocaId), {
    ...extra,
    inicioActual: serverTimestamp(),
    tiempoAcumuladoMs: 0,
    intervalos: [],
    puntosCompletados: [],
    puzzlesCompletados: [],
    penalizacionMinutos: 0,
    ayudasUsadas: {},
    estado: 'activo',
  })

export const getProgresoEpoca = (grupoId, equipoId, epocaId) =>
  getDoc(progresoDoc(grupoId, equipoId, epocaId))

export const subscribeProgresoEpoca = (grupoId, equipoId, epocaId, callback) =>
  onSnapshot(progresoDoc(grupoId, equipoId, epocaId), callback)

export const marcarPuntoCompletado = (grupoId, equipoId, epocaId, puntoId) =>
  updateDoc(progresoDoc(grupoId, equipoId, epocaId), {
    puntosCompletados: arrayUnion(puntoId),
  })

export const marcarPuzzleCompletado = (grupoId, equipoId, epocaId, puzzleId) =>
  updateDoc(progresoDoc(grupoId, equipoId, epocaId), {
    puzzlesCompletados: arrayUnion(puzzleId),
  })

export const registrarAyuda = (grupoId, equipoId, epocaId, puzzleId, nivel, penalizacion) => {
  const updates = { [`ayudasUsadas.${puzzleId}`]: nivel }
  if (penalizacion > 0) updates.penalizacionMinutos = increment(penalizacion)
  return updateDoc(progresoDoc(grupoId, equipoId, epocaId), updates)
}

export const pausarEpoca = (grupoId, equipoId, epocaId) =>
  runTransaction(db, async (tx) => {
    const ref = progresoDoc(grupoId, equipoId, epocaId)
    const snap = await tx.get(ref)
    if (!snap.exists()) return
    const data = snap.data()
    if (data.estado !== 'activo' || !data.inicioActual) return
    const inicio = data.inicioActual
    const fin = Timestamp.now()
    tx.update(ref, {
      estado: 'pausado',
      inicioActual: null,
      tiempoAcumuladoMs: (data.tiempoAcumuladoMs ?? 0) + (fin.toMillis() - inicio.toMillis()),
      intervalos: [...(data.intervalos ?? []), { inicio, fin }],
    })
  })

export const reanudarEpoca = (grupoId, equipoId, epocaId) =>
  updateDoc(progresoDoc(grupoId, equipoId, epocaId), {
    estado: 'activo',
    inicioActual: serverTimestamp(),
  })

export const completarEpoca = (grupoId, equipoId, epocaId) =>
  runTransaction(db, async (tx) => {
    const ref = progresoDoc(grupoId, equipoId, epocaId)
    const snap = await tx.get(ref)
    if (!snap.exists()) return
    const data = snap.data()
    const updates = { estado: 'completado' }
    if (data.inicioActual && data.estado === 'activo') {
      const inicio = data.inicioActual
      const fin = Timestamp.now()
      updates.inicioActual = null
      updates.tiempoAcumuladoMs = (data.tiempoAcumuladoMs ?? 0) + (fin.toMillis() - inicio.toMillis())
      updates.intervalos = [...(data.intervalos ?? []), { inicio, fin }]
    }
    tx.update(ref, updates)
  })

// Legacy — kept for coordinator progress view
export const subscribeProgreso = (grupoId, equipoId, callback) =>
  onSnapshot(
    collection(db, 'grupos', grupoId, 'equipos', equipoId, 'progreso'),
    callback
  )

// ─── Ranking ───────────────────────────────────────────────────────────────
export const writeRanking = (data) =>
  addDoc(collection(db, 'rankings'), { ...data, fecha: serverTimestamp() })

export const getRanking = (experienciaId) =>
  getDocs(query(
    collection(db, 'rankings'),
    where('experienciaId', '==', experienciaId),
    orderBy('puntuacion', 'desc'),
    orderBy('tiempo', 'asc')
  ))

export const subscribeRanking = (experienciaId, callback) =>
  onSnapshot(
    query(
      collection(db, 'rankings'),
      where('experienciaId', '==', experienciaId),
      orderBy('puntuacion', 'desc'),
      orderBy('tiempo', 'asc')
    ),
    callback
  )
