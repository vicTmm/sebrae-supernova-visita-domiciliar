import type { Ivcf20 } from './ivcf20'
import type { LabResults } from './labResults'
export type { LabResults } from './labResults'

export const conditions = ['Acamado', 'Hipertenso', 'Diabético', 'DPOC/pneumopata', 'Gestante', 'Puérpera', 'Saúde Mental', 'Outra'] as const
const conditionSex: Partial<Record<Visit['conditions'][number], NonNullable<Visit['sex']>>> = {
  Gestante: 'Feminino',
  Puérpera: 'Feminino',
}

export function conditionsForSex(sex: Visit['sex']) {
  return conditions.filter(condition => !conditionSex[condition] || conditionSex[condition] === sex)
}

export function changeVisitSex(visit: Visit, sex: Visit['sex']): Visit {
  const available = conditionsForSex(sex)
  return {
    ...visit,
    sex,
    conditions: visit.conditions.filter(condition => available.includes(condition)),
    womens_health: sex === 'Feminino' ? visit.womens_health ?? null : null,
  }
}
export const complaints = ['Sem intercorrências', 'Dor', 'Dispneia', 'Febre', 'Tontura', 'Queda', 'Ida à UPA/Emergência', 'Internação hospitalar'] as const
export const actions = ['Manutenção de receita', 'Ajuste medicamentoso', 'Solicitação de exames', 'Encaminhamento especialista', 'Agendamento de retorno VD', 'Orientações gerais'] as const
export const examLabels = { cardiovascular: 'Aparelho cardiovascular (ACV)', respiratory: 'Aparelho respiratório (AR)', abdomen: 'Abdome', general: 'Estado geral / hidratação' }
export type ExamFinding = { status: 'Não avaliado' | 'Sem alterações' | 'Alterado'; notes: string }
export interface Vitals { systolic: number | null; diastolic: number | null; heart_rate: number | null; respiratory_rate: number | null; oxygen_saturation: number | null; temperature: number | null; glucose: number | null }
export interface Companions { has_acs: boolean; acs_name: string | null; has_student: boolean; student_name: string | null; has_nurse: boolean; nurse_name?: string | null; is_solo: boolean }
export const neuroFlags = [
  { value: 'Lúcido e orientado (LOTE)', label: 'LOTE' },
  { value: 'Pupilas isocóricas e fotorreagentes (PIFR)', label: 'PIFR' },
  { value: 'Força muscular preservada e simétrica', label: 'Força preservada' },
  { value: 'Déficit motor focal', label: 'Déficit motor focal' },
  { value: 'Disartria/Afasia', label: 'Alteração de fala' },
] as const
export type NeuroFlag = (typeof neuroFlags)[number]['value']
export const cognitiveDomains = [
  { key: 'temporal', label: 'Orientação temporal', max: 5 },
  { key: 'spatial', label: 'Orientação espacial', max: 5 },
  { key: 'registration', label: 'Memória imediata / Registro', max: 3 },
  { key: 'attention', label: 'Atenção e cálculo', max: 5 },
  { key: 'recall', label: 'Evocação / Memória recente', max: 3 },
  { key: 'language', label: 'Linguagem e praxia construtiva', max: 9 },
] as const
export type CognitiveDomains = Record<(typeof cognitiveDomains)[number]['key'], number | null>
export function miniMentalTotal(d: CognitiveDomains): number | null {
  return cognitiveDomains.every(f => d[f.key] !== null && Number.isInteger(d[f.key]) && d[f.key]! >= 0 && d[f.key]! <= f.max) ? Object.values(d).reduce<number>((sum, v) => sum + v!, 0) : null
}
export type MiniMentalItems = Record<keyof CognitiveDomains, boolean[]>
export type AttentionMethod = 'serial_sevens' | 'mundo_reverse'
export interface MiniMental { education_level?: 'none' | '1_4' | '5_8' | 'over_8' | null; domains?: CognitiveDomains | null; items?: MiniMentalItems | null; attention_method?: AttentionMethod | null; score: number | null; education_years: number | null; notes: string }
export function miniMentalDomains(items: MiniMentalItems): CognitiveDomains {
  return {
    temporal: items.temporal.filter(Boolean).length, spatial: items.spatial.filter(Boolean).length,
    registration: items.registration.filter(Boolean).length, attention: items.attention.filter(Boolean).length,
    recall: items.recall.filter(Boolean).length, language: items.language.filter(Boolean).length,
  }
}
export const geriatricFlags = ['Humor deprimido / desânimo frequente', 'Perda de interesse nas atividades', 'Queixa de esquecimento progressivo', 'Dependência para atividades básicas (AVDs)', 'Risco de queda / mobilidade reduzida'] as const
export type GeriatricFlag = (typeof geriatricFlags)[number]
export interface GeriatricScreening { flags: GeriatricFlag[]; notes: string }
export type ScreeningStatus = 'Em dia' | 'Atrasado / Solicitar' | 'Nunca realizou' | 'Não se aplica'
export interface PreventiveScreening { status: ScreeningStatus | null; year: number | null; notes: string }
export interface WomensHealth { cervical: PreventiveScreening; mammography: PreventiveScreening }
export const emptyWomensHealth = (): WomensHealth => ({ cervical: { status: null, year: null, notes: '' }, mammography: { status: null, year: null, notes: '' } })
export interface NeuroExam { mini_mental?: MiniMental | null; ivcf20?: Ivcf20 | null; geriatric_screening?: GeriatricScreening | null; rankin: number | null; directed_flags: NeuroFlag[]; neuro_notes: string | null }
export const emptyCompanions = (): Companions => ({ has_acs: false, acs_name: null, has_student: false, student_name: null, has_nurse: false, nurse_name: null, is_solo: false })
export const emptyNeuro = (): NeuroExam => ({ mini_mental: null, geriatric_screening: null, rankin: null, directed_flags: [], neuro_notes: null })
export const residentRelationships = [
  { value: 'spouse', label: 'Cônjuge / companheiro(a)', plural: 'cônjuges / companheiros(as)' },
  { value: 'child', label: 'Filho(a)', plural: 'filhos(as)' },
  { value: 'grandchild', label: 'Neto(a)', plural: 'netos(as)' },
  { value: 'parent', label: 'Pai / mãe', plural: 'pais / mães' },
  { value: 'sibling', label: 'Irmão / irmã', plural: 'irmãos / irmãs' },
  { value: 'other_relative', label: 'Outro familiar', plural: 'outros familiares' },
  { value: 'friend', label: 'Amigo(a)', plural: 'amigos(as)' },
  { value: 'housemate', label: 'Pessoa sem parentesco', plural: 'pessoas sem parentesco' },
  { value: 'caregiver', label: 'Cuidador(a) residente', plural: 'cuidadores(as) residentes' },
  { value: 'other', label: 'Outro vínculo', plural: 'outros vínculos' },
] as const
export interface ResidentPerson { name: string; phone: string }
export interface ResidentGroup {
  id: string; relationship: (typeof residentRelationships)[number]['value'] | ''; other_relationship: string
  count: number; members: ResidentPerson[]
}
export function residentDescription(group: ResidentGroup): string {
  const relation = residentRelationships.find(r => r.value === group.relationship)
  const label = group.relationship === 'other' ? group.other_relationship.trim() : group.count === 1 ? relation?.label.toLowerCase() : relation?.plural
  return `${group.count} ${label ?? 'pessoa(s)'}`
}
export interface Household {
  residents?: ResidentGroup[]
  living_arrangement: 'alone' | 'with_others' | null; cohabitants: string
  caregiver_status: 'yes' | 'no' | null; caregiver_name: string; caregiver_relationship: string; caregiver_notes: string
}
export const emptyHousehold = (): Household => ({ living_arrangement: null, cohabitants: '', caregiver_status: null, caregiver_name: '', caregiver_relationship: '', caregiver_notes: '' })
export interface Visit {
  household?: Household | null
  lab_results?: LabResults | null
  id: string; visited_at: string; patient_code: string; age: number; sex: 'Feminino' | 'Masculino' | null; womens_health?: WomensHealth | null;
  conditions: (typeof conditions)[number][]; other_condition?: string; complaints: (typeof complaints)[number][];
  adherence: 'Regular' | 'Irregular' | 'Não faz uso' | 'Não informado'; subjective_notes: string; intercurrence_details: Partial<Record<(typeof complaints)[number], string>>; bp_target?: { systolic: number | null; diastolic: number | null } | null; vitals_context: string;
  companions: Companions; medications_in_use: string; recent_medications: string | null; neuro_exam: NeuroExam | null;
  vitals: Vitals; exam: Record<keyof typeof examLabels, ExamFinding>; assessment: string;
  actions: (typeof actions)[number][]; plan_notes: string;
}
export interface SOAPOutput {
  subjective_text: string; objective_text: string; vitals_formatted: Record<string, string>;
  plan_text: string; assessment_text: string | null; vitals_context: string;
  full_text_fallback: string; source: string;
}
export interface ServerVisit { visit: Visit; soap_text: string; soap_blocks?: SOAPOutput | null; revision: number }
export interface LocalVisit extends ServerVisit { pending: boolean; localVersion: number; conflict?: ServerVisit }
export interface Draft { visit: Visit; soap: string; soap_blocks?: SOAPOutput | null; baseRevision: number; source: string }
export function upgradeVisit(v: Visit & { medications?: string }): Visit {
  const { medications, ...rest } = v
  const raw = v.intercurrence_details as unknown
  const selected = v.complaints.filter(c => c !== 'Sem intercorrências')
  const legacyDetails = raw === undefined && selected.length ? v.subjective_notes : typeof raw === 'string' ? raw : ''
  const details = typeof raw === 'object' && raw !== null ? raw as Visit['intercurrence_details'] : selected.length && legacyDetails ? { [selected[0]]: legacyDetails } : {}
  return { ...rest, household: v.household ?? null, sex: v.sex === 'Feminino' || v.sex === 'Masculino' ? v.sex : null, other_condition: v.other_condition ?? '', womens_health: v.womens_health ?? null, intercurrence_details: details, bp_target: v.bp_target ?? null, subjective_notes: raw === undefined && legacyDetails ? '' : v.subjective_notes, vitals_context: v.vitals_context ?? '', companions: { ...emptyCompanions(), ...v.companions }, medications_in_use: v.medications_in_use ?? medications ?? '', recent_medications: v.recent_medications ?? null, neuro_exam: v.neuro_exam ? { mini_mental: v.neuro_exam.mini_mental ?? null, ivcf20: v.neuro_exam.ivcf20 ?? null, geriatric_screening: v.neuro_exam.geriatric_screening ?? null, rankin: v.neuro_exam.rankin ?? null, directed_flags: v.neuro_exam.directed_flags ?? [], neuro_notes: v.neuro_exam.neuro_notes ?? null } : null }
}
export function emptyVisit(): Visit {
  return { id: crypto.randomUUID(), visited_at: new Date().toISOString(), patient_code: '', age: 0, sex: null, womens_health: null, conditions: [], other_condition: '', complaints: [], adherence: 'Não informado', subjective_notes: '', intercurrence_details: {}, bp_target: null, vitals_context: '', companions: emptyCompanions(), medications_in_use: '', recent_medications: null, neuro_exam: null, vitals: { systolic: null, diastolic: null, heart_rate: null, respiratory_rate: null, oxygen_saturation: null, temperature: null, glucose: null }, exam: { cardiovascular: { status: 'Não avaliado', notes: '' }, respiratory: { status: 'Não avaliado', notes: '' }, abdomen: { status: 'Não avaliado', notes: '' }, general: { status: 'Não avaliado', notes: '' } }, assessment: '', actions: [], plan_notes: '' }
}
export function exampleVisit(): Visit {
  const v = emptyVisit()
  return {
    ...v, patient_code: 'EX-001', age: 78, sex: 'Feminino', conditions: ['Acamado', 'Hipertenso', 'Diabético'],
    companions: { has_acs: true, acs_name: 'Maria', has_student: true, student_name: 'João', has_nurse: false, is_solo: false },
    complaints: ['Internação hospitalar'], adherence: 'Regular',
    intercurrence_details: { 'Internação hospitalar': 'Internada por pneumonia por cinco dias, com alta há uma semana. Cuidadora refere melhora desde a alta.' },
    subjective_notes: 'Cuidadora relata boa aceitação alimentar e ausência de novas queixas hoje.',
    medications_in_use: 'Losartana e metformina, conforme receita apresentada.',
    recent_medications: 'Ceftriaxona durante a internação por pneumonia; tratamento encerrado conforme relato da cuidadora.',
    neuro_exam: { mini_mental: { score: 24, domains: { temporal: 4, spatial: 5, registration: 3, attention: 3, recall: 2, language: 7 }, education_years: 4, notes: '' }, geriatric_screening: { flags: ['Dependência para atividades básicas (AVDs)', 'Risco de queda / mobilidade reduzida'], notes: 'Cuidadora auxilia nas atividades básicas.' }, rankin: 4, directed_flags: [neuroFlags[0].value, neuroFlags[1].value], neuro_notes: null },
    vitals: { systolic: 150, diastolic: 90, heart_rate: 76, respiratory_rate: 18, oxygen_saturation: 97, temperature: 36.5, glucose: 145 },
    exam: { cardiovascular: { status: 'Sem alterações', notes: '' }, respiratory: { status: 'Sem alterações', notes: '' }, abdomen: { status: 'Sem alterações', notes: '' }, general: { status: 'Alterado', notes: 'Restrita ao leito; hidratada ao exame.' } },
    assessment: '', actions: ['Manutenção de receita', 'Orientações gerais', 'Agendamento de retorno VD'],
    plan_notes: 'Reforçadas orientações à cuidadora sobre mudança de decúbito e cuidados com a pele. Retorno VD em 30 dias.',
  }
}
