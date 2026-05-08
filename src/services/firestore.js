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
export const getExperiencias = () => getDocs(collection(db, 'experiencias'))

export const getExperiencia = (id) => getDoc(doc(db, 'experiencias', id))

export const createExperiencia = (data) =>
  addDoc(collection(db, 'experiencias'), { ...data, creadoEn: serverTimestamp() })

export const updateExperiencia = (id, data) =>
  updateDoc(doc(db, 'experiencias', id), data)

// ─── Épocas ────────────────────────────────────────────────────────────────
export const getEpocas = (experienciaId) =>
  getDocs(query(
    collection(db, 'experiencias', experienciaId, 'epocas'),
    orderBy('orden')
  ))

export const createEpoca = (experienciaId, data) =>
  addDoc(collection(db, 'experiencias', experienciaId, 'epocas'), data)

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

// ─── Equipos ───────────────────────────────────────────────────────────────
export const getEquipos = (grupoId) =>
  getDocs(collection(db, 'grupos', grupoId, 'equipos'))

export const createEquipo = (grupoId, data) =>
  addDoc(collection(db, 'grupos', grupoId, 'equipos'), {
    ...data,
    creadoEn: serverTimestamp(),
  })

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
