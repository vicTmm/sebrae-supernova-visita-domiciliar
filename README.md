# Visitário · Visita domiciliar ESF

O Visitário permite registrar visitas domiciliares pelo celular e revisar a evolução SOAP. O profissional copia os blocos revisados e os cola nos campos correspondentes do VitaCare.

O aplicativo usa React, TypeScript e Tailwind. Os registros locais ficam no IndexedDB, via Dexie, e o Workbox dá suporte ao uso offline. A API usa FastAPI, Pydantic v2 e SQLAlchemy assíncrono com SQLite.

## Executar no Windows / PowerShell

Requisitos: Python 3.11+ e Node.js 22.12+ (ou 24 LTS). Comandos a partir da raiz do repositório. Não é necessário ativar o ambiente virtual nem alterar a política de execução do PowerShell.

Backend, em um terminal:

```powershell
cd backend
py -3 -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
Copy-Item .env.example .env
.\.venv\Scripts\python.exe -m uvicorn app.main:app --reload
```

Se o ambiente estiver ativado, `uvicorn app.main:app --reload` também funciona. Banco `backend/visits.db` criado automaticamente na primeira inicialização. API: http://localhost:8000; documentação interativa: http://localhost:8000/docs.

Frontend, em outro terminal:

```powershell
cd frontend
npm.cmd ci
npm.cmd run dev
```

Abra http://localhost:5173. O proxy do Vite encaminha `/visits` e `/health` ao backend. A variável opcional `VITE_API_URL` deve conter a origem da API quando hospedada separadamente; ajuste também `CORS_ORIGINS` no backend.

Em Linux/macOS: use `python3 -m venv .venv`, `.venv/bin/python` no lugar de `.\.venv\Scripts\python.exe`, `cp` para copiar `.env.example` e `npm` no lugar de `npm.cmd`.

## Testar

Backend (a partir da raiz):

```powershell
cd backend
.\.venv\Scripts\python.exe -m pytest -q
```

Frontend (a partir da raiz):

```powershell
cd frontend
npm.cmd test
npm.cmd run build
npm.cmd run preview
```

Abra http://localhost:4173 para validar a PWA. O service worker é gerado no **build de produção**, não no servidor de desenvolvimento. Carregue a página uma vez com rede e aguarde o cache inicial. Depois desconecte a rede e recarregue: preencha, gere SOAP, edite, copie e salve no histórico. Reconecte e aguarde até 30 segundos ou toque em **Sincronizar**. Verifique a visita na API. Teste também API desligada com navegador online: a fila permanece pendente.

Instalação e clipboard exigem contexto seguro: localhost ou HTTPS. Para testar em celular real pela rede, use uma origem HTTPS e configure a API/proxy correspondente. `http://IP-DO-PC` não habilita todas as funções PWA. O primeiro acesso precisa ser online. Cache, IndexedDB e clipboard dependem das permissões do navegador. Não limpe os dados do site antes de sincronizar.

## Fluxo de demonstração

1. Na tela inicial, toque em **Preencher exemplo** para abrir um caso fictício.
2. Confira os dados gerais. Ao selecionar **Feminino**, a seção **Saúde da Mulher** aparece após a identificação. Toque em **Continuar para SOAP** para registrar queixas, sinais vitais, exame físico, avaliação e plano. O rascunho é salvo no dispositivo a cada mudança.
3. Toque em **Gerar evolução SOAP**. O aplicativo monta o texto no dispositivo, inclusive sem internet.
4. Revise os blocos S, O e P e copie cada um para a aba correspondente no VitaCare. O bloco A aparece quando há uma observação diagnóstica. Transcreva os sinais vitais nos campos numéricos do VitaCare. Para copiar o texto com as medidas, use **Copiar Evolução Completa**.
5. **Salvar visita no histórico** cria uma pendência persistente. **Iniciar nova visita** abre outro registro. O histórico mantém os registros locais anteriores e recupera do servidor as visitas do dia no fuso do dispositivo.

Alterar os campos do registro invalida o SOAP anterior para evitar copiar texto desatualizado. Substituir um rascunho ou usar o servidor para reorganizar um texto editado pede confirmação. Salvar no histórico e copiar são ações independentes.

## IA e fidelidade clínica

