import {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
} from 'firebase/auth'
import { auth } from './firebase'

export const loginCoordinador = (email, password) =>
  signInWithEmailAndPassword(auth, email, password)

export const logoutCoordinador = () => signOut(auth)

export const onAuthChange = (callback) => onAuthStateChanged(auth, callback)
