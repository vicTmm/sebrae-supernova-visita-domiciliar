import { HeartPulse } from 'lucide-react'
import { emptyWomensHealth, type PreventiveScreening, type ScreeningStatus, type WomensHealth } from '../types/visit'

export default function WomensHealthSection({ value, onChange }: { value: WomensHealth | null; onChange: (v: WomensHealth | null) => void }) {
  const health = value ?? emptyWomensHealth()
  function update(key: keyof WomensHealth, change: Partial<PreventiveScreening>) {
    const next = { ...health, [key]: { ...health[key], ...change } }
    onChange(Object.values(next).some(e => e.status || e.year !== null || e.notes.trim()) ? next : null)
  }
  return <section className="panel"><div className="section-title"><HeartPulse/><div><h2>Saúde da Mulher (Rastreio Preventivo)</h2><p>Registre o histórico e a indicação definida nesta visita.</p></div></div>
    {([['cervical', 'Preventivo (Citopatológico / Papanicolau)'], ['mammography', 'Mamografia']] as const).map(([key, label]) => <fieldset key={key}><legend>{label}</legend><label>Situação — {label}<select value={health[key].status ?? ''} onChange={e => update(key, { status: (e.target.value || null) as ScreeningStatus | null, ...(e.target.value === 'Nunca realizou' ? { year: null } : {}) })}><option value="">Não informado</option><option value="Em dia">Em dia</option><option value="Atrasado / Solicitar">{key === 'mammography' ? 'Atrasada / Solicitar' : 'Atrasado / Solicitar'}</option><option value="Nunca realizou">Nunca realizou</option><option value="Não se aplica">Não se aplica</option></select></label>
      <div className="screening-fields"><label>Ano do último exame — {label}<input type="number" inputMode="numeric" min={1900} max={new Date().getFullYear()} disabled={health[key].status === 'Nunca realizou'} value={health[key].year ?? ''} placeholder="Opcional" onChange={e => update(key, { year: e.target.value === '' ? null : Number(e.target.value) })}/></label><label>Observação — {label}<input maxLength={500} value={health[key].notes} placeholder="Ano, resultado informado ou contexto" onChange={e => update(key, { notes: e.target.value })}/></label></div>
    </fieldset>)}
    <p className="small-note">“Atrasado / Solicitar” inclui a solicitação no Plano. Deixe sem preenchimento quando o histórico não foi avaliado.</p>
    {value && <button type="button" className="text-button" onClick={() => onChange(null)}>Limpar rastreio preventivo</button>}
  </section>
}
