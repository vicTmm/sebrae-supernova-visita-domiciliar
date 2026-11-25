import GlassIcon from './GlassIcon'
import FeedbackDialog from './FeedbackDialog'
import { ProfileButton, ProfilePanel } from './ProfessionalProfile'
import { useRef, useState, type ReactNode, type RefObject } from 'react'
import { ArrowRight, CalendarDays, ExternalLink, X } from 'lucide-react'

type Props = {
  advisor: RefObject<HTMLDialogElement | null>
  releaseNotes: ReactNode
  dark: boolean
  toggleTheme: () => void
  online: boolean
  localOnly: boolean
  pending: number
  conflicts: number
  storageError: string
  ready: boolean
  hasDraft: boolean
  canExit: boolean
  onExit: () => void
  onHistory: () => void
  onHome: () => void
  stage?: string
  offlineReady: boolean
  location: string
}

export default function WorkspaceTools(props: Props) {
  const feedback = useRef<HTMLDialogElement>(null)
  const { advisor } = props
  const [labelsDismissed, setLabelsDismissed] = useState(false)
  const themeLabel = props.dark ? 'Usar modo claro' : 'Usar modo escuro'
  return <>
    <div className="desk-tools" data-labels-dismissed={labelsDismissed || undefined}
      onPointerOver={() => setLabelsDismissed(false)} onFocus={() => setLabelsDismissed(false)}
      onClick={() => setLabelsDismissed(true)}
      onKeyDown={event => { if (event.key === 'Escape') setLabelsDismissed(true) }}>
      <span className="workspace-location">{props.location}{props.stage && <> › <strong aria-current="step">{props.stage}</strong></>}</span>
      <div className="mobile-profile"><ProfileButton/></div>
      <div className="utility-actions">
        <button type="button" className="utility-button" popoverTarget="workspace-apps" aria-label="Conecte seus apps"><GlassIcon name="apps" size={23}/></button>

        <button className="utility-button" onClick={() => feedback.current?.showModal()} aria-label="Feedback"><GlassIcon name="feedback" size={23}/></button>
        <button className="utility-button mobile-advisor" aria-haspopup="dialog" onClick={() => advisor.current?.showModal()} aria-label="Central de orientações"><GlassIcon name="central" size={23}/></button>
        <button className="utility-button" onClick={props.toggleTheme} aria-label={themeLabel}><GlassIcon name={props.dark ? 'sol' : 'lua'} size={19}/></button>
        <button className="workspace-signature" onClick={props.onHome} aria-label="Visitário · Início">Visitário<img src="/brand/visitario/conexao-marca.webp" alt=""/></button>
      </div>
    </div>
    <ProfilePanel canExit={props.canExit} onExit={props.onExit}/>
    <div id="workspace-apps" popover="auto" className="workspace-popup apps-popup">
      <h2>Conecte seus apps</h2><p>Planeje uma visita na sua agenda. Você escolhe a data e confirma no aplicativo.</p>
      <a href="https://calendar.google.com/calendar/render?action=TEMPLATE&amp;text=Visita+domiciliar" target="_blank" rel="noreferrer"><CalendarDays/>Google Agenda <ExternalLink/></a>
      <a href="https://outlook.office.com/calendar/0/deeplink/compose?subject=Visita%20domiciliar" target="_blank" rel="noreferrer"><CalendarDays/>Calendário do Outlook <ExternalLink/></a>
    </div>
    <FeedbackDialog dialog={feedback}/>
    <dialog ref={advisor} className="workspace-dialog" aria-labelledby="advisor-title">
      <header><h2 id="advisor-title">Central de orientações</h2><button aria-label="Fechar orientações" onClick={() => advisor.current?.close()}><X/></button></header>
      <dl className="advisor-status">
        <dt><GlassIcon name="conexao" size={24}/>Conexão</dt><dd>{props.online ? 'Com conexão à internet.' : 'Modo offline. Continue registrando neste dispositivo.'}</dd>
        <dt><GlassIcon name="armazenamento" size={24}/>Armazenamento local</dt><dd>{props.storageError || (props.ready ? 'Disponível neste navegador.' : 'Verificando armazenamento…')}</dd>
        <dt><GlassIcon name="offline" size={24}/>Uso offline</dt><dd>{props.offlineReady ? 'Aplicativo disponível offline.' : 'Acesse com internet para preparar o uso offline.'}</dd>
        <dt><GlassIcon name="sincronizacao" size={24}/>Sincronização</dt><dd>{props.localOnly ? 'Modo local. As visitas ficam neste dispositivo.' : props.pending ? `${props.pending} visita(s) aguardando confirmação do servidor.` : 'Nenhuma visita na fila local.'}</dd>
        {props.conflicts > 0 && <><dt><GlassIcon name="conflito" size={24}/>Conflitos</dt><dd>{props.conflicts} registro(s) precisam de revisão no histórico.</dd></>}
        {props.hasDraft && <><dt><GlassIcon name="registro" size={24}/>Visita em andamento</dt><dd>Retome o rascunho em Minhas visitas.</dd></>}
      </dl>
      <button className="advisor-history" onClick={() => { advisor.current?.close(); props.onHistory() }}>
        <GlassIcon name="historico" size={24}/>Consultar histórico<ArrowRight size={18} aria-hidden="true"/>
      </button>
      {props.releaseNotes}
    </dialog>
  </>
}
