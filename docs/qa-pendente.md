# QA e hardening pendentes

Status registrado em 20/10/2026, conforme revisão informada por Gabriel. Estes itens permanecem em TODO; não representam testes concluídos nem achados críticos de segurança abertos.

## Antes de liberar a sala para alunos

- [ ] **Jitsi sob a nova CSP, com duas pessoas.** Entrar como professor e aluno em sessões distintas; confirmar áudio e câmera nos dois sentidos, conexão da sala e compartilhamento de janela e tela. Conferir erros de CSP e conexões WebSocket no navegador. Registrar ambiente, versão, data e resultado. A sala só deve ser liberada aos alunos após essa validação.

## QA manual

- [ ] **OTP real do aluno.** Solicitar código para um email real autorizado, confirmar recebimento e acesso; verificar rejeição de código incorreto, expirado e reutilizado. Não registrar códigos nem credenciais nas evidências.
- [ ] **Matriz Essencial × Pro.** Usar professores com planos diferentes para confirmar liberação e bloqueio de Emails e sala, inclusive por acesso direto às rotas e operações do servidor; conferir limites de documentos e isolamento entre contas. A matriz anterior com duas contas Pro não cobre essa diferença.
- [ ] **Google Calendar ponta a ponta.** Com conta e agenda de teste autorizadas, confirmar conexão, criação e alteração de aula, cancelamento e resolução da pendência de sincronização. Conferir o resultado no Google e no Lessonara. Uma tarefa técnica de calendário processada não substitui este fluxo completo.

## Operação antes de clientes reais

- [ ] **Backup e restore.** Confirmar o mecanismo de backup, retenção e local seguro e executar uma restauração de teste. O dashboard consultado em 20/10 exibiu “Last backup: No backups”; backup externo não foi verificado.

## Pós-lançamento

- [ ] **C8 — revisar `Access-Control-Allow-Origin: *` nas páginas HTML.** Hardening de baixo risco, sem exploração demonstrada na revisão informada. Investigar a origem do cabeçalho e restringir ou retirar onde desnecessário, preservando os acessos legítimos. Validar novamente os cabeçalhos e os fluxos afetados.

## Evidência para encerrar uma tarefa

Registrar data, ambiente/versão, cenário, resultado esperado e observado e referência à evidência sem dados pessoais ou segredos. Manter a tarefa aberta se o teste não foi executado ou se a evidência não cobre o cenário.
