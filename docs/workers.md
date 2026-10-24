# Jobs e filas

Publicado em 24/10/2026: migrações 0030/0031/0032 e do admin aplicadas, novas rotas publicadas e agendamentos ativos. Os cinco workers responderam HTTP 200 pelo Vault/pg_net e registraram conclusão sem falhas. Emails/Calendar estavam com filas vazias; isso não equivale a confirmar entrega real de um novo email.

## Agendamento ativo

Horários de Brasília (America/Sao_Paulo); pg_cron usa UTC.

| Job | Frequência | Trabalho |
| --- | --- | --- |
| Preparação de renovação | 08h e 18h | Percorre alunos ativos de professores Plus/Pro em lotes de até 100. |
| Retomada de renovação | Checagem a cada 5 minutos | Só solicita HTTP se uma janela ficou pendente; não inicia outra varredura. |
| Lembretes de aula (Pro) | A cada 5 minutos, minutos 4, 9… | Prepara avisos de aulas pagas nos próximos 60 minutos; revalida plano, ocorrência e preferência antes de enviar. |
| Envio de emails | A cada 5 minutos, minutos 2, 7… | Processa até 10 itens disponíveis por chamada. Convites/OTP também podem ter envio imediato no fluxo de acesso. |
| Google Calendar | A cada 5 minutos, minutos 3, 8… | Retoma criações, alterações e exclusões; ações do produto também processam a fila. |
| Limpeza | 03h diariamente | Remove sessões de aluno e desafios de autenticação expirados, janelas antigas de limite de acesso e originais de importações encerradas. |

Sessões são autorizações temporárias de acesso ao portal. Desafios são códigos/verificações temporários de autenticação. A limpeza não encerra sessões válidas e não exclui aulas, presença, pagamentos ou histórico. A expiração continua sendo validada no acesso; não depende da limpeza física.

## Renovação e histórico

`prepareReminderBatch` usa `loadLedgers`, a mesma leitura financeira do produto. Ela captura/carrega `lesson_occurrences` e mescla o histórico com a projeção futura. Remover ou trocar horários e mudar o plano não apagam aulas registradas nem reiniciam o consumo de créditos. Entrada antecipada na sala não consome o crédito antes do horário.

O aviso é elegível quando há créditos registrados, o saldo é de uma aula ou menos e existe aula futura que consome crédito. Não se trata de um lembrete do horário de cada aula. O cálculo considera saldo de abertura, pagamentos e exceções já representados no ledger.

A deduplicação usa aluno + total de créditos do ciclo (`reminder/<aluno>/<créditos>`), preservando o comportamento existente: as janelas da manhã e tarde não repetem o mesmo aviso; novos alunos elegíveis podem entrar na segunda janela. Um novo pagamento que aumenta os créditos permite o aviso do ciclo seguinte. Não há reenvio automático de um aviso que acabou em falha definitiva.

Cada janela tem cursor, lease de dois minutos e checkpoint atômico com o enfileiramento. A rota trabalha em páginas por até 20 segundos (máximo de 20 páginas por chamada); o restante é retomado. São no máximo cinco falhas consecutivas de processamento, doze despachos sem progresso ou 24 horas de idade. Progresso confirmado reinicia os contadores de falhas e despachos.

## Retentativas e falhas definitivas

Emails têm lease por item, seleção com `FOR UPDATE SKIP LOCKED`, corpo criptografado imutável e chave de idempotência estável no provedor. Falhas recuperáveis recebem backoff exponencial; a execução efetiva respeita o cron. O limite é cinco tentativas, além do vencimento específico do item e do prazo de 23 horas desde a primeira tentativa. Erro permanente, expiração ou tentativas esgotadas resultam em `failed`, sem repetição automática. Payload e corpo de entrega são limpos no encerramento.

Um processo interrompido na quinta tentativa passa a falha definitiva quando a trava expira. O mesmo tratamento de tentativas esgotadas se aplica à fila Google. Nova alteração legítima na origem do Calendar pode gerar uma nova versão de trabalho.

Isso é tratamento de dead letter (falha definitiva), não deadlock. O painel de operação é somente leitura; não oferece reenvio que possa gerar duplicidade inadvertida.

## Autorização e observabilidade

Emails de renovação e campanhas são Plus/Pro, com validação na aplicação, no enfileiramento SQL e novamente antes do envio. Lembretes de horário são exclusivos do Pro e alunos podem desativá-los no menu Emails do portal. Emails de acesso continuam disponíveis no Essencial. Outras mudanças de diferenciação de planos permanecem fora deste incremento.

As rotas cron exigem o segredo existente. Registros de execução e snapshots só podem ser acessados pelo backend com service role; o admin exige sessão e permissão administrativa antes de consultar o conector Lessonara. O snapshot não inclui destinatários, assunto, corpo, comandos cron ou valores do Vault.

`private.job_runs` registra início, conclusão, falha, execução ignorada e métricas numéricas/booleanas. Retenção: 30 dias, removidos na próxima execução. O painel recebe até 15 registros por job, além das últimas dez janelas de renovação. Alertas visuais distinguem cron ausente/pausado, falha do agendador, execução interrompida, janela não iniciada ou sem conclusão e falta de execução recente. Sem canal externo de alerta neste incremento: o painel precisa ser consultado.

Fila pendente, em processamento, falhas, tentativas esgotadas, idade do item mais antigo e falhas de entrega conhecidas ficam visíveis. HTTP 200 do worker, sucesso do agendador, aceite do provedor e entrega ao destinatário são etapas diferentes.

## Procedimento de aplicação

Ordem seguida na publicação autorizada de 24/10/2026:

1. Aplicar `supabase/migrations/0030_worker_operations.sql`, `0031_plan_features_notifications.sql`, `0032_storage_provider_ceiling.sql` e a migração correspondente do admin.
2. Publicar as rotas separadas e a tela administrativa.
3. Aplicar `supabase/operations/schedule-workers.sql`, preservando a entrada existente do Vault.
4. Confirmar os agendamentos e acompanhar execuções reais, diferenciando disparo HTTP de conclusão e entrega.

Os testes locais usam PostgreSQL em memória e provedores simulados; não enviam emails e não comprovam a execução futura em produção.


### Conferência em produção

Requests pg_net 2747–2751: renovação, emails, Calendar, lembretes de aula e limpeza responderam 200, sem timeout. Os registros `job_runs` confirmaram sucesso de aplicação. A janela das 18h de Brasília concluiu automaticamente, assim como execuções periódicas de emails/Calendar/lembretes. Nenhum lembrete era elegível nesta conferência (`queued: 0`); as filas ficaram sem pendências/falhas. O disparo diário automático da limpeza será observado às 03h; sua execução manual de implantação já concluiu. O job diário do admin segue às 09h e não foi antecipado para evitar aplicar trocas de assinatura fora de sua rotina.
