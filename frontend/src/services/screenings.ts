import type { Visit } from '../types/visit'
const paragraph = (parts: string[]) => parts.filter(s => s.trim()).map(s => s.trim().replace(/[.\s]+$/, '')).join('. ') + '.'

export function preventiveHistory(visit: Visit): string[] {
  if (visit.sex !== 'Feminino' || !visit.womens_health) return []
  const result: string[] = []
  for (const [key, name] of [['cervical', 'exame citopatológico do colo do útero (Papanicolau)'], ['mammography', 'mamografia']] as const) {
    const exam = visit.womens_health[key]
    if (!(exam.status || exam.year !== null || exam.notes.trim())) continue
    let line = exam.status === 'Em dia' ? `Relata ${name} em dia` : exam.status === 'Atrasado / Solicitar' ? `Relata rastreio por ${name} em atraso, com solicitação indicada nesta visita` : exam.status === 'Nunca realizou' ? `Refere nunca ter realizado ${name}` : exam.status === 'Não se aplica' ? `O rastreio por ${name} foi registrado como não aplicável` : `Sobre ${name}, há registro de acompanhamento preventivo`
    if (exam.year !== null) line += ` (último exame em ${exam.year})`
    result.push(paragraph([line, exam.notes]))
  }
  return result
}

export function preventivePlan(visit: Visit): string[] {
  if (visit.sex !== 'Feminino' || !visit.womens_health) return []
  return ([['cervical', 'Solicitar exame citopatológico do colo do útero (Papanicolau) para atualização do rastreio'], ['mammography', 'Solicitar mamografia para atualização do rastreio']] as const).filter(([key]) => visit.womens_health![key].status === 'Atrasado / Solicitar').map(([, text]) => text)
}
