# Direção de marca e design system — proposta 0.1

Status: proposta para avaliação. Não representa nome ou identidade aprovados. A interface atual permanece intacta.

## Produto e posicionamento

Ferramenta de apoio ao registro de visitas domiciliares da atenção primária: captura estruturada em campo, revisão da evolução SOAP e transferência do texto revisado para o sistema utilizado pela equipe. O MVP possui persistência local e fila de sincronização; não oferece integração direta com VitaCare.

Proposta de posicionamento: **Mais clareza no registro. Mais continuidade no cuidado.**

O profissional precisa registrar sem perder informações e compreender o que está salvo. O gestor precisa avaliar implantação, suporte, interoperabilidade e resultados demonstráveis. O paciente é o beneficiário do cuidado, mesmo sem operar a interface.

Na apresentação ao Supernova, mostrar problema, fluxo e evidências do piloto. Na apresentação B2G, acrescentar condições de implantação e operação, responsabilidades e custos. Não apresentar funcionalidades planejadas como entregues nem estimativas como resultados medidos.

## Nome: decisão separada da interface

“Em Casa” é o nome provisório encontrado no projeto. É acolhedor e compreensível, mas sua diferenciação precisa ser investigada. Três territórios para exploração:

| Candidato conceitual | Ideia | Ponto a investigar |
| --- | --- | --- |
| Elo Territorial | Continuidade entre equipe, território e cuidado | Comprimento e facilidade de uso oral |
| Cuidar em Rede | Colaboração e continuidade | Distinção em relação a iniciativas existentes |
| Em Casa | Proximidade e atenção domiciliar | Distintividade e associação com serviços de outros setores |

São propostas criativas sem verificação de disponibilidade. Antes da escolha, pesquisar marcas, domínios, nomes de aplicativos e possíveis confusões com serviços públicos. Testar pronúncia e reconhecimento com profissionais e gestores. Não usar brasões, cruzes oficiais ou marcas do SUS como identidade própria.

Descritor provisório: **Registro de visitas domiciliares**. Ele explica o produto enquanto o nome é decidido e evita prometer uma plataforma de gestão que o MVP ainda não entrega.

## Direção visual recomendada

**Clareza institucional com proximidade humana.** Base clara, tipografia sem serifa, verde petróleo nas ações, azul discreto como apoio e cores semânticas reservadas aos estados. Superfícies sólidas e bordas legíveis; pouca sombra. A personalidade vem da composição e da linguagem, sem depender de efeitos decorativos.

O verde atual pode ser a origem da identidade, mas a proposta reduz o aspecto amarelado das superfícies e aumenta o tamanho dos textos. Evitar textos de 8–11 px em informações operacionais. Usar ilustrações apenas no onboarding e nos materiais de apresentação; durante o registro, priorizar conteúdo e controles.

## Fundamentos

| Papel | Valor proposto | Aplicação |
| --- | --- | --- |
| Marca / ação | `#145B49` | Ação principal e seleção |
| Ação hover | `#104838` | Ponteiro sobre ação principal |
| Apoio | `#245A81` | Informação e visualização de dados |
| Fundo | `#F5F7F8` | Tela |
| Superfície | `#FFFFFF` | Formulários e painéis |
| Texto principal | `#172B35` | Conteúdo |
| Texto secundário | `#475B66` | Ajuda e metadados |
| Borda discreta | `#D4DDE2` | Divisores e painéis; não como único limite de controles |
| Borda de controle | `#788B95` | Inputs e seleção sem preenchimento |
| Foco | `#245A81` | Contorno de teclado com afastamento da superfície |
| Sucesso | `#216345` / `#EDF7F0` | Texto / fundo |
| Atenção | `#795000` / `#FFF5DC` | Texto / fundo |
| Erro | `#A52A32` / `#FFF0F0` | Texto / fundo |

Cores são candidatas: validar contraste de cada combinação e estado na implementação. Cor nunca comunica estado sozinha. Gráficos precisam de rótulos e padrões adicionais quando necessário. Não usar cores de marca para inferir normalidade clínica.

Tipografia: começar com `system-ui, -apple-system, Segoe UI, sans-serif`, disponível offline sem dependência de carregamento externo. Corpo 16/24 px; ajuda 14/20; rótulos 14/20 com peso 600; títulos de seção 20/28; título de página 28/36 no celular e 32/40 no desktop. Números de medidas e tabelas com algarismos tabulares. Não reduzir fonte para caber conteúdo.

Espaçamento: escala de 4, 8, 12, 16, 24, 32, 48 e 64 px. Raios de 8 px nos controles e 12 px nos painéis. Pílulas apenas para etiquetas e opções curtas. Ícones Lucide já utilizados no projeto, traço consistente, 20–24 px, acompanhados por texto em ações importantes.

