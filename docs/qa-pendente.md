# QA e hardening pendentes

Status revisado em 25/10/2026; conclusões anteriores preservam suas datas. Itens desmarcados permanecem em TODO; conclusões identificam a origem da validação. Este checklist não representa achados críticos de segurança abertos.

## Requisitos obrigatórios para iniciar o piloto com a professora

- [ ] **Jitsi sob a nova CSP, com duas pessoas.** Entrar como professor e aluno em sessões distintas; confirmar áudio e câmera nos dois sentidos, conexão da sala e compartilhamento de janela e tela. Conferir erros de CSP e conexões WebSocket no navegador. Registrar ambiente, versão, data e resultado. A sala só deve ser liberada aos alunos após essa validação.

- [ ] **Backup e restore.** Confirmar o mecanismo de backup, retenção e local seguro e executar uma restauração de teste. O dashboard consultado em 20/10 exibiu “Last backup: No backups”; backup externo não foi verificado.
- [ ] **QR Code Pix no aplicativo bancário.** Conferir leitura do QR/copia-e-cola, recebedor e valor antes do primeiro pagamento; não exige transferência real.

Estes três requisitos foram definidos por Gabriel em 21/10/2026. Permanecem abertos enquanto o trabalho segue no portal administrativo.

## QA manual

- [ ] **OTP real do aluno.** Solicitar código para um email real autorizado, confirmar recebimento e acesso; verificar rejeição de código incorreto, expirado e reutilizado. Não registrar códigos nem credenciais nas evidências.
- [ ] **Matriz Essencial × Plus × Pro.** Usar professores com planos diferentes para confirmar Emails/Google/exportação no Plus e Pro e sala/lembretes de aula no Pro, inclusive por acesso direto às rotas e operações do servidor; conferir limites efetivos de documentos (20/50/50 MB enquanto o Supabase for Free) e isolamento entre contas. A matriz anterior com duas contas Pro não cobre essa diferença.
- [x] **Google Calendar ponta a ponta.** Gabriel confirmou em 21/10/2026 a execução manual bem-sucedida de criação de evento/Meet, alteração/reagendamento e cancelamento após as mudanças de segurança. Encerrado com base na validação informada pelo usuário, sem alegar uma nova execução automatizada.

## Pós-lançamento

- [ ] **C8 — revisar `Access-Control-Allow-Origin: *` nas páginas HTML.** Hardening de baixo risco, sem exploração demonstrada na revisão informada. Investigar a origem do cabeçalho e restringir ou retirar onde desnecessário, preservando os acessos legítimos. Validar novamente os cabeçalhos e os fluxos afetados.

## Evidência para encerrar uma tarefa

Registrar data, ambiente/versão, cenário, resultado esperado e observado e referência à evidência sem dados pessoais ou segredos. Manter a tarefa aberta se o teste não foi executado ou se a evidência não cobre o cenário.

## Pix e importação (21/10/2026)

- [ ] Professor/aluno reais: preparar Pix, avisar pagamento e confirmar no extrato; verificar se reduz mensagens e conferência.
- [ ] Importar planilha real de um professor do piloto, com revisão assistida e sem disparar convites antes da autorização. Conferir saldo/agenda após a confirmação.
- [ ] Exercitar a operação humana completa do pedido assistido e medir tempo/correções; o painel admin e seu alerta automático continuam no backlog.

## Regressões da revisão de agenda e sala

- [ ] Em duas sessões, entrar antes do término, cair e reconectar na tolerância de 30 minutos; primeira entrada após o término deve ser recusada.
- [ ] Manter uma chamada ativa além do fim previsto e verificar continuidade no Jitsi; depois da tolerância, nova admissão deve ser recusada.
- [ ] Abrir quadros em duas ocorrências distintas e verificar isolamento, fonte e área útil em desktop e celular.
- [x] Definido e implementado histórico persistente de aulas, com data, horário e vínculo ao pacote; publicado antes da rodada de 24/10. Ver [histórico de aulas](lesson-history.md).
- [ ] Conferir manualmente que aulas dadas preservam data e pacote ao trocar plano ou remover/recriar horários; validar uma renovação completa durante o piloto.
