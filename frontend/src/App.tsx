import { useEffect, useRef, useState } from 'react'
import { useRegisterSW } from 'virtual:pwa-register/react'
import { ArrowLeft, ArrowRight, Check, ClipboardList, Plus, RefreshCw, ShieldCheck, Wifi, WifiOff } from 'lucide-react'
import VisitForm from './components/VisitForm'
import VisitSidebar from './components/VisitSidebar'
import ReleaseNotes from './components/ReleaseNotes'
import SoapResultCard from './components/SoapResultCard'
import { validateVitals } from './types/vitals'
import { emptyVisit, exampleVisit, type Draft, type LocalVisit, type Visit, type Vitals, type SOAPOutput } from './types/visit'
import { db, saveLocal } from './services/offlineDb'
import { generateSoap, syncVisits } from './services/api'
import { clinicalRuleError, localSoapOutput, restoreSoap, updateSoapVitals } from './services/soap'

const syncConfigured = import.meta.env.VITE_SYNC_CONFIGURED !== 'false'

export default function App() {
  const [visit, setVisit] = useState<Visit>(emptyVisit)
  const [soap, setSoap] = useState(''), [source, setSource] = useState('local'), [revision, setRevision] = useState(0)
  const [result, setResult] = useState<SOAPOutput | null>(null)
  function setOutput(next: SOAPOutput | null) { setResult(next); setSoap(next?.full_text_fallback ?? ''); setSource(next?.source ?? 'local') }
  const [tab, setTab] = useState<'visit' | 'history'>('visit'), [review, setReview] = useState(false)
  const [rows, setRows] = useState<LocalVisit[]>([]), [ready, setReady] = useState(false)
  const [online, setOnline] = useState(navigator.onLine), [syncing, setSyncing] = useState(false), [aiBusy, setAiBusy] = useState(false)
  const [notice, setNotice] = useState(''), [storageError, setStorageError] = useState(''), [draftSaved, setDraftSaved] = useState(false)
  const swRegistration = useRef<ServiceWorkerRegistration | undefined>(undefined)
  const { offlineReady: [offlineReady], needRefresh: [needRefresh], updateServiceWorker } = useRegisterSW({
    onRegisteredSW(_url, registration) {
      swRegistration.current = registration
      if (navigator.onLine) void registration?.update().catch(() => {})
    },
  })
  useEffect(() => {
    const check = () => { if (navigator.onLine) void swRegistration.current?.update().catch(() => {}) }
    window.addEventListener('focus', check); window.addEventListener('online', check)
    return () => { window.removeEventListener('focus', check); window.removeEventListener('online', check) }
  }, [])
  const form = useRef<HTMLFormElement>(null)
  const editVersion = useRef(0)
  const currentEditor = useRef({ visit, soap })
  currentEditor.current = { visit, soap }
  async function refresh() {
    const records = (await db.visits.toArray()).sort((a, b) => b.visit.visited_at.localeCompare(a.visit.visited_at))
    setRows(records)
    const editor = currentEditor.current
    const own = records.find(r => r.visit.id === editor.visit.id)
    const normalized = (v: Visit) => JSON.stringify({ ...v, visited_at: new Date(v.visited_at).toISOString() }, (_, value) => value && typeof value === 'object' && !Array.isArray(value) ? Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b))) : value)
    if (own && !own.conflict && normalized(own.visit) === normalized(editor.visit) && own.soap_text === editor.soap) setRevision(own.revision)
  }
  useEffect(() => {
    void (async () => { try { const draft = await db.drafts.get('active'); if (draft) { setVisit(draft.visit); setOutput(draft.soap ? restoreSoap(draft.visit, draft.soap, draft.soap_blocks) : null); setReview(Boolean(draft.soap)); setRevision(draft.baseRevision) } await refresh(); setReady(true) } catch { setStorageError('Armazenamento local indisponível. Libere o IndexedDB no navegador antes de registrar visitas.') } })()
    const on = () => setOnline(true), off = () => setOnline(false)
    window.addEventListener('online', on); window.addEventListener('offline', off)
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off) }
  }, [])
  useEffect(() => {
    if (!ready) return
    let active = true
    setDraftSaved(false)
    const draft: Draft & { key: string } = { key: 'active', visit, soap, soap_blocks: result, baseRevision: revision, source }
    void db.drafts.put(draft).then(() => { if (active) setDraftSaved(true) }).catch(() => setStorageError('Não foi possível salvar o rascunho. Verifique o espaço e as permissões do navegador.'))
    return () => { active = false }
  }, [visit, soap, result, revision, source, ready])
  async function sync(manual = false) {
    if (!syncConfigured) { if (manual) setNotice('Sincronização ainda não configurada. Seus registros ficam salvos neste dispositivo.'); return }
    if (!navigator.onLine) { if (manual) setNotice('Sem conexão. Suas visitas permanecem neste dispositivo.'); return }
    setSyncing(true)
    try { await syncVisits(); await refresh(); if (manual) setNotice('Sincronização concluída. Confira possíveis conflitos no histórico.') }
    catch (e) { if (manual) setNotice(`${(e as Error).message} As visitas continuam salvas neste dispositivo.`) }
    finally { setSyncing(false) }
  }
  useEffect(() => {
    if (!ready || !online || !syncConfigured) return
    void sync()
    const timer = setInterval(() => { void sync() }, 30000)
    const focus = () => { void sync() }
    window.addEventListener('focus', focus)
    return () => { clearInterval(timer); window.removeEventListener('focus', focus) }
  }, [ready, online])
  function change(v: Visit) { editVersion.current++; setVisit(v); setOutput(null); setReview(false) }
  function validate() {
    if (!form.current?.reportValidity()) return false
    if (!visit.patient_code.trim() || !Number.isInteger(visit.age) || visit.age < 0 || visit.age > 130) { setNotice('Informe código e idade válida.'); return false }
    if (!visit.conditions.length) { setNotice('Selecione ao menos uma condição acompanhada.'); return false }
    const ruleError = clinicalRuleError(visit)
    if (ruleError) { setNotice(ruleError); window.scrollTo({ top: 0, behavior: 'smooth' }); return false }
    const vitalsError = validateVitals(visit.vitals)
    if (vitalsError) { setNotice(vitalsError); return false }
    if (Object.values(visit.exam).some(f => f.status === 'Alterado' && !f.notes.trim())) { setNotice('Descreva as alterações selecionadas no exame.'); return false }
    return true
  }
  function generate() { if (!validate()) return; setOutput(localSoapOutput(visit)); setReview(true); setNotice(''); window.scrollTo({ top: 0, behavior: 'smooth' }) }
  function applyVitals(vitals: Vitals) {
    if (!result) return false
    const next = updateSoapVitals(visit, result, vitals)
    if (next.visit !== visit) {
      editVersion.current++
      setVisit(next.visit)
      setOutput(next.result)
    }
    return next.needsReview
  }
  async function ai() {
    if (!syncConfigured) { setNotice('Esta versão funciona em modo local. Revise a evolução já gerada para copiar ao VitaCare.'); return }
    if (soap && !confirm('O texto revisado será substituído pelo resultado do servidor. Continuar?')) return
    if (!navigator.onLine) { setNotice('Sem conexão. A evolução local já está disponível para revisão.'); return }
    const version = editVersion.current
    setAiBusy(true)
    try { const next = await generateSoap(visit); if (version === editVersion.current) { setOutput(next); setNotice(next.source === 'ai' ? 'Texto organizado por IA. Revise antes de copiar.' : 'Gerador determinístico utilizado. Revise antes de copiar.') } }
    catch { setNotice('Servidor indisponível. Sua evolução local e suas edições foram preservadas.') }
    finally { setAiBusy(false) }
  }
  async function save() {
    try { await saveLocal(visit, soap, revision, result); await refresh(); setNotice('Visita salva neste dispositivo. Sincronização pendente até confirmação do servidor.'); void sync() }
    catch { setStorageError('Não foi possível salvar a visita. Mantenha esta tela aberta e copie a evolução.') }
  }
  function replace(v: Visit, text = '', rev = 0, blocks?: SOAPOutput | null) { editVersion.current++; setVisit(v); setOutput(text ? restoreSoap(v, text, blocks) : null); setRevision(rev); setTab('visit'); setReview(Boolean(text)); setNotice(''); window.scrollTo({ top: 0 }) }
  function newVisit(example = false) { if ((visit.patient_code || soap) && !confirm('Iniciar outro registro? Salve a visita atual no histórico para mantê-la.')) return; replace(example ? exampleVisit() : emptyVisit()) }
  async function resolve(row: LocalVisit, keepLocal: boolean) {
    if (!row.conflict) return
    try { await db.visits.put(keepLocal ? { ...row, revision: row.conflict.revision, conflict: undefined, localVersion: row.localVersion + 1, pending: true } : { ...row.conflict, pending: false, localVersion: row.localVersion + 1 }); await refresh(); if (keepLocal) void sync() }
    catch { setNotice('Não foi possível resolver o conflito. Tente novamente.') }
  }
  function openTab(next: 'visit' | 'history') {
    setTab(next)
    window.scrollTo({ top: 0 })
  }

  const pending = rows.filter(r => r.pending).length
  const today = new Date().toLocaleDateString('pt-BR')
  const todayRows = rows.filter(r => new Date(r.visit.visited_at).toLocaleDateString('pt-BR') === today)
  return <div className="app-shell">
    <header className="topbar">
      <a href="/" className="brand" onClick={e => { e.preventDefault(); openTab('visit') }}>
        <img className="brand-icon" src="/icon.svg" alt="" width="44" height="44"/>
        <span>Visitário<small>Registro de visitas domiciliares</small></span>
      </a>
      <span className={`connection ${online ? '' : 'offline'}`}>{online ? <Wifi size={16}/> : <WifiOff size={16}/>}<span>{online ? 'Com conexão' : 'Modo offline'}</span></span>
    </header>
    <div className="workspace">
      <VisitSidebar tab={tab} todayCount={todayRows.length} showSections={ready && tab === 'visit' && !review}
        offlineReady={offlineReady || Boolean(navigator.serviceWorker?.controller)}
        storageReady={ready} storageError={Boolean(storageError)} onSelect={openTab}/>
    <main><div className="page-heading"><div><h1>{tab === 'history' ? 'Histórico de visitas' : review ? 'Revisão da evolução SOAP' : 'Registro da visita'}</h1><p>{tab === 'history' ? (syncConfigured ? 'Registros salvos neste dispositivo e visitas de hoje vindas do servidor.' : 'Registros salvos neste dispositivo.') : review ? 'Confira a evolução antes de salvar ou copiar para o prontuário.' : 'Preencha os dados da visita para gerar a evolução SOAP.'}</p></div><span className="date-label">{new Intl.DateTimeFormat('pt-BR', { day: 'numeric', month: 'short' }).format(new Date())}</span></div>
      <div className="status-strip"><span><span className="status-dot"/>{!syncConfigured ? 'Modo local · registros neste dispositivo' : pending ? `${pending} visita(s) aguardando sincronização` : 'Registros locais em dia'}</span><button type="button" onClick={() => void sync(true)} disabled={syncing}><RefreshCw size={14} className={syncing ? 'spin' : ''}/>{syncing ? 'Sincronizando' : 'Sincronizar'}</button></div>
      {needRefresh && <div className="notice">Nova versão disponível. Salve a visita antes de atualizar. <button onClick={() => void updateServiceWorker(true)}>Atualizar aplicativo</button></div>}
      {storageError && <div role="alert" className="error notice">{storageError}</div>}
      {notice && <div role="status" className="notice">{notice}<button aria-label="Fechar aviso" onClick={() => setNotice('')}>×</button></div>}
      {!ready ? <div className="panel">Abrindo armazenamento local…</div> : tab === 'history' ? <>
        <div className="history-heading"><h2>Hoje <span className="muted">/ {todayRows.length} visitas</span></h2><button className="secondary" onClick={() => newVisit()}><Plus size={16}/>Nova visita</button></div>
        {!rows.length && <div className="panel empty"><ClipboardList size={34}/><h2>Nenhuma visita salva</h2><p>As visitas salvas aparecerão neste histórico.</p><button className="primary" onClick={() => newVisit()}>Registrar primeira visita</button></div>}
        {rows.map(row => <article className="panel history-card" key={row.visit.id}><div className="history-meta"><span className="patient-avatar">{row.visit.patient_code.slice(0, 2)}</span><div><h2>{row.visit.patient_code} <span className="muted">· {row.visit.age} anos</span></h2><p>{new Date(row.visit.visited_at).toLocaleString('pt-BR')} · {row.visit.conditions.join(', ')}</p></div><span className={`save-state ${row.pending ? 'waiting' : ''}`}>{row.conflict ? 'Conflito' : row.pending ? 'No dispositivo' : 'Sincronizada'}</span></div><p className="history-preview">{row.soap_text.slice(0, 180)}…</p><button className="text-button" onClick={() => { if ((visit.patient_code || soap) && visit.id !== row.visit.id && !confirm('Abrir esta visita substituirá o rascunho atual. Continuar?')) return; replace(row.visit, row.soap_text, row.revision, row.soap_blocks) }}>Abrir evolução <ArrowRight size={16}/></button>{row.conflict && <div className="conflict"><strong>Existe outra edição no servidor.</strong><pre>{row.conflict.soap_text}</pre><p>Seu texto local foi preservado. Escolha qual versão manter.</p><button className="secondary" onClick={() => void resolve(row, false)}>Usar versão do servidor</button><button className="secondary" onClick={() => void resolve(row, true)}>Manter minha versão e reenviar</button></div>}</article>)}
      </> : <>
        <div className="form-topline"><div className="breadcrumb" aria-label="Etapas da visita"><span className={!review ? 'current' : ''} aria-current={!review ? 'step' : undefined}>Registro</span><ArrowRight size={14} aria-hidden="true"/><span className={review ? 'current' : ''} aria-current={review ? 'step' : undefined}>Revisão SOAP</span></div><span className="draft-state">{draftSaved && <Check size={14} aria-hidden="true"/>}{draftSaved ? 'Rascunho salvo' : 'Salvando rascunho…'}</span></div>
        <form ref={form} onSubmit={e => { e.preventDefault(); generate() }}>
          <div hidden={review}>
            <section className="example-banner">
              <img src="/brand/visitario/visita-app.webp" width="120" height="80" alt=""/>
              <div><h2>Caso clínico fictício</h2><p>Experimente o fluxo com um formulário preenchido.</p></div>
              <button type="button" className="secondary" onClick={() => newVisit(true)}>Preencher exemplo <ArrowRight size={16} aria-hidden="true"/></button>
            </section>
            <VisitForm key={visit.id} value={visit} onChange={change}/>
            <div className="form-bottom"><span><ShieldCheck size={16}/>Seus dados ficam salvos neste dispositivo.</span><button type="submit" className="primary">Gerar evolução SOAP <ArrowRight size={19}/></button></div>
          </div>
          {review && <><button type="button" className="text-button back" onClick={() => { editVersion.current++; setReview(false) }}><ArrowLeft size={17}/>Voltar ao registro</button>{result && <SoapResultCard key={visit.id} visit={visit} result={result} busy={aiBusy} serverAvailable={syncConfigured} onChange={next => { editVersion.current++; setOutput(next) }} onVitalsChange={applyVitals} onAI={() => void ai()} onSave={() => void save()}/>}<button type="button" className="secondary" onClick={() => newVisit()}><Plus size={17}/>Iniciar nova visita</button></>}
        </form>
      </>}
      <footer className="main-footer">
        Feito para apoiar o registro clínico. Toda evolução precisa de revisão médica.<br/>
        Ambiente de validação · use casos fictícios ou anonimizados.
        <ReleaseNotes
          updateAvailable={needRefresh}
          getRegistration={() => swRegistration.current ?? navigator.serviceWorker?.getRegistration()}
          onUpdate={() => void updateServiceWorker(true)}
        />
      </footer>
    </main></div>
    <nav className="mobile-nav" aria-label="Navegação principal">
      <button className={tab === 'visit' ? 'active' : ''} aria-current={tab === 'visit' ? 'page' : undefined} onClick={() => openTab('visit')}><Plus size={21}/>Visita</button>
      <button className={tab === 'history' ? 'active' : ''} aria-current={tab === 'history' ? 'page' : undefined} onClick={() => openTab('history')}><ClipboardList size={21}/>Histórico {pending > 0 && `(${pending})`}</button>
    </nav>
  </div>
}
