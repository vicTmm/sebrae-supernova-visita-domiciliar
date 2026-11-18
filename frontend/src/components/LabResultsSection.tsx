import { useState } from 'react'
import type { ClinicalAlert } from '../services/clinicalRules'
import { formatLabNumber, labGroups, labMax, labTextLimit, type LabNumericField, type LabResults } from '../types/labResults'

const decimalPattern = '[0-9]+([,.][0-9]+)?|[,.][0-9]+'
const validDecimal = new RegExp(`^(?:${decimalPattern})$`)
const countPattern = '[0-9]+'
const validCount = new RegExp(`^${countPattern}$`)

function LabNumberInput({ field, value, alert, onChange }: {
  field: LabNumericField
  value: number | null | undefined
  alert: ClinicalAlert | undefined
  onChange: (value: number | null) => void
}) {
  const [raw, setRaw] = useState<string>()
  const alertId = `lab-alert-${field.key}`
  const isCount = field.unit === '/mm³'
  return <label>{field.label}
    <div className="lab-unit-input">
      <input type="text" inputMode={isCount ? 'numeric' : 'decimal'} pattern={isCount ? countPattern : decimalPattern} autoComplete="off"
        aria-label={`${field.label} (${field.unit})`} aria-describedby={alert ? alertId : undefined}
        value={raw ?? (value == null ? '' : formatLabNumber(value))}
        onBlur={event => { if (event.currentTarget.validity.valid) setRaw(undefined) }}
        onChange={event => {
          const input = event.currentTarget
          const text = input.value
          const parsed = (isCount ? validCount : validDecimal).test(text) ? Number(text.replace(',', '.')) : null
          const outsideRange = parsed !== null && (parsed > labMax(field) || (field.key === 'ldl_target' && parsed === 0))
          let error = ''
          if (outsideRange) error = 'Confira o valor digitado.'
          else if (text && parsed === null) error = isCount
            ? 'Digite a contagem inteira, sem ponto ou vírgula.'
            : 'Digite um número. Use vírgula ou ponto para separar a parte decimal.'
          input.setCustomValidity(error)
          setRaw(text)
          onChange(outsideRange ? null : parsed)
        }}/>
      <span aria-hidden="true">{field.unit}</span>
    </div>
    {alert && <span className="clinical-badge" id={alertId}>{alert.observation}</span>}
  </label>
}

export default function LabResultsSection({ value, alerts, onChange }: {
  value: LabResults | null | undefined
  alerts: ClinicalAlert[]
  onChange: (value: LabResults | null) => void
}) {
  const results = value ?? {}
  const hasResult = (key: keyof LabResults) => {
    const item = results[key]
    return typeof item === 'number' || (typeof item === 'string' && item.trim().length > 0)
  }
  const total = labGroups.reduce((count, group) =>
    count + group.fields.filter(field => field.short && hasResult(field.key)).length, 0)
  function setResult<K extends keyof LabResults>(key: K, value: LabResults[K]) {
    const next = { ...results, [key]: value }
    onChange(Object.values(next).some(item => item != null && item !== '') ? next : null)
  }

  return <details className="lab-results" onInvalid={event => { event.currentTarget.open = true }}>
    <summary>Resultados de Exames (Externos / Trazidos pelo Paciente)
      <span>{total ? `${total} ${total === 1 ? 'resultado' : 'resultados'}` : 'Opcional'}</span>
    </summary>
    <div className="lab-results-body">
      <p>Preencha apenas os resultados disponíveis, sem separador de milhar. Confira as unidades e o intervalo de referência no laudo.</p>
      <label className="lab-date">Data do exame
        <input type="date" value={results.exam_date ?? ''} onChange={event => setResult('exam_date', event.target.value || null)}/>
      </label>
      {labGroups.map(group => {
        const count = group.fields.filter(field => field.short && hasResult(field.key)).length
        return <details className="lab-group" key={group.title} onInvalid={event => { event.currentTarget.open = true }}>
          <summary>{group.title}{count > 0 && <span>{count}</span>}</summary>
          <div className="lab-fields">
            {group.fields.map(field => 'unit' in field
              ? <LabNumberInput key={field.key} field={field} value={results[field.key]}
                  alert={alerts.find(alert => alert.fields.includes(field.key))}
                  onChange={value => setResult(field.key, value)}/>
              : <label key={field.key} className="lab-text-field">{field.label}
                  <input type="text" maxLength={labTextLimit} value={results[field.key] ?? ''}
                    onChange={event => setResult(field.key, event.target.value || null)}/>
                </label>)}
          </div>
        </details>
      })}
    </div>
  </details>
}
