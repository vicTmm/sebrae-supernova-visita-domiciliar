import GlassIcon from './GlassIcon'
import { useRef, useState } from 'react'

import { ProfileButton } from './ProfessionalProfile'
import { SectionLinks } from './VisitNavigation'

const modes = [
  { value: 'open', label: 'Expandida' },
  { value: 'compact', label: 'Recolhida' },
  { value: 'hover', label: 'Expandir ao passar o mouse' },
] as const

type SidebarMode = typeof modes[number]['value']

export default function VisitSidebar({ tab, todayCount, showSections, step, onSelect, onAdvisor }: {
  tab: 'home' | 'visit' | 'history'
  onAdvisor: () => void
  todayCount: number
  showSections: boolean
  step: "general" | "soap"
  onSelect: (tab: 'home' | 'visit' | 'history') => void
}) {
  const [tip, setTip] = useState<{ label: string; x: number; y: number } | null>(null)
  function revealTip(target: EventTarget) {
    const item = target instanceof Element && target.closest<HTMLElement>('button[title],a[title]')
    if (mode !== 'compact' || !item) { setTip(null); return }
    const rect = item.getBoundingClientRect()
    setTip({ label: item.title, x: rect.right + 10, y: rect.top + rect.height / 2 })
  }
  const control = useRef<HTMLButtonElement>(null)
  const menu = useRef<HTMLDivElement>(null)
  const [mode, setMode] = useState<SidebarMode>(() => {
    try {
      const saved = localStorage.getItem('visitario.sidebar')
      return modes.find(item => item.value === saved)?.value ?? 'hover'
    } catch { return 'hover' }
  })
  function selectMode(next: SidebarMode) {
    setMode(next)
    try { localStorage.setItem('visitario.sidebar', next) }
    catch { /* A preferência continua ativa nesta sessão. */ }
    menu.current?.hidePopover()
    control.current?.focus()
  }
  return <><aside className="app-sidebar" data-mode={mode}
    onPointerOver={e => revealTip(e.target)} onFocus={e => revealTip(e.target)}
    onPointerLeave={() => setTip(null)} onBlur={() => setTip(null)} onClick={() => setTip(null)} onScroll={() => setTip(null)}>
    <div className="sidebar-heading">
      <ProfileButton withLabel/>
    </div>
    <nav aria-label="Visitas">
      <button type="button" aria-current={tab === 'home' ? 'page' : undefined} aria-label="Início" title="Início" onClick={() => onSelect('home')}>
        <GlassIcon name={tab === 'home' ? 'inicio-ativo' : 'inicio'}/>
        <span>Início</span>
      </button>
      <button type="button" aria-current={tab === 'history' ? 'page' : undefined} aria-label={todayCount ? `Histórico, ${todayCount} hoje` : 'Histórico'} title="Histórico" onClick={() => onSelect('history')}>
        <GlassIcon name={tab === 'history' ? 'historico' : 'historico-ativo'}/>
        <span>Histórico</span>
        {todayCount > 0 && <small className="sidebar-count">{todayCount} hoje</small>}
      </button>
    </nav>
    {showSections && <nav className="sidebar-outline" aria-labelledby="visit-outline-title">
      <h3 id="visit-outline-title">Nesta visita</h3>
      <SectionLinks step={step}/>
    </nav>}
    <button type="button" className="sidebar-control sidebar-advisor" onClick={onAdvisor}
      title="Central de orientações" aria-label="Central de orientações" aria-haspopup="dialog">
      <GlassIcon name="central" size={19}/><span>Central de orientações</span>
    </button>
    <button ref={control} type="button" className="sidebar-control" popoverTarget="sidebar-modes"
      aria-label="Modo da barra lateral" title="Modo da barra lateral"
      onClick={event => {
        const rect = event.currentTarget.getBoundingClientRect()
        if (!menu.current) return
        menu.current.style.left = `${rect.left}px`
        menu.current.style.bottom = `${window.innerHeight - rect.top + 6}px`
      }}>
      <GlassIcon name="painel" size={19}/>
      <span>Modo da barra lateral</span>
    </button>
    <div ref={menu} id="sidebar-modes" popover="auto" className="sidebar-modes"
      onToggle={event => {
        if (event.newState === 'open') menu.current?.querySelector<HTMLInputElement>('input:checked')?.focus()
      }}>
      <fieldset>
        <legend>Modo da barra lateral</legend>
        {modes.map(item => <label key={item.value}>
          <input type="radio" name="sidebar-mode" checked={mode === item.value}
            onChange={() => selectMode(item.value)} onClick={() => {
              if (mode === item.value) selectMode(item.value)
            }}/>
          {item.label}
        </label>)}
      </fieldset>
    </div>
  </aside>{tip && <span aria-hidden="true" className="sidebar-tooltip" style={{ left: tip.x, top: tip.y }}>{tip.label}</span>}</>
}
