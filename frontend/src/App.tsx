import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useRegisterSW } from 'virtual:pwa-register/react'
import { ArrowLeft, ArrowRight, Check, Plus } from 'lucide-react'
import GlassIcon from './components/GlassIcon'
import WorkspaceTools from './components/WorkspaceTools'
import { ProfileProvider, useProfile } from './components/ProfessionalProfile'
import DoctorAccess from './components/DoctorAccess'
import VisitForm from './components/VisitForm'
import VisitAudio from './components/VisitAudio'
import { listAudio, purgeExpiredAudio } from './services/audioVault'
import { MobileNavigation } from './components/VisitNavigation'
import VisitHistory from './components/VisitHistory'
import VisitSidebar from './components/VisitSidebar'
import ReleaseNotes from './components/ReleaseNotes'
import SoapResultCard from './components/SoapResultCard'
import { formatRegistration, readRegistration } from './types/medicalRegistration'
import { validateVitals } from './types/vitals'
import { emptyVisit, exampleVisit, type Draft, type LocalVisit, type Visit, type Vitals, type SOAPOutput } from './types/visit'
import { db, saveLocal } from './services/offlineDb'
import { generateSoap, syncVisits } from './services/api'
import { clinicalRuleError, generalVisitError, localSoapOutput, restoreSoap, updateSoapVitals } from './services/soap'

const syncConfigured = import.meta.env.VITE_SYNC_CONFIGURED !== 'false'

export default function App() {
  const [preference, setPreference] = useState<'dark' | 'light' | null>(() => {
    try {
      const saved = localStorage.getItem('visitario.theme')
      return saved === 'dark' || saved === 'light' ? saved : null
    } catch { return null }
  })
  const [systemDark, setSystemDark] = useState(() => window.matchMedia('(prefers-color-scheme: dark)').matches)
  const dark = preference ? preference === 'dark' : systemDark
  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const sync = () => setSystemDark(media.matches)
    media.addEventListener('change', sync)
    sync()
    return () => media.removeEventListener('change', sync)
  }, [])
  useLayoutEffect(() => {
    document.documentElement.dataset.theme = dark ? 'dark' : 'light'
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#141416' : '#145b49')
  }, [dark])
  function toggleTheme() {
    const next = dark ? 'light' : 'dark'
    setPreference(next)
    try { localStorage.setItem('visitario.theme', next) } catch { /* Continua nesta sessão. */ }
  }
  const [entered, setEntered] = useState(() => {
    try { return sessionStorage.getItem('visitario.demo') === '1' } catch { return false }
  })
  function changeSession(active: boolean) {
    try {
      if (active) sessionStorage.setItem('visitario.demo', '1')
      else sessionStorage.removeItem('visitario.demo')
    } catch { /* Session remains available in memory. */ }
    setEntered(active)
    window.scrollTo(0, 0)
  }
  return <ProfileProvider>{entered ? <VisitWorkspace dark={dark} toggleTheme={toggleTheme} onExit={() => changeSession(false)}/> : <DoctorAccess onEnter={() => changeSession(true)}/>}</ProfileProvider>
}

