import { useRef, useState } from 'react'
import { X } from 'lucide-react'

const release = {
  version: '0.1.3',
  changes: [
    { title: 'Plano em tópicos', description: 'A evolução SOAP mantém o Subjetivo narrativo e apresenta as condutas e sugestões do Plano em tópicos.' },
    { title: 'MEEM e IVCF-20', description: 'As duas avaliações podem ser aplicadas na visita. O app calcula os escores e os inclui no Objetivo do SOAP.' },
    { title: 'Nova identidade', description: 'Visitário é o novo nome do app. O visual mudou no registro, na revisão SOAP e no histórico.' },
    { title: 'Endereço mais curto', description: 'Use visitario.victmm.workers.dev. Visitas e rascunhos salvos pelo navegador continuam no endereço em que foram criados.' },
    { title: 'Notas da versão', description: 'Consulte as mudanças e busque atualizações pelo rodapé.' },
  ],
}

type Props = {
  updateAvailable: boolean
  getRegistration: () => ServiceWorkerRegistration | Promise<ServiceWorkerRegistration | undefined> | undefined
  onUpdate: () => void
}

export default function ReleaseNotes({ updateAvailable, getRegistration, onUpdate }: Props) {
  const dialog = useRef<HTMLDialogElement>(null)
  const [checking, setChecking] = useState(false)
  const [status, setStatus] = useState('')

  async function checkUpdate() {
    if (!navigator.onLine) {
      setStatus('Conecte-se à internet para buscar atualizações.')
      return
    }

    setChecking(true)
    setStatus('Buscando atualizações…')
    try {
      const registration = await getRegistration()
      if (!registration) {
        setStatus('A busca estará disponível quando o aplicativo terminar de preparar o uso offline.')
        return
      }
      await registration.update()
      setStatus(registration.waiting || registration.installing
        ? 'Uma atualização está sendo preparada.'
        : 'Nenhuma nova versão encontrada.')
    } catch {
      setStatus('Não foi possível buscar atualizações agora. Tente novamente em instantes.')
    } finally {
      setChecking(false)
    }
  }

  return <>
    <div className="release-footer">
      <span>Versão {release.version}</span>
      <button type="button" className="text-button" aria-haspopup="dialog" onClick={() => {
        if (!checking) setStatus('')
        dialog.current?.showModal()
      }}>Verificar atualização</button>
    </div>
    <dialog ref={dialog} className="release-dialog" aria-labelledby="release-title">
      <div className="release-heading">
        <div>
          <h2 id="release-title">Notas da versão</h2>
          <p>Versão instalada {release.version}</p>
        </div>
        <button type="button" className="release-close" aria-label="Fechar notas da versão" onClick={() => dialog.current?.close()}>
          <X size={20} aria-hidden="true"/>
        </button>
      </div>
      <ul className="release-changes">
        {release.changes.map(change => <li key={change.title}>
          <h3>{change.title}</h3>
          <p>{change.description}</p>
        </li>)}
      </ul>
      <div className="release-actions">
        <p role="status">{updateAvailable ? 'Nova versão disponível. Salve a visita antes de atualizar.' : status}</p>
        {updateAvailable
          ? <button type="button" className="primary" onClick={onUpdate}>Atualizar aplicativo</button>
          : <button type="button" className="secondary" disabled={checking} onClick={() => void checkUpdate()}>
            {checking ? 'Buscando atualizações…' : 'Buscar nova versão'}
          </button>}
      </div>
    </dialog>
  </>
}
