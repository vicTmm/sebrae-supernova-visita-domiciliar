import { Check, Copy, Pencil, Save, Sparkles } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import type { SOAPOutput, Visit, Vitals } from '../types/visit'
import { vitalUnits, withSoapEdits, normalizeSoapBlocks } from '../services/soap'
import { evaluateClinical } from '../services/clinicalRules'
import { validateVitals } from '../types/vitals'
import GlassIcon from './GlassIcon'
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
    } catch { setError('Não foi possível copiar. Selecione o texto da evolução e use o comando Copiar do navegador.') }
  }
  return <div className="copy-control"><button type="button" aria-label={copied ? `${label} (copiado)` : label} className={subtle ? 'text-button' : 'secondary copy-block'} disabled={disabled || !text.trim()} onClick={() => void copy()}>{copied ? <Check size={17}/> : <Copy size={17}/>}<span>{copied ? 'Copiado' : label}</span></button><span role="status" className="sr-only">{copied ? `${label}: copiado` : ''}</span>{error && <p role="alert" className="error small-note">{error}</p>}</div>
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
      ? 'Sinais vitais atualizados. Confira os valores citados no exame físico e no plano.'
      : 'Sinais vitais atualizados. Se você digitou alguma medida na evolução, confira o valor.')
    closeVitalsEditor()
  }

  return <div className="soap-results">
    <div className="review-intro"><GlassIcon name="secoes" size={30}/><div><h2>Registro no VitaCare</h2>{result.source === 'ai' && <small>Texto preparado com IA</small>}{result.source === 'legacy' && <small>Texto de uma evolução anterior</small>}</div></div>
    <section className="panel soap-block"><div className="block-heading"><span className="soap-letter">S</span><div><h2>História clínica</h2></div></div><label className="sr-only" htmlFor="soap-subjective">História clínica</label><textarea id="soap-subjective" className="block-text subjective" maxLength={24000} value={result.subjective_text} onChange={e => edit('subjective_text', e.target.value)}/><CopyButton text={result.subjective_text} label="Copiar história clínica"/></section>
    <section className="panel soap-block"><div className="block-heading"><span className="soap-letter">O</span><div><h2>Sinais vitais e exame físico</h2></div></div>
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
          }}><Pencil size={16} aria-hidden="true"/>{editingVitals ? 'Descartar alterações' : 'Editar sinais vitais'}</button>
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
          <button type="button" className="primary" onClick={applyVitals}>Aplicar medidas</button>
        </div>
      </fieldset> : measured.length ? <dl className="vital-badges">{measured.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}<small>{vitalUnits[label]}</small></dd></div>)}</dl> : <p className="small-note">Nenhuma medida registrada nesta visita.</p>}
      {vitalsStatus && <p className="review-vitals-status small-note" role="status">{vitalsStatus}</p>}
      {result.vitals_context && <div className="vitals-context"><strong>Contexto das medidas</strong><p>{result.vitals_context}</p></div>}
      <label htmlFor="soap-objective">Exame físico, avaliação neurológica e observações</label><textarea id="soap-objective" className="block-text" maxLength={10000} value={result.objective_text} onChange={e => edit('objective_text', e.target.value)}/><CopyButton text={result.objective_text} label="Copiar exame físico" disabled={editingVitals}/>
    </section>
    <section className="panel soap-block"><div className="block-heading"><span className="soap-letter">A</span><div><h2>Avaliação diagnóstica</h2></div></div><label className="sr-only" htmlFor="soap-assessment">Avaliação diagnóstica</label><textarea id="soap-assessment" className="block-text" maxLength={6000} placeholder="Se houver impressão diagnóstica, registre aqui" value={result.assessment_text ?? ''} onChange={e => edit('assessment_text', e.target.value)}/><CopyButton text={result.assessment_text ?? ''} label="Copiar avaliação"/></section>
    <section className="panel soap-block"><div className="block-heading"><span className="soap-letter">P</span><div><h2>Plano de condutas</h2></div></div><label className="sr-only" htmlFor="soap-plan">Plano de condutas</label><textarea id="soap-plan" className="block-text" maxLength={6000} value={result.plan_text} onChange={e => edit('plan_text', e.target.value)}/><CopyButton text={result.plan_text} label="Copiar plano" disabled={editingVitals}/></section>
    <div className="review-footer"><button type="button" className="primary" onClick={onSave} disabled={editingVitals}><Save size={17}/>Salvar visita no histórico</button>{serverAvailable && <button type="button" className="text-button" onClick={onAI} disabled={busy || editingVitals}><Sparkles size={17}/>{busy ? 'Preparando nova versão…' : 'Gerar nova versão'}</button>}<CopyButton text={result.full_text_fallback} label="Copiar evolução completa" subtle disabled={editingVitals}/></div>
  </div>
}
