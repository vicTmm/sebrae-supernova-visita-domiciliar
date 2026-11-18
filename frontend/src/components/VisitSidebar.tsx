import { ClipboardList, FilePenLine, HardDrive } from 'lucide-react'

const visitSections = [
  { id: 'visit-team', label: 'Equipe' },
  { id: 'visit-identification', label: 'Identificação' },
  { id: 'visit-subjective', label: 'Subjetivo' },
  { id: 'visit-objective', label: 'Objetivo' },
  { id: 'visit-plan', label: 'Avaliação e plano' },
]

export default function VisitSidebar({ tab, todayCount, showSections, offlineReady, storageReady, storageError, onSelect }: {
  tab: 'visit' | 'history'
  todayCount: number
  showSections: boolean
  offlineReady: boolean
  storageReady: boolean
  storageError: boolean
  onSelect: (tab: 'visit' | 'history') => void
}) {
  const storageTitle = storageError ? 'Armazenamento com erro' : storageReady ? 'Armazenamento local' : 'Abrindo armazenamento'
  return <aside className="app-sidebar">
    <nav aria-labelledby="visit-navigation-title">
      <h2 id="visit-navigation-title">Visitas</h2>
      <button type="button" aria-current={tab === 'visit' ? 'page' : undefined} onClick={() => onSelect('visit')}>
        <FilePenLine size={19} aria-hidden="true"/>
        <span>Registro da visita</span>
      </button>
      <button type="button" aria-current={tab === 'history' ? 'page' : undefined} onClick={() => onSelect('history')}>
        <ClipboardList size={19} aria-hidden="true"/>
        <span>Histórico</span>
        {todayCount > 0 && <small className="sidebar-count">{todayCount} hoje</small>}
      </button>
    </nav>
    {showSections && <nav className="sidebar-outline" aria-labelledby="visit-outline-title">
      <h3 id="visit-outline-title">Nesta visita</h3>
      {visitSections.map(section => <a key={section.id} href={`#${section.id}`}>{section.label}</a>)}
    </nav>}
    <div className="sidebar-storage">
      <HardDrive size={17} aria-hidden="true"/>
      <div>
        <strong>{storageTitle}</strong>
        {storageReady && !storageError && <p>{offlineReady ? 'Aplicativo disponível offline.' : 'Acesse com internet para preparar o uso offline.'}</p>}
      </div>
    </div>
  </aside>
}
