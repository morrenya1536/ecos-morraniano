export const IDIOMA_LABELS = { es: 'Castellano', ca: 'Català', en: 'English' }

// Devuelve el texto en el idioma pedido.
// Acepta campo como string (legacy) o como objeto { es, ca, en }.
export function getText(campo, idioma) {
  if (!campo && campo !== 0) return ''
  if (typeof campo === 'string') return campo
  if (typeof campo === 'object' && !Array.isArray(campo)) {
    return campo[idioma] ?? campo[Object.keys(campo)[0]] ?? ''
  }
  return ''
}

export const generarCodigo = (longitud = 6) => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  return Array.from({ length: longitud }, () =>
    chars[Math.floor(Math.random() * chars.length)]
  ).join('')
}

export const formatearTiempo = (segundos) => {
  const h = Math.floor(segundos / 3600)
  const m = Math.floor((segundos % 3600) / 60)
  const s = segundos % 60
  if (h > 0) return `${h}h ${m}m ${s}s`
  if (m > 0) return `${m}m ${s}s`
  return `${s}s`
}

export const distanciaMetros = (lat1, lng1, lat2, lng2) => {
  const R = 6371000
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLng = ((lng2 - lng1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

export const slugify = (text) =>
  text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
