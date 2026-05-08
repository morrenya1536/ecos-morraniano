import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage'
import { storage } from './firebase'

export const uploadImagen = async (path, file) => {
  const storageRef = ref(storage, path)
  const snapshot = await uploadBytes(storageRef, file)
  return getDownloadURL(snapshot.ref)
}

export const deleteImagen = (path) => deleteObject(ref(storage, path))

export const getImagenUrl = (path) => getDownloadURL(ref(storage, path))
