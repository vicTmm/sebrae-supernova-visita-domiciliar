import { UsersRound } from 'lucide-react'
import { emptyCompanions, type Companions } from '../types/visit'

export default function CompanionsSection({ value: c, onChange }: { value: Companions; onChange: (c: Companions) => void }) {
  function toggle(key: 'has_acs' | 'has_student' | 'has_nurse' | 'is_solo') {
    if (key === 'is_solo') { onChange({ ...emptyCompanions(), is_solo: !c.is_solo }); return }
    const next = { ...c, [key]: !c[key], is_solo: false }
    if (!next.has_acs) next.acs_name = null
    if (!next.has_student) next.student_name = null
    if (!next.has_nurse) next.nurse_name = null
    onChange(next)
  }
  return <section className="panel visit-section" id="visit-team" tabIndex={-1}><div className="section-title"><UsersRound/><div><h2>Equipe na Visita</h2><p>Selecione quem participou. Sem seleção: equipe não informada.</p></div></div>
    <fieldset><legend>Acompanhantes da equipe</legend><div className="choices team-choices">
      {([['has_acs', 'ACS'], ['has_student', 'Estudante'], ['has_nurse', 'Enfermeiro(a) / Técnico(a)'], ['is_solo', 'Apenas Médico']] as const).map(([key, label]) => <label key={key} className={`chip ${c[key] ? 'selected' : ''}`}><input type="checkbox" checked={c[key]} onChange={() => toggle(key)} />{label}</label>)}
    </div></fieldset>
    <div className="exam-list">{c.has_acs && <label>Nome da ACS (opcional)<input maxLength={80} value={c.acs_name ?? ''} placeholder="Ex.: Maria" onChange={e => onChange({ ...c, acs_name: e.target.value || null })} /></label>}
    {c.has_student && <label>Nome do estudante (opcional)<input maxLength={80} value={c.student_name ?? ''} placeholder="Ex.: João" onChange={e => onChange({ ...c, student_name: e.target.value || null })} /></label>}
    {c.has_nurse && <label>Nome do enfermeiro(a) / técnico(a) (opcional)<input maxLength={80} value={c.nurse_name ?? ''} placeholder="Ex.: Ana" onChange={e => onChange({ ...c, nurse_name: e.target.value || null })}/></label>}</div>
    {c.is_solo && <p className="small-note">Visita sem acompanhantes da equipe. O nome do médico responsável ainda não é registrado nesta versão.</p>}
  </section>
}
