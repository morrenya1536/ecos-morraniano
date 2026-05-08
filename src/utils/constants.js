export const ROLES = {
  COORDINADOR: 'coordinador',
  JUGADOR: 'jugador',
}

export const TIPOS_PUNTO = {
  QR: 'qr',
  GPS: 'gps',
  MANUAL: 'manual',
}

export const TIPOS_PUZZLE = {
  TEXTO: 'texto',
  IMAGEN: 'imagen',
  OPCION_MULTIPLE: 'opcion_multiple',
  CODIGO: 'codigo',
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
