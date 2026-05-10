const IDIOMA_LABELS = { es: 'Castellano', ca: 'Català', en: 'English' }

function getVal(campo, idioma, idiomas) {
  if (!campo) return ''
  if (typeof campo === 'string') return idioma === idiomas[0] ? campo : ''
  return campo[idioma] ?? ''
}

function buildObj(campo, idioma, value, idiomas) {
  const asObj = (typeof campo === 'object' && campo !== null && !Array.isArray(campo))
    ? campo
    : { [idiomas[0]]: typeof campo === 'string' ? campo : '' }
  return { ...asObj, [idioma]: value }
}

export function CampoTraducible({ label, campo, onChange, idiomas, placeholder = '', tipo = 'input', rows = 2, required = false }) {
  return idiomas.map((lang, idx) => (
    <div key={lang} className="form__group">
      <label className="form__label">
        {label} <span className="text-muted">({IDIOMA_LABELS[lang] ?? lang.toUpperCase()})</span>
      </label>
      {tipo === 'textarea' ? (
        <textarea
          rows={rows}
          value={getVal(campo, lang, idiomas)}
          onChange={e => onChange(buildObj(campo, lang, e.target.value, idiomas))}
          placeholder={placeholder}
          required={required && idx === 0}
        />
      ) : (
        <input
          type="text"
          value={getVal(campo, lang, idiomas)}
          onChange={e => onChange(buildObj(campo, lang, e.target.value, idiomas))}
          placeholder={placeholder}
          required={required && idx === 0}
        />
      )}
    </div>
  ))
}
