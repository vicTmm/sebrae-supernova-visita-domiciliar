import { evaluateClinical, cognitiveInterpretation } from './clinicalRules'
import { neuroFlags, glasgowTotal, cognitiveDomains, miniMentalTotal, type Visit, type SOAPOutput } from '../types/visit'
const clean = (s: string) => s.replace(/[*_`#~]/g, '').replace(/\s+/g, ' ').trim()
export function clinicalRuleError(v: Visit): string | null {
  const c = v.companions
  if (c.is_solo && (c.has_acs || c.has_student || c.has_nurse)) return 'Apenas Médico não pode ser combinado com acompanhantes.'
  if ((c.acs_name?.trim() && !c.has_acs) || (c.student_name?.trim() && !c.has_student) || (c.nurse_name?.trim() && !c.has_nurse)) return 'Selecione o acompanhante correspondente ao nome informado.'
  if (v.other_condition?.trim() && !v.conditions.includes('Outra')) return 'Selecione Outra para descrever a condição acompanhada.'
  const n = v.neuro_exam
  if (Object.keys(v.intercurrence_details).some(key => key === 'Sem intercorrências' || !v.complaints.includes(key as Visit['complaints'][number]))) return 'Cada detalhe exige a queixa correspondente selecionada.'
  const target = v.bp_target
  if (target && (target.systolic === null || target.diastolic === null || !Number.isInteger(target.systolic) || !Number.isInteger(target.diastolic) || target.systolic < 80 || target.systolic > 180 || target.diastolic < 40 || target.diastolic > 110 || target.systolic <= target.diastolic)) return 'Preencha as duas metas de PA ou deixe ambas vazias.'
  if (n?.mini_mental) {
    const m = n.mini_mental
    if (m.score === null || !Number.isInteger(m.score) || m.score < 0 || m.score > 30) return 'Mini-Mental: informe a pontuação de 0 a 30 ou limpe o registro.'
    if (m.education_level && m.education_years !== null && m.education_level !== (m.education_years === 0 ? 'none' : m.education_years <= 4 ? '1_4' : m.education_years <= 8 ? '5_8' : 'over_8')) return 'Faixa de escolaridade diverge dos anos completos informados.'
    if (m.domains && (miniMentalTotal(m.domains) === null || miniMentalTotal(m.domains) !== m.score || cognitiveDomains.some(f => m.domains![f.key] === null))) return 'MEEM: preencha os seis domínios para calcular o total, ou marque Não avaliado.'
    if (m.education_years !== null && (!Number.isInteger(m.education_years) || m.education_years < 0 || m.education_years > 40)) return 'Confira os anos completos de escolaridade.'
  }
  if (n?.glasgow) {
    const g = n.glasgow
    if (g.eye === null || g.verbal === null || g.motor === null || !Number.isInteger(g.eye) || !Number.isInteger(g.verbal) || !Number.isInteger(g.motor) || g.eye < 1 || g.eye > 4 || g.verbal < 1 || g.verbal > 5 || g.motor < 1 || g.motor > 6 || g.total !== glasgowTotal(g)) return 'Glasgow: preencha os três componentes corretamente ou remova o registro legado de Glasgow.'
  }
  if (n?.rankin != null && (!Number.isInteger(n.rankin) || n.rankin < 0 || n.rankin > 5)) return 'Rankin deve ser um número inteiro de 0 a 5.'
  if (n?.directed_flags.includes(neuroFlags[2].value) && n.directed_flags.includes(neuroFlags[3].value)) return 'Força preservada e déficit motor focal não podem ser selecionados juntos.'
  return null
}
export function subjectiveOpening(v: Visit): string {
  const c = v.companions
  const team = [c.has_acs && (c.acs_name?.trim() ? `da ACS ${c.acs_name.trim()}` : 'de ACS (nome não informado)'), c.has_student && (c.student_name?.trim() ? `do estudante ${c.student_name.trim()}` : 'de estudante (nome não informado)'), c.has_nurse && (c.nurse_name?.trim() ? `de enfermeiro(a)/técnico(a) ${c.nurse_name.trim()}` : 'de enfermeiro(a)/técnico(a)')].filter(Boolean) as string[]
  if (team.length) return `Realizada visita domiciliar acompanhado(a) ${team.length < 3 ? team.join(' e ') : `${team.slice(0, -1).join(', ')} e ${team.at(-1)}`}.`
  return c.is_solo ? 'Realizada visita domiciliar sem acompanhantes da equipe.' : 'Realizada visita domiciliar. Acompanhantes da equipe não informados.'
}
export function neurologicalText(v: Visit): string {
  const n = v.neuro_exam
  if (!n) return ''
  const parts: string[] = []
  if (n.mini_mental?.score != null) {
    const m = n.mini_mental
    parts.push(`Mini-Mental (MEEM) ${m.score}/30${m.education_level ? ` (escolaridade: ${{ none: 'analfabeto / 0 anos', '1_4': '1–4 anos', '5_8': '5–8 anos', over_8: 'mais de 8 anos' }[m.education_level]})` : m.education_years !== null ? ` (escolaridade: ${m.education_years} anos completos)` : ''}; ${cognitiveInterpretation(m)}`)
    if (m.notes.trim()) parts.push(m.notes.trim())
  }
  if (n.glasgow?.total != null) { const g = n.glasgow; parts.push(`Glasgow ${g.total}/15 (O${g.eye} V${g.verbal} M${g.motor})`) }
  if (n.rankin !== null) parts.push(`Rankin modificado ${n.rankin}`)
  parts.push(...n.directed_flags.map(f => f === neuroFlags[0].value ? 'LOTE' : f === neuroFlags[1].value ? 'PIFR' : f))
  if (n.neuro_notes?.trim()) parts.push(n.neuro_notes.trim())
  return parts.length ? `Exame neurológico: ${parts.join(', ')}` : ''
}
const paragraph = (parts: string[]) => parts.filter(s => clean(s)).map(s => clean(s).replace(/[.\s]+$/, '')).join('. ') + '.'
const joined = (parts: string[]) => parts.length < 2 ? parts.join('') : `${parts.slice(0, -1).join(', ')} e ${parts.at(-1)}`
export const vitalUnits: Record<string, string> = { PAS: 'mmHg', PAD: 'mmHg', SatO2: '', FC: 'bpm', FR: 'irpm', Tax: '', HGT: 'mg/dL' }
export function formattedVitals(v: Visit): Record<string, string> {
  const fields = [['systolic', 'PAS', ''], ['diastolic', 'PAD', ''], ['oxygen_saturation', 'SatO2', '%'], ['heart_rate', 'FC', ''], ['respiratory_rate', 'FR', ''], ['temperature', 'Tax', ' °C'], ['glucose', 'HGT', '']] as const
  return Object.fromEntries(fields.filter(([key]) => v.vitals[key] !== null).map(([key, label, unit]) => [label, String(v.vitals[key]).replace('.', ',') + unit]))
}
export function assembleFullText(result: Omit<SOAPOutput, 'full_text_fallback'>): string {
  const values = Object.entries(result.vitals_formatted).map(([key, val]) => `${key} ${val}${vitalUnits[key] ? ` ${vitalUnits[key]}` : ''}`).join(', ')
  const objective = [values ? `Sinais vitais: ${values}.` : '', result.vitals_context, result.objective_text].filter(Boolean).join(' ')
  return [`S: ${result.subjective_text}`, `O: ${objective}`, ...(result.assessment_text?.trim() ? [`A: ${result.assessment_text}`] : []), `P: ${result.plan_text}`].join('\n')
}
export function withSoapEdits(result: SOAPOutput, edits: Partial<SOAPOutput>): SOAPOutput {
  const next = { ...result, ...edits }
  return { ...next, full_text_fallback: assembleFullText(next) }
}
export function localSoapOutput(v: Visit): SOAPOutput {
  const error = clinicalRuleError(v)
  if (error) throw new Error(error)
  const complaintLabels = { Dor: 'dor', Dispneia: 'dispneia', Febre: 'febre', Tontura: 'tontura', Queda: 'queda', 'Ida à UPA/Emergência': 'ida à UPA/emergência', 'Internação hospitalar': 'internação hospitalar', 'Sem intercorrências': '' }
  const timeline = v.complaints.includes('Sem intercorrências') ? 'Desde a última visita domiciliar, não foram relatadas intercorrências' : v.complaints.length ? `Desde a última visita domiciliar, houve relato de ${joined(v.complaints.map(c => complaintLabels[c]))}` : 'Não foi informado como transcorreu o período desde a última visita domiciliar'
  const adherence = { Regular: 'Refere uso regular das medicações', Irregular: 'Refere uso irregular das medicações', 'Não faz uso': 'Refere não fazer uso de medicações', 'Não informado': '' }
  const s = paragraph([subjectiveOpening(v), v.other_condition?.trim() ? `Em acompanhamento por ${v.other_condition.trim()}` : '', timeline, ...Object.entries(v.intercurrence_details).filter(([, value]) => value?.trim()).map(([key, value]) => `Quanto a ${key.toLowerCase()}: ${value}`), v.subjective_notes, v.recent_medications?.trim() ? `No período recente, utilizou ${v.recent_medications.trim()}` : '', v.medications_in_use.trim() ? `Atualmente, está em uso contínuo de ${v.medications_in_use.trim()}` : '', adherence[v.adherence]])
  const physical: string[] = []
  for (const [key, label] of [['general', 'Estado geral e hidratação'], ['cardiovascular', 'Ausculta cardíaca'], ['respiratory', 'Ausculta pulmonar']] as const) {
    const f = v.exam[key]
    if (f.status === 'Alterado') physical.push(`${key === 'cardiovascular' ? 'Exame cardiovascular' : key === 'respiratory' ? 'Exame respiratório' : label}: ${f.notes}`)
    else if (f.status === 'Sem alterações') physical.push(`${label} sem alterações ao exame`)
  }
  const neuro = neurologicalText(v)
  if (neuro) physical.push(neuro)
  if (v.exam.abdomen.status === 'Alterado') physical.push(`Exame abdominal: ${v.exam.abdomen.notes}`)
  else if (v.exam.abdomen.status === 'Sem alterações') physical.push('Exame abdominal sem alterações ao exame')
  const actionText = { 'Manutenção de receita': 'Mantida a receita em uso', 'Ajuste medicamentoso': 'Realizado ajuste medicamentoso', 'Solicitação de exames': 'Solicitados exames', 'Encaminhamento especialista': 'Definido encaminhamento para especialista', 'Agendamento de retorno VD': 'Programado retorno para visita domiciliar', 'Orientações gerais': 'Fornecidas orientações gerais' }
  const alerts = evaluateClinical(v)
  const observations = alerts.filter(a => a.code !== 'cognition').map(a => a.observation)
  const suggestions = [...new Set(alerts.map(a => a.suggestion))]
  const objective = (physical.length ? paragraph(physical) : 'Exame físico não registrado.') + (observations.length ? ` Parâmetros para revisão clínica: ${paragraph(observations)}` : '')
  const result = { subjective_text: s, objective_text: objective, vitals_formatted: formattedVitals(v), plan_text: v.actions.length || v.plan_notes.trim() ? paragraph([joined(v.actions.map((a, i) => i === 0 ? actionText[a] : actionText[a].toLowerCase())), v.plan_notes]) : 'Conduta não registrada.', assessment_text: clean(v.assessment) || null, vitals_context: clean(v.vitals_context), source: 'deterministic' }
  if (suggestions.length) result.plan_text += ` Sugestões para revisão médica: ${paragraph(suggestions)}`
  return { ...result, full_text_fallback: assembleFullText(result) }
}
export const localSoap = (v: Visit): string => localSoapOutput(v).full_text_fallback

export function restoreSoap(v: Visit, text: string, blocks?: SOAPOutput | null): SOAPOutput {
  if (blocks && blocks.full_text_fallback === text) return blocks
  const sections: Record<string, string> = {}
  const matches = [...text.matchAll(/^(S|O|A|P):[ \t]*/gm)]
  matches.forEach((m, i) => { sections[m[1]] = text.slice(m.index! + m[0].length, matches[i + 1]?.index ?? text.length).trim() })
  const originalObjective = sections.O ?? ''
  let objective = originalObjective
  // Medidas antigas podem ter sido editadas só no texto. Só as destacamos se
  // coincidirem com o dado estruturado, sem reintroduzir medidas apagadas.
  const values = formattedVitals(v)
  let confirmedVitals: Record<string, string> = {}
  const expectedPrefix = `Sinais vitais: ${Object.entries(values).map(([key, value]) => `${key} ${value}${vitalUnits[key] ? ` ${vitalUnits[key]}` : ''}`).join(', ')}.`
  if (Object.keys(values).length && objective.startsWith(expectedPrefix)) {
    confirmedVitals = values
    objective = objective.slice(expectedPrefix.length).trim()
  } else {
    const v0 = v.vitals
    const known: Record<string, string[]> = {}
    if (v0.systolic !== null && v0.diastolic !== null) known[`PA ${v0.systolic}/${v0.diastolic} mmHg`] = ['PAS', 'PAD']
    for (const [key, label, unit] of [['heart_rate', 'FC', 'bpm'], ['respiratory_rate', 'FR', 'irpm'], ['oxygen_saturation', 'SatO2', '%'], ['temperature', 'Tax', '°C'], ['glucose', 'HGT', 'mg/dL']] as const) if (v0[key] !== null) known[`${label} ${v0[key]} ${unit}`] = [label]
    const legacyVital = /^(PA [\d.,]+\/[\d.,]+ mmHg|FC [\d.,]+ bpm|FR [\d.,]+ irpm|SatO2 [\d.,]+\s*%|Tax [\d.,]+\s*°C|HGT [\d.,]+ mg\/dL|Sinais vitais não informados)(?:;\s*|\.\s*|$)/
    let match: RegExpMatchArray | null
    while ((match = objective.match(legacyVital))) {
      if (match[1] === 'Sinais vitais não informados' && !Object.keys(values).length) { objective = objective.slice(match[0].length); continue }
      const labels = known[match[1].replace(',', '.')]
      if (!labels) { confirmedVitals = {}; objective = originalObjective; break }
      for (const label of labels) confirmedVitals[label] = values[label]
      objective = objective.slice(match[0].length)
    }
  }
  if (v.vitals_context && objective.startsWith(v.vitals_context)) objective = objective.slice(v.vitals_context.length).trim()
  return { subjective_text: sections.S ?? text, objective_text: objective, vitals_formatted: confirmedVitals, plan_text: sections.P ?? '', assessment_text: sections.A || null, vitals_context: v.vitals_context, full_text_fallback: text, source: 'legacy' }
}
