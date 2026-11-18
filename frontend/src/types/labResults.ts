export const labGroups = [
  { title: 'Renal e eletrólitos', fields: [
    { key: 'creatinina', label: 'Creatinina', short: 'Cr', unit: 'mg/dL' },
    { key: 'ureia', label: 'Ureia', short: 'Ur', unit: 'mg/dL' },
    { key: 'sodio', label: 'Sódio', short: 'Na', unit: 'mEq/L' },
    { key: 'potassio', label: 'Potássio', short: 'K', unit: 'mEq/L' },
  ] },
  { title: 'Perfil lipídico', fields: [
    { key: 'colesterol_total', label: 'Colesterol total', short: 'CT', unit: 'mg/dL' },
    { key: 'ldl', label: 'LDL', short: 'LDL', unit: 'mg/dL' },
    { key: 'hdl', label: 'HDL', short: 'HDL', unit: 'mg/dL' },
    { key: 'triglicerideos', label: 'Triglicerídeos', short: 'TG', unit: 'mg/dL' },
    { key: 'ldl_target', label: 'Meta de LDL registrada', short: '', unit: 'mg/dL' },
  ] },
  { title: 'Metabólico e tireoide', fields: [
    { key: 'glicemia_jejum', label: 'Glicemia de jejum', short: 'Glicemia de jejum', unit: 'mg/dL' },
    { key: 'hba1c', label: 'Hemoglobina glicada', short: 'HbA1c', unit: '%', max: 100 },
    { key: 'tsh', label: 'TSH', short: 'TSH', unit: 'mUI/L' },
    { key: 't4_livre', label: 'T4 livre', short: 'T4L', unit: 'ng/dL' },
  ] },
  { title: 'Hemograma', fields: [
    { key: 'hb', label: 'Hemoglobina', short: 'Hb', unit: 'g/dL' },
    { key: 'ht', label: 'Hematócrito', short: 'Ht', unit: '%', max: 100 },
    { key: 'leucocitos', label: 'Leucócitos', short: 'Leucócitos', unit: '/mm³' },
    { key: 'plaquetas', label: 'Plaquetas', short: 'Plaquetas', unit: '/mm³' },
    { key: 'hemograma_resumo', label: 'Resumo do hemograma', short: 'Hemograma' },
  ] },
  { title: 'Hepático e proteínas', fields: [
    { key: 'tgo_ast', label: 'TGO (AST)', short: 'TGO/AST', unit: 'U/L' },
    { key: 'tgp_alt', label: 'TGP (ALT)', short: 'TGP/ALT', unit: 'U/L' },
    { key: 'ggt', label: 'GGT', short: 'GGT', unit: 'U/L' },
    { key: 'fosfatase_alcalina', label: 'Fosfatase alcalina', short: 'FA', unit: 'U/L' },
    { key: 'bilirrubinas', label: 'Bilirrubinas', short: 'Bilirrubinas' },
    { key: 'proteinas_totais_fracoes', label: 'Proteínas totais e frações', short: 'Proteínas totais e frações' },
  ] },
  { title: 'Rastreio e outros exames', fields: [
    { key: 'psa', label: 'PSA', short: 'PSA', unit: 'ng/mL' },
    { key: 'eas_urina', label: 'EAS / urina', short: 'EAS' },
    { key: 'outros_exames', label: 'Outros exames', short: 'Outros exames' },
  ] },
] as const

export type LabField = (typeof labGroups)[number]['fields'][number]
export type LabNumericField = Extract<LabField, { unit: string }>
export type LabNumericKey = LabNumericField['key']
type LabTextKey = Exclude<LabField['key'], LabNumericKey>
export type LabResults = { exam_date?: string | null }
  & Partial<Record<LabNumericKey, number | null>>
  & Partial<Record<LabTextKey, string | null>>

export const labFields = labGroups.flatMap<LabField>(group => group.fields)
export const labNumberLimit = 1_000_000_000
export const labTextLimit = 320
export const labMax = (field: LabNumericField) => 'max' in field ? field.max : labNumberLimit
const labNumberFormat = new Intl.NumberFormat('pt-BR', { useGrouping: false, maximumSignificantDigits: 21 })
export const formatLabNumber = (value: number) => value === 0 ? '0' : labNumberFormat.format(value)

export function validateLabResults(results: LabResults): string | null {
  if (results.exam_date != null) {
    const date = new Date(results.exam_date + 'T00:00:00Z')
    if (!/^(?!0000)\d{4}-\d{2}-\d{2}$/.test(results.exam_date) || Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== results.exam_date)
      return 'Confira a data dos exames laboratoriais.'
  }
  for (const field of labFields) {
    const value = results[field.key]
    if (value == null) continue
    if ('unit' in field ? typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > labMax(field)
      || (field.key === 'ldl_target' && value === 0) || (field.unit === '/mm³' && !Number.isInteger(value))
      : typeof value !== 'string' || Array.from(value).length > labTextLimit) return `Confira o campo ${field.label} dos exames laboratoriais.`
  }
  return null
}
