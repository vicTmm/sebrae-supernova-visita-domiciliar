import { useState } from 'react'
import { Activity, ClipboardList, HeartPulse, UserRound } from 'lucide-react'
import { changeVisitSex, conditionsForSex, complaints, actions, examLabels, type Visit } from '../types/visit'
import VitalSigns from './VitalSigns'
import LabResultsSection from './LabResultsSection'
import CompanionsSection from './CompanionsSection'
import NeuroTestsSection from './NeuroTestsSection'
import WomensHealthSection from './WomensHealthSection'
import { evaluateClinical } from '../services/clinicalRules'
function Choices<T extends string>({ options, value, onChange }: { options: readonly T[]; value: T[]; onChange: (v: T[]) => void }) {
  return <div className="choices">{options.map(option => <button key={option} type="button" aria-pressed={value.includes(option)} className={`chip ${value.includes(option) ? 'selected' : ''}`} onClick={() => onChange(value.includes(option) ? value.filter(v => v !== option) : [...value, option])}><span className="check" aria-hidden="true">{value.includes(option) ? '✓' : '+'}</span>{option}</button>)}</div>
}
export default function VisitForm({ value: v, onChange }: { value: Visit; onChange: (v: Visit) => void }) {
  const alerts = evaluateClinical(v)
  const availableConditions = conditionsForSex(v.sex)
  const hiddenConditions = v.conditions.filter(condition => !availableConditions.includes(condition))
  const [removedConditions, setRemovedConditions] = useState(false)
  function changeSex(sex: Visit['sex']) {
    const next = changeVisitSex(v, sex)
    setRemovedConditions(v.conditions.length !== next.conditions.length)
    onChange(next)
  }
  function set<K extends keyof Visit>(key: K, value: Visit[K]) { onChange({ ...v, [key]: value }) }
  return <>
    <CompanionsSection value={v.companions} onChange={x => set('companions', x)} />
    <section className="panel visit-section" id="visit-identification" tabIndex={-1}><div className="section-title"><UserRound/><div><h2>Quem você está visitando?</h2><p>Use um código ou iniciais. Evite dados identificáveis.</p></div><span className="step-number">01</span></div>
      <div className="identity-grid"><label>Código ou iniciais <span className="required">*</span><input required maxLength={30} value={v.patient_code} placeholder="Ex.: AB ou VD-024" onChange={e => set('patient_code', e.target.value)} /></label><label>Idade em anos <span className="required">*</span><input required type="number" min={0} max={130} inputMode="numeric" value={Number.isFinite(v.age) ? v.age : ''} onChange={e => set('age', e.target.value === '' ? NaN : Number(e.target.value))} /></label><label>Sexo<select value={v.sex ?? ''} onChange={e => changeSex(e.target.value as Visit['sex'])}><option value="" disabled>Selecione</option>{['Feminino', 'Masculino'].map(s => <option key={s}>{s}</option>)}</select></label></div>
      <fieldset><legend>Condições acompanhadas <span className="required">*</span></legend><Choices options={availableConditions} value={v.conditions} onChange={x => onChange({ ...v, conditions: x, other_condition: x.includes('Outra') ? v.other_condition ?? '' : '' })} />
        {removedConditions && <p className="small-note" role="status">As condições incompatíveis foram removidas após a troca de sexo.</p>}
        {hiddenConditions.length > 0 && <div className="clinical-badge">
          <p>Confira o sexo e as condições do registro anterior: {hiddenConditions.join(', ')}.</p>
          <button type="button" className="text-button" onClick={() => set('conditions', v.conditions.filter(condition => availableConditions.includes(condition)))}>Remover condições incompatíveis</button>
        </div>}
      </fieldset>{v.conditions.includes('Outra') && <div className="contextual-details"><label>Qual outra condição?<input maxLength={500} value={v.other_condition ?? ''} placeholder="Ex.: doença de Parkinson" onChange={e => set('other_condition', e.target.value)}/></label></div>}
    </section>
    {v.sex === 'Feminino' && <WomensHealthSection value={v.womens_health ?? null} onChange={health => set('womens_health', health)}/>}
    <section className="panel visit-section" id="visit-subjective" tabIndex={-1}><div className="section-title"><HeartPulse/><div><span className="eyebrow">S · SUBJETIVO</span><h2>O que mudou desde a última visita?</h2></div><span className="step-number">02</span></div>
      <fieldset><legend>Queixas e intercorrências</legend><Choices options={complaints} value={v.complaints} onChange={x => {
        const added = x.find(c => !v.complaints.includes(c))
        const next = added === 'Sem intercorrências' ? ['Sem intercorrências'] as Visit['complaints'] : x.filter(c => c !== 'Sem intercorrências')
        onChange({ ...v, complaints: next, intercurrence_details: Object.fromEntries(Object.entries(v.intercurrence_details).filter(([key]) => next.includes(key as Visit['complaints'][number]))) })
      }} />
      {v.complaints.length > 0 && !v.complaints.includes('Sem intercorrências') && <div className="contextual-details complaint-cards">{v.complaints.map((complaint, i) => {
        const hints: Partial<Record<Visit['complaints'][number], string>> = { Dor: 'Descreva local, intensidade, início...', Dispneia: 'Início, duração, esforço ou repouso, sintomas associados...', Febre: 'Temperatura relatada, início, duração, sintomas associados...', Tontura: 'Início, duração, fatores associados...', Queda: 'Quando ocorreu, circunstâncias, trauma, perda de consciência...', 'Ida à UPA/Emergência': 'Motivo, atendimento, conduta e evolução após a alta...', 'Internação hospitalar': 'Motivo, período, tratamento e evolução após a alta...' }
        return <article className="complaint-card" key={complaint}><h3>{complaint}</h3><label htmlFor={`complaint-${i}`}>Detalhes de {complaint.toLowerCase()}<textarea id={`complaint-${i}`} rows={2} maxLength={2000} value={v.intercurrence_details[complaint] ?? ''} placeholder={hints[complaint]} onChange={e => set('intercurrence_details', { ...v.intercurrence_details, [complaint]: e.target.value })}/></label></article>
      })}</div>}</fieldset>
      <label>Adesão medicamentosa<select value={v.adherence} onChange={e => set('adherence', e.target.value as Visit['adherence'])}>{['Não informado', 'Regular', 'Irregular', 'Não faz uso'].map(s => <option key={s}>{s}</option>)}</select></label>
      <label>Medicações em uso contínuo<input maxLength={1000} value={v.medications_in_use} placeholder="Ex.: Losartana, conforme receita apresentada" onChange={e => set('medications_in_use', e.target.value)} /></label>
      <label>Medicações utilizadas recentemente (ex.: pós-alta / intercorrência)<input maxLength={1000} value={v.recent_medications ?? ''} placeholder="Ex.: Ceftriaxona durante internação por pneumonia" onChange={e => set('recent_medications', e.target.value || null)} /></label>
      <details className="additional-notes" open={v.subjective_notes ? true : undefined}><summary>Relato complementar do paciente ou cuidador (opcional)</summary><label>Outras informações do relato<textarea maxLength={2000} value={v.subjective_notes} placeholder="Informações adicionais à história. Use o ditado do teclado se preferir." onChange={e => set('subjective_notes', e.target.value)} /></label></details>
    </section>
    <section className="panel visit-section" id="visit-objective" tabIndex={-1}><div className="section-title"><Activity/><div><span className="eyebrow">O · OBJETIVO</span><h2>Sinais vitais e exame físico</h2><p>Preencha apenas o que foi aferido ou avaliado.</p></div><span className="step-number">03</span></div>
      <VitalSigns alerts={alerts} value={v.vitals} onChange={x => set('vitals', x)} />
      <LabResultsSection key={v.id} alerts={alerts} value={v.lab_results} onChange={x => set('lab_results', x)} />
      <details className="additional-notes"><summary>Contextualizar os sinais vitais (opcional)</summary><label>Contexto clínico e meta individual definida pelo médico<textarea maxLength={1000} value={v.vitals_context} placeholder="Ex.: sintomas associados, condição da aferição ou meta individual já definida" onChange={e => set('vitals_context', e.target.value)} /></label><div className="identity-grid"><label>Meta individual PAS menor que (mmHg)<input type="number" inputMode="numeric" min={80} max={180} value={v.bp_target?.systolic ?? ''} onChange={e => { const systolic = e.target.value === '' ? null : Number(e.target.value); set('bp_target', systolic === null && v.bp_target?.diastolic == null ? null : { systolic, diastolic: v.bp_target?.diastolic ?? null }) }}/></label><label>Meta individual PAD menor que (mmHg)<input type="number" inputMode="numeric" min={40} max={110} value={v.bp_target?.diastolic ?? ''} onChange={e => { const diastolic = e.target.value === '' ? null : Number(e.target.value); set('bp_target', diastolic === null && v.bp_target?.systolic == null ? null : { systolic: v.bp_target?.systolic ?? null, diastolic }) }}/></label></div><p className="small-note">Limiares de apoio à revisão do MVP. Sem alerta não significa normalidade. Metas dependem da avaliação individual; idade e acamamento não definem fragilidade automaticamente.</p></details>
      <NeuroTestsSection age={v.age} value={v.neuro_exam} onChange={x => set('neuro_exam', x)} />
      <fieldset><legend>Exame físico</legend><div className="exam-list">{(Object.keys(examLabels) as (keyof typeof examLabels)[]).map(key => <div className="exam-row" key={key}><label>{examLabels[key]}<select value={v.exam[key].status} onChange={e => set('exam', { ...v.exam, [key]: { status: e.target.value, notes: '' } })}>{['Não avaliado', 'Sem alterações', 'Alterado'].map(x => <option key={x}>{x}</option>)}</select></label>{v.exam[key].status === 'Alterado' && <label>Descreva a alteração<textarea required maxLength={500} value={v.exam[key].notes} onChange={e => set('exam', { ...v.exam, [key]: { ...v.exam[key], notes: e.target.value } })} /></label>}</div>)}</div></fieldset>
    </section>
    <section className="panel visit-section" id="visit-plan" tabIndex={-1}><div className="section-title"><ClipboardList/><div><span className="eyebrow">A/P · AVALIAÇÃO E PLANO</span><h2>Como vamos seguir?</h2></div><span className="step-number">04</span></div>
      <label>Avaliação clínica (opcional)<textarea maxLength={2000} value={v.assessment} placeholder="Preencha apenas se desejar acrescentar uma observação diagnóstica ao cadastro existente" onChange={e => set('assessment', e.target.value)} /></label>
      <fieldset><legend>Condutas realizadas ou definidas</legend><Choices options={actions} value={v.actions} onChange={x => set('actions', x)} /></fieldset>
      <label>Detalhes da conduta<textarea maxLength={2000} value={v.plan_notes} placeholder="Especifique ajustes, exames, orientações e prazo de retorno" onChange={e => set('plan_notes', e.target.value)} /></label>
    </section>
  </>
}
