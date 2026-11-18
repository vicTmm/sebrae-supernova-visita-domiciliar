import { Check, Copy, FileCheck2, Pencil, Save, Sparkles } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import type { SOAPOutput, Visit, Vitals } from '../types/visit'
import { vitalUnits, withSoapEdits, normalizeSoapBlocks } from '../services/soap'
import { evaluateClinical } from '../services/clinicalRules'
import { validateVitals } from '../types/vitals'
import VitalSigns from './VitalSigns'

function CopyButton({ text, label, subtle = false, disabled = false }: { text: string; label: string; subtle?: boolean; disabled?: boolean }) {
  const [copied, setCopied] = useState(false), [error, setError] = useState('')
  const sequence = useRef(0)
  useEffect(() => { sequence.current++; setCopied(false); setError('') }, [text])
  async function copy() {
    const current = ++sequence.current
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true); setError('')
      setTimeout(() => { if (sequence.current === current) setCopied(false) }, 2500)
    } catch { setError('Selecione o texto e copie manualmente. A cópia automática exige HTTPS ou localhost.') }
  }
  return <div className="copy-control"><button type="button" aria-label={copied ? `${label} — Copiado!` : label} className={subtle ? 'text-button' : 'secondary copy-block'} disabled={disabled || !text.trim()} onClick={() => void copy()}>{copied ? <Check size={17}/> : <Copy size={17}/>}<span>{copied ? 'Copiado!' : label}</span></button><span role="status" className="sr-only">{copied ? `${label}: copiado` : ''}</span>{error && <p role="alert" className="error small-note">{error}</p>}</div>
}

