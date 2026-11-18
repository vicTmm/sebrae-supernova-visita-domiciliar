import { useId } from 'react'
import type { ClinicalAlert } from '../services/clinicalRules'
import type { Vitals } from '../types/visit'
import { vitalFields } from '../types/vitals'

export default function VitalSigns({ value, onChange, alerts = [] }: { value: Vitals; onChange: (v: Vitals) => void; alerts?: ClinicalAlert[] }) {
  const id = useId()
  return <div className="vitals-grid">{vitalFields.map(field => {
    const notes = alerts.filter(alert => alert.fields.includes(field.key)).map(alert => alert.observation)
    const alertId = `${id}-${field.key}`
    return <label key={field.key}>{field.label}
      <div className="unit-input">
        <input aria-describedby={notes.length ? alertId : undefined} aria-label={field.label}
          type="number" inputMode={field.step ? 'decimal' : 'numeric'} min={field.min} max={field.max}
          step={field.step ?? 1} value={value[field.key] ?? ''} placeholder="—"
          onChange={event => onChange({ ...value, [field.key]: event.target.value === '' ? null : Number(event.target.value) })}/>
        <span>{field.unit}</span>
      </div>
      {notes.length > 0 && <span id={alertId} className="clinical-badge">{notes.join('. ')}</span>}
    </label>
  })}</div>
}
