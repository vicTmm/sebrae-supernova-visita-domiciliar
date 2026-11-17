import { cognitiveInterpretation } from '../services/clinicalRules'
import { Brain } from 'lucide-react'
import { emptyNeuro, cognitiveDomains, emptyDomains, miniMentalTotal, neuroFlags, geriatricFlags, type GeriatricScreening, type CognitiveDomains, type NeuroExam, type NeuroFlag, type MiniMental } from '../types/visit'

const rankinLabels = ['Assintomático', 'Sem incapacidade significativa', 'Incapacidade leve', 'Incapacidade moderada', 'Incapacidade moderadamente grave', 'Acamado / Incontinente']
export default function NeuroTestsSection({ value, onChange }: { value: NeuroExam | null; onChange: (n: NeuroExam | null) => void }) {
  const n = value ?? emptyNeuro()
  const m = n.mini_mental ?? { score: null, education_years: null, notes: '' }
  function setMiniMental(change: Partial<MiniMental>) {
    const next = { ...m, ...change }
    onChange({ ...n, mini_mental: next.score === null && !next.domains && next.education_years === null && !next.education_level && !next.notes ? null : next })
  }
  const q = n.geriatric_screening ?? { flags: [], notes: '' }
  function setGeriatric(change: Partial<GeriatricScreening>) {
    const next = { ...q, ...change }
    onChange({ ...n, geriatric_screening: next.flags.length || next.notes.trim() ? next : null })
  }
  function setDomain(key: keyof CognitiveDomains, value: string) {
    const domains = { ...(m.domains ?? emptyDomains()), [key]: value === '' ? null : Number(value) }
    setMiniMental({ domains, score: miniMentalTotal(domains) })
  }
  function toggleFlag(flag: NeuroFlag) {
    let flags = n.directed_flags.filter(f => f !== flag)
    if (!n.directed_flags.includes(flag)) {
      const opposite = flag === neuroFlags[2].value ? neuroFlags[3].value : flag === neuroFlags[3].value ? neuroFlags[2].value : null
      flags = [...flags.filter(f => f !== opposite), flag]
    }
    onChange({ ...n, directed_flags: flags })
  }
  return <details className="neuro-section"><summary><Brain size={19}/>Avaliação Cognitiva e Funcional (Idoso / Neuro)<span>{n.mini_mental || n.geriatric_screening || n.rankin !== null || n.directed_flags.length || n.neuro_notes ? 'Registrado' : 'Opcional'}</span></summary><div className="neuro-content">
    <details className="neuro-module"><summary>1. Mini-Exame do Estado Mental (MEEM / Mini-Mental)</summary><div className="neuro-module-content"><fieldset><legend>Mini-Mental · Mini-Exame do Estado Mental (MEEM)</legend><p className="small-note">Registre os pontos dos domínios do instrumento aplicado. Não avaliado é diferente de zero. O rastreio não estabelece diagnóstico.</p>
      {n.mini_mental && !m.domains && <p className="small-note">Resultado anterior preservado: {m.score}/30. Ao preencher domínios, informe todos os seis para recalcular.</p>}
      <div className="cognitive-grid">{cognitiveDomains.map(f => <label key={f.key}>{f.label}<select value={m.domains?.[f.key] ?? ''} onChange={e => setDomain(f.key, e.target.value)}><option value="">Não avaliado</option>{Array.from({ length: f.max + 1 }, (_, i) => <option value={i} key={i}>{i} / {f.max}</option>)}</select></label>)}</div>
      <output className="cognitive-total" aria-live="polite">{m.score === null ? 'MEEM: preencha os seis domínios ou deixe Não avaliado' : `MEEM: ${m.score}/30`}</output>
      <label>Escolaridade<select value={m.education_level ?? (m.education_years === null ? '' : m.education_years === 0 ? 'none' : m.education_years <= 4 ? '1_4' : m.education_years <= 8 ? '5_8' : 'over_8')} onChange={e => setMiniMental({ education_level: (e.target.value || null) as MiniMental['education_level'], education_years: null })}><option value="">Não informada</option><option value="none">Analfabeto / 0 anos — corte 20</option><option value="1_4">1–4 anos — corte 25</option><option value="5_8">5–8 anos — corte 26</option><option value="over_8">Mais de 8 anos — corte 28</option></select></label>
      {m.score !== null && <p className="clinical-badge" aria-live="polite">{cognitiveInterpretation(m)}</p>}
      <label>Observações do Mini-Mental<textarea rows={2} maxLength={1000} value={m.notes} placeholder="Versão aplicada, limitações e interpretação pelo médico" onChange={e => setMiniMental({ notes: e.target.value })}/></label>
      {n.mini_mental && <button type="button" className="text-button" onClick={() => onChange({ ...n, mini_mental: null })}>Não avaliado / Limpar Mini-Mental</button>}
    </fieldset>
    </div></details>
    <details className="neuro-module"><summary>2. Rastreio de Saúde Mental e Vulnerabilidade do Idoso</summary><div className="neuro-module-content">
      <p className="small-note">Assinale apenas os marcadores identificados. Esta lista breve não calcula GDS ou IVCF-20; itens desmarcados não significam ausência do achado.</p>
      <div className="geriatric-choices">{geriatricFlags.map(flag => <label className={`chip ${q.flags.includes(flag) ? 'selected' : ''}`} key={flag}><input type="checkbox" checked={q.flags.includes(flag)} onChange={() => setGeriatric({ flags: q.flags.includes(flag) ? q.flags.filter(f => f !== flag) : [...q.flags, flag] })}/>{flag}</label>)}</div>
      <label>Observações do rastreio geriátrico<textarea rows={2} maxLength={1000} value={q.notes} onChange={e => setGeriatric({ notes: e.target.value })} placeholder="Contexto, relato do paciente ou cuidador e limitações"/></label>
      {n.geriatric_screening && <button type="button" className="text-button" onClick={() => onChange({ ...n, geriatric_screening: null })}>Limpar rastreio geriátrico</button>}
    </div></details>
    <details className="neuro-module"><summary>3. Rankin e Exame Neurológico Dirigido</summary><div className="neuro-module-content">
    <fieldset><legend>Escala de Rankin Modificada (mRS 0 a 5)</legend><div className="rankin-grid">{rankinLabels.map((label, i) => <button type="button" className={`chip ${n.rankin === i ? 'selected' : ''}`} aria-pressed={n.rankin === i} key={i} onClick={() => onChange({ ...n, rankin: n.rankin === i ? null : i })}><strong>{i}</strong><span>{label}</span></button>)}</div></fieldset>
    <fieldset><legend>Exame neurológico dirigido</legend><div className="choices team-choices">{neuroFlags.map(flag => <label className={`chip ${n.directed_flags.includes(flag.value) ? 'selected' : ''}`} key={flag.value} title={flag.value}><input type="checkbox" checked={n.directed_flags.includes(flag.value)} onChange={() => toggleFlag(flag.value)}/>{flag.label}</label>)}</div></fieldset>
    <label>Observações neurológicas<textarea maxLength={1000} value={n.neuro_notes ?? ''} onChange={e => onChange({ ...n, neuro_notes: e.target.value || null })} placeholder="Descreva os achados avaliados"/></label>
    <button className="text-button" type="button" onClick={() => onChange({ ...n, rankin: null, directed_flags: [], neuro_notes: null })}>Limpar Rankin e exame dirigido</button>
    </div></details>
    <button className="text-button" type="button" onClick={() => onChange(null)}>Limpar toda a avaliação cognitiva e funcional</button>
  </div></details>
}
