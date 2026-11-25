type IconName = 'credencial' | 'telefone' | 'apps' | 'central' | 'feedback' | 'lua' | 'sol' | 'painel' | 'equipe' | 'identificacao' | 'rede-apoio' | 'inicio' | 'historico' | 'perfil' | 'audio' | 'secoes' | 'sincronizacao' | 'conexao' | 'armazenamento' | 'offline' | 'conflito' | 'registro' | 'inicio-ativo' | 'historico-ativo' | 'subjetivo' | 'objetivo' | 'avaliacao-plano' | 'saude-da-mulher'

export default function GlassIcon({ name, size = 26 }: { name: IconName; size?: number }) {
  return <img className="glass-icon" src={`/brand/visitario/icons/${name}.webp`}
    alt="" aria-hidden="true" width={size} height={size} draggable={false}/>
}
