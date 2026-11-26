import { ArrowRight, Plus } from 'lucide-react'
import type { LocalVisit } from '../types/visit'

type Props = {
  rows: LocalVisit[]
  today: string
  onNew: () => void
  onOpen: (row: LocalVisit) => void
  onResolve: (row: LocalVisit, keepLocal: boolean) => void
}

const time = new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' })

export default function VisitHistory({ rows, today, onNew, onOpen, onResolve }: Props) {
  if (!rows.length) return (
    <section className="history-empty">
      <img src="/brand/visitario/territorio.webp" alt="" width="800" height="533"/>
      <div><h2>Nenhuma visita salva</h2>
      <p>Depois de revisar e salvar sua primeira visita, a evolução aparece aqui.</p>
      <button className="text-button" onClick={onNew}>Registrar primeira visita <ArrowRight size={17} aria-hidden="true"/></button>
      </div>
    </section>
  )

  const days = new Map<string, LocalVisit[]>()
  for (const row of rows) {
    const date = new Date(row.visit.visited_at).toLocaleDateString('pt-BR')
    const group = days.get(date)
    if (group) group.push(row)
    else days.set(date, [row])
  }

  return <>
    <div className="history-heading">
      <p>{rows.length} {rows.length === 1 ? 'visita salva' : 'visitas salvas'}</p>
      <button className="secondary" onClick={onNew}><Plus size={16}/>Nova visita</button>
    </div>
    {Array.from(days, ([day, visits]) => (
      <section key={day} className="history-day">
        <h2>{day === today ? 'Hoje' : day}</h2>
        <div className="panel history-list">
          {visits.map(row => {
            const { visit } = row
            const state = row.conflict ? 'Conflito' : row.pending ? 'No dispositivo' : 'Sincronizada'
            return <article key={visit.id} className="history-entry">
              <div className="history-entry-heading">
                <time dateTime={visit.visited_at}>{time.format(new Date(visit.visited_at))}</time>
                <h3>{visit.patient_code} {visit.age != null && <span className="muted">· {visit.age} anos</span>}</h3>
                <span className={row.pending || row.conflict ? 'save-state waiting' : 'save-state'}>{state}</span>
              </div>
              {visit.conditions.length > 0 && <p>{visit.conditions.join(', ')}</p>}
              <p className="history-preview">{row.soap_text.slice(0, 180)}{row.soap_text.length > 180 && '…'}</p>
              <button className="text-button" onClick={() => onOpen(row)} aria-label={`Abrir evolução de ${visit.patient_code}`}>Abrir evolução <ArrowRight size={16}/></button>
              {row.conflict && <div className="conflict">
                <strong>Existe outra edição no servidor.</strong><pre>{row.conflict.soap_text}</pre>
                <p>Seu texto local foi preservado. Escolha qual versão manter.</p>
                <button className="secondary" onClick={() => onResolve(row, false)}>Usar versão do servidor</button>
                <button className="secondary" onClick={() => onResolve(row, true)}>Manter minha versão e reenviar</button>
              </div>}
            </article>
          })}
        </div>
      </section>
    ))}
  </>
}
