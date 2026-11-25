import GlassIcon from './GlassIcon'
import { emptyWomensHealth, type PreventiveScreening, type ScreeningStatus, type WomensHealth } from '../types/visit'

export default function WomensHealthSection({ value, onChange }: { value: WomensHealth | null; onChange: (v: WomensHealth | null) => void }) {
  const health = value ?? emptyWomensHealth()
  function update(key: keyof WomensHealth, change: Partial<PreventiveScreening>) {
    const next = { ...health, [key]: { ...health[key], ...change } }
    onChange(Object.values(next).some(e => e.status || e.year !== null || e.notes.trim()) ? next : null)
  }
  return <section className="panel"><div className="section-title"><GlassIcon name="saude-da-mulher" size={30}/><div><h2>Saúde da Mulher (Rastreio Preventivo)</h2><p>Informe a situação do preventivo e da mamografia. Se souber, registre o ano do último exame.</p></div></div>
    {([['cervical', 'Preventivo (Citopatológico / Papanicolau)'], ['mammography', 'Mamografia']] as const).map(([key, label]) => <fieldset key={key}><legend>{label}</legend><label>Situação — {label}<select value={health[key].status ?? ''} onChange={e => update(key, { status: (e.target.value || null) as ScreeningStatus | null, ...(e.target.value === 'Nunca realizou' ? { year: null } : {}) })}><option value="">Não informado</option><option value="Em dia">Em dia</option><option value="Atrasado / Solicitar">{key === 'mammography' ? 'Atrasada / Solicitar' : 'Atrasado / Solicitar'}</option><option value="Nunca realizou">Nunca realizou</option><option value="Não se aplica">Não se aplica</option></select></label>
      <div className="screening-fields"><label>Ano do último exame — {label}<input type="number" inputMode="numeric" min={1900} max={new Date().getFullYear()} disabled={health[key].status === 'Nunca realizou'} value={health[key].year ?? ''} placeholder="Opcional" onChange={e => update(key, { year: e.target.value === '' ? null : Number(e.target.value) })}/></label><label>Observação — {label}<input maxLength={500} value={health[key].notes} placeholder="Ex.: resultado informado pela paciente" onChange={e => update(key, { notes: e.target.value })}/></label></div>
    </fieldset>)}
    <p className="small-note">Ao marcar um exame como atrasado, a indicação de solicitá-lo aparece no Plano. Se você não avaliou o histórico, deixe os campos em branco.</p>
    {value && <button type="button" className="text-button" onClick={() => onChange(null)}>Limpar rastreio preventivo</button>}
  </section>
}
