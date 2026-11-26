# Análise pendente das telas do VitaCare — 30/11/2026

O médico da unidade vai enviar as telas do VitaCare no dia **30/11/2026**. Este arquivo guarda o que deve ser comparado quando as imagens chegarem. Nada aqui depende de nova decisão do profissional: as alterações abaixo já estão aplicadas no app e servem como linha de base para a análise.

## Decisão já aplicada ao perfil

- **Perfil profissional mantém:** nome, CRM/UF, celular e e-mail.
- **Perfil profissional não pede mais:** especialidade e unidade/equipe. Valores antigos podem continuar no `localStorage`, mas o formulário não os exibe nem os grava novamente.
- **Motivo:** especialidade e vínculo institucional são dados do VitaCare. A equipe que acompanha o paciente pode mudar de visita para visita, então não faz sentido obrigar a redigitar esse vínculo em todo atendimento.

## O que comparar nas telas

1. **Identificação do profissional**
   - O VitaCare exige especialidade no cadastro do usuário? Se sim, ela é automática/importada ou precisa ser digitada?
   - Unidade/equipe vem do login, do cadastro do usuário ou é escolhida por visita?
   - Confirmar que nome, CRM/UF, celular e e-mail continuam suficientes no perfil do Visitário.

2. **Contexto da visita**
   - Onde o VitaCare mostra a equipe lotada/unidade de lotação e onde mostra a equipe presente na visita?
   - Existe campo para “responsável pelo seguimento”? Se houver, ele aceita texto livre ou exige um profissional cadastrado?
   - Nossa implementação separa: **Presença da equipe na visita** (documentação) de **Responsável pelo seguimento** (no plano). Não recriar o vínculo no perfil.

3. **Motivo da visita**
   - O VitaCare tem campo próprio e obrigatório para motivo/objetivo da visita?
   - Se tiver, comparar o texto com `visit_reason` (até 300 caracteres). Hoje o motivo aparece no início do Subjetivo como `Motivo do atendimento: …`.
   - Confirmar se o bloqueio adotado está correto: avanço exige motivo **ou** ao menos uma condição acompanhada.

4. **História clínica**
   - O VitaCare já traz automaticamente “desde a última visita”? Se trouxer, revisar se devemos preencher esse campo ou apenas registrar o relato desta visita.
   - Nossa redação atual não presupõe visita anterior: `Houve relato de …`, `Não foram relatadas intercorrências` ou nenhuma frase quando não informado.
   - Comparar também a ordem do relato: motivo → cuidador/rede de apoio → condição → intercorrências → adesão/medicamentos.

5. **Rede de apoio e cuidador**
   - Existem campos estruturados para cuidador de referência, vínculo e quem administra medicação/companha orientações?
   - Se não houver, o texto livre atual já registra: nome/iniciais, vínculo, `Sobre os cuidados: …` e, depois, os demais moradores.
   - Verificar se dificuldades de leitura, comparecimento ou administração de medicações cabem no campo de cuidador ou em outro campo do VitaCare.

6. **Retorno**
   - O VitaCare distingue “retorno indicado” de “retorno agendado”?
   - Há campo de data obrigatório quando se marca retorno?
   - Nossa implementação usa o rótulo **Retorno indicado em VD** e o texto `Indico retorno em visita domiciliar`, sem criar agenda nem confirmar data. O combinado com a equipe fica em `plan_notes`.

7. **Blocos SOAP e campos obrigatórios**
   - Conferir rótulos, limites de caracteres e obrigatoriedade de S/O/A/P, sinais vitais e campos numéricos.
   - Levantar códigos/campos obrigatórios da unidade: tipo de visita, desfecho, siglas e eventuais códigos municipais.
   - Solicitar **3 exemplos reais anonimizados e aprovados** de evolução no VitaCare para ajustar `SYSTEM_PROMPT` e o template determinístico, se necessário.

## Estado atual para comparação

- `visit_reason`: motivo desta visita, no início do Subjetivo.
- `age`: pode ficar em branco; zero informado é aceito e não ativa referências adultas.
- `follow_up_owner`: responsável pelo seguimento, como tópico do Plano.
- Ação `Agendamento de retorno VD` permanece como valor interno legado; a interface mostra `Retorno indicado em VD` e o SOAP diz `Indico retorno em visita domiciliar`.
- Ordem da rede de apoio no Subjetivo: cuidador e cuidados antes de moradores.
- Migração IndexedDB v7 preserva rascunhos, evoluções revisadas, pendências e conflitos, preenchendo os campos novos em registros antigos.

## Resultado esperado da análise

Após comparar, registrar aqui:

- telas e campos conferidos;
- exemplos anonimizados usados;
- ajustes aprovados em `SYSTEM_PROMPT`, template determinístico ou formulário;
- itens que permanecem fora do MVP, com motivo.

Até lá, não declarar compatibilidade validada com uma configuração específica do VitaCare.
