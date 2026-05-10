import { IDIOMA_LABELS } from '../../utils/helpers'

export function TabsIdioma({ idiomas, activo, onChange }) {
  return (
    <div className="tabs-idioma">
      {idiomas.map(lang => (
        <button
          key={lang}
          type="button"
          className={`tabs-idioma__btn${activo === lang ? ' tabs-idioma__btn--active' : ''}`}
          onClick={() => onChange(lang)}
        >
          {IDIOMA_LABELS[lang] ?? lang.toUpperCase()}
        </button>
      ))}
    </div>
  )
}

// Normaliza un campo a objeto multiidioma
export function toMulti(val, idiomas) {
  if (val && typeof val === 'object' && !Array.isArray(val)) return val
  const first = idiomas[0] ?? 'es'
  return { [first]: typeof val === 'string' ? val : '' }
}
