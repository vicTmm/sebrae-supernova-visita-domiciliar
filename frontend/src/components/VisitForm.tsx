import ConditionPicker from './ConditionPicker'
import GlassIcon from './GlassIcon'
import { useState } from 'react'
import { actionLabels, changeVisitSex, conditionsForSex, complaints, actions, examLabels, type Visit } from '../types/visit'
import VitalSigns from './VitalSigns'
import LabResultsSection from './LabResultsSection'
import CompanionsSection from './CompanionsSection'
import NeuroTestsSection from './NeuroTestsSection'
import HouseholdSection from './HouseholdSection'
import WomensHealthSection from './WomensHealthSection'
import { evaluateClinical } from '../services/clinicalRules'
const AGE_RECHECK_YEARS = 110

function Choices<T extends string>({ options, value, onChange, labels }: { options: readonly T[]; value: T[]; onChange: (v: T[]) => void; labels?: Partial<Record<T, string>> }) {
  return <div className="choices">{options.map(option => <button key={option} type="button" aria-pressed={value.includes(option)} className={`chip ${value.includes(option) ? 'selected' : ''}`} onClick={() => onChange(value.includes(option) ? value.filter(v => v !== option) : [...value, option])}><span className="check" aria-hidden="true">{value.includes(option) ? '✓' : '+'}</span>{labels?.[option] ?? option}</button>)}</div>
}
export default function VisitForm({ value: v, onChange, step }: { step: "general" | "soap"; value: Visit; onChange: (v: Visit) => void }) {
  const checkAge = v.age !== null && Number.isInteger(v.age) && v.age >= AGE_RECHECK_YEARS && v.age <= 130
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
  if (step === "general") return <>
    <CompanionsSection value={v.companions} onChange={x => set('companions', x)} />
    <section className="panel visit-section" id="visit-identification" tabIndex={-1}><div className="section-title"><GlassIcon name="identificacao" size={30}/><div><h2>Quem você está visitando?</h2><p>Use um código ou iniciais. Evite dados identificáveis.</p></div></div>
      <div className="identity-grid"><label>Código ou iniciais <span className="required">*</span><input required maxLength={30} value={v.patient_code} placeholder="Ex.: AB ou VD-024" onChange={e => set('patient_code', e.target.value)} /></label><div className="patient-age">
        <label htmlFor="patient-age">Idade em anos <span className="required">*</span></label>
        <input id="patient-age" required type="number" min={0} max={130} inputMode="numeric"
          aria-describedby={checkAge ? 'patient-age-hint' : undefined}
          value={v.age ?? ''}
          onChange={e => set('age', e.target.value === '' ? null : Number(e.target.value))}/>
        {checkAge && <p id="patient-age-hint">Confira se a idade é mesmo {v.age} anos.</p>}
      </div><label>Sexo<select value={v.sex ?? ''} onChange={e => changeSex(e.target.value as Visit['sex'])}><option value="" disabled>Selecione</option>{['Feminino', 'Masculino'].map(s => <option key={s}>{s}</option>)}</select></label></div>
      <label>Motivo do atendimento nesta visita<textarea maxLength={300} rows={2} value={v.visit_reason} placeholder="Ex.: reavaliar após alta; acompanhar diabetes; investigar queixa relatada" onChange={e => set('visit_reason', e.target.value)}/></label>
      <fieldset><legend>Condições acompanhadas</legend><ConditionPicker options={availableConditions} value={v.conditions} onChange={x => onChange({ ...v, conditions: x, other_condition: x.includes('Outra') ? v.other_condition ?? '' : '' })} />
        {removedConditions && <p className="small-note" role="status">As condições incompatíveis foram removidas após a troca de sexo.</p>}
        {hiddenConditions.length > 0 && <div className="clinical-badge">
          <p>Confira o sexo e as condições do registro anterior: {hiddenConditions.join(', ')}.</p>
          <button type="button" className="text-button" onClick={() => set('conditions', v.conditions.filter(condition => availableConditions.includes(condition)))}>Remover condições incompatíveis</button>
        </div>}
      </fieldset>{v.conditions.includes('Outra') && <div className="contextual-details"><label>Qual outra condição?<input maxLength={500} value={v.other_condition ?? ''} placeholder="Descreva a condição nesta visita" onChange={e => set('other_condition', e.target.value)}/></label></div>}
    </section>
    {v.sex === 'Feminino' && <WomensHealthSection value={v.womens_health ?? null} onChange={health => set('womens_health', health)}/>}
    <HouseholdSection value={v.household} onChange={x => set('household', x)}/>
  </>
  return <>
    <section className="panel visit-section" id="visit-subjective" tabIndex={-1}><div className="section-title"><GlassIcon name="subjetivo" size={30}/><div><h2>S · História relatada pelo paciente ou cuidador</h2></div></div>
      <fieldset><legend>Queixas e intercorrências</legend><Choices options={complaints} value={v.complaints} onChange={x => {
        const added = x.find(c => !v.complaints.includes(c))
        const next = added === 'Sem intercorrências' ? ['Sem intercorrências'] as Visit['complaints'] : x.filter(c => c !== 'Sem intercorrências')
        onChange({ ...v, complaints: next, intercurrence_details: Object.fromEntries(Object.entries(v.intercurrence_details).filter(([key]) => next.includes(key as Visit['complaints'][number]))) })
      }} />
      {v.complaints.length > 0 && !v.complaints.includes('Sem intercorrências') && <div className="contextual-details complaint-cards">{v.complaints.map((complaint, i) => {
        const hints: Partial<Record<Visit['complaints'][number], string>> = { Dor: 'Localização, intensidade e início da dor', Dispneia: 'Início, duração, relação com esforço ou repouso e sintomas associados', Febre: 'Temperatura relatada, início, duração e sintomas associados', Tontura: 'Início, duração e fatores associados', Queda: 'Data da queda, circunstâncias, trauma e perda de consciência', 'Ida à UPA/Emergência': 'Motivo do atendimento, conduta e evolução após a alta', 'Internação hospitalar': 'Motivo da internação, período, tratamento e evolução após a alta' }
        return <article className="complaint-card" key={complaint}><h3>{complaint}</h3><label htmlFor={`complaint-${i}`}>Detalhes de {complaint.toLowerCase()}<textarea id={`complaint-${i}`} rows={2} maxLength={2000} value={v.intercurrence_details[complaint] ?? ''} placeholder={hints[complaint]} onChange={e => set('intercurrence_details', { ...v.intercurrence_details, [complaint]: e.target.value })}/></label></article>
      })}</div>}</fieldset>
      <label>Adesão ao tratamento medicamentoso<select value={v.adherence} onChange={e => set('adherence', e.target.value as Visit['adherence'])}>{['Não informado', 'Regular', 'Irregular', 'Não faz uso'].map(s => <option key={s}>{s}</option>)}</select></label>
      <label>Medicamentos de uso contínuo<input maxLength={1000} value={v.medications_in_use} placeholder="Ex.: losartana, conforme receita apresentada" onChange={e => set('medications_in_use', e.target.value)} /></label>
      <label>Medicamentos de uso recente<input maxLength={1000} value={v.recent_medications ?? ''} placeholder="Ex.: ceftriaxona durante internação por pneumonia" onChange={e => set('recent_medications', e.target.value || null)} /></label>
      <details className="additional-notes" open={v.subjective_notes ? true : undefined}><summary>Relato complementar do paciente ou cuidador</summary><label>Outras informações do relato<textarea maxLength={2000} value={v.subjective_notes} onChange={e => set('subjective_notes', e.target.value)} /></label></details>
    </section>
    <section className="panel visit-section" id="visit-objective" tabIndex={-1}><div className="section-title"><GlassIcon name="objetivo" size={30}/><div><h2>O · Sinais vitais e exame físico</h2><p>Preencha apenas o que foi aferido ou avaliado.</p></div></div>
      <VitalSigns alerts={alerts} value={v.vitals} onChange={x => set('vitals', x)} />
      <LabResultsSection key={v.id} alerts={alerts} value={v.lab_results} onChange={x => set('lab_results', x)} />
      <details className="additional-notes"><summary>Contexto da aferição e metas de pressão arterial</summary><label>Contexto clínico da aferição e metas individuais<textarea maxLength={1000} value={v.vitals_context} placeholder="Ex.: sintomas associados, condição da aferição ou meta individual já definida" onChange={e => set('vitals_context', e.target.value)} /></label><div className="identity-grid"><label>Meta individual PAS menor que (mmHg)<input type="number" inputMode="numeric" min={80} max={180} value={v.bp_target?.systolic ?? ''} onChange={e => { const systolic = e.target.value === '' ? null : Number(e.target.value); set('bp_target', systolic === null && v.bp_target?.diastolic == null ? null : { systolic, diastolic: v.bp_target?.diastolic ?? null }) }}/></label><label>Meta individual PAD menor que (mmHg)<input type="number" inputMode="numeric" min={40} max={110} value={v.bp_target?.diastolic ?? ''} onChange={e => { const diastolic = e.target.value === '' ? null : Number(e.target.value); set('bp_target', diastolic === null && v.bp_target?.systolic == null ? null : { systolic: v.bp_target?.systolic ?? null, diastolic }) }}/></label></div></details>
      <NeuroTestsSection age={v.age} value={v.neuro_exam} onChange={x => set('neuro_exam', x)} />
      <fieldset><legend>Exame físico</legend><div className="exam-list">{(Object.keys(examLabels) as (keyof typeof examLabels)[]).map(key => <div className="exam-row" key={key}><label>{examLabels[key]}<select value={v.exam[key].status} onChange={e => set('exam', { ...v.exam, [key]: { status: e.target.value, notes: '' } })}>{['Não avaliado', 'Sem alterações', 'Alterado'].map(x => <option key={x}>{x}</option>)}</select></label>{v.exam[key].status === 'Alterado' && <label>Descreva a alteração<textarea required maxLength={500} value={v.exam[key].notes} onChange={e => set('exam', { ...v.exam, [key]: { ...v.exam[key], notes: e.target.value } })} /></label>}</div>)}</div></fieldset>
    </section>
    <section className="panel visit-section" id="visit-plan" tabIndex={-1}><div className="section-title"><GlassIcon name="avaliacao-plano" size={30}/><div><h2>A/P · Impressão clínica e condutas</h2></div></div>
      <label>Avaliação clínica<textarea maxLength={2000} value={v.assessment} placeholder="Impressão diagnóstica com base nos achados da visita" onChange={e => set('assessment', e.target.value)} /></label>
      <fieldset><legend>Condutas realizadas ou definidas</legend><Choices options={actions} value={v.actions} onChange={x => set('actions', x)} labels={actionLabels}/><p className="small-note">Não agenda visita nem confirma data.</p></fieldset>
      <label>Detalhes da conduta<textarea maxLength={2000} value={v.plan_notes} placeholder="Especifique ajustes, exames, orientações e prazo de retorno" onChange={e => set('plan_notes', e.target.value)} /></label>
      <label>Responsável pelo seguimento<input maxLength={200} value={v.follow_up_owner} placeholder="Ex.: ACS Maria, enfermeira da UBS, cuidador" onChange={e => set('follow_up_owner', e.target.value)}/></label>
    </section>
  </>
}
