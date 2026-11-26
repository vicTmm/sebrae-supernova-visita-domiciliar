import GlassIcon from './GlassIcon'
import { emptyWomensHealth, type ScreeningStatus, type WomensHealth } from '../types/visit'

const exams = [['cervical', 'Preventivo (Papanicolau)'], ['mammography', 'Mamografia']] as const

export default function WomensHealthSection({ value, onChange }: { value: WomensHealth | null; onChange: (v: WomensHealth | null) => void }) {
  const health = value ?? emptyWomensHealth()
  function update(key: keyof WomensHealth, change: Partial<WomensHealth[typeof key]>) {
    const next = { ...health, [key]: { ...health[key], ...change } }
    onChange(Object.values(next).some(e => e.status || e.year !== null || e.notes.trim()) ? next : null)
  }
  return <section className="panel visit-section"><div className="section-title"><GlassIcon name="saude-da-mulher" size={30}/><div><h2>Saúde da Mulher</h2><p>Último preventivo e mamografia.</p></div></div>
    {exams.map(([key, label]) => <fieldset key={key}><legend>{label}</legend>
      <label>Situação<select aria-label={`${label}: situação`} value={health[key].status ?? ''} onChange={e => update(key, {
        status: (e.target.value || null) as ScreeningStatus | null,
        ...(e.target.value === 'Nunca realizou' ? { year: null } : {}),
      })}>
        <option value="">Não informado</option>
        <option value="Em dia">Em dia</option>
        <option value="Atrasado / Solicitar">Atrasado</option>
        <option value="Nunca realizou">Nunca realizou</option>
        <option value="Não se aplica">Não se aplica</option>
      </select></label>
      <div className="screening-fields">
        <label>Ano<input aria-label={`${label}: ano do último exame`} type="number" inputMode="numeric" min={1900} max={new Date().getFullYear()} disabled={health[key].status === 'Nunca realizou'} value={health[key].year ?? ''} onChange={e => update(key, { year: e.target.value === '' ? null : Number(e.target.value) })}/></label>
        <label>Observação<input aria-label={`${label}: observação`} maxLength={500} value={health[key].notes} onChange={e => update(key, { notes: e.target.value })}/></label>
      </div>
    </fieldset>)}
  </section>
}
