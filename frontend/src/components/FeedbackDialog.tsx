import { useRef, useState, type RefObject } from 'react'
import { ArrowLeft, ChevronRight, Lightbulb, TriangleAlert, X } from 'lucide-react'
import { sendFeedback } from '../services/api'

type Screen = 'choose' | 'idea' | 'issue' | 'received'
const emptyDraft = { id: '', message: '', reply: '' }

export default function FeedbackDialog({ dialog }: {
  dialog: RefObject<HTMLDialogElement | null>
}) {
  const [screen, setScreen] = useState<Screen>('choose')
  const [drafts, setDrafts] = useState({ idea: emptyDraft, issue: emptyDraft })
  const [error, setError] = useState('')
  const [sending, setSending] = useState(false)
  const locked = useRef(false)
  const category = screen === 'issue' ? 'issue' : 'idea'
  const draft = drafts[category]
  function navigate(next: Screen) { setScreen(next); setError('') }
  function edit(update: Partial<typeof emptyDraft>) {
    setDrafts(prev => ({ ...prev, [category]: { ...prev[category], id: '', ...update } }))
    setError('')
  }

  return <dialog ref={dialog} className="workspace-dialog feedback-dialog" aria-labelledby="feedback-title"
    onCancel={event => { if (locked.current) event.preventDefault() }} onClose={() => navigate('choose')}>
    <header><h2 id="feedback-title">{screen === 'choose' ? 'O que gostaria de compartilhar?' : screen === 'idea' ? 'Tenho uma ideia' : screen === 'received' ? 'Relato recebido' : 'Encontrei um problema'}</h2>
      <button type="button" disabled={sending} aria-label="Fechar feedback" onClick={() => dialog.current?.close()}><X/></button></header>
    {screen === 'choose' && <div className="feedback-choices">
      <button type="button" onClick={() => navigate('idea')}><Lightbulb/>Tenho uma ideia<ChevronRight/></button>
      <button type="button" onClick={() => navigate('issue')}><TriangleAlert/>Encontrei um problema<ChevronRight/></button>
    </div>}
    {(screen === 'idea' || screen === 'issue') && <form onSubmit={async event => {
      event.preventDefault()
      if (locked.current || !draft.message.trim()) return
      locked.current = true
      setSending(true)
      setError('')
      try {
        const id = draft.id || crypto.randomUUID()
        setDrafts(prev => ({ ...prev, [category]: { ...prev[category], id } }))
        await sendFeedback(id, draft.message.trim(), category, category === 'issue' ? draft.reply.trim() || null : null)
        setDrafts(prev => ({ ...prev, [category]: emptyDraft }))
        navigate('received')
      } catch { setError('Envio não confirmado. Seu texto está aqui para tentar novamente.') }
      finally { locked.current = false; setSending(false) }
    }}>
      <label htmlFor="feedback-message">{screen === 'idea' ? 'O que facilitaria seu trabalho nas visitas?' : 'O que aconteceu e em qual tela?'}</label>
      <textarea id="feedback-message" required maxLength={2000} disabled={sending} value={draft.message}
        placeholder="Descreva sua experiência, sem dados de pacientes." onChange={event => edit({ message: event.target.value })}/>
      {screen === 'issue' && <label>E-mail para retorno (opcional)<input type="email" autoComplete="email" maxLength={254} disabled={sending}
        value={draft.reply} onChange={event => edit({ reply: event.target.value })}/></label>}
      {error && <p role="alert">{error}</p>}
      <button className="primary" disabled={sending || !draft.message.trim()}>{sending ? 'Enviando…' : screen === 'idea' ? 'Enviar sugestão' : 'Enviar relato'}</button>
    </form>}
    {screen === 'received' && <><p>Obrigado por compartilhar sua experiência.</p><button className="primary" onClick={() => dialog.current?.close()}>Concluir</button></>}
    {screen !== 'choose' && screen !== 'received' && <button type="button" className="text-button" disabled={sending}
      onClick={() => navigate('choose')}><ArrowLeft size={16}/>Voltar</button>}
  </dialog>
}