export default function SoapResultCard({ visit, result: rawResult, onChange, onVitalsChange, onAI, busy, onSave, serverAvailable }: {
  visit: Visit
  result: SOAPOutput
  onChange: (result: SOAPOutput) => void
  onVitalsChange: (vitals: Vitals) => boolean
  onAI: () => void
  busy: boolean
  onSave: () => void
  serverAvailable: boolean
}) {
  const result = normalizeSoapBlocks(rawResult)
  function edit(key: 'subjective_text' | 'objective_text' | 'plan_text' | 'assessment_text', text: string) { onChange(withSoapEdits(result, { [key]: key === 'assessment_text' ? text || null : text })) }
  const measured = Object.entries(result.vitals_formatted)
  const assessmentWasFilled = useRef(result.assessment_text !== null)
  const editVitalsButton = useRef<HTMLButtonElement>(null)
  const vitalsEditor = useRef<HTMLFieldSetElement>(null)
  const [draftVitals, setDraftVitals] = useState<Vitals | null>(null)
  const [vitalsError, setVitalsError] = useState('')
  const [vitalsStatus, setVitalsStatus] = useState('')
  const editingVitals = draftVitals !== null

  useEffect(() => {
    if (editingVitals) vitalsEditor.current?.querySelector('input')?.focus()
  }, [editingVitals])

  function closeVitalsEditor() {
    setDraftVitals(null)
    editVitalsButton.current?.focus()
  }

  function applyVitals() {
    if (!draftVitals) return
    const invalid = vitalsEditor.current?.querySelector<HTMLInputElement>('input:invalid')
    if (invalid) {
      invalid.reportValidity()
      return
    }
    const error = validateVitals(draftVitals)
    if (error) {
      setVitalsError(error)
      return
    }
    const needsReview = onVitalsChange(draftVitals)
    setVitalsStatus(needsReview
      ? 'Medidas atualizadas. Revise as menções a elas no texto do Objetivo e do Plano.'
      : 'Medidas atualizadas. Confira se você citou algum valor no texto livre.')
    closeVitalsEditor()
  }

  return <div className="soap-results">
    <div className="review-intro"><FileCheck2 aria-hidden="true"/><div><h2>Blocos para o VitaCare</h2><p>Revise os textos e copie cada bloco para o campo correspondente.</p><small>{result.source === 'ai' ? 'Organizado por IA' : result.source === 'legacy' ? 'Texto anterior preservado' : 'Organizado no dispositivo'} · revisão médica obrigatória</small></div></div>
    <section className="panel soap-block"><div className="block-heading"><span className="soap-letter">S</span><div><h2>Subjetivo — História Clínica</h2><p>A história da visita, pronta para o campo S.</p></div></div><label htmlFor="soap-subjective">História clínica editável</label><textarea id="soap-subjective" className="block-text subjective" maxLength={24000} value={result.subjective_text} onChange={e => edit('subjective_text', e.target.value)}/><CopyButton text={result.subjective_text} label="Copiar Subjetivo (S)"/></section>
    <section className="panel soap-block"><div className="block-heading"><span className="soap-letter">O</span><div><h2>Objetivo — Sinais Vitais & Exame Físico</h2><p>Transcreva as medidas nos campos numéricos do VitaCare.</p></div></div>
      <div className="review-vitals-heading">
        <h3>Sinais vitais</h3>
        <button ref={editVitalsButton} type="button" className="text-button" aria-expanded={editingVitals}
          onClick={() => {
            if (editingVitals) closeVitalsEditor()
            else {
              setVitalsError('')
              setVitalsStatus('')
              setDraftVitals(visit.vitals)
            }
          }}><Pencil size={16} aria-hidden="true"/>{editingVitals ? 'Fechar edição' : 'Editar sinais vitais'}</button>
      </div>
      {draftVitals ? <fieldset className="review-vitals-editor" ref={vitalsEditor}
        onKeyDown={event => {
          if (event.key === 'Enter' && event.target instanceof HTMLInputElement) {
            event.preventDefault()
            applyVitals()
          }
        }}>
        <legend className="sr-only">Editar sinais vitais</legend>
        <VitalSigns value={draftVitals} onChange={value => { setDraftVitals(value); setVitalsError('') }}
          alerts={evaluateClinical({ ...visit, vitals: draftVitals })}/>
        {vitalsError && <p role="alert" className="error small-note">{vitalsError}</p>}
        <div className="review-vitals-actions">
          <button type="button" className="secondary" onClick={closeVitalsEditor}>Cancelar</button>
          <button type="button" className="primary" onClick={applyVitals}>Aplicar alterações</button>
        </div>
      </fieldset> : measured.length ? <dl className="vital-badges">{measured.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}<small>{vitalUnits[label]}</small></dd></div>)}</dl> : <p className="small-note">Nenhum sinal vital informado.</p>}
      {vitalsStatus && <p className="review-vitals-status small-note" role="status">{vitalsStatus}</p>}
      {result.vitals_context && <div className="vitals-context"><strong>Contexto informado pelo médico</strong><p>{result.vitals_context}</p></div>}
      <label htmlFor="soap-objective">Exame físico, neurológico e observações clínicas editáveis</label><textarea id="soap-objective" className="block-text" maxLength={10000} value={result.objective_text} onChange={e => edit('objective_text', e.target.value)}/><CopyButton text={result.objective_text} label="Copiar Exame Físico (O)" disabled={editingVitals}/>
    </section>
    {(assessmentWasFilled.current || result.assessment_text !== null) && <section className="panel soap-block"><div className="block-heading"><span className="soap-letter">A</span><div><h2>Avaliação — Observação Diagnóstica</h2><p>Incluída porque foi preenchida no registro.</p></div></div><label htmlFor="soap-assessment">Avaliação editável</label><textarea id="soap-assessment" className="block-text" maxLength={6000} value={result.assessment_text ?? ''} onChange={e => edit('assessment_text', e.target.value)}/><CopyButton text={result.assessment_text ?? ''} label="Copiar Avaliação (A)"/></section>}
    <section className="panel soap-block"><div className="block-heading"><span className="soap-letter">P</span><div><h2>Plano — Condutas</h2><p>Condutas registradas e sugestões identificadas para revisão médica.</p></div></div><label htmlFor="soap-plan">Plano editável</label><textarea id="soap-plan" className="block-text" maxLength={6000} value={result.plan_text} onChange={e => edit('plan_text', e.target.value)}/><CopyButton text={result.plan_text} label="Copiar Plano (P)" disabled={editingVitals}/></section>
    <div className="review-footer"><button type="button" className="primary" onClick={onSave} disabled={editingVitals}><Save size={17}/>Salvar visita no histórico</button>{serverAvailable && <button type="button" className="text-button" onClick={onAI} disabled={busy || editingVitals}><Sparkles size={17}/>{busy ? 'Organizando…' : 'Organizar com o servidor / IA'}</button>}<CopyButton text={result.full_text_fallback} label="Copiar Evolução Completa" subtle disabled={editingVitals}/><p className="small-note">A cópia não envia dados ao VitaCare. Cole cada texto na aba correspondente.</p></div>
  </div>
}
