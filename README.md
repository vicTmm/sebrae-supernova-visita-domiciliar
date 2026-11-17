# Em Casa · Visita domiciliar ESF

MVP mobile-first para registrar uma visita domiciliar, revisar a evolução SOAP e copiar texto simples para o VitaCare. React/TypeScript/Tailwind, IndexedDB (Dexie), PWA com Workbox, FastAPI/Pydantic v2 e SQLite/SQLAlchemy assíncrono. Não há integração direta com o VitaCare.

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

1. Toque em **Preencher Exemplo de Caso Clínico**. O caso é fictício.
2. Ajuste queixas, sinais vitais, exame, avaliação e plano. O rascunho é salvo em IndexedDB a cada mudança.
3. Toque em **Gerar evolução SOAP**: a geração local funciona sem rede nem API key.
4. Revise os cards S, O e P e copie cada um para sua aba no VitaCare. Os badges de PAS, PAD, SatO2, FC, FR, Tax e HGT ficam separados para transcrição nos campos numéricos. O botão discreto **Copiar Evolução Completa** inclui também as medidas. A aparece apenas se foi preenchida uma observação diagnóstica.
5. **Salvar visita no histórico** cria uma pendência persistente. **Iniciar nova visita** abre outro registro. O histórico mantém os registros locais anteriores e recupera do servidor as visitas do dia no fuso do dispositivo.

Alterar os campos do registro invalida o SOAP anterior para evitar copiar texto desatualizado. Substituir um rascunho ou usar o servidor para reorganizar um texto editado pede confirmação. Salvar no histórico e copiar são ações independentes.

## IA e fidelidade clínica

A saída de `POST /visits/generate-soap` contém `subjective_text`, `objective_text`, `vitals_formatted`, `plan_text`, `assessment_text` (opcional), `vitals_context`, `full_text_fallback` e `source`. S, O e P são textos sem cabeçalho, prontos para seus campos; apenas a cópia completa acrescenta os rótulos S:/O:/A:/P: e as medidas. Sem observação diagnóstica, `assessment_text` é null e não há seção A na cópia completa.

O relato é um parágrafo clínico, abrindo com a realização da visita e os acompanhantes informados. A narrativa diferencia intercorrências desde a última VD, tratamento recente e uso contínuo atual. O campo **Descreva melhor (motivo, conduta na UPA, duração...)** surge logo abaixo dos chips quando existe intercorrência selecionada; fica oculto com **Sem intercorrências**. Relatos antigos são preservados e apresentados no campo contextual quando aplicável. Nenhuma ausência de sintomas ou normalidade é deduzida de campos vazios.

O texto O inclui o exame físico/neurológico registrado e observações dos parâmetros alterados. Os sinais vitais continuam separados em `vitals_formatted`, para transcrição nos campos numéricos. Medidas vazias não viram zero, e exames não avaliados não são descritos como normais.

Cada queixa selecionada abre seu próprio cartão de descrição. `intercurrence_details` agora é um mapa, por exemplo `{"Dor": "Lombalgia há dois dias", "Tontura": "Ao levantar"}`. Chaves precisam corresponder às queixas selecionadas. “Sem intercorrências” é exclusivo e limpa os cartões. Relatos compartilhados de versões anteriores são preservados no primeiro cartão selecionado, uma única vez; revise essa associação ao abrir um registro antigo. Texto SOAP já revisado nunca é regenerado pela migração.

