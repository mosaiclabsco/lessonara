# Revisão de agenda, integração, onboarding e sala

Origem: observações e dez imagens enviadas por Gabriel em 23/10/2026. Estado: ajustes autorizados na rodada seguinte; decisões sobre consolidação do histórico ainda pendentes. Preservar os registros anteriores enquanto essa decisão não for concluída. Imagens 8 e 9 representam o mesmo problema visual.

## REV-01 — Reduzir a projeção futura na lista de aulas

- [x] Encaminhamento autorizado implementado; ver validações e limites de QA abaixo.

Imagem 1 mostra meses até 2028. O motor projeta 104 semanas; conferir o recorte de visibleLessons e os créditos. Mostrar mês atual/próximas semanas, navegação para mais períodos e separar previsão de histórico real.

## REV-02 — Ampliar onboarding com etapas opcionais

- [x] Encaminhamento autorizado implementado; ver validações e limites de QA abaixo.

Percorrer Geral, Integrações, Feriados, Recebimentos, Planos e demais abas relevantes. Perfil/plano exigem dados válidos; opcionais podem ser revisadas ou puladas sem conexão/Pix obrigatório. Distinguir visitado de configurado e salvar progresso por professor.

## REV-03 — Investigar o aviso de OAuth Google não verificado

- [x] Investigação concluída; aprovação do acesso a dados continua pendente no Google.

Imagem 3: Google hasn’t verified this app. Conferir projeto/cliente OAuth, estado de publicação/verificação, domínios e escopos. A aprovação anterior não foi comprovada. A limpeza apagou conexão local, não a aprovação do Google. Não contornar o aviso nem afirmar regressão sem evidência do console.

## REV-04 — Reproduzir criação, encerramento e recriação de horário

- [x] Encaminhamento autorizado implementado; ver validações e limites de QA abaixo.

Imagens 4 e 7: linhas repetidas com início e fim iguais. Encerramento hoje é inclusivo e preserva o registro. Separar histórico de horários ativos; não confundir registros de configuração sem ocorrência com aulas realizadas. Validar frequência, sobreposição e idempotência.

## REV-05 — Investigar bloqueios Google e eventos órfãos

- [x] Encaminhamento autorizado implementado; ver validações e limites de QA abaixo.

Imagens 5 e 6: ocupado no Google sem evento esperado visível. Consulta freeBusy verifica agenda principal e não identifica o evento causador. Limpeza anterior preservou eventos externos e apagou vínculos locais; pode haver órfãos. Conferir calendário, fuso, transparência, eventos e jobs antes de qualquer exclusão externa.

## REV-06 — Validar liberação de agenda ao encerrar recorrência

- [x] Encaminhamento autorizado implementado; ver validações e limites de QA abaixo.

Preservar aulas anteriores válidas; excluir/truncar ocorrências futuras da série e liberar disponibilidade após o limite definido. Conferir filas, falhas, tentativas e estado Google; não prometer consistência instantânea. Último cadastro das imagens 10 funcionou, portanto não tratar toda criação como quebrada.

## REV-07 — Reorganizar a seção de reposições

- [x] Encaminhamento autorizado implementado; ver validações e limites de QA abaixo.

Imagens 8 e 9: título, descrição, summary com triângulo/+ e vazio muito próximos. Ação Adicionar reposição centralizada no vazio com ícone; formulário em modal compartilhado; lista separada com espaçamento; manter vínculo com a aula desmarcada e estados acessíveis.

## REV-08 — Avaliar Excalidraw para o quadro da sala

- [x] Encaminhamento autorizado implementado; ver validações e limites de QA abaixo.

Decisão pendente. Considerar componente integrado para o quadro; colaboração exige integração própria. Preservar ferramentas de anotação sobre a tela no desktop como função distinta. Avaliar persistência privada, sincronização, permissões, móvel e CSP.

## REV-09 — Definir regras de entrada, reconexão e extensão da sala

- [x] Encaminhamento autorizado implementado; ver validações e limites de QA abaixo.

Hoje: 5 minutos antes até 30 após término, sem distinguir entrada inicial e retorno; endpoint também valida. Discutir primeira entrada, reconexão nos últimos 10 minutos, extensão sem derrubar chamada ativa, esconder link após fechamento e controle do professor. Não implementar antes da decisão.

## REV-10 — Validar remarcação de uma ocorrência no Google Calendar

- [x] Encaminhamento autorizado implementado; ver validações e limites de QA abaixo.

Desmarcar a ocorrência original, excluí-la da série via exceção ou cancelar evento avulso e criar nova reposição vinculada, sem alterar demais semanas nem duplicar eventos. Código possui EXDATE e evento separado; falta reproduzir o cenário atual em QA autorizado.

## REV-11 — Documentar identidade dos links e das salas

- [x] Identidade por ocorrência conferida e documentada.

O link inclui aluno, tipo/origem e data; a sala é derivada por HMAC desses campos. Cada ocorrência tem identidade própria, não uma sala reutilizada por dia da semana. Acesso continua autenticado e autorizado; URL sozinha não concede acesso. Não confundir link Lessonara com Meet de uma série.

## REV-12 — Decidir persistência de ocorrências e status de aula

- [ ] Decisão pendente para a próxima conversa sobre histórico consolidado.

Hoje passada sem exceção vira dada ao atingir o início e consome crédito, sem comprovar presença. Avaliar projeção futura sob demanda e persistência de ocorrências relevantes, alterações e participação. Entrada técnica não comprova aula realizada. Separar presumida de confirmada e discutir inferência após término, não no início.

## Evidências de código consultadas

