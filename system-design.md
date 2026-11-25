# Visitário · Guia de interface

O Visitário acompanha três tarefas de campo. O profissional registra a visita no domicílio, revisa a evolução SOAP e recupera o texto no histórico. Em cada tela, o título identifica a tarefa, o rótulo do botão diz o que vai acontecer e o estado informa onde o registro está salvo.

## Identidade em uso

| Elemento | Aplicação |
| --- | --- |
| Assinatura | Escrever **Visitário**, com acento. Usar os elos de conexão no cabeçalho e o Link2 nos ícones instaláveis. |
| Tipografia | Bricolage Grotesque Variable na marca e nos títulos. Inter Variable em campos, instruções, botões e metadados. As duas famílias são locais para uso em campo. |
| Paleta | Usar os tokens existentes. Verde petróleo `#145B49` identifica ação e seleção. Azul `#245A81` identifica informação e foco. Texto `#172B35` sobre superfície branca ou fundo `#F5F7F8`. |
| Estados | Acompanhar cor com texto. “No dispositivo” informa persistência local. “Sincronizada” exige confirmação do servidor. “Conflito” aparece junto à decisão entre versões. |
| Ilustração | A casa de `visita-app.webp` identifica o caso fictício. Os renders de visita, conexão e registro pertencem à mesma série e compõem materiais de apresentação. |
| Controles | Usar os seis ícones de vidro aprovados em Início, Histórico, Perfil, Áudio, Seções e Sincronização. Nas demais ações, usar Lucide. Manter rótulos e foco visível. Preservar alvos de pelo menos 44 px. Em telas estreitas, permitir que texto e ações ocupem outra linha. |

Os valores implementados estão em [design-system.css](frontend/src/design-system.css). O [manual da marca](docs/design-system/VISITARIO.md) detalha os componentes e a distribuição das fontes. O [catálogo de assets](docs/design-system/ASSETS-3D.md) identifica os originais e a versão preparada para a PWA.

## Composição e escrita

- **Minhas visitas.** Após o acesso, oferecer “Nova visita” como ação principal. Quando houver um rascunho, priorizar “Continuar visita”. O histórico e o caso fictício ficam disponíveis nessa tela. Exibir os atalhos clínicos somente durante o preenchimento.
- **Registro.** Manter campos relacionados sob o mesmo título. Colocar unidade junto à medida e instrução junto ao campo. “Preencher exemplo” identifica a ação de demonstração. “Gerar evolução SOAP” encerra o preenchimento.
- **Revisão.** O texto clínico ocupa a maior largura de leitura. Edição, cópia e salvamento precisam de verbos distintos. Indicar quando o profissional precisa revisar um trecho antes de transferi-lo ao prontuário.
- **Histórico.** Agrupar pelo dia local da visita, com a mais recente primeiro. Mostrar hora, código do paciente, idade e estado antes do trecho da evolução. Usar uma superfície por dia e divisores entre visitas. Quando o histórico está vazio, oferecer “Registrar primeira visita”.
- **Mensagens.** Dizer o que aconteceu e qual ação está disponível. “Rascunho salvo” descreve gravação local. A conectividade tem indicação própria no cabeçalho.

## Escolha das referências

| Referência | Decisão para o Visitário |
| --- | --- |
| [DesignMD](https://designmd.ai/) e [Design Guide](https://github.com/GrubbyLee/design-guide) | Registrar as decisões junto ao código e vincular cada regra a uma tela ou token existente. |
| [Taste](https://github.com/Leonxlnx/taste-skill), [Web Design Skills](https://github.com/lotfb86/web-design-skills) e [Netxeo](https://github.com/Netxeo/skill-file-design) | Trabalhar alinhamento, hierarquia e adaptação ao celular com as fontes da marca. Verificar a composição com registros preenchidos. |
| [No Slop UI](https://github.com/LeoStehlik/no-slop-ui), [Avoid AI Design](https://github.com/funboy322/avoid-ai-design) e [Anti Slop](https://github.com/miqdadbadjuber/anti-slop) | Remover a repetição visual que dificulta comparar registros. No histórico, o código completo já identifica o paciente e dispensa o avatar de iniciais. |
| [Revenue-Centric Design](https://github.com/heliocosta-dev/revenue-centric-design) e [Visant](https://ui.visantlabs.com/skills) | Reduzir escolhas redundantes. No histórico vazio, concentrar a criação da primeira visita em um único botão no conteúdo. |
| [Framer Gallery](https://www.framer.com/community/gallery/) e [Huashu](https://github.com/alchaincyf/huashu-design) | Referências de composição para a demonstração e os materiais de apresentação. Na tela clínica, priorizar leitura e continuidade da tarefa. |
| [Nucleo Glass](https://nucleoapp.com/svg-glass-icons) | A translucidez faz sentido como referência de material para a série 3D existente. A família de vidro do Visitário deriva da mesa aprovada e do render de elos da marca. |

## Assinatura e navegação do aplicativo

No cabeçalho, a assinatura combina o render de conexão com o nome em Bricolage Grotesque e o descritor em Inter. O arquivo leve `conexao-marca.webp` deriva do render original. O elo simplificado continua a identificar o aplicativo instalado e o favicon.

Início e Histórico usam os mesmos pictogramas de vidro no desktop e no celular. Início usa vidro fosco quando selecionado e o pictograma original em repouso. Histórico usa o pictograma original quando selecionado e vidro fosco em repouso. O rótulo ativo usa verde petróleo. Na lateral do desktop, um traço junto à borda também marca a seleção. No celular, esses estados aparecem dentro da cápsula flutuante da opção 3. O botão circular central abre as seções durante o preenchimento. No formulário, o índice “Nesta visita” fica na lateral do desktop e abre pelo botão “Seções” na barra inferior do celular. Cada atalho leva diretamente ao grupo de campos correspondente.

No espaço de trabalho, o perfil médico abre pelo avatar. A assinatura compacta acompanha os controles de agenda, tema, feedback e orientações no canto direito. “Visitas de hoje” conta registros locais pelo dia da visita. Os atalhos de agenda abrem um evento genérico para revisão no serviço escolhido. A Central de orientações apresenta o estado operacional do dispositivo e da sincronização.

Durante o atendimento, o topo identifica a etapa atual. Dados gerais reúne identificação, áudio, acompanhantes e moradia. A próxima tela reúne os campos SOAP. Gerar a evolução leva à revisão. O rascunho conserva a etapa ao retomar. O armazenamento aparece nas orientações e falhas têm aviso na tela. A assinatura encerra a faixa de utilitários à direita.

**Conferência da idade.** No campo editável, de 110 anos até o máximo válido de 130, exibir uma pergunta discreta com o valor digitado. O corte de 110 é uma decisão de interface para evitar interrupções frequentes. O Censo 2022 agrupa 37.814 pessoas na faixa de 100 anos ou mais. [Tabela do IBGE](https://agenciadenoticias.ibge.gov.br/media/com_mediaibge/arquivos/6e3da28dfe74401c5464880d8896197f.pdf)
