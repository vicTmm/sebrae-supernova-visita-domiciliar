import type { Visit, Vitals, MiniMental } from '../types/visit'
import { formatLabNumber, type LabNumericKey } from '../types/labResults'
export interface ClinicalAlert { code: string; fields: (keyof Vitals | LabNumericKey)[]; observation: string; suggestion: string }
export const cognitiveCutoff = (years: number) => years === 0 ? 20 : years <= 4 ? 25 : years <= 8 ? 26 : 28
export const mentalCutoff = (m: MiniMental): number | null => m.education_level ? ({ none: 20, '1_4': 25, '5_8': 26, over_8: 28 })[m.education_level] : m.education_years === null ? null : cognitiveCutoff(m.education_years)
export function cognitiveInterpretation(m: MiniMental): string {
  if (mentalCutoff(m) === null) return 'Escolaridade não informada; interpretação por corte não disponível'
  const cutoff = mentalCutoff(m)!
  const status = m.score! < cutoff ? 'abaixo do corte de rastreio; possível alteração cognitiva, sem diagnóstico' : 'não abaixo do corte de rastreio; não exclui alteração cognitiva'
  return `${status} (corte ${cutoff} para a escolaridade informada)`
}
export function evaluateClinical(visit: Visit): ClinicalAlert[] {
  const v = visit.vitals, alerts: ClinicalAlert[] = []
  const add = (code: string, fields: ClinicalAlert['fields'], observation: string, suggestion: string) => alerts.push({ code, fields, observation, suggestion })
  const adult = visit.age != null && visit.age >= 18 && !visit.conditions.includes('Gestante') && !visit.conditions.includes('Puérpera')
  if (!adult) {
    if (Object.values(v).some(value => value !== null)) add('specific_profile', Object.keys(v) as (keyof Vitals)[], 'Perfil pediátrico/obstétrico: referências adultas gerais não aplicadas', 'Avaliar os sinais vitais conforme protocolo específico para idade ou condição obstétrica')
  } else {
    if (v.systolic !== null && v.diastolic !== null) {
      const value = `PA ${v.systolic}/${v.diastolic} mmHg`, has = visit.conditions.includes('Hipertenso')
      if (v.systolic >= 180 || v.diastolic >= 120) add('bp_severe', ['systolic', 'diastolic'], `${value}: elevação acentuada`, 'Reavaliar imediatamente a PA, sintomas e sinais de lesão aguda de órgão-alvo; definir necessidade de atendimento urgente')
      else if (has && (v.systolic >= 150 || v.diastolic >= 95)) add('bp_uncontrolled', ['systolic', 'diastolic'], `${value}: elevação significativa no acompanhamento de HAS`, 'Revisar adesão anti-hipertensiva e considerar ajuste posológico ou curva pressórica após avaliação médica')
      else if (v.systolic >= 140 || v.diastolic >= 90) add('bp_monitor', ['systolic', 'diastolic'], has ? `${value}: limítrofe/elevada no acompanhamento de HAS; conferir meta individual` : `${value}: PA acima da referência de rastreio, investigar/monitorar`, 'Repetir a aferição e revisar a meta individual; considerar monitorização pressórica')
      const t = visit.bp_target
      if (t?.systolic != null && t.diastolic != null && (v.systolic >= t.systolic || v.diastolic >= t.diastolic)) add('bp_target', ['systolic', 'diastolic'], `${value}: atinge ou supera a meta individual registrada de <${t.systolic}/${t.diastolic} mmHg`, 'Revisar a PA em relação à meta individual definida pelo médico, tolerabilidade e contexto clínico')
    }
    if (v.oxygen_saturation !== null) {
      const copd = visit.conditions.includes('DPOC/pneumopata'), threshold = copd ? 92 : 95
      if (v.oxygen_saturation < threshold) add('oxygen_low', ['oxygen_saturation'], `SatO2 ${v.oxygen_saturation}%: saturação reduzida, possível hipoxemia${copd ? ' no contexto de pneumopatia' : ''}`, 'Confirmar a oximetria e avaliar sintomas respiratórios e necessidade de atendimento imediato; individualizar suporte conforme avaliação médica')
    }
    if (v.glucose !== null) {
      const diabetic = visit.conditions.includes('Diabético')
      if (v.glucose < 70) add('glucose_low', ['glucose'], `HGT ${v.glucose} mg/dL: hipoglicemia`, 'Avaliar e manejar prontamente a hipoglicemia conforme protocolo, reavaliar glicemia e revisar fatores precipitantes')
      else if (v.glucose > (diabetic ? 180 : 200)) add('glucose_high', ['glucose'], diabetic ? `HGT ${v.glucose} mg/dL: hiperglicemia no acompanhamento de diabetes` : `HGT ${v.glucose} mg/dL: glicemia elevada sem diagnóstico prévio de diabetes informado`, 'Reavaliar glicemia, horário da alimentação, sintomas e adesão; considerar investigação ou revisão terapêutica após avaliação médica')
    }
    for (const [key, low, high, name, unit] of [['heart_rate', 50, 100, 'FC', 'bpm'], ['respiratory_rate', null, 20, 'FR', 'irpm']] as const) {
      const value = v[key]
      if (value !== null && ((low !== null && value < low) || value > high)) {
        const label = low !== null && value < low ? 'bradicardia' : key === 'heart_rate' ? 'taquicardia' : 'taquipneia'
        add(label, [key], `${name} ${value} ${unit}: ${label}`, `Reavaliar ${name}, sintomas associados e possíveis causas; definir conduta conforme avaliação clínica`)
      }
    }
    if (v.temperature !== null && v.temperature >= 37.8) add('fever', ['temperature'], `Tax ${v.temperature} °C: febre`, 'Investigar foco e sintomas associados à febre e definir conduta conforme avaliação clínica')
  }
  const labs = visit.lab_results
  if (adult && labs) {
    const diabetic = visit.conditions.includes('Diabético')
    const target = labs.ldl_target
    if (labs.ldl != null && (target != null ? labs.ldl >= target : diabetic ? labs.ldl >= 100 : labs.ldl > 130)) {
      const threshold = target != null ? `atinge ou supera a meta registrada de <${formatLabNumber(target)} mg/dL`
        : diabetic ? 'atinge ou supera 100 mg/dL na triagem do diabetes' : 'acima de 130 mg/dL na triagem'
      add('lab_ldl', ['ldl'], `LDL ${formatLabNumber(labs.ldl)} mg/dL: ${threshold}`,
        'Reavaliar o perfil lipídico, a meta individual e o risco cardiovascular, reforçar medidas alimentares e considerar indicação ou ajuste de estatina')
    }
    if (diabetic && labs.hba1c != null && labs.hba1c >= 7)
      add('lab_hba1c', ['hba1c'], `HbA1c ${formatLabNumber(labs.hba1c)}%: atinge ou supera 7% na triagem do diabetes`,
        'Revisar a meta individual de HbA1c, adesão, hipoglicemias e necessidade de ajuste após avaliação clínica')
    if (labs.creatinina != null && labs.creatinina > 1.3)
      add('lab_creatinine', ['creatinina'], `Cr ${formatLabNumber(labs.creatinina)} mg/dL: acima de 1,3 mg/dL na triagem`,
        'Comparar a creatinina com resultados anteriores, revisar a TFGe e avaliar a necessidade de confirmação no contexto clínico')
    if (labs.tsh != null && (labs.tsh < 0.4 || labs.tsh > 4.5))
      add('lab_tsh', ['tsh'], `TSH ${formatLabNumber(labs.tsh)} mUI/L: fora da faixa de triagem de 0,4 a 4,5 mUI/L`,
        'Conferir o intervalo de referência do laboratório e interpretar o TSH junto ao T4 livre e ao quadro clínico')
    if (labs.psa != null && labs.psa > 4)
      add('lab_psa', ['psa'], `PSA ${formatLabNumber(labs.psa)} ng/mL: acima de 4 ng/mL na triagem`,
        'Contextualizar o PSA conforme idade, histórico e fatores transitórios e considerar repetir o exame antes de investigação adicional')
    if (labs.hb != null && labs.hb < 12)
      add('lab_hb', ['hb'], `Hb ${formatLabNumber(labs.hb)} g/dL: abaixo de 12 g/dL na triagem`,
        'Revisar o hemograma e a referência aplicável, comparar resultados anteriores e avaliar a causa da hemoglobina baixa')
  }
  const m = visit.neuro_exam?.mini_mental
  if (m?.score != null && mentalCutoff(m) !== null && m.score < mentalCutoff(m)!) add('cognition', [], `MEEM ${m.score}/30: ${cognitiveInterpretation(m)}`, 'Considerar avaliação cognitiva ampliada, comparar com desempenho prévio e investigar causas reversíveis; rastreio isolado não estabelece declínio ou demência')
  return alerts
}
