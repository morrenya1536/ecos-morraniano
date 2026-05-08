export const ROLES = {
  COORDINADOR: 'coordinador',
  JUGADOR: 'jugador',
}

export const TIPOS_PUNTO = {
  QR: 'qr',
  GPS: 'gps',
  MANUAL: 'manual',
}

export const TIPOS_RESPUESTA_PUZZLE = {
  NUMERICA: 'numerica',
  TEXTO_LIBRE: 'texto_libre',
  CONFIRMACION_FISICA: 'confirmacion_fisica',
  COLABORATIVA: 'colaborativa',
  ESCANEAR_QR: 'escanear_qr',
}

export const ESTADOS_PROGRESO = {
  ACTIVO: 'activo',
  COMPLETADO: 'completado',
  PAUSADO: 'pausado',
}

export const RUTAS = {
  ROOT: '/',
  LOGIN_COORDINADOR: '/login',
  HOME_COORDINADOR: '/coordinador',
  EXPERIENCE_BUILDER: '/coordinador/experiencias/:experienciaId',
  ACCESO_JUGADOR: '/acceso',
  HOME_JUGADOR: '/jugador',
  EPOCA_ACTIVA: '/jugador/epoca/:epocaId',
  RANKING: '/ranking/:experienciaId',
}