`src/lib/ledger.ts`, `src/lib/onboarding.ts`, `src/components/onboarding-guide.tsx`, `src/app/(panel)/students/[id]/page.tsx`, `src/app/(panel)/actions.ts`, `src/lib/google/calendar.ts`, `src/lib/google/worker.ts`, `src/lib/classroom.ts`, `src/lib/classroom-token.ts` e `src/components/classroom.tsx`. Comportamento observado no código não equivale a validação ponta a ponta em produção.

## Conferência operacional somente de leitura

A conexão Google atual está cadastrada sem `last_error`. A fila tem quatro trabalhos de horário fixo e um de reposição em `sent`, sem falhas registradas na consulta. Há três registros de horário encerrados com início/fim em 23/10/2026 e um ativo; todos são de quarta-feira. Como 23/10/2026 é sexta-feira, as três séries encerradas terminam antes de sua primeira ocorrência possível. O worker tem tratamento para excluir a série nesse caso. O estado `sent` não identifica a origem de todos os intervalos `freeBusy`, nem substitui a inspeção dos eventos no Google. Nenhuma exclusão externa ou sincronização foi disparada nesta revisão.

## Encaminhamento após a autorização

- REV-01: implementado recorte de futuras aulas pelos créditos pagos ou saldo inicial importado. Histórico passado permanece visível; o cálculo financeiro anterior não foi alterado nesta rodada.
- REV-02: checklist de sete etapas; Geral e Planos exigem configuração válida. Integrações, Feriados, Recebimentos, Plano da empresa e Ajuda são opcionais e marcados como revisados ao acessar a tela, com progresso por professor.
- REV-03: o console confirmou branding aprovado, com homepage/branding concluídos em 11/10/2026, e acesso a dados ainda em análise. Política de privacidade, funcionalidade, acesso apropriado e escopos permanecem em revisão. O cliente configurado corresponde ao projeto analisado. Não foi alterada nem reenviada a solicitação; a remoção do aviso depende do Google.
- REV-04: registros encerrados deixam a lista operacional, sem apagar o histórico. A prévia de disponibilidade é refeita ao mudar os horários.
- REV-05: foram identificadas duas séries antigas de teste sem vínculo local, segundas e quintas às 11h, responsáveis pelos bloqueios adjacentes. O usuário autorizou remover somente futuras ocorrências. As duas séries foram limitadas por atualização de recorrência, preservando o passado; nenhuma futura ocorrência dessas séries restou no intervalo conferido. Nenhum compromisso pessoal foi alterado. A visualização recebeu mais área, cores por grupo e indicação de responsáveis locais nas opções sobrepostas.
- REV-06: o encerramento aguarda uma tentativa de sincronização e informa pendência caso haja falha. A fila conserva repetição e tratamento de versões. Registros e aulas anteriores não são apagados.
- REV-07: ação centralizada, modal compartilhado e lista com separação visual.
- REV-08: mantido o quadro atual, com mais área e fonte entre 12 e 72 px. Estado do quadro reinicia por ocorrência e as autorizações de material já impedem reutilização entre alunos, datas e origens. Excalidraw não foi incorporado; uma substituição completa continua decisão separada.
- REV-09: primeira entrada somente até o término previsto; retorno até 30 minutos depois para quem possui callback de participação registrado naquela ocorrência. Não há botão de extensão nem temporizador do aplicativo para derrubar chamada ativa. Registro técnico de acesso não confirma realização pedagógica ou financeira. Reconexão real e continuidade de chamada longa ainda exigem QA com duas pessoas.
- REV-10: mantida exclusão de uma ocorrência com EXDATE e criação de reposição separada; testes de regressão asseguram filtro por data, horário e limites da série.
- REV-11: identidade por aluno, origem e data mantida.
- REV-12: **decisão pendente para conversa posterior**. Gabriel apontou o risco de upgrade/downgrade de plano e remoção/recriação de horários mudarem uma reconstrução do passado. Avaliar modelo híbrido: previsões futuras sob demanda e ocorrências realizadas consolidadas com retrato de plano, duração, status e consumo. Não considerar essa arquitetura implementada nem alterar o histórico retroativamente.

## Validação desta implementação

Suíte completa: 58 arquivos e 367 testes aprovados. TypeScript, lint dos arquivos alterados e build passaram. Migração 0028 validada em transação com rollback e depois aplicada pelo painel já autenticado, sem solicitar acesso ao Chaves do macOS. A verificação de permissões confirmou ausência de acesso anônimo/autenticado direto à tabela de participação e função de revisão restrita a professores autenticados com sessão válida.

Os ajustes estão publicados em produção (versão `af107f4`, deploy READY). A inspeção da interface confirmou ausência dos horários encerrados, remoção da projeção até 2028 e cores pastéis iguais para as três opções que cruzam um mesmo compromisso. A etapa opcional Recebimentos passou para revisada (3/7) apenas com a visita, sem cadastrar Pix. Isso não substitui o QA de Jitsi com duas pessoas nem a decisão pendente sobre o histórico consolidado.

### Conferência isolada no provedor

Uma série técnica temporária de três ocorrências, sem convidados, foi criada no Google para testar o mesmo formato de EXDATE usado pelo worker. Somente a ocorrência selecionada foi retirada; as outras duas semanas permaneceram. Uma reposição individual foi criada separadamente. Os dois eventos técnicos foram removidos ao final e nenhum email foi enviado. Isso valida o comportamento da API e do gerador de exceções, não substitui o QA completo dos formulários com professor e aluno. A consulta freeBusy confirmou livres os intervalos de 11h a 12h nas duas próximas datas das séries antigas autorizadas para limpeza.
