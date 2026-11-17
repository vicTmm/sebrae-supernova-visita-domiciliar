import { useEffect, useId, useRef, type ReactNode } from 'react'
import { X } from 'lucide-react'

export default function AssessmentDialog({ title, children, result, actions, onClose }: {
  title: string
  children: ReactNode
  result: ReactNode
  actions: (close: () => void) => ReactNode
  onClose: () => void
}) {
  const dialog = useRef<HTMLDialogElement>(null)
  const titleId = useId()

  useEffect(() => {
    const element = dialog.current
    if (element && !element.open) element.showModal()
  }, [])

  function close() {
    dialog.current?.close()
    onClose()
  }

  return <dialog ref={dialog} className="assessment-dialog" aria-labelledby={titleId}
    onCancel={event => { event.preventDefault(); close() }}>
    <header className="assessment-heading">
      <h2 id={titleId}>{title}</h2>
      <button type="button" className="assessment-close" aria-label="Fechar avaliação" onClick={close}><X size={20} aria-hidden="true"/></button>
    </header>
    <div className="assessment-body">{children}</div>
    <footer className="assessment-actions">
      <output className="assessment-result" aria-live="polite">{result}</output>
      <div>
        <button type="button" className="secondary" onClick={close}>Cancelar</button>
        {actions(close)}
      </div>
    </footer>
  </dialog>
}
