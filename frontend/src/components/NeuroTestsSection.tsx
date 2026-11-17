import { useState } from 'react'
import { Brain } from 'lucide-react'
import MeemModal from './MeemModal'
import Ivcf20Modal from './Ivcf20Modal'
import { cognitiveInterpretation } from '../services/clinicalRules'
import { ivcfAgeBand, ivcfStratum } from '../types/ivcf20'
import { emptyNeuro, neuroFlags, type NeuroExam, type NeuroFlag } from '../types/visit'

const rankinLabels = ['Assintomático', 'Sem incapacidade significativa', 'Incapacidade leve', 'Incapacidade moderada', 'Incapacidade moderadamente grave', 'Acamado / Incontinente']
export default function NeuroTestsSection({ age, value, onChange }: { age: number; value: NeuroExam | null; onChange: (n: NeuroExam | null) => void }) {
  const n = value ?? emptyNeuro()
  const [test, setTest] = useState<'meem' | 'ivcf20' | null>(null)
  const m = n.mini_mental ?? null
  const ivcf = n.ivcf20 ?? null
  const legacy = n.geriatric_screening
  function toggleFlag(flag: NeuroFlag) {
    let flags = n.directed_flags.filter(f => f !== flag)
    if (!n.directed_flags.includes(flag)) {
      const opposite = flag === neuroFlags[2].value ? neuroFlags[3].value : flag === neuroFlags[3].value ? neuroFlags[2].value : null
      flags = [...flags.filter(f => f !== opposite), flag]
    }
    onChange({ ...n, directed_flags: flags })
  }
  return <details className="neuro-section"><summary><Brain size={19}/>Avaliação Cognitiva e Funcional (Idoso / Neuro)<span>{m || ivcf || legacy || n.rankin !== null || n.directed_flags.length || n.neuro_notes ? 'Registrado' : 'Opcional'}</span></summary><div className="neuro-content">
    <section className="assessment-entry">
      <div>
        <h3>Mini-Exame do Estado Mental (MEEM)</h3>
        {m && <p className="small-note">{m.score == null ? 'Avaliação anterior incompleta.' : `${m.items ? 'MEEM' : 'Resultado anterior'}: ${m.score}/30 · ${cognitiveInterpretation(m)}`}</p>}
      </div>
      <button className="secondary" type="button" onClick={() => setTest('meem')}>{m?.items ? 'Editar MEEM' : 'Aplicar MEEM'}</button>
      {m && <button type="button" className="text-button" onClick={() => onChange({ ...n, mini_mental: null })}>Remover MEEM</button>}
    </section>
    <section className="assessment-entry">
      <div>
        <h3>Índice de Vulnerabilidade Clínico-Funcional (IVCF-20)</h3>
        {ivcf && <p className="small-note">IVCF-20: {ivcf.score}/40 · {ivcfStratum(ivcf.score)}</p>}
        {!ivcf && !ivcfAgeBand(age) && <p className="small-note">Disponível para pessoas a partir de 60 anos.</p>}
      </div>
      <button className="secondary" type="button" disabled={!ivcfAgeBand(age)} onClick={() => setTest('ivcf20')}>{ivcf ? 'Editar IVCF-20' : 'Aplicar IVCF-20'}</button>
      {ivcf && <button type="button" className="text-button" onClick={() => onChange({ ...n, ivcf20: null })}>Remover IVCF-20</button>}
    </section>
    {legacy && (legacy.flags.length > 0 || legacy.notes.trim()) && <details className="neuro-module">
      <summary>Rastreio geriátrico anterior</summary>
      <div className="neuro-module-content">
        {legacy.flags.length > 0 && <p>{legacy.flags.join(', ')}</p>}
        {legacy.notes && <p>{legacy.notes}</p>}
        <button type="button" className="text-button" onClick={() => onChange({ ...n, geriatric_screening: null })}>Remover rastreio anterior</button>
      </div>
    </details>}
    {test === 'meem' && <MeemModal value={m} onClose={() => setTest(null)} onSave={mini_mental => onChange({ ...n, mini_mental })}/>}
    {test === 'ivcf20' && <Ivcf20Modal age={age} value={ivcf} onClose={() => setTest(null)} onSave={ivcf20 => onChange({ ...n, ivcf20 })}/>}
    <details className="neuro-module"><summary>Rankin e Exame Neurológico Dirigido</summary><div className="neuro-module-content">
    <fieldset><legend>Escala de Rankin Modificada (mRS 0 a 5)</legend><div className="rankin-grid">{rankinLabels.map((label, i) => <button type="button" className={`chip ${n.rankin === i ? 'selected' : ''}`} aria-pressed={n.rankin === i} key={i} onClick={() => onChange({ ...n, rankin: n.rankin === i ? null : i })}><strong>{i}</strong><span>{label}</span></button>)}</div></fieldset>
    <fieldset><legend>Exame neurológico dirigido</legend><div className="choices team-choices">{neuroFlags.map(flag => <label className={`chip ${n.directed_flags.includes(flag.value) ? 'selected' : ''}`} key={flag.value} title={flag.value}><input type="checkbox" checked={n.directed_flags.includes(flag.value)} onChange={() => toggleFlag(flag.value)}/>{flag.label}</label>)}</div></fieldset>
    <label>Observações neurológicas<textarea maxLength={1000} value={n.neuro_notes ?? ''} onChange={e => onChange({ ...n, neuro_notes: e.target.value || null })} placeholder="Descreva os achados avaliados"/></label>
    <button className="text-button" type="button" onClick={() => onChange({ ...n, rankin: null, directed_flags: [], neuro_notes: null })}>Limpar Rankin e exame dirigido</button>
    </div></details>
    <button className="text-button" type="button" onClick={() => onChange(null)}>Limpar toda a avaliação cognitiva e funcional</button>
  </div></details>
}
