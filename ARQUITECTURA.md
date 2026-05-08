# Arquitectura — Escape Room Builder

## Visión general

Plataforma PWA para crear y gestionar escape rooms al aire libre. Cada **experiencia** es
independiente y configurable. "Els Ecos de Morraniano" es la primera experiencia.

---

## Stack técnico

| Capa | Tecnología |
|---|---|
| Frontend | React 18 + Vite 6 |
| Base de datos | Firebase Firestore |
| Autenticación | Firebase Auth (coordinador) |
| Almacenamiento | Firebase Storage |
| Hosting | Vercel |
| Mapa | Leaflet.js + OpenStreetMap |
| QR Scanner | html5-qrcode |
| PWA | vite-plugin-pwa + Workbox |

---

## Tipos de usuario

### Coordinador
- Autenticación: email + contraseña (Firebase Auth)
- Capacidades: crear/editar experiencias, gestionar grupos, ver progreso en tiempo real
- Ruta de entrada: `/login`

### Jugador
- Autenticación: código de grupo + nombre de equipo (sin Firebase Auth)
- El estado de sesión se guarda en React Context (GameContext)
- Ruta de entrada: `/acceso`

---

## Estructura de datos Firestore

### `experiencias/{experienciaId}`

```
{
  nombre: string,
  descripcion: string,
  activa: boolean,
  creadoPor: string,          // uid del coordinador
  creadoEn: Timestamp,
  imagenPortadaUrl: string,   // Firebase Storage
}
```

#### `experiencias/{id}/epocas/{epocaId}`

Cada experiencia tiene una o varias épocas que se juegan de forma secuencial.

```
{
  nombre: string,             // ej: "La Era Romana"
  descripcion: string,
  orden: number,              // 1, 2, 3... determina el orden de juego
  activa: boolean,
  imagenUrl: string,
  narrativa: string,          // texto de ambientación que ve el jugador al entrar
}
```

#### `experiencias/{id}/epocas/{id}/puntos/{puntoId}`

Cada época tiene N puntos geográficos que el equipo debe encontrar.

```
{
  nombre: string,
  descripcion: string,
  lat: number,
  lng: number,
  orden: number,
  tipo: 'qr' | 'gps' | 'manual',
  codigoQR: string,           // valor del QR si tipo === 'qr'
  radioMetros: number,        // radio de validación GPS (default: 15m)
  imagenUrl: string,
}
```

#### `experiencias/{id}/epocas/{id}/puntos/{id}/puzzles/{puzzleId}`

Cada punto tiene uno o varios puzzles secuenciales. El equipo debe resolver todos para
completar el punto.

```
{
  orden: number,
  tipo: 'texto' | 'imagen' | 'opcion_multiple' | 'codigo',
  enunciado: string,
  imagenUrl: string,          // opcional
  respuestaCorrecta: string,  // normalizada (lowercase, sin acentos)
  opciones: string[],         // solo para tipo 'opcion_multiple'
  pistas: string[],           // array de pistas desbloqueables
  puntos: number,             // puntos que otorga resolver este puzzle
  penalizacionPista: number,  // puntos que resta pedir una pista
}
```

---

### `grupos/{grupoId}`

Un grupo corresponde a una sesión de juego de una experiencia concreta.
Puede tener varios equipos jugando simultáneamente (competición).

```
{
  experienciaId: string,      // referencia a la experiencia
  nombre: string,             // nombre descriptivo, ej: "Salida 14 mayo"
  codigo: string,             // 6 chars, ej: "ABC123" — lo comparte el coordinador
  activo: boolean,
  creadoEn: Timestamp,
  creadoPor: string,          // uid del coordinador
}
```

#### `grupos/{id}/equipos/{equipoId}`

```
{
  nombre: string,
  creadoEn: Timestamp,
}
```

#### `grupos/{id}/equipos/{id}/jugadores/{jugadorId}`

```
{
  nombre: string,
  unidoEn: Timestamp,
}
```

#### `grupos/{id}/equipos/{id}/progreso/{progresoId}`

Un único documento por sesión de juego (uno por equipo por experiencia).

```
{
  experienciaId: string,
  epocaActualId: string,
  puntosCompletados: string[],   // array de puntoId
  puzzlesCompletados: string[],  // array de puzzleId
  pistasUsadas: string[],        // array de puzzleId donde se pidió pista
  puntuacion: number,
  tiempoInicio: Timestamp,
  tiempoFin: Timestamp | null,
  estado: 'activo' | 'completado' | 'pausado',
}
```

---

### `rankings/{rankingId}`

Colección plana para consultas de ranking eficientes.
Se escribe cuando un equipo completa una experiencia.

```
{
  experienciaId: string,
  grupoId: string,
  equipoId: string,
  equipoNombre: string,
  puntuacion: number,
  tiempoSegundos: number,     // tiempo total en segundos
  fecha: Timestamp,
}
```

