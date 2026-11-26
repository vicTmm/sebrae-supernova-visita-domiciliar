import ProfilePhoto from './ProfilePhoto'
import GlassIcon from './GlassIcon'
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { LogOut, X } from 'lucide-react'
import { formatRegistration, readRegistration, registrationStates, validRegistrationNumber } from '../types/medicalRegistration'
import './profile-settings.css'

// unit e specialty podem existir em perfis antigos, mas não são mais pedidos nem salvos.
type Profile = { name: string; registration?: string; photo?: string; phone?: string; email?: string; unit?: string; specialty?: string }
const key = 'visitario.professional-profile'
const ProfileContext = createContext<{ profile: Profile | null; save: (value: Profile) => void } | null>(null)

function formatProfessionalName(name: string) {
  const particles = /^(da|das|de|do|dos|e)$/iu
  return name.trim().replace(/\s+/g, ' ').replace(/\p{L}+/gu, (word, offset: number) => {
    if (offset > 0 && particles.test(word)) return word.toLowerCase()
    const letters = word === word.toUpperCase() ? word.toLowerCase() : word
    return letters.charAt(0).toLocaleUpperCase('pt-BR') + letters.slice(1)
  })
}

export function ProfileProvider({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState<Profile | null>(() => {
    try {
      const value = JSON.parse(localStorage.getItem(key) ?? 'null')
      return typeof value?.name === 'string' && value.name.trim() ? { ...value, name: formatProfessionalName(value.name) } : null
    } catch { return null }
  })
  function save(value: Profile) {
    localStorage.setItem(key, JSON.stringify(value))
    setProfile(value)
  }
  return <ProfileContext.Provider value={{ profile, save }}>{children}</ProfileContext.Provider>
}

export function useProfile() {
  const context = useContext(ProfileContext)
  if (!context) throw new Error('Perfil fora do contexto do Visitário')
  return context
}

export function ProfileForm({ onDone, onCancel }: { onDone: () => void; onCancel: () => void }) {
  const { profile, save } = useProfile()
  const [name, setName] = useState(profile?.name ?? '')
  const [crm, setCrm] = useState(() => readRegistration(profile?.registration))
  const numberInput = useRef<HTMLInputElement>(null)
  const stateInput = useRef<HTMLSelectElement>(null)
  const hasRegistration = Boolean(crm.number || crm.state)
  const numberInvalid = hasRegistration && !validRegistrationNumber(crm.number.trim())
  const stateInvalid = hasRegistration && !registrationStates.includes(crm.state)
  const [photo, setPhoto] = useState(profile?.photo ?? '')
  const [phone, setPhone] = useState(profile?.phone ?? '')
  const [email, setEmail] = useState(profile?.email ?? '')
  const [error, setError] = useState('')
  const [nameError, setNameError] = useState(false)
  const nameInput = useRef<HTMLInputElement>(null)

  useEffect(() => {
    numberInput.current?.setCustomValidity(numberInvalid ? 'Informe o número do CRM como consta na inscrição, sem espaços ou pontuação.' : '')
    stateInput.current?.setCustomValidity(stateInvalid ? 'Selecione a UF que emitiu o CRM.' : '')
  }, [numberInvalid, stateInvalid])

  return <form className="profile-settings" onSubmit={event => {
    event.preventDefault()
    if (!name.trim()) {
      setNameError(true)
      requestAnimationFrame(() => nameInput.current?.focus())
      return
    }
    try { save({ name: formatProfessionalName(name), registration: formatRegistration(crm.number, crm.state), phone: phone.trim(), email: email.trim(), photo }); onDone() }
    catch { setError('Não foi possível salvar neste navegador. Verifique o armazenamento e tente novamente.') }
  }}>
    <ProfilePhoto name={name} photo={photo} onChange={setPhoto}/>
    <fieldset><legend><GlassIcon name="credencial" size={18}/>Dados profissionais</legend>
      <div className="profile-fields">
        <label>Nome profissional<input ref={nameInput} required aria-invalid={nameError || undefined} aria-describedby={nameError ? 'profile-name-error' : undefined} autoComplete="name" autoCapitalize="words" onBlur={() => setName(formatProfessionalName(name))} maxLength={80} value={name} onChange={e => { setName(e.target.value); setNameError(false) }}/></label>
        {nameError && <small role="alert" id="profile-name-error">Informe seu nome profissional.</small>}
        <label>Número do CRM<input ref={numberInput} autoCapitalize="characters" spellCheck={false}
          placeholder="Ex.: 123456" value={crm.number}
          onChange={event => setCrm({ ...crm, number: event.target.value.toUpperCase() })}/></label>
        <label>UF do CRM<select ref={stateInput} value={crm.state}
          onChange={event => setCrm({ ...crm, state: event.target.value })}>
          <option value="">Selecione a UF</option>
          {registrationStates.map(state => <option key={state}>{state}</option>)}
        </select></label>
      </div>
      <p className="small-note">Vínculo com unidade ou equipe e especialidade ficam no VitaCare; não são pedidos novamente aqui.</p>
    </fieldset>
    <fieldset><legend><GlassIcon name="telefone" size={18}/>Contato profissional</legend>
      <div className="profile-fields">
        <label>Celular (obrigatório)<input required type="tel" pattern={String.raw`(?=(?:\D*\d){10,15}\D*$)[0-9\s\+\(\)\-]+`} title="Informe um celular com DDD ou código do país." placeholder="(11) 99999-9999" autoComplete="tel" maxLength={30} value={phone} onChange={e => setPhone(e.target.value)}/></label>
        <label>E-mail (obrigatório)<input required type="email" autoComplete="email" maxLength={254} value={email} onChange={e => setEmail(e.target.value)}/></label>
      </div>
    </fieldset>
    {error && <p role="alert">{error}</p>}
    <div className="start-actions"><button className="primary">{profile ? 'Salvar alterações' : 'Criar perfil'}</button><button type="button" className="text-button" onClick={onCancel}>Cancelar</button></div>
  </form>
}

export function ProfileButton({ withLabel = false }: { withLabel?: boolean }) {
  const { profile } = useProfile()
  return <button type="button" className="profile-trigger" popoverTarget="profile-menu" title={withLabel ? 'Meu perfil' : undefined} aria-label="Meu perfil">
    <span className="doctor-avatar">{profile?.photo ? <img className="nav-portrait" src={profile.photo} alt=""/> : <GlassIcon name="perfil" size={29}/>}</span>
    {withLabel && <span className="profile-name">{profile?.name ?? 'Meu perfil'}</span>}
  </button>
}

export function ProfilePanel({ canExit, onExit }: { canExit: boolean; onExit: () => void }) {
  const { profile } = useProfile()
  const editor = useRef<HTMLDialogElement>(null)
  const menu = useRef<HTMLDivElement>(null)
  const [session, setSession] = useState(0)
  const confirmExit = useRef<HTMLDialogElement>(null)
  const close = () => editor.current?.close()
  return <>
    <div id="profile-menu" ref={menu} popover="auto" className="workspace-popup profile-popup">
      <strong>{profile?.name || 'Meu perfil'}</strong>
      <button type="button" aria-haspopup="dialog" onClick={() => { menu.current?.hidePopover(); editor.current?.showModal() }}>
        <GlassIcon name="perfil" size={21}/>Configurações do perfil
      </button>
      <button type="button" className="profile-signout" aria-haspopup="dialog" disabled={!canExit}
        onClick={() => { menu.current?.hidePopover(); confirmExit.current?.showModal() }}>
        <LogOut size={19} aria-hidden="true"/>Encerrar sessão
      </button>
    </div>
    <dialog ref={editor} id="doctor-profile" className="workspace-dialog settings-dialog" aria-labelledby="profile-editor-title"
    onClose={event => { if (event.target === event.currentTarget) setSession(previous => previous + 1) }}>
    <header><h2 id="profile-editor-title">Perfil profissional</h2>
      <button aria-label="Fechar" onClick={close}><X/></button></header>
    <ProfileForm key={session} onDone={close} onCancel={close}/>
    </dialog>
    <dialog ref={confirmExit} className="workspace-dialog exit-confirmation" aria-labelledby="exit-title" aria-describedby="exit-description">
      <h2 id="exit-title">Encerrar sua sessão no Visitário?</h2>
      <p id="exit-description">Você voltará à tela de entrada. Seu perfil continuará salvo neste navegador.</p>
      <div className="start-actions"><button type="button" className="secondary" autoFocus onClick={() => confirmExit.current?.close()}>Continuar no app</button>
        <button type="button" className="confirm-signout" disabled={!canExit} onClick={onExit}>Encerrar sessão</button></div>
    </dialog>
  </>
}
