import { Check, Copy, FileCheck2, Save, Sparkles } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import type { SOAPOutput } from '../types/visit'
import { vitalUnits, withSoapEdits } from '../services/soap'

function CopyButton({ text, label, subtle = false }: { text: string; label: string; subtle?: boolean }) {
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
  return <div className="copy-control"><button type="button" aria-label={copied ? `${label} — Copiado!` : label} className={subtle ? 'text-button' : 'primary copy-block'} disabled={!text.trim()} onClick={() => void copy()}>{copied ? <Check size={17}/> : <Copy size={17}/>}<span>{copied ? 'Copiado!' : label}</span></button><span role="status" className="sr-only">{copied ? `${label}: copiado` : ''}</span>{error && <p role="alert" className="error small-note">{error}</p>}</div>
}

export default function SoapResultCard({ result, onChange, onAI, busy, onSave, serverAvailable }: { result: SOAPOutput; onChange: (s: SOAPOutput) => void; onAI: () => void; busy: boolean; onSave: () => void; serverAvailable: boolean }) {
  function edit(key: 'subjective_text' | 'objective_text' | 'plan_text' | 'assessment_text', text: string) { onChange(withSoapEdits(result, { [key]: key === 'assessment_text' ? text || null : text })) }
  const measured = Object.entries(result.vitals_formatted)
  const assessmentWasFilled = useRef(result.assessment_text !== null)
  return <div className="soap-results">
    <div className="review-intro"><FileCheck2/><div><span className="eyebrow">REVISÃO PARA O VITACARE</span><h2>Uma aba de cada vez.</h2><p>Revise os textos e copie cada bloco para o campo correspondente.</p><small>{result.source === 'ai' ? 'Organizado por IA' : result.source === 'legacy' ? 'Texto anterior preservado' : 'Organizado no dispositivo'} · revisão médica obrigatória</small></div></div>
    <section className="panel soap-block"><div className="block-heading"><span className="soap-letter">S</span><div><h2>Subjetivo — História Clínica</h2><p>A história da visita, pronta para o campo S.</p></div></div><label htmlFor="soap-subjective">História clínica editável</label><textarea id="soap-subjective" className="block-text subjective" maxLength={24000} value={result.subjective_text} onChange={e => edit('subjective_text', e.target.value)}/><CopyButton text={result.subjective_text} label="Copiar Subjetivo (S)"/></section>
    <section className="panel soap-block"><div className="block-heading"><span className="soap-letter">O</span><div><h2>Objetivo — Sinais Vitais & Exame Físico</h2><p>Transcreva as medidas nos campos numéricos do VitaCare.</p></div></div>
      {measured.length ? <dl className="vital-badges">{measured.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}<small>{vitalUnits[label]}</small></dd></div>)}</dl> : <p className="small-note">Nenhum sinal vital informado.</p>}
      {result.vitals_context && <div className="vitals-context"><strong>Contexto informado pelo médico</strong><p>{result.vitals_context}</p></div>}
      <p className="small-note measures-note">Para corrigir uma medida, volte ao registro e gere novamente a evolução.</p><label htmlFor="soap-objective">Exame físico, neurológico e observações clínicas editáveis</label><textarea id="soap-objective" className="block-text" maxLength={6000} value={result.objective_text} onChange={e => edit('objective_text', e.target.value)}/><CopyButton text={result.objective_text} label="Copiar Exame Físico (O)"/>
    </section>
    {(assessmentWasFilled.current || result.assessment_text !== null) && <section className="panel soap-block"><div className="block-heading"><span className="soap-letter">A</span><div><h2>Avaliação — Observação Diagnóstica</h2><p>Incluída porque foi preenchida no registro.</p></div></div><label htmlFor="soap-assessment">Avaliação editável</label><textarea id="soap-assessment" className="block-text" maxLength={6000} value={result.assessment_text ?? ''} onChange={e => edit('assessment_text', e.target.value)}/><CopyButton text={result.assessment_text ?? ''} label="Copiar Avaliação (A)"/></section>}
    <section className="panel soap-block"><div className="block-heading"><span className="soap-letter">P</span><div><h2>Plano — Condutas</h2><p>Condutas registradas e sugestões identificadas para revisão médica.</p></div></div><label htmlFor="soap-plan">Plano editável</label><textarea id="soap-plan" className="block-text" maxLength={6000} value={result.plan_text} onChange={e => edit('plan_text', e.target.value)}/><CopyButton text={result.plan_text} label="Copiar Plano (P)"/></section>
    <div className="review-footer"><button type="button" className="secondary" onClick={onSave}><Save size={17}/>Salvar visita no histórico</button>{serverAvailable && <button type="button" className="text-button" onClick={onAI} disabled={busy}><Sparkles size={17}/>{busy ? 'Organizando…' : 'Organizar com o servidor / IA'}</button>}<CopyButton text={result.full_text_fallback} label="Copiar Evolução Completa" subtle/><p className="small-note">A cópia não envia dados ao VitaCare. Cole cada texto na aba correspondente.</p></div>
  </div>
}
