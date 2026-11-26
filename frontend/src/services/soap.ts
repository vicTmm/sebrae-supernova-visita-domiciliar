import { residentDescription, residentRelationships } from '../types/visit'
import { preventiveHistory } from './screenings'
import { evaluateClinical, cognitiveInterpretation, type ClinicalAlert } from './clinicalRules'
import { neuroFlags, geriatricFlags, cognitiveDomains, miniMentalDomains, miniMentalTotal, conditionsForSex, type Visit, type Vitals, type SOAPOutput } from '../types/visit'
import { completeIvcfAnswers, ivcfAgeBand, ivcfComorbidities, ivcfFollowUp, ivcfScore, ivcfStratum } from '../types/ivcf20'
import { formatLabNumber, labFields, validateLabResults, type LabResults } from '../types/labResults'
export const stripSoapPrefix = (s: string) => s.replace(/^\s*(?:[SOAP]\s*:\s*)+/i, '')
const clean = (s: string) => s.replace(/[*_`#~]/g, '').replace(/\s+/g, ' ').trim()
const planTopics = (s: string) => s.split(/\r?\n/).map(line => clean(line.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1'))
  .replace(/^(?:(?:P|Plano)\s*:\s*|[-–—•]+\s+|\d+[.)]\s+)+/i, ''))
  .filter(Boolean).map(topic => /[.!?]$/.test(topic) ? topic : topic + '.')
export function generalVisitError(v: Visit): string | null {
  if (v.sex === 'Masculino') {
    const available = conditionsForSex(v.sex)
    if (v.conditions.some(condition => !available.includes(condition))) return 'Confira o sexo e as condições obstétricas selecionadas.'
  }
  const h = v.household
  if ((h?.cohabitants.trim() || h?.residents?.length) && h.living_arrangement !== 'with_others') return 'Informe que mora com outras pessoas para descrever os moradores.'
  if (h && [h.caregiver_name, h.caregiver_relationship, h.caregiver_notes].some(s => s.trim()) && h.caregiver_status !== 'yes') return 'Informe a presença de cuidador para descrever os cuidados.'
  if (h?.residents) {
    if (h.residents.length > 10 || new Set(h.residents.map(g => g.id)).size !== h.residents.length) return 'Confira os grupos de moradores.'
    for (const g of h.residents) {
      if (!residentRelationships.some(r => r.value === g.relationship) || !Number.isInteger(g.count) || g.count < 1 || g.count > 20) return 'Selecione o vínculo e uma quantidade de 1 a 20 para cada grupo.'
      if (g.relationship === 'other' ? !g.other_relationship.trim() : Boolean(g.other_relationship.trim())) return 'Confira a descrição do outro vínculo.'
      if (g.other_relationship.length > 100 || g.members.length > g.count) return 'Confira a quantidade e os detalhes dos moradores.'
      for (const person of g.members) {
        if (person.name.length > 120 || (person.phone && (!person.name.trim() || !/^[1-9][0-9]{9,10}$/.test(person.phone)))) return 'Informe o nome do contato e um telefone com DDD (10 ou 11 dígitos).'
      }
    }
  }
  const c = v.companions
  if (c.is_solo && (c.has_acs || c.has_student || c.has_nurse)) return 'Apenas Médico não pode ser combinado com acompanhantes.'
  if ((c.acs_name?.trim() && !c.has_acs) || (c.student_name?.trim() && !c.has_student) || (c.nurse_name?.trim() && !c.has_nurse)) return 'Selecione o acompanhante correspondente ao nome informado.'
  if (v.other_condition?.trim() && !v.conditions.includes('Outra')) return 'Selecione Outra para descrever a condição acompanhada.'
  return null
}
export function clinicalRuleError(v: Visit): string | null {
  const generalError = generalVisitError(v)
  if (generalError) return generalError
  const labError = v.lab_results && validateLabResults(v.lab_results)
  if (labError) return labError
  if (v.womens_health && v.sex !== 'Feminino') return 'Saúde da Mulher exige sexo Feminino selecionado.'
  if (v.womens_health) for (const exam of Object.values(v.womens_health)) {
    if (exam.year !== null && (!Number.isInteger(exam.year) || exam.year < 1900 || exam.year > new Date().getFullYear() || exam.status === 'Nunca realizou')) return 'Confira o ano do último exame e o histórico de realização.'
  }
  const screening = v.neuro_exam?.geriatric_screening
  if (screening && (new Set(screening.flags).size !== screening.flags.length || screening.flags.some(f => !geriatricFlags.includes(f)))) return 'Confira os marcadores geriátricos selecionados.'
  const n = v.neuro_exam
  const ivcf = n?.ivcf20
  if (ivcf) {
    if (ivcf.age_band !== ivcfAgeBand(v.age)) return 'Confira a faixa etária do IVCF-20. Corrija a idade ou revise a avaliação.'
    if (!completeIvcfAnswers(ivcf.answers) || ivcf.comorbidities.some(reason => !ivcfComorbidities.some(item => item.key === reason))
      || new Set(ivcf.comorbidities).size !== ivcf.comorbidities.length || ivcfScore(ivcf.age_band, ivcf.answers, ivcf.comorbidities) !== ivcf.score)
      return 'Confira as respostas e a pontuação do IVCF-20.'
  }
  if (Object.keys(v.intercurrence_details).some(key => key === 'Sem intercorrências' || !v.complaints.includes(key as Visit['complaints'][number]))) return 'Cada detalhe exige a queixa correspondente selecionada.'
  const target = v.bp_target
  if (target && (target.systolic === null || target.diastolic === null || !Number.isInteger(target.systolic) || !Number.isInteger(target.diastolic) || target.systolic < 80 || target.systolic > 180 || target.diastolic < 40 || target.diastolic > 110 || target.systolic <= target.diastolic)) return 'Preencha as duas metas de PA ou deixe ambas vazias.'
  if (n?.mini_mental) {
    const m = n.mini_mental
    if (m.score === null || !Number.isInteger(m.score) || m.score < 0 || m.score > 30) return 'Mini-Mental: informe a pontuação de 0 a 30 ou limpe o registro.'
    if (m.education_level && m.education_years !== null && m.education_level !== (m.education_years === 0 ? 'none' : m.education_years <= 4 ? '1_4' : m.education_years <= 8 ? '5_8' : 'over_8')) return 'Faixa de escolaridade diverge dos anos completos informados.'
    if (m.domains && (miniMentalTotal(m.domains) === null || miniMentalTotal(m.domains) !== m.score || cognitiveDomains.some(f => m.domains![f.key] === null))) return 'MEEM: preencha os seis domínios para calcular o total, ou marque Não avaliado.'
    const items = m.items
    if (items) {
      const validMethod = m.attention_method === 'serial_sevens' || m.attention_method === 'mundo_reverse'
      const validItems = cognitiveDomains.every(({ key, max }) => Array.isArray(items[key]) && items[key].length === max && items[key].every(marked => typeof marked === 'boolean'))
      if (!validMethod || !validItems) return 'Confira os acertos e o método de atenção do MEEM.'
      const counted = miniMentalDomains(items)
      if (cognitiveDomains.some(({ key }) => m.domains?.[key] !== counted[key])) return 'Confira se os acertos correspondem à pontuação do MEEM.'
    } else if (m.attention_method) return 'O método de atenção exige o MEEM preenchido item a item.'
    if (m.education_years !== null && (!Number.isInteger(m.education_years) || m.education_years < 0 || m.education_years > 40)) return 'Confira os anos completos de escolaridade.'
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
  if (n.rankin !== null) parts.push(`Rankin modificado ${n.rankin}`)
  parts.push(...n.directed_flags.map(f => f === neuroFlags[0].value ? 'LOTE' : f === neuroFlags[1].value ? 'PIFR' : f))
  if (n.neuro_notes?.trim()) parts.push(n.neuro_notes.trim())
  return parts.length ? `Exame neurológico: ${parts.join(', ')}` : ''
}
const paragraph = (parts: string[]) => parts.filter(s => clean(s)).map(s => clean(s).replace(/[.\s]+$/, '')).join('. ') + '.'
const joined = (parts: string[]) => parts.length < 2 ? parts.join('') : `${parts.slice(0, -1).join(', ')} e ${parts.at(-1)}`
function laboratoryText(results: LabResults | null | undefined): string {
  if (!results) return ''
  const values: string[] = []
  for (const field of labFields) {
    const value = results[field.key]
    if (!field.short || value == null) continue
    if ('unit' in field && typeof value === 'number') {
      const separator = field.unit === '%' ? '' : ' '
      values.push(`${field.short} ${formatLabNumber(value)}${separator}${field.unit}`)
    } else if (typeof value === 'string') {
      const text = clean(value.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1'))
      if (text) values.push(`${field.short}: ${text}`)
    }
  }
  if (!values.length) return ''
  const date = results.exam_date ? ` (${results.exam_date.split('-').reverse().join('/')})` : ''
  return `Exames laboratoriais externos${date}: ${values.join(' | ')}`
}
export const vitalUnits: Record<string, string> = { PAS: 'mmHg', PAD: 'mmHg', SatO2: '', FC: 'bpm', FR: 'irpm', Tax: '', HGT: 'mg/dL' }
const vitalOutputFields = [['systolic', 'PAS', ''], ['diastolic', 'PAD', ''], ['oxygen_saturation', 'SatO2', '%'], ['heart_rate', 'FC', ''], ['respiratory_rate', 'FR', ''], ['temperature', 'Tax', ' °C'], ['glucose', 'HGT', '']] as const
export function formattedVitals(v: Visit): Record<string, string> {
  return Object.fromEntries(vitalOutputFields.filter(([key]) => v.vitals[key] !== null).map(([key, label, unit]) => [label, String(v.vitals[key]).replace('.', ',') + unit]))
}
export function assembleFullText(result: Omit<SOAPOutput, 'full_text_fallback'>): string {
  const values = Object.entries(result.vitals_formatted).map(([key, val]) => `${key} ${val}${vitalUnits[key] ? ` ${vitalUnits[key]}` : ''}`).join(', ')
  const objective = [values ? `Sinais vitais: ${values}.` : '', result.vitals_context, result.objective_text].filter(Boolean).join(' ')
  const plan = result.plan_text.startsWith('- ') ? `P:\n${result.plan_text}` : `P: ${result.plan_text}`
  return [`S: ${result.subjective_text}`, `O: ${objective}`, ...(result.assessment_text?.trim() ? [`A: ${result.assessment_text}`] : []), plan].join('\n')
}
export function withSoapEdits(result: SOAPOutput, edits: Partial<SOAPOutput>): SOAPOutput {
  const next = { ...result, ...edits }
  next.subjective_text = stripSoapPrefix(next.subjective_text)
  next.objective_text = stripSoapPrefix(next.objective_text)
  next.plan_text = stripSoapPrefix(next.plan_text)
  next.assessment_text = next.assessment_text ? stripSoapPrefix(next.assessment_text) || null : null
  return { ...next, full_text_fallback: assembleFullText(next) }
}
export function normalizeSoapBlocks(result: SOAPOutput): SOAPOutput {
  return [result.subjective_text, result.objective_text, result.plan_text, result.assessment_text ?? ''].some(s => stripSoapPrefix(s) !== s) ? withSoapEdits(result, {}) : result
}

const observationText = (alerts: ClinicalAlert[]) => {
  const observations = alerts.filter(alert => alert.code !== 'cognition').map(alert => alert.observation)
  return observations.length ? `Parâmetros para revisão clínica: ${paragraph(observations)}` : ''
}
const suggestionTopic = (suggestion: string) => `Sugestão para revisão médica: ${suggestion}.`

export function updateSoapVitals(visit: Visit, result: SOAPOutput, vitals: Vitals): { visit: Visit; result: SOAPOutput; needsReview: boolean } {
  const changed = vitalOutputFields.filter(([key]) => visit.vitals[key] !== vitals[key])
  if (!changed.length) return { visit, result, needsReview: false }

  const nextVisit = { ...visit, vitals }
  const previousValues = formattedVitals(visit)
  const nextValues = formattedVitals(nextVisit)
  const values = { ...result.vitals_formatted }
  let needsReview = changed.some(([, label]) => previousValues[label] !== values[label])
  for (const [, label] of changed) {
    if (label in nextValues) values[label] = nextValues[label]
    else delete values[label]
  }
  const vitalsFormatted = Object.fromEntries(vitalOutputFields.flatMap(([, label]) => label in values ? [[label, values[label]]] : []))
  for (const [label, value] of Object.entries(values)) if (!Object.hasOwn(vitalsFormatted, label)) vitalsFormatted[label] = value

  const before = evaluateClinical(visit)
  const after = evaluateClinical(nextVisit)
  const oldObservations = observationText(before)
  const newObservations = observationText(after)
  let objective = result.objective_text
  if (oldObservations !== newObservations) {
    const start = oldObservations ? objective.indexOf(oldObservations) : -1
    if (start >= 0) {
      const prefixEnd = !newObservations && objective[start - 1] === ' ' ? start - 1 : start
      objective = objective.slice(0, prefixEnd) + newObservations + objective.slice(start + oldObservations.length)
    } else {
      const removed = before.filter(alert => alert.code !== 'cognition' && !after.some(next => next.observation === alert.observation))
      for (const alert of removed) {
        const standalone = observationText([alert])
        if (objective.includes(standalone)) {
          const index = objective.indexOf(standalone)
          const prefixEnd = objective[index - 1] === ' ' ? index - 1 : index
          objective = objective.slice(0, prefixEnd) + objective.slice(index + standalone.length)
        } else needsReview = true
      }
      const added = after.filter(alert => !before.some(previous => previous.observation === alert.observation) && !objective.includes(alert.observation))
      objective = [objective, ...added.map(alert => observationText([alert]))].filter(Boolean).join(' ')
    }
  }

  const oldSuggestions = new Set(before.map(alert => alert.suggestion))
  const newSuggestions = new Set(after.map(alert => alert.suggestion))
  const removedTopics = [...oldSuggestions].filter(text => !newSuggestions.has(text)).map(text => '- ' + suggestionTopic(text))
  const addedTopics = [...newSuggestions].filter(text => !oldSuggestions.has(text)).map(text => '- ' + suggestionTopic(text))
  let plan = result.plan_text
  if (removedTopics.length || addedTopics.length) {
    const lines = plan.split(/\r?\n/)
    if (removedTopics.some(topic => !lines.some(line => line.trim() === topic))) needsReview = true
    plan = lines.filter(line => !removedTopics.includes(line.trim())).join('\n')
    const missingTopics = addedTopics.filter(topic => !lines.some(line => line.trim() === topic))
    if (missingTopics.length) plan = [plan, ...missingTopics].filter(Boolean).join('\n')
  }

  return {
    visit: nextVisit,
    result: withSoapEdits(result, { vitals_formatted: vitalsFormatted, objective_text: objective, plan_text: plan }),
    needsReview,
  }
}
export function householdFacts(v: Visit): string[] {
  const h = v.household
  if (!h) return []
  const care: string[] = []
  if (h.caregiver_status === 'no') care.push('Relata não possuir cuidador de referência')
  else if (h.caregiver_status === 'yes') {
    care.push(`Cuidador de referência${h.caregiver_name.trim() ? `: ${h.caregiver_name.trim()}` : ' informado'}${h.caregiver_relationship.trim() ? ` (vínculo: ${h.caregiver_relationship.trim()})` : ''}`)
    if (h.caregiver_notes.trim()) care.push(`Sobre os cuidados: ${h.caregiver_notes.trim()}`)
  }
  const residence = h.living_arrangement === 'alone' ? 'Relata morar sozinho(a)' : h.living_arrangement === 'with_others' ? ((h.residents?.length || h.cohabitants.trim()) ? `Reside com ${[h.residents?.map(residentDescription).join(', '), h.cohabitants.trim()].filter(Boolean).join('; relato complementar: ')}` : 'Relata morar com outras pessoas') : ''
  return [...care, residence].filter(Boolean)
}
export function localSoapOutput(v: Visit): SOAPOutput {
  const error = clinicalRuleError(v)
  if (error) throw new Error(error)
  const complaintLabels = { Dor: 'dor', Dispneia: 'dispneia', Febre: 'febre', Tontura: 'tontura', Queda: 'queda', 'Ida à UPA/Emergência': 'ida à UPA/emergência', 'Internação hospitalar': 'internação hospitalar', 'Sem intercorrências': '' }
  const timeline = v.complaints.includes('Sem intercorrências') ? 'Não foram relatadas intercorrências' : v.complaints.length ? `Houve relato de ${joined(v.complaints.map(c => complaintLabels[c]))}` : ''
  const adherence = { Regular: 'Refere uso regular das medicações', Irregular: 'Refere uso irregular das medicações', 'Não faz uso': 'Refere não fazer uso de medicações', 'Não informado': '' }
  const screening = v.neuro_exam?.geriatric_screening
  const screeningFacts = screening ? [screening.flags.length ? `No rastreio geriátrico, foram assinalados ${joined(screening.flags.map(f => f.toLowerCase()))}` : '', screening.notes] : []
  const s = paragraph([subjectiveOpening(v), v.visit_reason?.trim() ? `Motivo do atendimento: ${v.visit_reason.trim()}` : '', ...householdFacts(v), v.other_condition?.trim() ? `Em acompanhamento por ${v.other_condition.trim()}` : '', timeline, ...Object.entries(v.intercurrence_details).filter(([, value]) => value?.trim()).map(([key, value]) => `Quanto a ${key.toLowerCase()}: ${value}`), v.subjective_notes, v.recent_medications?.trim() ? `No período recente, utilizou ${v.recent_medications.trim()}` : '', v.medications_in_use.trim() ? `Atualmente, está em uso contínuo de ${v.medications_in_use.trim()}` : '', adherence[v.adherence], ...preventiveHistory(v), ...screeningFacts])
  const physical: string[] = []
  for (const [key, label] of [['general', 'Estado geral e hidratação'], ['cardiovascular', 'Ausculta cardíaca'], ['respiratory', 'Ausculta pulmonar']] as const) {
    const f = v.exam[key]
    if (f.status === 'Alterado') physical.push(`${key === 'cardiovascular' ? 'Exame cardiovascular' : key === 'respiratory' ? 'Exame respiratório' : label}: ${f.notes}`)
    else if (f.status === 'Sem alterações') physical.push(`${label} sem alterações ao exame`)
  }
  const neuro = neurologicalText(v)
  if (neuro) physical.push(neuro)
  const ivcf = v.neuro_exam?.ivcf20
  if (ivcf) physical.push(`IVCF-20: ${ivcf.score}/40 — ${ivcfStratum(ivcf.score)}${ivcf.comorbidities.includes('polypharmacy') ? '; critério de polifarmácia assinalado' : ''}`)
  if (v.exam.abdomen.status === 'Alterado') physical.push(`Exame abdominal: ${v.exam.abdomen.notes}`)
  else if (v.exam.abdomen.status === 'Sem alterações') physical.push('Exame abdominal sem alterações ao exame')
  const actionText = { 'Manutenção de receita': 'Mantenho a receita em uso', 'Ajuste medicamentoso': 'Ajusto a medicação', 'Solicitação de exames': 'Solicito exames', 'Encaminhamento especialista': 'Encaminho para avaliação especializada', 'Agendamento de retorno VD': 'Indico retorno em visita domiciliar', 'Orientações gerais': 'Forneço orientações gerais' }
  const alerts = evaluateClinical(v)
  const suggestions = [...new Set(alerts.map(a => a.suggestion))]
  if (ivcf && (ivcf.score >= 15 || ivcf.comorbidities.includes('polypharmacy'))) suggestions.push(ivcfFollowUp)
  const labs = laboratoryText(v.lab_results)
  const objective = [
    physical.length ? paragraph(physical) : 'Exame físico não registrado.',
    labs ? paragraph([labs]) : '',
    observationText(alerts),
  ].filter(Boolean).join(' ')
  const topics = planTopics([...v.actions.map(action => actionText[action]), v.plan_notes, v.follow_up_owner?.trim() ? `Responsável pelo seguimento: ${v.follow_up_owner.trim()}` : ''].join('\n'))
  if (!topics.length) topics.push('Conduta não registrada.')
  for (const suggestion of suggestions) {
    const topic = suggestionTopic(suggestion)
    if (!topics.includes(topic)) topics.push(topic)
  }
  const result = { subjective_text: s, objective_text: objective, vitals_formatted: formattedVitals(v), plan_text: topics.map(topic => `- ${topic}`).join('\n'), assessment_text: clean(v.assessment) || null, vitals_context: clean(v.vitals_context), source: 'deterministic' }
  result.subjective_text = stripSoapPrefix(result.subjective_text)
  result.objective_text = stripSoapPrefix(result.objective_text)
  result.assessment_text = result.assessment_text ? stripSoapPrefix(result.assessment_text) || null : null
  return { ...result, full_text_fallback: assembleFullText(result) }
}
export const localSoap = (v: Visit): string => localSoapOutput(v).full_text_fallback

export function restoreSoap(v: Visit, text: string, blocks?: SOAPOutput | null): SOAPOutput {
  if (blocks && blocks.full_text_fallback === text) return normalizeSoapBlocks(blocks)
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
  return normalizeSoapBlocks({ subjective_text: sections.S ?? text, objective_text: objective, vitals_formatted: confirmedVitals, plan_text: sections.P ?? '', assessment_text: sections.A || null, vitals_context: v.vitals_context, full_text_fallback: text, source: 'legacy' })
}