Layout: uma coluna no celular; duas ou três apenas para campos curtos relacionados no desktop. Padding de 16 px no celular e 24–40 px no desktop. Coluna de leitura de até 72 caracteres; formulários com largura confortável e agrupamento por tarefa. Não transformar todo campo em um card.

## Contrato dos componentes

| Componente | Regras e estados necessários |
| --- | --- |
| Botão | Primário, secundário e textual; padrão, foco, hover, pressionado, indisponível e carregando; manter rótulo durante carregamento |
| Campo | Rótulo persistente, unidade explícita, ajuda, erro associado; distinguir vazio, zero e não avaliado |
| Opções | Checkbox para múltipla escolha e radio para escolha única; chips devem manter essa semântica |
| Painel de seção | Título, descrição opcional e conteúdo; hierarquia por espaçamento antes de sombra |
| Notificação | Informação, atenção, erro e sucesso; texto explica ocorrido e próximo passo |
| Estado de registro | Rascunho salvo no aparelho, pendente, sincronizando, sincronizado, falha e conflito |
| Bloco SOAP | Origem do texto, edição, cópia e revisão; avisar quando mudanças invalidam o conteúdo anterior |
| Histórico | Identificação mínima necessária, data, estado e ação; vazio, carregando, falha e conflito |
| Confirmação | Para substituir conteúdo ou resolver conflito; ação descrita com verbo específico |

Alvos de interação: pelo menos 44 × 44 px como regra do produto. Navegação por teclado, foco visível, labels associados e mensagens anunciadas por tecnologias assistivas. Validar também zoom de 200%, largura de 320 px, textos longos e preferência por movimento reduzido. Meta de acessibilidade: WCAG 2.2 AA, a confirmar por auditoria; não declarar conformidade antes da validação.

## Linguagem e confiança

Tom direto, respeitoso e objetivo. Verbos claros: “Salvar visita”, “Copiar texto”, “Revisar evolução”, “Tentar sincronizar”. Usar termos reconhecidos pela equipe com explicação na primeira ocorrência quando necessário.

Exemplos de mensagens:

- “Rascunho salvo neste aparelho.”
- “Sem conexão. Você pode continuar o registro.”
- “Visita salva neste aparelho. Sincronização pendente.”
- “Não foi possível sincronizar. O registro continua neste aparelho.”
- “O registro foi alterado em outro dispositivo. Compare as versões para continuar.”
- “Revise o texto antes de utilizá-lo no prontuário.”

Conectividade e persistência são estados diferentes: estar online não significa que a visita chegou ao servidor. Não exibir “seguro”, “em conformidade com a LGPD” ou “integrado ao SUS” como garantias sem comprovação correspondente. Os avisos clínicos devem refletir comportamento implementado e revisão profissional.

## Manual visual e materiais

Após decidir o nome, desenvolver assinatura principal horizontal, versão compacta, monocromática e inversa; definir área de proteção e tamanho mínimo a partir de testes reais. Explorar símbolo abstrato de conexão e percurso, legível em 24 px, sem depender de detalhes de casa, coração e cruz combinados.

Entregáveis de marca: SVG mestre, PNG de apoio, ícones PWA, favicons e manual com exemplos de aplicação. Materiais comerciais: capa de proposta, apresentação de demonstração, ficha do produto e relatório de piloto, todos com a mesma grade, tipografia e paleta. Separar marca do produto das marcas de municípios e parceiros; coassinaturas dependem de autorização.

Fotos e exemplos devem mostrar o contexto de trabalho sem expor pacientes. Demonstrações usam dados fictícios claramente identificados. Métricas de economia de tempo, qualidade de registro ou impacto só entram com metodologia e evidência.

## Sequência de implementação

1. Validar posicionamento e território de nome com o responsável pelo produto.
2. Pesquisar disponibilidade e escolher nome; desenvolver a assinatura visual.
3. Prototipar registro, revisão SOAP e histórico em celular e desktop com os fundamentos desta proposta.
4. Validar com profissionais em tarefas reais usando dados fictícios: preencher, retomar rascunho, revisar, copiar e recuperar uma falha.
5. Implementar tokens semânticos e componentes compartilhados, substituindo valores repetidos do CSS atual de forma gradual.
6. Auditar contraste, teclado, leitores de tela, telas pequenas e estados de sincronização; verificar que dados e fluxos existentes continuam preservados.
7. Consolidar manual visual e materiais comerciais com os resultados do piloto.

Concluído neste documento: proposta de posicionamento, territórios de nome, fundamentos visuais e contratos de componentes. Ainda pendentes: decisão de marca, pesquisa de disponibilidade, identidade gráfica final, protótipos, biblioteca implementada e validação com usuários.
