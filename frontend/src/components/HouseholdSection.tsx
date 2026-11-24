import { useState } from 'react'
import { ChevronDown, ChevronUp, Plus, Trash2, UsersRound } from 'lucide-react'
import type { Household, ResidentGroup, ResidentPerson } from '../types/visit'
import { emptyHousehold, residentDescription, residentRelationships } from '../types/visit'

function phoneLabel(phone: string) {
  if (phone.length < 3) return phone
  return `(${phone.slice(0, 2)}) ${phone.slice(2, phone.length > 10 ? 7 : 6)}${phone.length > 6 ? `-${phone.slice(phone.length > 10 ? 7 : 6)}` : ''}`
}
const hasIdentity = (g: ResidentGroup) => g.members.some(p => p.name.trim() || p.phone)
export default function HouseholdSection({ value, onChange }: { value?: Household | null; onChange: (value: Household) => void }) {
  const v = value ?? emptyHousehold(), groups = v.residents ?? []
  const [expanded, setExpanded] = useState<string[]>([])
  const [legacyNotes, setLegacyNotes] = useState(false)
  function set<K extends keyof Household>(key: K, next: Household[K]) { onChange({ ...v, [key]: next }) }
  function update(id: string, patch: Partial<ResidentGroup>) { set('residents', groups.map(g => g.id === id ? { ...g, ...patch } : g)) }
  function quantity(group: ResidentGroup, next: number) {
    if (!Number.isInteger(next) || next < 1 || next > 20) return
    if (group.members.slice(next).some(p => p.name.trim() || p.phone) && !confirm('Reduzir a quantidade removerá os dados das últimas pessoas deste grupo. Continuar?')) return
    update(group.id, { count: next, members: group.members.slice(0, next) })
  }
  function person(group: ResidentGroup, index: number, patch: Partial<ResidentPerson>) {
    const members = Array.from({ length: group.count }, (_, i) => ({ ...(group.members[i] ?? { name: '', phone: '' }), ...(i === index ? patch : {}) }))
    update(group.id, { members })
  }
  function remove(group: ResidentGroup) {
    if (hasIdentity(group) && !confirm('Remover este grupo também excluirá os nomes e telefones cadastrados nele. Continuar?')) return
    set('residents', groups.filter(g => g.id !== group.id)); setExpanded(expanded.filter(id => id !== group.id))
  }
  return <section className="panel visit-section household-section" aria-labelledby="household-title">
    <div className="section-title"><UsersRound aria-hidden="true"/><div><h2 id="household-title">Moradia e rede de apoio</h2><p>Registre os moradores por vínculo. Identifique pessoas apenas quando necessário.</p></div></div>
    <label>Com quem o paciente mora?<select value={v.living_arrangement ?? ''} onChange={e => {
      if ((groups.some(hasIdentity) || v.cohabitants.trim()) && !confirm('Alterar a situação de moradia limpará os moradores e o relato complementar. Continuar?')) return
      onChange({ ...v, living_arrangement: e.target.value as Household['living_arrangement'] || null, residents: [], cohabitants: '' })
      setExpanded([])
    }}><option value="">Não informado</option><option value="alone">Mora sozinho(a)</option><option value="with_others">Mora com outras pessoas</option></select></label>
    {v.living_arrangement === 'with_others' && <div className="household-residents">
      <p className="small-note">Adicione quem vive com o paciente, sem contar o próprio paciente. A quantidade se refere ao vínculo selecionado.</p>
      {groups.map((group, index) => <div className="resident-group" key={group.id}>
        <div className="resident-row">
          <label className="resident-relationship">Vínculo {index + 1}<select required value={group.relationship} onChange={e => update(group.id, { relationship: e.target.value as ResidentGroup['relationship'], other_relationship: '' })}><option value="" disabled>Selecione o vínculo</option>{residentRelationships.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}</select></label>
          <div className="resident-quantity"><label htmlFor={`quantity-${group.id}`}>Quantidade</label><div className="quantity-control"><input id={`quantity-${group.id}`} type="number" inputMode="numeric" min={1} max={20} required value={group.count} onChange={e => quantity(group, Number(e.target.value))}/><div><button type="button" disabled={group.count >= 20} aria-label={`Aumentar quantidade do vínculo ${index + 1}`} onClick={() => quantity(group, group.count + 1)}><ChevronUp size={16}/></button><button type="button" disabled={group.count <= 1} aria-label={`Diminuir quantidade do vínculo ${index + 1}`} onClick={() => quantity(group, group.count - 1)}><ChevronDown size={16}/></button></div></div></div>
          <button type="button" className="text-button resident-remove" aria-label={`Remover vínculo ${index + 1}`} onClick={() => remove(group)}><Trash2 size={17}/></button>
        </div>
        {group.relationship === 'other' && <label>Qual é o outro vínculo?<input required maxLength={100} value={group.other_relationship} onChange={e => update(group.id, { other_relationship: e.target.value })}/></label>}
        <button type="button" className="text-button resident-details-toggle" aria-expanded={expanded.includes(group.id)} aria-controls={`people-${group.id}`} onClick={() => setExpanded(expanded.includes(group.id) ? expanded.filter(id => id !== group.id) : [...expanded, group.id])}>{expanded.includes(group.id) ? <ChevronUp size={16}/> : <ChevronDown size={16}/>}Identificar pessoas ou contato (opcional){hasIdentity(group) && <span> · há dados cadastrados</span>}</button>
        <div id={`people-${group.id}`} hidden={!expanded.includes(group.id)}>
          <p className="small-note">Use nome completo se necessário para distinguir a pessoa. Celular somente para contato assistencial. Estes campos ficam no cadastro; não entram no SOAP nem são enviados à IA.</p>
          {Array.from({ length: group.count }, (_, i) => <div className="resident-person" key={i}><h3>Pessoa {i + 1} deste vínculo</h3><div className="resident-person-fields"><label htmlFor={`name-${group.id}-${i}`}>Nome completo (opcional)<input id={`name-${group.id}-${i}`} maxLength={120} autoComplete="off" value={group.members[i]?.name ?? ''} onChange={e => person(group, i, { name: e.target.value })}/></label><label htmlFor={`phone-${group.id}-${i}`}>Celular ou telefone com DDD (opcional)<input id={`phone-${group.id}-${i}`} type="tel" inputMode="tel" autoComplete="off" placeholder="(11) 99999-9999" value={phoneLabel(group.members[i]?.phone ?? '')} onChange={e => person(group, i, { phone: e.target.value.replace(/\D/g, '').slice(0, 11) })}/></label></div></div>)}
        </div>
      </div>)}
      <div className="resident-summary"><button type="button" className="secondary" disabled={groups.length >= 10} onClick={() => set('residents', [...groups, { id: crypto.randomUUID(), relationship: '', other_relationship: '', count: 1, members: [] }])}><Plus size={16}/>Adicionar vínculo</button>{groups.length > 0 && <p className="small-note">{groups.reduce((total, group) => total + group.count, 0)} pessoa(s) além do paciente. {groups.filter(g => g.relationship && (g.relationship !== 'other' || g.other_relationship.trim())).map(residentDescription).join(' · ')}</p>}</div>
      {(v.cohabitants || legacyNotes) ? <div><label htmlFor="cohabitants-notes">Relato complementar sobre os moradores<textarea id="cohabitants-notes" aria-describedby="cohabitants-help" maxLength={500} rows={2} value={v.cohabitants} placeholder="Outras informações relevantes sobre a moradia" onChange={e => set('cohabitants', e.target.value)}/></label><p id="cohabitants-help" className="small-note">Relatos anteriores foram preservados. Ao preencher vínculos, revise para não contar as mesmas pessoas duas vezes.</p></div> : <button type="button" className="text-button" onClick={() => setLegacyNotes(true)}>Acrescentar observação sobre os moradores</button>}
    </div>}
    <label>Há cuidador de referência?<select value={v.caregiver_status ?? ''} onChange={e => {
      if ((v.caregiver_name || v.caregiver_relationship || v.caregiver_notes) && !confirm('Alterar esta opção limpará os dados do cuidador. Continuar?')) return
      onChange({ ...v, caregiver_status: e.target.value as Household['caregiver_status'] || null, caregiver_name: '', caregiver_relationship: '', caregiver_notes: '' })
    }}><option value="">Não informado</option><option value="yes">Sim</option><option value="no">Não possui cuidador</option></select></label>
    {v.caregiver_status === 'yes' && <>
      <div className="resident-person-fields"><label>Nome ou iniciais do cuidador (opcional)<input maxLength={80} autoComplete="off" value={v.caregiver_name} placeholder="Ex.: M. ou Maria" onChange={e => set('caregiver_name', e.target.value)}/></label><label>Parentesco ou vínculo (opcional)<input maxLength={100} value={v.caregiver_relationship} list="caregiver-relationships" placeholder="Selecione ou digite" onChange={e => set('caregiver_relationship', e.target.value)}/><datalist id="caregiver-relationships">{residentRelationships.map(r => <option key={r.value} value={r.label}/>)}<option value="Cuidador(a) profissional"/><option value="Vizinho(a)"/></datalist></label></div>
      <label>Como participa dos cuidados? (opcional)<textarea maxLength={500} rows={2} value={v.caregiver_notes} placeholder="Ex.: auxilia com medicações durante o dia; não reside no domicílio." onChange={e => set('caregiver_notes', e.target.value)}/></label>
    </>}
    <p className="small-note">O cuidador pode morar em outro endereço. Morar na casa não significa ser responsável legal ou cuidador. CPF não é necessário para descrever a rede de apoio.</p>
    <p className="small-note">Ambiente de validação: use dados fictícios. Os cadastros ainda não têm controle de acesso por profissional.</p>
  </section>
}
