# Visitário — manual inicial

## Marca

Grafia oficial: **Visitário**, com acento agudo. Descritor: **Registro de visitas domiciliares**.

Propósito: apoiar o registro profissional em campo e a continuidade do cuidado. Linguagem clara, objetiva e próxima. Apresentar capacidades disponíveis e identificar funcionalidades futuras explicitamente.

A assinatura inicial combina Bricolage Grotesque com o ícone Link2 da Lucide. O mesmo símbolo aparece no cabeçalho, no favicon e nos ícones instaláveis. O SVG está em `frontend/public/icon.svg`. Para regenerar os PNGs a partir dele, instale `resvg-py` e execute `py -3 frontend/scripts/generate_icons.py` na raiz do projeto. A pesquisa de disponibilidade da marca e o desenho do símbolo exclusivo continuam pendentes.

## Fundamentos implementados

Os tokens `--vl-` ficam em `frontend/src/design-system.css`. O arquivo `frontend/src/styles.css` usa esses tokens nas telas de registro, revisão SOAP e histórico, incluindo nos módulos clínicos.

- Marca: verde petróleo `#145B49`; hover `#104838`; superfície de apoio `#EAF3EF`.
- Fundo `#F5F7F8`; superfície branca; texto `#172B35`; texto secundário `#475B66`.
- Apoio e foco `#245A81`, superfície informativa `#EDF4F8` e borda de controles `#788B95`.
- Sucesso verde, atenção âmbar e erro vermelho, sempre com mensagem textual.
- Inter Variable no corpo, formulários, botões e metadados; Bricolage Grotesque Variable na marca e nos títulos. Fontes empacotadas localmente via Fontsource e incluídas no precache da PWA (após preparação inicial online), com fallback do sistema. Licenças OFL distribuídas nos respectivos pacotes. Corpo e entrada de dados de 16 px, rótulos de 14 px; metadados de 12 px.
- Espaçamento em múltiplos de 4 px. Raios de 8 px em controles e 12 px em painéis.
- Botões principais com altura mínima de 48 px; opções com 44 px; foco visível por teclado.

O verde da marca identifica ações e seleções. A conexão usa azul informativo e a falta de conexão usa âmbar. O histórico mantém rótulos próprios para registro local, sincronização confirmada e conflito.

## Uso dos componentes

Reservar botão primário para o próximo passo principal. Usar secundário em alternativas e botão textual em ações auxiliares. Carregamento deve manter contexto da operação. Campos têm rótulos persistentes; unidades não substituem o rótulo. Erros devem explicar a correção e manter o conteúdo preenchido.

Painéis agrupam etapas da tarefa. Chips representam opções, com semântica de seleção adequada. Blocos SOAP permanecem editáveis e dependem de revisão profissional. Não ocultar pendências, conflitos ou falhas atrás de uma indicação genérica de sucesso.

## Materiais e evolução

Aplicar a mesma paleta e hierarquia na apresentação Supernova, proposta B2G e relatório de piloto. Usar dados fictícios identificados nas demonstrações. Reservar área separada para marcas de municípios e parceiros autorizados.

A ilustração da casa acompanha a opção de preencher o caso fictício. Os renders originais continuam na demo e na biblioteca de marca. A versão WebP usada no app faz parte do cache offline.

A validação com profissionais, o símbolo exclusivo, o catálogo de componentes e a auditoria completa de acessibilidade seguem como próximos entregáveis.