A saída de `POST /visits/generate-soap` contém `subjective_text`, `objective_text`, `vitals_formatted`, `plan_text`, `assessment_text` (opcional), `vitals_context`, `full_text_fallback` e `source`. S, O e P são textos sem cabeçalho, prontos para seus campos; apenas a cópia completa acrescenta os rótulos S:/O:/A:/P: e as medidas. Sem observação diagnóstica, `assessment_text` é null: o bloco A continua disponível para preenchimento na revisão, mas não entra na cópia completa enquanto estiver vazio.

O relato é um parágrafo clínico, abrindo com a realização da visita e os acompanhantes informados. O **motivo desta visita** vem em seguida, seguido do cuidador/rede de apoio e das intercorrências relatadas. A narrativa não presume visita anterior nem escreve “desde a última VD” automaticamente; diferencia tratamento recente e uso contínuo atual. Os cartões de descrição individual surgem logo abaixo dos chips quando existem intercorrências selecionadas; fica oculto com **Sem intercorrências**. Relatos antigos são preservados e apresentados no campo contextual quando aplicável. Nenhuma ausência de sintomas ou normalidade é deduzida de campos vazios.

O texto O inclui o exame físico/neurológico registrado e observações dos parâmetros alterados. Os sinais vitais continuam separados em `vitals_formatted`, para transcrição nos campos numéricos. Medidas vazias não viram zero, e exames não avaliados não são descritos como normais.

Cada queixa selecionada abre seu próprio cartão de descrição. `intercurrence_details` agora é um mapa, por exemplo `{"Dor": "Lombalgia há dois dias", "Tontura": "Ao levantar"}`. Chaves precisam corresponder às queixas selecionadas. “Sem intercorrências” é exclusivo e limpa os cartões. Relatos compartilhados de versões anteriores são preservados no primeiro cartão selecionado, uma única vez; revise essa associação ao abrir um registro antigo. Texto SOAP já revisado nunca é regenerado pela migração.

