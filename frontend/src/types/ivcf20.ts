// Perguntas adaptadas da ficha IVCF-20 do Ministério da Saúde.
export const ivcfGroups = [
  { title: 'Autopercepção da saúde', questions: [
    { key: 'poor_health', label: 'Comparada à de outras pessoas da sua idade, como você considera sua saúde?', points: 1 },
  ] },
  { title: 'Atividades de vida diária', description: 'As três atividades instrumentais valem, juntas, até 4 pontos. Considere apenas limitações por motivo de saúde.', questions: [
    { key: 'shopping', label: 'Por causa da saúde, deixou de fazer compras?', points: 4 },
    { key: 'finances', label: 'Por causa da saúde, deixou de cuidar do dinheiro ou das contas?', points: 4 },
    { key: 'housework', label: 'Por causa da saúde, deixou de fazer pequenos trabalhos domésticos?', points: 4 },
    { key: 'bathing', label: 'Por causa da saúde, deixou de tomar banho sem ajuda?', points: 6 },
  ] },
  { title: 'Cognição', questions: [
    { key: 'memory_report', label: 'Algum familiar ou amigo comentou que você anda esquecendo mais?', points: 1 },
    { key: 'memory_worse', label: 'O esquecimento piorou nos últimos meses?', points: 1 },
    { key: 'memory_limits', label: 'O esquecimento impede alguma atividade do dia a dia?', points: 2 },
  ] },
  { title: 'Humor', questions: [
    { key: 'low_mood', label: 'No último mês, sentiu desânimo, tristeza ou desesperança?', points: 2 },
    { key: 'loss_interest', label: 'No último mês, perdeu interesse ou prazer nas atividades de que gostava?', points: 2 },
  ] },
  { title: 'Mobilidade', questions: [
    { key: 'arm_reach', label: 'Tem dificuldade que impeça elevar os braços acima dos ombros?', points: 1 },
    { key: 'small_objects', label: 'É incapaz de segurar ou manusear objetos pequenos?', points: 1 },
    { key: 'physical_capacity', label: 'Apresenta ao menos um dos critérios de capacidade aeróbica ou muscular?', points: 2, details: [
      'Perda de peso involuntária de 4,5 kg ou 5% do peso em um ano, 6 kg em seis meses ou 3 kg em um mês.',
      'IMC inferior a 22 kg/m².',
      'Panturrilha com perímetro inferior a 31 cm.',
      'Mais de 5 segundos para percorrer 4 metros.',
    ] },
    { key: 'walking', label: 'A dificuldade para caminhar pode impedir alguma atividade do dia a dia?', points: 2 },
    { key: 'falls', label: 'Caiu duas vezes ou mais no último ano?', points: 2 },
    { key: 'incontinence', label: 'Já perdeu urina ou fezes involuntariamente?', points: 2 },
  ] },
  { title: 'Comunicação', questions: [
    { key: 'vision', label: 'A limitação visual pode impedir alguma atividade do dia a dia, mesmo com correção habitual?', points: 2 },
    { key: 'hearing', label: 'A limitação auditiva pode impedir alguma atividade do dia a dia, mesmo com o aparelho habitual?', points: 2 },
  ] },
] as const

type IvcfQuestion = (typeof ivcfGroups)[number]['questions'][number]
const questions = ivcfGroups.flatMap<IvcfQuestion>(group => group.questions)
type Question = IvcfQuestion['key']
export type IvcfAnswers = Record<Question, boolean>
export type IvcfAgeBand = '60_74' | '75_84' | '85_plus'
export const ivcfAgeLabels: Record<IvcfAgeBand, string> = { '60_74': '60 a 74 anos', '75_84': '75 a 84 anos', '85_plus': '85 anos ou mais' }
export const ivcfAgePoints = { '60_74': 0, '75_84': 1, '85_plus': 3 }
export const ivcfComorbidities = [
  { key: 'chronic_diseases', label: 'Pelo menos cinco doenças crônicas' },
  { key: 'polypharmacy', label: 'Uso diário regular de pelo menos cinco medicamentos diferentes' },
  { key: 'hospitalization', label: 'Internação nos últimos seis meses' },
] as const
export type IvcfComorbidity = (typeof ivcfComorbidities)[number]['key']
export interface Ivcf20 {
  age_band: IvcfAgeBand
  answers: IvcfAnswers
  comorbidities: IvcfComorbidity[]
  score: number
}

const instrumental = new Set<Question>(['shopping', 'finances', 'housework'])
export function ivcfAgeBand(age: number | null): IvcfAgeBand | null {
  if (age === null || !Number.isInteger(age) || age < 60 || age > 130) return null
  return age < 75 ? '60_74' : age < 85 ? '75_84' : '85_plus'
}

export function completeIvcfAnswers(answers: Partial<IvcfAnswers>): answers is IvcfAnswers {
  return questions.every(({ key }) => typeof answers[key] === 'boolean')
}

export function ivcfScore(age: IvcfAgeBand, answers: IvcfAnswers, comorbidities: readonly IvcfComorbidity[]): number {
  const instrumentalPoints = answers.shopping || answers.finances || answers.housework ? 4 : 0
  return ivcfAgePoints[age] + instrumentalPoints + (comorbidities.length ? 4 : 0)
    + questions.reduce((sum, { key, points }) => sum + (!instrumental.has(key) && answers[key] ? points : 0), 0)
}

export function ivcfStratum(score: number): string {
  return score <= 6 ? 'Idoso Robusto (baixo risco)' : score <= 14 ? 'Idoso em Risco de Fragilização (risco moderado)' : 'Idoso Frágil (alto risco)'
}

export const ivcfFollowUp = 'Considerar revisão medicamentosa e acompanhamento multiprofissional conforme avaliação clínica'