> **Índice compuesto necesario:** `experienciaId ASC + puntuacion DESC + tiempoSegundos ASC`

---

## Flujo de juego (jugador)

```
/acceso
  └─ Introduce código de grupo + nombre de equipo
  └─ Se valida el grupo en Firestore
  └─ Se crea o recupera el equipo
  └─ Se guarda sesión en GameContext

/jugador (PlayerHome)
  └─ Muestra experiencia activa y estado del equipo
  └─ Botón "Continuar" → /jugador/epoca/:epocaId

/jugador/epoca/:epocaId (ActiveEpoch)
  └─ Mapa Leaflet con los puntos de la época
  └─ El equipo se desplaza físicamente al punto
  └─ Validación del punto (QR scan | GPS | código manual)
  └─ Se despliegan los puzzles del punto secuencialmente
  └─ Al resolver todos → punto completado → siguiente punto
  └─ Al completar todos los puntos → época completada
  └─ Si hay más épocas → avanza a la siguiente
  └─ Si era la última → experiencia completada → se escribe el ranking

/ranking/:experienciaId
  └─ Tabla pública en tiempo real
  └─ Ordenada: puntuación DESC, tiempo ASC
```

## Flujo del coordinador

```
/login
  └─ Firebase Auth email/password

/coordinador (CoordinatorHome)
  └─ Lista de experiencias creadas
  └─ CTA para crear nueva

/coordinador/experiencias/:id (ExperienceBuilder)
  └─ Tab "Info": nombre, descripción, imagen de portada
  └─ Tab "Épocas": CRUD épocas + reordenar (drag & drop)
    └─ Para cada época: CRUD puntos en mapa Leaflet
      └─ Para cada punto: CRUD puzzles secuenciales
  └─ Tab "Grupos": crear grupos, generar código, activar/desactivar
  └─ Tab "Progreso": ver en tiempo real qué hace cada equipo
  └─ Tab "Ranking": tabla de resultados
```

---

## Estructura de carpetas

```
src/
├── context/
│   ├── AuthContext.jsx      # Firebase Auth para coordinador
│   └── GameContext.jsx      # Sesión del jugador (grupoId, equipoId, progreso)
├── pages/
│   ├── coordinator/
│   │   ├── CoordinatorLogin.jsx
│   │   ├── CoordinatorHome.jsx
│   │   └── ExperienceBuilder.jsx
│   ├── player/
│   │   ├── PlayerAccess.jsx
│   │   ├── PlayerHome.jsx
│   │   └── ActiveEpoch.jsx
│   ├── Ranking.jsx
│   └── NotFound.jsx
├── components/
│   ├── coordinator/         # Componentes del panel de coordinador
│   ├── player/              # Componentes de la vista jugador
│   └── shared/
│       ├── LoadingScreen.jsx
│       └── ProtectedRoute.jsx
├── hooks/
│   ├── useCoordinator.js    # Login/logout coordinador
│   ├── useFirestore.js      # Subscripción reactiva a colecciones
│   └── usePlayerAccess.js   # Validación y acceso de jugadores
├── services/
│   ├── firebase.js          # Inicialización (app, db, auth, storage)
│   ├── auth.js              # Funciones de autenticación
│   ├── firestore.js         # Todas las queries/mutaciones de Firestore
│   └── storage.js           # Upload/download de imágenes
├── utils/
│   ├── constants.js         # RUTAS, TIPOS_PUZZLE, ESTADOS_PROGRESO...
│   └── helpers.js           # generarCodigo, formatearTiempo, distanciaMetros...
├── App.jsx
├── main.jsx
├── router.jsx
└── index.css
```

---

## Reglas de seguridad Firestore (borrador)

```javascript
// Coordinadores: autenticados pueden leer/escribir todo
// Jugadores: solo pueden leer su progreso y escribir su propio progreso

rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // Experiencias: solo coordinadores autenticados pueden escribir
    match /experiencias/{id=**} {
      allow read: if true;
      allow write: if request.auth != null;
    }

    // Grupos: coordinadores escriben, cualquiera lee por código
    match /grupos/{grupoId} {
      allow read: if true;
      allow write: if request.auth != null;

      match /equipos/{equipoId} {
        allow read, write: if true; // el equipo crea su propia sesión
        match /progreso/{progresoId} {
          allow read, write: if true;
        }
      }
    }

    // Rankings: cualquiera lee, solo escritura desde el cliente del equipo
    match /rankings/{id} {
      allow read: if true;
      allow write: if true; // TODO: validar con Cloud Functions
    }
  }
}
```

> **Nota:** Las reglas de producción deberán endurecerse con Cloud Functions
> para validar el progreso del lado del servidor.