O **MEEM** tem seis seletores: orientação temporal 0–5, espacial 0–5, registro 0–3, atenção/cálculo 0–5, evocação 0–3 e linguagem/praxia 0–9. O total só é calculado após preencher todos os domínios, incluindo zeros explícitos. Pode ficar não avaliado. A escolaridade rápida é registrada como faixa (`education_level`: `none`, `1_4`, `5_8`, `over_8`), sem inventar anos exatos; `education_years` preserva dados anteriores. Cortes do protocolo solicitado para este MVP: 20/25/26/28, respectivamente, com resultado abaixo do corte quando **escore < corte**. A interpretação é de rastreio, não diagnóstico de demência ou prova de declínio longitudinal. Os cortes variam entre instrumentos/populações; devem ser validados pelo médico da unidade. Não são uma alegação de protocolo universal. O aplicativo registra pontos, sem reproduzir perguntas do instrumento. [Estudo sobre cortes do MEEM e escolaridade](https://www.scielo.br/j/dn/a/hjKPjtgyVMnfg7xMMRtzBNs/?format=html&ilang=pt_BR). Campos estruturados de testes descontinuados são retirados ao reabrir registros antigos; o texto da evolução já revisada permanece intocado. Rankin 0–5 e exame dirigido continuam disponíveis.

`backend/app/services/clinical_rules.py` e `frontend/src/services/clinicalRules.ts` avaliam o protocolo de referência solicitado, com os mesmos resultados online/offline. Os limiares são apoio à revisão, não metas universais ou confirmação diagnóstica:

| Parâmetro | Alerta do MVP |
|---|---|
| PA sem HAS informada | PAS ≥140 ou PAD ≥90: investigar/monitorar |
| PA com HAS | ≥140/90: limítrofe/elevada, conferir meta; PAS ≥150 ou PAD ≥95: elevação significativa |
| PA acentuadamente elevada | PAS ≥180 ou PAD ≥120: reavaliação imediata de sintomas e necessidade de atendimento urgente |
| Meta individual | `bp_target` opcional, com ambas as medidas: alerta se a medida atinge/supera o alvo registrado; não suprime os alertas gerais |
| SatO₂ | <95%; se `DPOC/pneumopata`, <92% |
| HGT | <70: hipoglicemia; >180 no diabetes ou >200 sem diabetes informado: glicemia elevada, contextualizar alimentação/sintomas |
| FC / FR / Tax | FC >100 ou <50; FR >20; Tax ≥37,8 °C |

Os limiares adultos gerais não são aplicados a menores de 18 anos, gestantes ou puérperas: aparece indicação de avaliação por protocolo específico. Ausência de badge não atesta normalidade. Idade e condição de acamado não definem fragilidade automaticamente; uma meta individual deve ser registrada pelo médico. A referência de SatO₂ não é meta de oxigenoterapia. Veja [diretriz brasileira de hipertensão](https://www.scielo.br/j/abc/a/BXT7Vk4B9VKQnJFsJhgJ4Hn/?lang=pt), [metas glicêmicas da SBD](https://diretriz.diabetes.org.br/metas-de-controle-glicemico/) e [avaliação de DPOC do NICE](https://www.nice.org.uk/guidance/ng115/chapter/Recommendations).

A análise determinística, as comorbidades, idade, valores e contexto são enviados à IA. Sugestões são acrescentadas ao P com o rótulo **“Sugestões para revisão médica”**, separadas das ações informadas: não geram prescrição, dose, diagnóstico ou ação realizada. MEEM abaixo do corte sugere considerar avaliação ampliada; PA alterada sugere revisão de adesão e eventual ajuste após avaliação. O médico pode editar todo o texto antes de copiar.


`app/services/soap_generator.py` mantém fallback determinístico e integração assíncrona com o SDK OpenAI, com saída estruturada Pydantic. Por padrão `AI_ENABLED=false`. Para testar com casos anonimizados, configure `AI_ENABLED=true`, `OPENAI_API_KEY` e, opcionalmente, `OPENAI_MODEL` no `.env` do backend. A chave nunca vai ao frontend. Sem chave, erro, timeout ou resposta que omita fatos obrigatórios, o fallback continua disponível. A IA usa a mesma representação numérica dos dados e não controla os valores apresentados nos badges. A Avaliação é sempre a observação escrita pelo médico.

A saída estruturada não garante fidelidade clínica. Revise sempre. UUID, código do paciente, data, idade e sexo são excluídos do payload enviado ao provedor, mas nomes da equipe e texto livre ainda podem conter dados pessoais. Não insira identificação do paciente nas notas. A IA externa só é chamada pelo botão da revisão, não durante a sincronização. Alterar os campos do registro invalida a saída anterior; editar um card recompõe a cópia completa com as mesmas medidas.

Compatibilidade: `medications` legado continua aceito como `medications_in_use`. As versões 4 a 7 do IndexedDB atualizam os campos sem apagar rascunhos, textos revisados, conflitos ou pendências; a v7 acrescenta `visit_reason`, `follow_up_owner` e idade vazia (`null`), preservando zero quando informado. O SQLite recebe a coluna JSON opcional `soap_blocks` por migração aditiva (Alembic 0002 e bootstrap compatível). Evoluções antigas ficam com texto integral intacto e são abertas por um adaptador de leitura; novos blocos editados são persistidos e sincronizados sem regeneração. Não é necessário limpar os bancos.

Referência técnica: [saídas estruturadas do SDK OpenAI](https://developers.openai.com/api/docs/guides/structured-outputs).

## Persistência e sincronização

- IndexedDB guarda um rascunho ativo e registros salvos, incluindo fila e texto editado. O service worker guarda apenas arquivos estáticos da aplicação, nunca respostas clínicas da API.
- Sincronização roda ao abrir o app, recuperar rede, voltar à janela, manualmente e a cada 30 segundos com a página aberta. Com o app fechado, a fila aguarda a próxima abertura; não há garantia de Background Sync no sistema operacional.
- UUID criado no dispositivo + comparação do conteúdo tornam reenvios idempotentes, inclusive quando a resposta se perde após salvar. `base_revision` impede sobrescrita silenciosa de edições concorrentes. SQLite serializa transações de escrita.
- Alterações locais durante uma requisição continuam pendentes. Conflitos mostram o texto do servidor no histórico; o médico escolhe usar a versão remota ou reenviar a local sobre a revisão atual. Registros pendentes não são substituídos pela consulta ao servidor.
- O histórico da API é paginado, filtra dia e fuso; a sincronização lê todas as páginas do dia. Histórico anterior já baixado permanece no aparelho.

Endpoints principais em `/docs`: `POST /visits/generate-soap`, `POST /visits/sync`, `GET /visits?day=AAAA-MM-DD&offset_minutes=-180`, `GET /visits/{id}`, `POST /visits`, `PUT /visits` e `DELETE /visits/{id}?revision=N`. Escritas usam `{visit, soap_text, soap_blocks, base_revision}` (`soap_blocks` é opcional para registros legados); exclusão exige revisão. A tela do MVP não oferece exclusão. A API preserva o SOAP revisado e nunca o regenera ao sincronizar.

## Cloudflare Workers

Worker: **`sebrae-supernova-visita-domiciliar`**. O frontend PWA é servido por Workers Static Assets. O backend FastAPI/SQLite permanece separado. Sem `API_ORIGIN`, esta publicação funciona em **modo local**: gera SOAP, permite revisão/cópia e salva no IndexedDB; a sincronização e a IA externa aguardam uma API pública. `/health` informa `api_configured: false`, e `/visits` retorna 503 em vez de HTML ou confirmação falsa de sincronização.

Frontend publicado para validação em [visitario.victmm.workers.dev](https://visitario.victmm.workers.dev/). O Worker desse endereço encaminha as requisições ao Worker do app por um vínculo de serviço. Cada deploy automático do app atualiza os dois endereços. O [endereço original](https://sebrae-supernova-visita-domiciliar.victmm.workers.dev/) continua disponível para acessar rascunhos e visitas salvos pelo navegador naquela origem.

Para republicar somente o Worker do endereço curto, instale as dependências em `frontend` e execute os comandos abaixo a partir de `frontend/visitario-address`.

```powershell
node ../node_modules/vite/bin/vite.js build
node ../node_modules/cf/bin/cf deploy --prebuilt --mode production
```

A conta de destino do Worker do app está fixada em `frontend/cloudflare.config.ts` e pode ser sobrescrita por `CLOUDFLARE_ACCOUNT_ID` de forma explícita. A primeira publicação dessa configuração usa a versão `653faaf0-d90a-4c62-95f3-341ff6bbe4ee`.

Configuração em `frontend/cloudflare.config.ts` com CLI `cf` e Cloudflare Vite plugin. O build Cloudflare usa `--mode cloudflare`; o desenvolvimento local tradicional continua usando `npm.cmd run dev` e o proxy do Vite para a API no computador. Vite foi atualizado para a linha 7 para compatibilidade com o plugin Cloudflare. Para a CLI `cf` instalada, prefira Node.js 24.22+ (linha 24 LTS).

```powershell
cd frontend
npm.cmd ci
npm.cmd exec -- cf auth login
npm.cmd exec -- cf auth whoami
# Se houver várias contas, defina explicitamente a conta de destino:
$env:CLOUDFLARE_ACCOUNT_ID = 'ID_DA_CONTA_CLOUDFLARE'
npm.cmd run worker:types
npm.cmd test
npm.cmd run worker:dry-run
npm.cmd run deploy
```

`worker:dry-run` valida o bundle e a PWA sem publicar. `deploy` verifica TypeScript, constrói os assets e publica o Worker. `worker:dev` executa a integração no runtime local da Cloudflare. Tipos de bindings são inferidos de `cloudflare.config.ts`; o comando `worker:types` também gera as declarações em `.cloudflare/types/`, ignoradas pelo Git. Logs e traces estão habilitados, com redação de query string; o proxy não registra corpos clínicos nem respostas da API.

Quando existir uma API FastAPI pública HTTPS (origem sem caminho), conecte-a no mesmo terminal de publicação:

```powershell
$env:API_ORIGIN = 'https://SUA-API-FASTAPI'
npm.cmd run worker:dry-run
npm.cmd run deploy
```

A origem é um valor de configuração, não uma credencial. O Worker encaminha `/visits` e `/visits/*` para ela, preservando os endpoints atuais. Dados clínicos não são armazenados na Cloudflare por este proxy, e respostas da API têm `Cache-Control: no-store`. O proxy recusa redirecionamentos e loops. SQLite, dados locais, chaves de IA e credenciais não são incluídos nos assets. O deploy do frontend não provisiona Supabase, banco ou hospedagem Python.

Referências: [React + Vite em Workers](https://developers.cloudflare.com/workers/framework-guides/web-apps/react/) e [configuração programática da CLI cf](https://developers.cloudflare.com/cf/projects/cloudflare-config/).

## Migrações do SQLite

O bootstrap cria tabelas ausentes e adiciona a coluna opcional `soap_blocks` quando o banco ainda está na versão anterior, preservando os registros. Essa operação é idempotente e também está representada na migração Alembic 0002. Para outras alterações de esquema, faça backup do SQLite e use Alembic:

```powershell
cd backend
.\.venv\Scripts\python.exe -m alembic upgrade head
.\.venv\Scripts\python.exe -m alembic revision --autogenerate -m "descricao da mudanca"
# Revise a migração gerada antes de aplicar.
.\.venv\Scripts\python.exe -m alembic upgrade head
```

A migração inicial reconhece a tabela criada pelo bootstrap. Migrações futuras usam modo batch para SQLite. Os testes usam banco temporário próprio; a aplicação não depende de uma chave de IA nos testes.

## Limites do MVP e validação com a unidade

Ambiente de demonstração e validação com casos fictícios ou anonimizados. Não há autenticação, isolamento por profissional/equipe, criptografia em repouso, auditoria, política de retenção ou gestão de dispositivos. CORS não é controle de acesso. O histórico do servidor é compartilhado entre todos os clientes conectados à mesma API. Não exponha esta API publicamente nem use dados reais antes de implementar esses controles e validar o tratamento de dados com a instituição. Apenas o frontend foi publicado na Cloudflare; a API FastAPI e o SQLite não foram publicados.

Antes da validação final, peça ao médico **3 exemplos reais anonimizados de evolução no VitaCare** e os **códigos/campos obrigatórios** da unidade (tipo de visita, desfecho, siglas e outros campos). Registre apenas exemplos anonimizados e aprovados para ajustar `SYSTEM_PROMPT` com few-shot e o template determinístico. O MVP não preenche códigos municipais automaticamente e não declara compatibilidade validada com uma configuração específica do VitaCare. As telas do VitaCare com o médico estão previstas para **30/11/2026**; o checklist e o estado atual para comparação estão em [docs/analise-vitacare-2026-11-30.md](docs/analise-vitacare-2026-11-30.md).

### Validação das regras clínicas

`backend/tests/fixtures/clinical_cases.json` contém casos compartilhados para verificar paridade entre o SOAP local e Python, incluindo limiares exatos, comorbidades, metas individuais, escolaridade e dados ausentes. Os testes também cobrem migração IndexedDB de versões antigas para a v7, mapas de queixas, soma dos domínios e preservação de texto editado. O exemplo inclui PA 150/90 e MEEM 24/30 (4 anos de escolaridade) para demonstrar alertas e sugestões. Na Cloudflare, estas funções operam localmente enquanto a API pública não estiver configurada.

### Detalhes contextuais do cadastro

Enfermeiro(a)/técnico(a) agora abre nome opcional (`companions.nurse_name`), incluído na abertura do Subjetivo. A condição “Outra” abre descrição (`other_condition`, até 500 caracteres), incluída na história e enviada à IA. Ao desmarcar as opções, o formulário limpa os detalhes associados. Sexo oferece somente Feminino e Masculino, com “Selecione” como estado vazio; valores legados “Outro”/“Não informado” viram ausência de informação, sem atribuição automática. A migração IndexedDB v5 preserva SOAP revisado, rascunhos e pendências.

### Perfil e fluxo da visita

O perfil profissional pede nome, CRM/UF, celular e e-mail. Especialidade e unidade/equipe ficam no VitaCare: não são exibidas nem regravadas, embora perfis antigos sejam aceitos sem limpeza forçada. A identificação da visita aceita idade em branco e zero informado; o avanço exige motivo do atendimento **ou** condição acompanhada. O campo `visit_reason` (até 300 caracteres) aparece no início do Subjetivo.

A rede de apoio começa pelo cuidador de referência (nome/iniciais, vínculo e `Quem participa dos cuidados?`, até 500 caracteres) e só depois descreve os demais moradores. Presença da equipe e responsabilidade pelo seguimento são informações distintas: `follow_up_owner` (até 200 caracteres) vira tópico do Plano. O valor interno `Agendamento de retorno VD` foi mantido por compatibilidade, mas a tela mostra **Retorno indicado em VD** e o texto gerado diz `Indico retorno em visita domiciliar`, sem criar agenda nem confirmar data.

Numa passada de redução de ruído, os rótulos deixaram de repetir o título da seção, o marcador `(opcional)` foi removido (campo obrigatório é o que leva `*`) e textos que explicavam o funcionamento interno foram cortados. O mesmo critério se aplicou ao rastreio preventivo: o sistema não escreve más condutas no Plano.

### Publicação automática e atualização da PWA

Workers Builds deve usar `/frontend` como diretório raiz, `npm ci && npm exec --yes --package=node@24.22.0 -- node node_modules/cf/bin/cf build --mode cloudflare` como build e `npm exec --yes --package=node@24.22.0 -- node node_modules/cf/bin/cf deploy --prebuilt --mode cloudflare` como publicação de produção. Previews usam o mesmo build e `cf workers versions create --prebuilt --mode cloudflare` (com o mesmo prefixo Node) para não substituir produção. A configuração antiga sem build e com `npx wrangler deploy` publicava o HTML fonte após cada push e sobrescrevia o deploy manual.

A versão 0.1.1 exibe “Verificar atualização” no rodapé e verifica o service worker ao registrar, recuperar conexão e voltar à aba. A ativação continua sendo confirmada no aviso “Atualizar aplicativo”; não limpa IndexedDB. “Apenas Médico” indica ausência de acompanhantes: não existe login nem identificação automática do médico neste MVP.

### Saúde da Mulher e avaliação do idoso — versão 0.1.2

Ao selecionar Feminino, surge “Saúde da Mulher”, com duas linhas curtas: preventivo (Papanicolau) e mamografia. Cada uma registra situação, ano e observação. O valor interno `Atrasado / Solicitar` aparece na tela apenas como “Atrasado”, para não misturar histórico com conduta. Ano e observação são opcionais; ano futuro ou ano informado com “Nunca realizou” são recusados. Trocar o sexo limpa o preenchimento. O rastreio atrasado é narrado no Subjetivo como histórico, sem gerar “Solicitar …” automático no Plano: a conduta é escrita pelo profissional em Detalhes da conduta.

“Avaliação Cognitiva e Funcional (Idoso / Neuro)” contém três módulos opcionais independentes: MEEM, rastreio breve de saúde mental/vulnerabilidade e Rankin/exame dirigido. `neuro_exam.geriatric_screening` armazena `flags` e `notes`. Os marcadores assinalados são narrados no Subjetivo; não se presume negativa nos itens desmarcados, depressão, escore GDS ou escore IVCF-20. A seleção breve usa temas de humor, memória, AVDs e mobilidade; não equivale à aplicação integral de instrumentos validados. Consulte a [ficha IVCF-20 do Ministério da Saúde](https://bvsms.saude.gov.br/bvs/publicacoes/ficha_indice_vulnerabilidade_treino_INVCF-20.pdf) para a aplicação completa.

Os títulos S/O/A/P ficam fora das caixas. Os blocos individuais são limpos também quando a IA ou uma edição traz prefixos; somente “Copiar Evolução Completa” usa cabeçalhos. IndexedDB v7 preserva textos editados e normaliza os campos estruturados atuais; o backend filtra campos neurológicos descontinuados ao ler payloads antigos do SQLite, sem reescrever a evolução salva. Novas requisições continuam com validação estrita.

### Áudio para revisão da visita

No registro e na revisão SOAP, **Áudio da visita → Nova gravação** permite ditar um relato ou gravar uma conversa autorizada. Informe o profissional responsável, confirme a autorização, escolha 24 horas (padrão) ou 7 dias e defina uma senha exclusiva com pelo menos 12 caracteres. A permissão do microfone só é solicitada ao tocar em **Iniciar gravação**. Pausar, retomar e encerrar estão disponíveis. Cada visita aceita até cinco gravações, com até 15 minutos e 32 MB por gravação; o conjunto de áudios deste navegador fica limitado a 128 MB. O navegador pode impor uma cota menor.

O áudio é associado ao UUID da visita e permanece disponível ao reabri-la pelo histórico no mesmo navegador/origem. Salve a evolução no histórico antes de iniciar outra visita. O botão de nova visita impede abandonar áudios sem uma visita salva. Na reprodução, use os controles nativos para buscar trechos e ajustar o volume. A senha é exigida em cada desbloqueio. O player bloqueia ao ocultar a aba ou após cinco minutos sem interação com a página. Ao ocultar a aba durante captura, o app encerra e tenta salvar o áudio. Microfone e URLs temporárias são liberados ao encerrar/bloquear.

**Armazenamento e acesso:** banco IndexedDB separado `visitario-audio-v1`, sem mudanças no esquema de visitas. Áudio e declaração de autorização são criptografados juntos por AES-256-GCM. A chave não extraível é derivada da senha via PBKDF2-SHA-256 com 600.000 iterações e salt aleatório por arquivo; cada arquivo tem IV aleatório de 96 bits. UUID, vínculo da visita, data, prazo, duração e MIME permanecem como metadados locais e são autenticados como dados adicionais da cifra, impedindo sua alteração sem invalidar a descriptografia. Senha e chave não são persistidas; não existe recuperação de senha. O formulário mantém a senha em memória durante a captura e eventual nova tentativa de salvamento. A senha é limpa após salvar ou descartar.

Os áudios **não são enviados ao backend, à IA, à sincronização nem ao VitaCare** e não integram o cache do service worker. Não há transcrição automática nesta implementação. Não existe backup, acesso por conta, compartilhamento ou recuperação em outro aparelho. Quem possuir a senha e acesso à origem neste navegador poderá ouvir; o nome/registro declarado não constitui autenticação do profissional. Criptografia local não protege uma sessão desbloqueada contra scripts maliciosos, dispositivo comprometido ou quem controla o navegador. Os registros clínicos existentes continuam com as limitações de segurança descritas anteriormente.

**Autorização:** no modo relato, o profissional confirma que apenas sua própria voz será gravada. No modo conversa, registra se o paciente ou responsável legal autorizou e confirma que informou finalidade, acesso, prazo e que todas as pessoas gravadas concordaram. A declaração versionada inclui profissional, modalidade, categoria de autorizante e data/hora, dentro do conteúdo criptografado. Não se armazenam nomes do paciente nessa declaração. Trata-se de declaração do profissional, não assinatura digital nem prova independente de consentimento. A recusa não bloqueia o formulário clínico. A exclusão manual permite remover áudio e declaração sem apagar a evolução, inclusive diante da retirada da autorização; é confirmada na interface e não exige senha para permitir remoção mesmo se ela for esquecida.

**Retenção:** prazo contado do salvamento. Após expirar, o app recusa a descriptografia e exclui o arquivo ao abrir a aplicação e a cada 15 segundos enquanto ela estiver aberta (temporizadores podem ser suspensos pelo navegador). Sem execução do aplicativo, não há garantia de remoção física no horário exato. Exclusão de IndexedDB não equivale a apagamento forense de disco/backups do sistema. A captura fica em memória até o salvamento; fechar o navegador, recarregar ou perder energia antes de concluir pode perder o áudio. Falhas de quota preservam o áudio em memória para tentar novamente ou descartar explicitamente. As cotas e os prazos são escolhas conservadoras deste MVP, não prazos legais universais.

**Antes de uso institucional:** validar finalidade e hipótese legal com a instituição/encarregado, processo de autorização e retirada, política de retenção, proteção do dispositivo e necessidade de áudio no prontuário. O registro na UI não declara conformidade com LGPD. Caso haja armazenamento central futuro, implementar autenticação individual, autorização por visita/equipe no servidor, trilha de acesso, criptografia e gestão de chaves, retenção e exclusão no servidor antes de habilitar uploads. Não publicar um endpoint de áudio na API atual sem esses controles.

Referências: [LGPD, inclusive dados sensíveis e segurança](https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2018/lei/l13709compilado.htm), [ANPD: perguntas frequentes](https://www.gov.br/anpd/pt-br/acesso-a-informacao/perguntas-frequentes), [MediaRecorder e formatos suportados](https://developer.mozilla.org/en-US/docs/Web/API/MediaRecorder/MediaRecorder), [permissão e contexto seguro do microfone](https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia).

### Moradia e cuidador

O bloco opcional **Moradia e cuidador** registra `household`: situação de moradia (`alone`, `with_others` ou não informada), descrição dos moradores (até 500 caracteres), presença de cuidador (`yes`, `no` ou não informada), nome/iniciais (80), parentesco/vínculo (100) e participação nos cuidados (500). Prefira vínculos e iniciais a nomes completos. Não há campos de documento, telefone ou endereço.

Moradia e cuidador são independentes: morar sozinho não significa não possuir cuidador. Ao trocar a situação, os detalhes incompatíveis são limpos na interface; a API recusa combinações contraditórias. O contexto preenchido integra o Subjetivo, sem inferir ausência de apoio quando vazio. Rascunhos, histórico e sincronização preservam o objeto no JSON existente; registros anteriores continuam aceitos sem ele, sem regenerar SOAP revisado nem exigir alteração das tabelas SQLite/IndexedDB. A IA externa não recebe esse objeto: os fatos domiciliares são acrescentados pelo gerador local/backend à saída revisável. Publicar também o backend atualizado antes de usar a sincronização dos novos campos com uma API remota antiga.

### Moradores por vínculo e identificação opcional

A interface de moradia agora usa grupos em `household.residents`: vínculo em lista, quantidade com setas/teclado e botão **Adicionar vínculo**. O paciente não entra nessa contagem. Até 10 grupos e de 1 a 20 pessoas por grupo; outro vínculo exige descrição. Esses limites são operacionais do MVP. O vínculo não é preenchido automaticamente. O vínculo de cuidador residente descreve moradia e não atribui, por si, responsabilidade legal ou papel de cuidador de referência.

Cada grupo tem UUID estável, `relationship`, `other_relationship`, `count` e `members`. **Identificar pessoas ou contato (opcional)** abre nome completo (até 120 caracteres) e telefone com DDD por pessoa. Os campos podem ficar todos vazios; telefone informado exige nome e 10/11 dígitos, armazenados sem máscara. Não há coleta de CPF. As setas respeitam os limites e reduzir quantidade/remover grupos com dados pessoais pede confirmação. Ocultar os detalhes não apaga os dados. Mudar a situação de moradia limpa os grupos, preservando os dados independentes do cuidador. O aplicativo continua a exigir confirmação se houver identificação a remover.

O SOAP usa apenas os vínculos e quantidades dos grupos, como “Reside com 2 filhos(as), 1 neto(a)”. Os nomes e telefones de `members` ficam fora da evolução e não são enviados à IA externa (todo o objeto `household` permanece excluído). Relato livre legado e campos anteriores do cuidador mantêm seu comportamento; não se deve inserir documentos ou telefones no texto livre se não se pretende copiá-los no SOAP. O texto antigo `cohabitants` é preservado como relato complementar, sem inferir grupos/quantidades e sem regenerar evoluções revisadas. Revise esse relato ao cadastrar grupos para evitar duplicar as mesmas pessoas.

**Limitação de segurança dos contatos:** estes campos administrativos seguem a persistência atual das visitas no IndexedDB e no JSON SQLite, inclusive a sincronização com a API configurada. Eles não recebem a criptografia por senha usada exclusivamente nos áudios. A API ainda não tem isolamento por profissional ou equipe; portanto, use contatos fictícios nesta fase. Sua inclusão no modelo não autoriza uso com dados reais nem representa implementação de acesso institucional. A finalidade e a necessidade de cada dado devem ser definidas pela instituição antes da coleta real.

Referências de contexto: [cadastro de cidadãos no e-SUS APS](https://sisaps.saude.gov.br/sistemas/esusaps/docs/manual/PEC/PEC_03_cidadao/) e [princípio da necessidade segundo a ANPD](https://www.gov.br/anpd/pt-br/documentos-e-publicacoes/glossario-anpd).

### Recebimento de feedback por e-mail

No backend FastAPI de produção, defina `APP_ENV=production`, `SMTP_HOST`, `SMTP_PORT` (587 por padrão, com STARTTLS), `FEEDBACK_FROM` (remetente autorizado pelo provedor) e as credenciais `SMTP_USERNAME` e `SMTP_PASSWORD` do serviço. `FEEDBACK_TO` define o destinatário e começa em `kginatsu@gmail.com`. Para alterar o endereço, atualize a variável no backend e reinicie a API. O Worker deve encaminhar `/feedback` à API por `API_ORIGIN`.

A confirmação no app indica que o relato foi registrado no banco. Em produção, a mesma transação o coloca na fila SQLite `feedback_delivery`. Mantenha o banco em volume persistente. O processo da API encaminha sugestões e problemas por SMTP e repete tentativas após falhas, inclusive depois de reiniciar. A fila guarda apenas entregas pendentes. Se a API for interrompida entre o aceite SMTP e a baixa no banco, pode haver reentrega com o mesmo Message-ID. Em desenvolvimento, o relato é registrado sem gerar entrega de e-mail.
