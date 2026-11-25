import { useEffect, useRef, useState } from 'react'
import { ArrowLeft, ArrowRight, ClipboardList, FileCheck2, Stethoscope } from 'lucide-react'
import { ProfileForm, useProfile } from './ProfessionalProfile'
import './doctor-access.css'

const guide = [
  { title: 'Registre a visita', text: 'Identifique o paciente por um código e preencha as condições acompanhadas, os sinais vitais e os achados do exame.', icon: ClipboardList },
  { title: 'Revise a evolução', text: 'Gere a evolução SOAP a partir do registro. Confira cada bloco e ajuste o texto antes de salvar ou copiar para o prontuário.', icon: FileCheck2 },
]
const guideKey = 'visitario.guia-medico-concluido'

export default function DoctorAccess({ onEnter }: { onEnter: () => void }) {
  const { profile } = useProfile()
  const [registering, setRegistering] = useState(false)
  const [step, setStep] = useState(0)
  const heading = useRef<HTMLHeadingElement>(null)
  const current = guide[step - 1]
  const Icon = current?.icon ?? Stethoscope
  useEffect(() => { if (step) heading.current?.focus() }, [step])

  function finish() {
    try { localStorage.setItem(guideKey, '1') } catch { /* Continue in memory. */ }
    onEnter()
  }
  function advance() {
    if (step === guide.length) return finish()
    if (!step) {
      try { if (localStorage.getItem(guideKey) === '1') return onEnter() } catch { /* Show the guide. */ }
    }
    setStep(step + 1)
  }
  return <main className="doctor-access">
    <header className="access-header">
      <div className="brand">Visitário<img className="brand-emblem" src="/brand/visitario/conexao-marca.webp" alt="" width="64" height="48"/></div>
      <span>Área médica</span>
    </header>
    {registering ? <section className="access-settings"><h1>Configurar perfil profissional</h1><ProfileForm onDone={onEnter} onCancel={() => setRegistering(false)}/></section> : <div className="access-layout">
      <aside className="access-art">
        <div><p>Visitas domiciliares</p><h2>O cuidado começa em casa.</h2></div>
        <img src="/brand/visitario/visita-acesso.webp" alt="" width="720" height="480"/>
      </aside>
      <section className="access-content">
        {step > 0 && <div className="access-progress"><span>Guia de primeiro acesso</span><span>{step} de {guide.length}</span><progress value={step} max={guide.length} aria-label="Progresso do guia"/></div>}
        <h1 ref={heading} tabIndex={-1}>{current?.title ?? 'Entrar no Visitário'}</h1>
        <p>{current?.text ?? (profile ? 'Continue com o perfil salvo neste navegador.' : 'Cadastre seu perfil ou use o perfil de demonstração para conhecer o registro de visitas domiciliares.')}</p>
        <div className="access-profile"><Icon size={25} aria-hidden="true"/><div><strong>{!step ? profile?.name ?? 'Médico de demonstração' : step === 1 ? 'Caso clínico fictício' : 'Histórico de visitas'}</strong><small>{!step ? profile?.unit || 'Atenção Primária à Saúde' : step === 1 ? 'Use “Preencher exemplo” na tela inicial para experimentar.' : 'Consulte as evoluções salvas pelo menu Histórico.'}</small></div></div>
        {!step && !profile && <button className="primary access-enter" onClick={() => setRegistering(true)}>Cadastrar perfil profissional<ArrowRight size={18}/></button>}
        <button className={!step && !profile ? "text-button" : "primary access-enter"} onClick={advance}>{!step ? profile ? 'Acessar Visitário' : 'Entrar na demonstração' : step === guide.length ? 'Ir para minhas visitas' : 'Continuar'}<ArrowRight size={18}/></button>
        {step > 0 && <div className="access-nav"><button className="text-button" onClick={() => setStep(step - 1)}><ArrowLeft size={15}/>Voltar</button>{step < guide.length && <button className="text-button" onClick={finish}>Pular guia</button>}</div>}
      </section>
    </div>}
  </main>
}
