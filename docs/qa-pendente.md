# QA e hardening pendentes

Status atualizado em 21/10/2026. Itens desmarcados permanecem em TODO; conclusões identificam a origem da validação. Este checklist não representa achados críticos de segurança abertos.

## Antes de liberar a sala para alunos

- [ ] **Jitsi sob a nova CSP, com duas pessoas.** Entrar como professor e aluno em sessões distintas; confirmar áudio e câmera nos dois sentidos, conexão da sala e compartilhamento de janela e tela. Conferir erros de CSP e conexões WebSocket no navegador. Registrar ambiente, versão, data e resultado. A sala só deve ser liberada aos alunos após essa validação.

## QA manual

- [ ] **OTP real do aluno.** Solicitar código para um email real autorizado, confirmar recebimento e acesso; verificar rejeição de código incorreto, expirado e reutilizado. Não registrar códigos nem credenciais nas evidências.
- [ ] **Matriz Essencial × Pro.** Usar professores com planos diferentes para confirmar liberação e bloqueio de Emails e sala, inclusive por acesso direto às rotas e operações do servidor; conferir limites de documentos e isolamento entre contas. A matriz anterior com duas contas Pro não cobre essa diferença.
- [x] **Google Calendar ponta a ponta.** Gabriel confirmou em 21/10/2026 a execução manual bem-sucedida de criação de evento/Meet, alteração/reagendamento e cancelamento após as mudanças de segurança. Encerrado com base na validação informada pelo usuário, sem alegar uma nova execução automatizada.

## Operação antes de clientes reais

- [ ] **Backup e restore.** Confirmar o mecanismo de backup, retenção e local seguro e executar uma restauração de teste. O dashboard consultado em 20/10 exibiu “Last backup: No backups”; backup externo não foi verificado.

## Pós-lançamento

- [ ] **C8 — revisar `Access-Control-Allow-Origin: *` nas páginas HTML.** Hardening de baixo risco, sem exploração demonstrada na revisão informada. Investigar a origem do cabeçalho e restringir ou retirar onde desnecessário, preservando os acessos legítimos. Validar novamente os cabeçalhos e os fluxos afetados.

## Evidência para encerrar uma tarefa

Registrar data, ambiente/versão, cenário, resultado esperado e observado e referência à evidência sem dados pessoais ou segredos. Manter a tarefa aberta se o teste não foi executado ou se a evidência não cobre o cenário.

## Pix e importação (21/10/2026)

- [ ] Ler o QR Code/copia-e-cola num aplicativo bancário e conferir recebedor e valor, sem exigir uma transferência real.
- [ ] Professor/aluno reais: preparar Pix, avisar pagamento e confirmar no extrato; verificar se reduz mensagens e conferência.
- [ ] Importar planilha real de um professor do piloto, com revisão assistida e sem disparar convites antes da autorização. Conferir saldo/agenda após a confirmação.
- [ ] Exercitar a operação humana completa do pedido assistido e medir tempo/correções; o painel admin e seu alerta automático continuam no backlog.