function VisitWorkspace({ onExit, dark, toggleTheme }: { onExit: () => void; dark: boolean; toggleTheme: () => void }) {
  const advisor = useRef<HTMLDialogElement>(null)
  const { profile } = useProfile()
  const crm = readRegistration(profile?.registration)
  const registration = formatRegistration(crm.number, crm.state)
  const [step, setStep] = useState<"general" | "soap">("general")
  const [audioBusy, setAudioBusy] = useState(false)
  const [visit, setVisit] = useState<Visit>(emptyVisit)
  const [soap, setSoap] = useState(''), [source, setSource] = useState('local'), [revision, setRevision] = useState(0)
  const [result, setResult] = useState<SOAPOutput | null>(null)
  function setOutput(next: SOAPOutput | null) { setResult(next); setSoap(next?.full_text_fallback ?? ''); setSource(next?.source ?? 'local') }
  const [tab, setTab] = useState<'home' | 'visit' | 'history'>('home'), [review, setReview] = useState(false)
  const [hasDraft, setHasDraft] = useState(false)
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
  useEffect(() => {
    const purge = () => { void purgeExpiredAudio().catch(() => {}) }
    purge()
    const timer = setInterval(purge, 15000)
    return () => clearInterval(timer)
  }, [])
  const form = useRef<HTMLFormElement>(null)
  const editVersion = useRef(0)
  const currentEditor = useRef({ visit, soap })
  currentEditor.current = { visit, soap }
  async function refresh() {
    const records = (await db.visits.toArray()).sort((a, b) => Date.parse(b.visit.visited_at) - Date.parse(a.visit.visited_at))
    setRows(records)
    const editor = currentEditor.current
    const own = records.find(r => r.visit.id === editor.visit.id)
    const normalized = (v: Visit) => JSON.stringify({ ...v, visited_at: new Date(v.visited_at).toISOString() }, (_, value) => value && typeof value === 'object' && !Array.isArray(value) ? Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b))) : value)
    if (own && !own.conflict && normalized(own.visit) === normalized(editor.visit) && own.soap_text === editor.soap) setRevision(own.revision)
  }
  useEffect(() => {
    void (async () => { try { const draft = await db.drafts.get('active'); if (draft) { setHasDraft(true); setStep(draft.soap || draft.step === "soap" ? "soap" : "general"); setVisit(draft.visit); setOutput(draft.soap ? restoreSoap(draft.visit, draft.soap, draft.soap_blocks) : null); setReview(Boolean(draft.soap)); setRevision(draft.baseRevision) } await refresh(); setReady(true) } catch { setStorageError('Armazenamento local indisponível. Libere o IndexedDB no navegador antes de registrar visitas.') } })()
    const on = () => setOnline(true), off = () => setOnline(false)
    window.addEventListener('online', on); window.addEventListener('offline', off)
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off) }
  }, [])
  useEffect(() => {
    if (!ready || !hasDraft) return
    let active = true
    setDraftSaved(false)
    const draft: Draft & { key: string } = { key: 'active', step, visit, soap, soap_blocks: result, baseRevision: revision, source }
    void db.drafts.put(draft).then(() => { if (active) setDraftSaved(true) }).catch(() => setStorageError('Não foi possível salvar o rascunho. Verifique o espaço e as permissões do navegador.'))
    return () => { active = false }
  }, [visit, soap, result, revision, source, ready, hasDraft, step])
  const [syncFailed, setSyncFailed] = useState(false)
  const syncInProgress = useRef(false)
  async function sync() {
    if (!syncConfigured || !navigator.onLine || syncInProgress.current) return
    syncInProgress.current = true
    setSyncing(true)
    try {
      await syncVisits()
      await refresh()
      setSyncFailed(false)
    } catch {
      setSyncFailed(true)
      await refresh().catch(() => {})
    } finally {
      syncInProgress.current = false
      setSyncing(false)
    }
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
    if (!visit.patient_code.trim() || visit.age == null || !Number.isInteger(visit.age) || visit.age < 0 || visit.age > 130) { setNotice('Informe código e idade válida.'); return false }
    if (!visit.conditions.length && !visit.visit_reason.trim()) { setNotice('Informe o motivo do atendimento ou selecione ao menos uma condição acompanhada.'); return false }
    const ruleError = step === "general" ? generalVisitError(visit) : clinicalRuleError(visit)
    if (ruleError) { setNotice(ruleError); window.scrollTo({ top: 0, behavior: 'smooth' }); return false }
    if (step === "general") return true
    const vitalsError = validateVitals(visit.vitals)
    if (vitalsError) { setNotice(vitalsError); return false }
    if (Object.values(visit.exam).some(f => f.status === 'Alterado' && !f.notes.trim())) { setNotice('Descreva as alterações selecionadas no exame.'); return false }
    return true
  }
  function advanceVisit() {
    if (audioBusy) { setNotice('Encerre e salve a gravação para continuar.'); return }
    if (!validate()) { window.scrollTo({ top: 0 }); return }
    if (step === 'general') {
      setStep('soap'); setNotice(''); window.scrollTo({ top: 0 }); return
    }
    const hasClinicalEntry = visit.complaints.length || visit.actions.length || visit.adherence !== 'Não informado'
      || [visit.visit_reason, visit.follow_up_owner, visit.subjective_notes, visit.assessment, visit.plan_notes, visit.medications_in_use, visit.recent_medications, visit.vitals_context].some(text => text?.trim())
      || Object.values(visit.vitals).some(value => value != null)
      || Object.values(visit.exam).some(finding => finding.status !== 'Não avaliado' || finding.notes.trim())
      || visit.bp_target || visit.lab_results || visit.neuro_exam
      || Object.values(visit.womens_health ?? {}).some(screening => screening.status || screening.year || screening.notes.trim())
    if (!hasClinicalEntry) {
      setNotice('Registre um relato, achado, avaliação ou conduta antes de gerar a evolução.')
      window.scrollTo({ top: 0 })
      return
    }
    setOutput(localSoapOutput(visit))
    setReview(true)
    setNotice('')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }
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
    if (!syncConfigured) { setNotice('A evolução desta visita está disponível para revisão neste dispositivo.'); return }
    if (soap && !confirm('Gerar uma nova versão a partir dos dados da visita? O servidor poderá usar IA. A nova versão substituirá o texto atual, inclusive suas edições.')) return
    if (!navigator.onLine) { setNotice('Sem conexão para gerar uma nova versão. Você pode continuar revisando o texto atual.'); return }
    const version = editVersion.current
    setAiBusy(true)
    try { const next = await generateSoap(visit); if (version === editVersion.current) { setOutput(next); setNotice(next.source === 'ai' ? 'Nova versão preparada com IA. Confira o texto antes de usá-lo no prontuário.' : 'Nova versão preparada com os dados da visita, sem uso de IA.') } }
    catch { setNotice('Não foi possível gerar uma nova versão. Suas edições continuam disponíveis.') }
    finally { setAiBusy(false) }
  }
  async function save() {
    if (audioBusy) { setNotice('Encerre e salve o áudio antes de concluir a visita.'); return }
    const version = editVersion.current
    try { await saveLocal(visit, soap, revision, result);
      if (version === editVersion.current) {
        setHasDraft(false)
        setTab('history')
        window.scrollTo({ top: 0 })
      }
      await refresh(); setNotice('Visita salva neste dispositivo.'); void sync() }
    catch { setStorageError('Não foi possível salvar a visita. Mantenha esta tela aberta e copie a evolução.') }
  }
  function replace(v: Visit, text = '', rev = 0, blocks?: SOAPOutput | null) { editVersion.current++; setStep(text ? "soap" : "general"); setHasDraft(true); setVisit(v); setOutput(text ? restoreSoap(v, text, blocks) : null); setRevision(rev); setTab('visit'); setReview(Boolean(text)); setNotice(''); window.scrollTo({ top: 0 }) }
  async function canLeaveVisit() {
    if (audioBusy) { setNotice('Encerre e salve o áudio antes de iniciar outra visita.'); return false }
    try {
      if ((await listAudio(visit.id)).length && !rows.some(r => r.visit.id === visit.id)) {
        setNotice('Esta visita tem áudio. Gere a evolução e salve no histórico antes de abrir outra visita, ou exclua os áudios.')
        return false
      }
      return true
    } catch { setNotice('Não foi possível conferir os áudios desta visita. Tente novamente antes de iniciar outra.'); return false }
  }
  async function newVisit(example = false) {
    if (hasDraft && !await canLeaveVisit()) return
    if (hasDraft && !confirm('Iniciar outro registro? Salve a visita atual no histórico para mantê-la.')) return
    replace(example ? exampleVisit() : emptyVisit())
  }
  async function resolve(row: LocalVisit, keepLocal: boolean) {
    if (!row.conflict) return
    try { await db.visits.put(keepLocal ? { ...row, revision: row.conflict.revision, conflict: undefined, localVersion: row.localVersion + 1, pending: true } : { ...row.conflict, pending: false, localVersion: row.localVersion + 1 }); await refresh(); if (keepLocal) void sync() }
    catch { setNotice('Não foi possível resolver o conflito. Tente novamente.') }
  }
  function openTab(next: 'home' | 'visit' | 'history') {
    if (audioBusy) { setNotice('Encerre e salve o áudio antes de trocar de tela.'); return }
    setTab(next)
    window.scrollTo({ top: 0 })
  }

  const pending = rows.filter(r => r.pending).length
  const queued = rows.filter(row => row.pending && !row.conflict).length
  const today = new Date().toLocaleDateString('pt-BR')
  const todayRows = rows.filter(r => new Date(r.visit.visited_at).toLocaleDateString('pt-BR') === today)
  return <div className="app-shell">
    <div className="workspace">
      <VisitSidebar onAdvisor={() => advisor.current?.showModal()} tab={tab} todayCount={todayRows.length} showSections={ready && tab === 'visit' && !review}
        step={step} onSelect={openTab}/>
    <main>
      <WorkspaceTools advisor={advisor} releaseNotes={<ReleaseNotes
          updateAvailable={needRefresh}
          getRegistration={() => swRegistration.current ?? navigator.serviceWorker?.getRegistration()}
          onUpdate={() => void updateServiceWorker(true)}
        />} dark={dark} toggleTheme={toggleTheme} online={online} localOnly={!syncConfigured}
        pending={pending} conflicts={rows.filter(row => row.conflict).length} ready={ready} storageError={storageError}
        hasDraft={hasDraft} canExit={!audioBusy && (!hasDraft || draftSaved)} onExit={onExit}
        onHistory={() => openTab('history')} onHome={() => openTab('home')}
        stage={tab === 'visit' ? review ? 'Revisão' : step === 'general' ? 'Dados gerais' : 'SOAP' : undefined}
        offlineReady={offlineReady || Boolean(navigator.serviceWorker?.controller)}
        location={tab === 'home' ? 'Página inicial' : tab === 'history' ? 'Histórico' : 'Atendimento'}/>
      {!online && <p className="offline-line">Modo offline · registros neste dispositivo</p>}
      <div className="page-heading"><div><h1>{tab === 'home' ? 'Minhas visitas' : tab === 'history' ? 'Histórico de visitas' : review ? 'Revisão da evolução SOAP' : step === 'soap' ? 'Preenchimento SOAP' : 'Dados gerais da visita'}</h1><p>{tab === 'home' ? 'Inicie uma visita domiciliar ou consulte os registros anteriores.' : tab === 'history' ? (syncConfigured ? 'Registros salvos neste dispositivo e visitas de hoje vindas do servidor.' : 'Registros salvos neste dispositivo.') : review ? 'A revisão médica é obrigatória. Confira os dados e ajuste o texto antes de salvar a visita ou copiá-lo para o prontuário.' : step === 'soap' ? 'Registre o que o paciente relatou, o que você observou e o plano de cuidado.' : 'Identifique o paciente, a equipe e a rede de apoio.'}</p></div></div>
      {needRefresh && <div className="notice">Nova versão disponível. Salve a visita antes de atualizar. <button onClick={() => void updateServiceWorker(true)}>Atualizar aplicativo</button></div>}
      {storageError && <div role="alert" className="error notice">{storageError}</div>}
      {notice && <div role="status" className="notice">{notice}<button aria-label="Fechar aviso" onClick={() => setNotice('')}>×</button></div>}
      {!ready ? <div className="panel">Abrindo armazenamento local…</div> : tab === 'home' ? <>
        <div className="home-layout"><section className="panel visit-start">
          <div>
            <h2>{hasDraft ? 'Visita em andamento' : 'Nova visita domiciliar'}</h2>
            <p>{hasDraft
              ? [visit.patient_code, new Date(visit.visited_at).toLocaleDateString('pt-BR'), review ? 'Revisão da evolução' : 'Registro em preenchimento'].filter(Boolean).join(' · ')
              : 'Abra um registro para começar o atendimento.'}</p>
            <div className="start-actions">
              {hasDraft && <button type="button" className="primary" onClick={() => openTab('visit')}>Continuar visita <ArrowRight size={17}/></button>}
              <button type="button" className={hasDraft ? 'secondary' : 'primary'} onClick={() => void newVisit()}><Plus size={17}/>Nova visita</button>
            </div>
          </div>
          <img src="/brand/visitario/visita-app.webp" alt="" width="120" height="80"/>
        </section>
        <section className="panel home-history"><h2>Visitas de hoje</h2><strong>{todayRows.length}</strong>
          <p>{todayRows.length === 1 ? 'visita salva neste dispositivo' : 'visitas salvas neste dispositivo'}</p>
          <button type="button" className="text-button" onClick={() => openTab('history')}>Consultar histórico <ArrowRight size={16}/></button>
        </section></div>
        <section className="example-banner">
          <div><h2>Caso clínico fictício</h2><p>Abra uma visita de exemplo para editar os dados e gerar a evolução SOAP.</p></div>
          <button type="button" className="secondary" onClick={() => void newVisit(true)}>Preencher exemplo <ArrowRight size={16}/></button>
        </section>
      </> : tab === 'history' ? <>
        {syncConfigured && queued > 0 && <div className="sync-queue">
          <p role="status"><strong>{queued === 1 ? '1 visita aguarda envio.' : `${queued} visitas aguardam envio.`}</strong>{' '}
            {!online ? 'O envio é automático quando a conexão voltar.' : syncing ? 'Enviando ao servidor…' : syncFailed ? 'A última tentativa falhou. Os registros continuam neste dispositivo.' : 'O envio é automático.'}
          </p>
          {online && syncFailed && <button className="text-button" disabled={syncing} onClick={() => void sync()}><GlassIcon name="sincronizacao" size={22}/>Tentar novamente</button>}
        </div>}
        <VisitHistory rows={rows} today={today} onNew={() => newVisit()} onResolve={resolve} onOpen={async row => {
          if (hasDraft && visit.id !== row.visit.id && !await canLeaveVisit()) return
          if (hasDraft && visit.id !== row.visit.id && !confirm('Abrir esta visita substituirá o rascunho atual. Continuar?')) return
          replace(row.visit, row.soap_text, row.revision, row.soap_blocks)
        }}/>
      </> : <>
        {!review && <>
          <form id="visit-fields" ref={form} onSubmit={e => { e.preventDefault(); advanceVisit() }}>
            {step === 'soap' && <button type="button" className="text-button back" onClick={() => { setStep('general'); setNotice(''); window.scrollTo({ top: 0 }) }}><ArrowLeft size={17}/>Voltar aos dados gerais</button>}
            <VisitForm step={step} key={visit.id} value={visit} onChange={change}/>
          </form>
        {step === 'general' && !review && <VisitAudio key={visit.id} visitId={visit.id} onBusy={setAudioBusy}
          professional={profile ? registration ? `${profile.name} / ${registration}` : '' : 'Médico de demonstração'}/>}
          <div className="form-bottom">
            <span className="draft-state">{!storageError && draftSaved && <Check size={14} aria-hidden="true"/>}
              {storageError ? 'Confira o aviso de armazenamento.' : draftSaved ? 'Rascunho salvo neste dispositivo' : 'Salvando rascunho…'}
            </span>
            <button type="submit" form="visit-fields" className="primary" disabled={audioBusy}>{step === 'general' ? 'Continuar para SOAP' : 'Gerar evolução SOAP'} <ArrowRight size={19}/></button>
          </div>
        </>}
          {review && <><button type="button" className="text-button back" onClick={() => { editVersion.current++; setReview(false) }}><ArrowLeft size={17}/>Voltar aos dados clínicos</button>{result && <SoapResultCard key={visit.id} visit={visit} result={result} busy={aiBusy} serverAvailable={syncConfigured} onChange={next => { editVersion.current++; setOutput(next) }} onVitalsChange={applyVitals} onAI={() => void ai()} onSave={() => void save()}/>}<button type="button" className="secondary" onClick={() => newVisit()}><Plus size={17}/>Iniciar nova visita</button></>}
      </>}

    </main></div>
    <MobileNavigation step={step} tab={tab} pending={pending} showSections={ready && tab === 'visit' && !review} onSelect={openTab}/>
  </div>
}
