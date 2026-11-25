import GlassIcon from './GlassIcon'
import { createContext, useContext, useRef, useState, type ReactNode } from 'react'
import { LogOut, X } from 'lucide-react'
import './profile-settings.css'

type Profile = { name: string; unit: string; registration?: string; photo?: string; specialty?: string; phone?: string; email?: string }
const key = 'visitario.professional-profile'
const ProfileContext = createContext<{ profile: Profile | null; save: (value: Profile) => void } | null>(null)

export function ProfileProvider({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState<Profile | null>(() => {
    try {
      const value = JSON.parse(localStorage.getItem(key) ?? 'null')
      return typeof value?.name === 'string' && value.name.trim() && typeof value.unit === 'string' ? value : null
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

function initials(name: string) {
  const words = name.trim().split(/\s+/)
  return ((words[0]?.[0] ?? '') + (words.length > 1 ? words[words.length - 1][0] : '')).toLocaleUpperCase('pt-BR')
}

async function portrait(file: File) {
  const bitmap = await createImageBitmap(file)
  try {
    const canvas = document.createElement('canvas')
    canvas.width = canvas.height = 192
    const side = Math.min(bitmap.width, bitmap.height)
    const context = canvas.getContext('2d')
    if (!context) throw new Error()
    context.drawImage(bitmap, (bitmap.width-side)/2, (bitmap.height-side)/2, side, side, 0, 0, 192, 192)
    return canvas.toDataURL('image/jpeg', 0.86)
  } finally { bitmap.close() }
}

export function ProfileForm({ onDone, onCancel }: { onDone: () => void; onCancel: () => void }) {
  const { profile, save } = useProfile()
  const [name, setName] = useState(profile?.name ?? '')
  const [registration, setRegistration] = useState(profile?.registration ?? '')
  const [unit, setUnit] = useState(profile?.unit ?? '')
  const [photo, setPhoto] = useState(profile?.photo ?? '')
  const [specialty, setSpecialty] = useState(profile?.specialty ?? '')
  const [phone, setPhone] = useState(profile?.phone ?? '')
  const [email, setEmail] = useState(profile?.email ?? '')
  const [error, setError] = useState('')
  const [nameError, setNameError] = useState(false)
  const [loading, setLoading] = useState(false)
  const nameInput = useRef<HTMLInputElement>(null)
  const upload = useRef<HTMLInputElement>(null)

  return <form className="profile-settings" onSubmit={event => {
    event.preventDefault()
    if (!name.trim()) {
      setNameError(true)
      requestAnimationFrame(() => nameInput.current?.focus())
      return
    }
    try { save({ name: name.trim(), registration: registration.trim(), unit: unit.trim(), specialty: specialty.trim(), phone: phone.trim(), email: email.trim(), photo }); onDone() }
    catch { setError('Não foi possível salvar neste navegador. Verifique o armazenamento e tente novamente.') }
  }}>
    <div className="profile-identity">
      <span className="profile-portrait">{photo ? <img src={photo} alt="Foto de perfil"/> : initials(name) || <GlassIcon name="perfil" size={42}/>}</span>
      <div><strong>{name.trim() || 'Foto de perfil'}</strong>
        <div className="photo-actions">
          <input hidden type="file" ref={upload} accept="image/jpeg,image/png,image/webp" onChange={async event => {
            const file = event.target.files?.[0]
            event.target.value = ''
            if (!file) return
            if (!['image/jpeg','image/png','image/webp'].includes(file.type) || file.size > 8*1024*1024) {
              setError('Escolha uma imagem JPG, PNG ou WebP de até 8 MB.'); return
            }
            setLoading(true); setError('')
            try { setPhoto(await portrait(file)) } catch { setError('Não foi possível ler a foto. Escolha outra imagem.') }
            finally { setLoading(false) }
          }}/>
          <button type="button" className="text-button" disabled={loading} onClick={() => upload.current?.click()}>{loading ? 'Preparando foto…' : photo ? 'Trocar foto' : 'Escolher foto'}</button>
          {photo && <button type="button" className="text-button" disabled={loading} onClick={() => setPhoto('')}>Remover foto</button>}
        </div>
      </div>
    </div>
    <fieldset><legend><GlassIcon name="credencial" size={18}/>Dados profissionais</legend>
      <div className="profile-fields">
        <label>Nome profissional<input ref={nameInput} required aria-invalid={nameError || undefined} aria-describedby={nameError ? 'profile-name-error' : undefined} autoComplete="name" maxLength={80} value={name} onChange={e => { setName(e.target.value); setNameError(false) }}/></label>
        {nameError && <small role="alert" id="profile-name-error">Informe seu nome profissional.</small>}
        <label>Registro profissional (CRM e UF)<input maxLength={38} placeholder="Ex.: CRM-SP 123456" value={registration} onChange={e => setRegistration(e.target.value)}/></label>
        <label>Unidade ou equipe (opcional)<input autoComplete="organization" maxLength={100} value={unit} onChange={e => setUnit(e.target.value)}/></label>
        <label>Especialidade (opcional)<input maxLength={100} value={specialty} onChange={e => setSpecialty(e.target.value)}/></label>
      </div>
    </fieldset>
    <fieldset><legend><GlassIcon name="telefone" size={18}/>Contato profissional</legend>
      <div className="profile-fields">
        <label>Celular (obrigatório)<input required type="tel" pattern={String.raw`(?=(?:\D*\d){10,15}\D*$)[0-9\s\+\(\)\-]+`} title="Informe um celular com DDD ou código do país." placeholder="(11) 99999-9999" autoComplete="tel" maxLength={30} value={phone} onChange={e => setPhone(e.target.value)}/></label>
        <label>E-mail (obrigatório)<input required type="email" autoComplete="email" maxLength={254} value={email} onChange={e => setEmail(e.target.value)}/></label>
      </div>
    </fieldset>
    <small className="profile-local">Seu perfil fica salvo neste navegador.</small>
    {error && <p role="alert">{error}</p>}
    <div className="start-actions"><button className="primary" disabled={loading}>{profile ? 'Salvar alterações' : 'Criar perfil'}</button><button type="button" className="text-button" onClick={onCancel}>Cancelar</button></div>
  </form>
}

export function ProfileButton({ withLabel = false }: { withLabel?: boolean }) {
  const { profile } = useProfile()
  return <button type="button" className="profile-trigger" popoverTarget="profile-menu" title={withLabel ? 'Meu perfil' : undefined} aria-label="Meu perfil">
    <span className="doctor-avatar">{profile?.photo ? <img className="nav-portrait" src={profile.photo} alt=""/> : initials(profile?.name ?? '') || <GlassIcon name="perfil" size={29}/>}</span>
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