O **MEEM** tem seis seletores: orientação temporal 0–5, espacial 0–5, registro 0–3, atenção/cálculo 0–5, evocação 0–3 e linguagem/praxia 0–9. O total só é calculado após preencher todos os domínios, incluindo zeros explícitos. Pode ficar não avaliado. A escolaridade rápida é registrada como faixa (`education_level`: `none`, `1_4`, `5_8`, `over_8`), sem inventar anos exatos; `education_years` preserva dados anteriores. Cortes do protocolo solicitado para este MVP: 20/25/26/28, respectivamente, com resultado abaixo do corte quando **escore < corte**. A interpretação é de rastreio, não diagnóstico de demência ou prova de declínio longitudinal. Os cortes variam entre instrumentos/populações; devem ser validados pelo médico da unidade. Não são uma alegação de protocolo universal. O aplicativo registra pontos, sem reproduzir perguntas do instrumento. [Estudo sobre cortes do MEEM e escolaridade](https://www.scielo.br/j/dn/a/hjKPjtgyVMnfg7xMMRtzBNs/?format=html&ilang=pt_BR). Glasgow foi retirado dos seletores; resultados antigos permanecem legíveis e podem ser removidos explicitamente. Rankin 0–5 e exame dirigido continuam disponíveis.

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

Compatibilidade: `medications` legado continua aceito como `medications_in_use`. A versão 4 do IndexedDB atualiza os campos sem apagar rascunhos, textos revisados, conflitos ou pendências. O SQLite recebe a coluna JSON opcional `soap_blocks` por migração aditiva (Alembic 0002 e bootstrap compatível). Evoluções antigas ficam com texto integral intacto e são abertas por um adaptador de leitura; novos blocos editados são persistidos e sincronizados sem regeneração. Não é necessário limpar os bancos.

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

Frontend publicado para validação: https://sebrae-supernova-visita-domiciliar.victmm.workers.dev. A conta de destino está fixada em `cloudflare.config.ts` e pode ser sobrescrita por `CLOUDFLARE_ACCOUNT_ID` de forma explícita. A primeira publicação desta configuração usa a versão `653faaf0-d90a-4c62-95f3-341ff6bbe4ee`.

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

Antes da validação final, peça ao médico **3 exemplos reais anonimizados de evolução no VitaCare** e os **códigos/campos obrigatórios** da unidade (tipo de visita, desfecho, siglas e outros campos). Registre apenas exemplos anonimizados e aprovados para ajustar `SYSTEM_PROMPT` com few-shot e o template determinístico. O MVP não preenche códigos municipais automaticamente e não declara compatibilidade validada com uma configuração específica do VitaCare.

### Validação das regras clínicas

`backend/tests/fixtures/clinical_cases.json` contém casos compartilhados para verificar paridade entre o SOAP local e Python, incluindo limiares exatos, comorbidades, metas individuais, escolaridade e dados ausentes. Os testes também cobrem migração IndexedDB v3→v4, mapas de queixas, soma dos domínios e preservação de texto editado. O exemplo inclui PA 150/90 e MEEM 24/30 (4 anos de escolaridade) para demonstrar alertas e sugestões. Na Cloudflare, estas funções operam localmente enquanto a API pública não estiver configurada.

### Detalhes contextuais do cadastro

Enfermeiro(a)/técnico(a) agora abre nome opcional (`companions.nurse_name`), incluído na abertura do Subjetivo. A condição “Outra” abre descrição (`other_condition`, até 500 caracteres), incluída na história e enviada à IA. Ao desmarcar as opções, o formulário limpa os detalhes associados. Sexo oferece somente Feminino e Masculino, com “Selecione” como estado vazio; valores legados “Outro”/“Não informado” viram ausência de informação, sem atribuição automática. A migração IndexedDB v5 preserva SOAP revisado, rascunhos e pendências.

### Publicação automática e atualização da PWA

Workers Builds deve usar `/frontend` como diretório raiz, `npm ci && npm exec --yes --package=node@24.22.0 -- node node_modules/cf/bin/cf build --mode cloudflare` como build e `npm exec --yes --package=node@24.22.0 -- node node_modules/cf/bin/cf deploy --prebuilt --mode cloudflare` como publicação de produção. Previews usam o mesmo build e `cf workers versions create --prebuilt --mode cloudflare` (com o mesmo prefixo Node) para não substituir produção. A configuração antiga sem build e com `npx wrangler deploy` publicava o HTML fonte após cada push e sobrescrevia o deploy manual.

A versão 0.1.1 exibe “Verificar atualização” no rodapé e verifica o service worker ao registrar, recuperar conexão e voltar à aba. A ativação continua sendo confirmada no aviso “Atualizar aplicativo”; não limpa IndexedDB. “Apenas Médico” indica ausência de acompanhantes: não existe login nem identificação automática do médico neste MVP.
