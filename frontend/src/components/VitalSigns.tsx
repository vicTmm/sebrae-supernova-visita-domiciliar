import type { ClinicalAlert } from '../services/clinicalRules'
import type { Vitals } from '../types/visit'
export const vitalFields: { key: keyof Vitals; label: string; unit: string; min: number; max: number; step?: number }[] = [
  { key: 'systolic', label: 'PA sistólica', unit: 'mmHg', min: 40, max: 300 },
  { key: 'diastolic', label: 'PA diastólica', unit: 'mmHg', min: 20, max: 200 },
  { key: 'heart_rate', label: 'Frequência cardíaca', unit: 'bpm', min: 10, max: 300 },
  { key: 'respiratory_rate', label: 'Frequência respiratória', unit: 'irpm', min: 1, max: 100 },
  { key: 'oxygen_saturation', label: 'Saturação de O₂', unit: '%', min: 0, max: 100, step: 0.1 },
  { key: 'temperature', label: 'Temperatura axilar', unit: '°C', min: 30, max: 45, step: 0.1 },
  { key: 'glucose', label: 'Glicemia capilar', unit: 'mg/dL', min: 10, max: 1000 },
]
export default function VitalSigns({ value, onChange, alerts = [] }: { value: Vitals; onChange: (v: Vitals) => void; alerts?: ClinicalAlert[] }) {
  return <div className="vitals-grid">{vitalFields.map(f => <label key={f.key}>{f.label}<div className="unit-input"><input aria-describedby={alerts.some(a => a.fields.includes(f.key)) ? `alert-${f.key}` : undefined} aria-label={f.label} type="number" inputMode={f.step ? 'decimal' : 'numeric'} min={f.min} max={f.max} step={f.step ?? 1} value={value[f.key] ?? ''} placeholder="—" onChange={e => onChange({ ...value, [f.key]: e.target.value === '' ? null : Number(e.target.value) })} /><span>{f.unit}</span></div>{alerts.some(a => a.fields.includes(f.key)) && <span id={`alert-${f.key}`} className="clinical-badge">{alerts.filter(a => a.fields.includes(f.key)).map(a => a.observation).join(". ")}</span>}</label>)}</div>
}
