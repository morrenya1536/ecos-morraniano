import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  serverTimestamp,
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

export const createEpoca = (experienciaId, data) =>
  addDoc(collection(db, 'experiencias', experienciaId, 'epocas'), data)

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

export const createPunto = (experienciaId, epocaId, data) =>
  addDoc(
    collection(db, 'experiencias', experienciaId, 'epocas', epocaId, 'puntos'),
    data
  )

// ─── Grupos ────────────────────────────────────────────────────────────────
export const getGrupoByCodigo = (codigo) =>
  getDocs(query(collection(db, 'grupos'), where('codigo', '==', codigo)))

export const createGrupo = (data) =>
  addDoc(collection(db, 'grupos'), { ...data, creadoEn: serverTimestamp() })

export const updateGrupo = (grupoId, data) =>
  updateDoc(doc(db, 'grupos', grupoId), data)

// Nota: deleteGrupo no elimina las subcolecciones; se necesitaría Cloud Function
// para borrado completo. Los equipos huérfanos no afectan al juego.
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

// ─── Progreso (tiempo real) ────────────────────────────────────────────────
export const subscribeProgreso = (grupoId, equipoId, callback) =>
  onSnapshot(
    collection(db, 'grupos', grupoId, 'equipos', equipoId, 'progreso'),
    callback
  )

export const updateProgreso = (grupoId, equipoId, progresoId, data) =>
  updateDoc(
    doc(db, 'grupos', grupoId, 'equipos', equipoId, 'progreso', progresoId),
    data
  )

// ─── Ranking ───────────────────────────────────────────────────────────────
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
