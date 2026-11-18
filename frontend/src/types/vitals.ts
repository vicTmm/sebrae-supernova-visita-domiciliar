import type { Vitals } from './visit'

export const vitalFields: { key: keyof Vitals; label: string; unit: string; min: number; max: number; step?: number }[] = [
  { key: 'systolic', label: 'PA sistólica', unit: 'mmHg', min: 40, max: 300 },
  { key: 'diastolic', label: 'PA diastólica', unit: 'mmHg', min: 20, max: 200 },
  { key: 'heart_rate', label: 'Frequência cardíaca', unit: 'bpm', min: 10, max: 300 },
  { key: 'respiratory_rate', label: 'Frequência respiratória', unit: 'irpm', min: 1, max: 100 },
  { key: 'oxygen_saturation', label: 'Saturação de O₂', unit: '%', min: 0, max: 100, step: 0.1 },
  { key: 'temperature', label: 'Temperatura axilar', unit: '°C', min: 30, max: 45, step: 0.1 },
  { key: 'glucose', label: 'Glicemia capilar', unit: 'mg/dL', min: 10, max: 1000 },
]

export function validateVitals(vitals: Vitals): string | null {
  const { systolic, diastolic } = vitals
  if ((systolic === null) !== (diastolic === null) || (systolic !== null && diastolic !== null && systolic <= diastolic)) {
    return 'Informe os dois valores da PA. A sistólica deve superar a diastólica.'
  }
  for (const field of vitalFields) {
    const value = vitals[field.key]
    if (value !== null && (!Number.isFinite(value) || value < field.min || value > field.max || (!field.step && !Number.isInteger(value)))) {
      return `Confira o valor de ${field.label}.`
    }
  }
  return null
}
