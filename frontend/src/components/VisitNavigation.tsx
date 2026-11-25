import GlassIcon from './GlassIcon'
import { useRef } from 'react'
import { X } from 'lucide-react'

const sections = [
  { id: 'visit-team', label: 'Equipe', icon: <GlassIcon name="equipe" size={22}/> },
  { id: 'visit-identification', label: 'Identificação', icon: <GlassIcon name="identificacao" size={22}/> },
  { id: 'visit-household', label: 'Moradia e rede de apoio', icon: <GlassIcon name="rede-apoio" size={22}/> },
  { id: 'visit-audio', label: 'Áudio', icon: <GlassIcon name="audio" size={22}/> },
]
const soapSections = [
  { id: 'visit-subjective', label: 'Subjetivo', icon: <GlassIcon name="subjetivo" size={22}/> },
  { id: 'visit-objective', label: 'Objetivo', icon: <GlassIcon name="objetivo" size={22}/> },
  { id: 'visit-plan', label: 'Avaliação e plano', icon: <GlassIcon name="avaliacao-plano" size={22}/> },
]

export function SectionLinks({ step, onSelect }: { step: "general" | "soap"; onSelect?: () => void }) {
  return (step === "general" ? sections : soapSections).map(({ id, label, icon }) => (
    <a key={id} title={label} aria-label={label} href={`#${id}`} onClick={onSelect}>
      {icon}<span>{label}</span>
    </a>
  ))
}

type Tab = 'home' | 'visit' | 'history'

export function MobileNavigation({ step, tab, showSections, pending, onSelect }: {
  step: "general" | "soap"
  tab: Tab
  showSections: boolean
  pending: number
  onSelect: (tab: Tab) => void
}) {
  const dialog = useRef<HTMLDialogElement>(null)
  return <>
    <nav className="mobile-nav" aria-label="Navegação principal">
      <button aria-current={tab === 'home' ? 'page' : undefined} onClick={() => onSelect('home')}>
        <GlassIcon name={tab === 'home' ? 'inicio-ativo' : 'inicio'}/>Início
      </button>
      {showSections && <button aria-haspopup="dialog" onClick={() => dialog.current?.showModal()}>
        <GlassIcon name="secoes"/>Seções
      </button>}
      <button aria-current={tab === 'history' ? 'page' : undefined} onClick={() => onSelect('history')}>
        <GlassIcon name={tab === 'history' ? 'historico' : 'historico-ativo'}/>Histórico {pending > 0 && `(${pending})`}
      </button>
    </nav>
    <dialog ref={dialog} className="section-sheet" aria-labelledby="section-sheet-title">
      <header><h2 id="section-sheet-title">Nesta visita</h2>
        <button type="button" aria-label="Fechar seções" onClick={() => dialog.current?.close()}><X size={20}/></button>
      </header>
      <nav aria-labelledby="section-sheet-title"><SectionLinks step={step} onSelect={() => dialog.current?.close()}/></nav>
    </dialog>
  </>
}
