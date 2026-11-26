import type { Visit } from '../types/visit'
const paragraph = (parts: string[]) => parts.filter(s => s.trim()).map(s => s.trim().replace(/[.\s]+$/, '')).join('. ') + '.'

export function preventiveHistory(visit: Visit): string[] {
  if (visit.sex !== 'Feminino' || !visit.womens_health) return []
  const result: string[] = []
  for (const [key, name] of [['cervical', 'exame citopatológico do colo do útero (Papanicolau)'], ['mammography', 'mamografia']] as const) {
    const exam = visit.womens_health[key]
    if (!(exam.status || exam.year !== null || exam.notes.trim())) continue
    let line = exam.status === 'Em dia' ? `Relata ${name} em dia` : exam.status === 'Atrasado / Solicitar' ? `Relata rastreio por ${name} em atraso` : exam.status === 'Nunca realizou' ? `Refere nunca ter realizado ${name}` : exam.status === 'Não se aplica' ? `O rastreio por ${name} foi registrado como não aplicável` : `Sobre ${name}, há registro de acompanhamento preventivo`
    if (exam.year !== null) line += ` (último exame em ${exam.year})`
    result.push(paragraph([line, exam.notes]))
  }
  return result
}
