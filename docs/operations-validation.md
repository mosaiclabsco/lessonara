# Validação operacional — 20/10/2026

Registro em horário de São Paulo; callbacks do provedor ocorreram em 21/10 UTC. Esta rodada contempla validação de formulários, estados de entrega, documentação e conferência do Google. Não é uma repetição completa do pentest.

## Código e publicação

Commit funcional: `dc4ac60` — Validate forms, track email delivery and consolidate product docs. Deploy Production confirmado Ready na Vercel e rota canônica respondendo. GitHub Checks concluído com sucesso (formatação, ESLint, testes e build). TypeScript e build de produção passaram localmente; suíte final local: 51 arquivos, 321 testes aprovados.

O leitor do backlog continua um servidor independente em `127.0.0.1:4317`; não existe rota pública dessa ferramenta no app Next.js. Seu estado em `.local/` não é versionado.

## Banco

- Migrações 0021 e 0022 aplicadas pelo SQL Editor após dry-run transacional com rollback.
- Nove constraints de formulários presentes e validadas sobre o histórico. Regras anteriores de créditos inteiros/positivos permanecem; não foram duplicadas.
- RLS ativo em `email_delivery_events` e `email_suppressions`; `authenticated` sem permissão de executar `record_email_delivery_event` e sem leitura da tabela privada de eventos.
- Teste SQL conferiu deduplicação, evento anterior ao vínculo do provedor, rejeição de regressão por evento atrasado, cancelamento de envio pendente, bloqueio de novo OTP para destinatário suprimido e persistência de reclamação. Todas as fixtures desse teste foram revertidas antes de os workers poderem lê-las.
- O roteiro repetível está em `supabase/operations/verify-form-delivery.sql`. Ele não chama o provedor nem cria eventos Google.

Aplicação foi manual pelo SQL Editor. Não presumir que o histórico do Supabase CLI contém essas versões; conferir schema/histórico antes de reaplicar arquivos.

## Resend

Endpoint de produção: `/api/webhooks/resend`, com seis tipos de evento necessários. Signing secret configurado como Secret somente no Production; a chave de envio permanece restrita a envio. Nenhum segredo foi gravado neste documento ou no código.

Uma chamada sem assinatura respondeu 400. Três emails com conteúdo técnico foram enviados somente aos endereços oficiais de simulação `delivered+…@resend.dev`, `bounced+…@resend.dev` e `complained+…@resend.dev`, com rótulos exclusivos desta rodada. Os registros técnicos da outbox usam prefixo `delivery-validation/` e não correspondem a aulas/pagamentos de alunos.

| Cenário | Estado persistido | Novos envios ao endereço |
|---|---|---|
| Entrega simulada | `delivered` | Liberados |
| Rejeição permanente simulada | `bounced` | Bloqueados |
| Reclamação de spam simulada | `complained` | Bloqueados |

O painel Resend registrou quatro eventos com sucesso/HTTP 200: os três resultados e uma entrega associada ao cenário de spam. Não foi necessário replay manual. Eventos repetidos e fora de ordem têm cobertura própria no SQL e nos testes.

Os callbacks reais do provedor e a projeção do banco foram confirmados. Isso não significa entrega a uma pessoa real, leitura, abertura ou primeiro acesso ao portal. Não foram enviados emails a alunos reais nem notificações adicionais ao professor. O fluxo completo de novo lembrete preparado pelo worker continua uma verificação operacional distinta; esses envios usaram a API de simulação diretamente.

## Google Calendar

Uma conexão armazenada sem erro; 14 trabalhos de calendário em `sent`, sem `pending`, `sending` ou `failed` na conferência. Consulta real de disponibilidade `freeBusy` passou usando as credenciais existentes e leitura/escrita criptográfica v3 durante a eventual renovação do token. Não foram criados eventos nem enviados convites.

Confirmado: conexão/token/API de disponibilidade e estado atual da fila. Ainda não executado nesta rodada: criar/alterar/cancelar evento com Meet pela interface; estado atual de aprovação OAuth no console Google. Esses itens não devem ser inferidos a partir de fila vazia.

## Pendências mantidas

[QA manual](qa-pendente.md): Jitsi com duas pessoas sob CSP, OTP real e Essencial × Pro. O ciclo Google completo, pendente na conferência técnica anterior, foi posteriormente validado manualmente por Gabriel. C8 continua hardening de baixo risco pós-lançamento. O dashboard Supabase exibiu “Last backup: No backups”; backup externo e restore não foram verificados. Monitoramento contínuo de workers, filas sem progresso e tentativas esgotadas continua no backlog.

Na rodada de 20/10, Pix e importação eram [propostas documentadas](product-flows.md). A implementação posterior está registrada abaixo.

## Pix e importação — 21/10/2026

Migrações **0023, 0024 e 0025** aplicadas no Supabase após validação com fixtures fictícias e rollback. Nenhum aluno real foi criado/alterado, nenhum pagamento real foi confirmado e nenhum email/convite Google real foi enviado por esses testes.

O roteiro [verify-pix-import.sql](../supabase/operations/verify-pix-import.sql) foi executado também após a aplicação. Cobriu: preço zero sem cobrança, retrato de preço/chave, “Já paguei” sem créditos, confirmação idempotente, bloqueio cruzado, saldo inicial sem pacote/recebimento, convites não solicitados ausentes da fila, reversão integral em conflito de agenda, prévia desatualizada, plano de outra conta, restrição Essencial, opções nulas, sessão expirada, RLS e bucket privado. Fixtures das duas contas tinham registros próprios para tornar a leitura cruzada verificável. Tudo foi revertido.

A suíte local final passou com **56 arquivos / 353 testes**. Inclui decodificação independente do QR renderizado para o payload Pix original. TypeScript, ESLint, formatação e build de produção passaram. A conferência visual local usou exclusivamente dados fictícios, em desktop e largura de 390 px, com QR, formulário de recebimentos, revisão do professor e escolha guiada/assistida. A rota de demonstração foi removida e o proxy restaurado antes da publicação.

O comando operacional de suporte foi executado em leitura contra a fila privada; retornou vazia. Isso valida a inicialização/acesso do comando, sem alegar atendimento de um pedido real. O modo assistido depende de um operador consultar a fila e preparar o CSV; ainda não há painel admin web/alerta automático. Originais encerrados têm limpeza imediata com repetição pelo worker, com contadores na resposta e metadados pendentes visíveis ao operador.

Leitura do QR em app bancário, pagamento/confirmação com professor/aluno real, planilha real do piloto e ganho de tempo continuam no [QA](qa-pendente.md). O ciclo completo assistido não foi executado com dados pessoais reais. Os resultados históricos do pentest não são uma reauditoria automática dessas funcionalidades novas.

## Confirmação manual do Calendar — 21/10/2026

Gabriel confirmou ter testado com sucesso a criação de evento/Meet, alteração/reagendamento e cancelamento após as mudanças de segurança. A tarefa e o checklist foram marcados como concluídos com base nesse relato. Nenhum novo teste automatizado ou consulta ao estado da aprovação OAuth é alegado por essa atualização.

## Reinício dos dados de teste — 23/10/2026

Por solicitação do proprietário, os dados de negócio de teste foram removidos do Supabase de produção. A conta original foi preservada com o mesmo login e senha, perfil pendente, importação em estado inicial e acesso Pro completo. Foram excluídas quatro contas extras e três arquivos privados de teste; alunos, pacotes, planos de aulas, agenda, atividades, documentos, conexões Google e filas foram zerados. As sessões anteriores foram encerradas.

Uma cópia privada das 67 tabelas inventariadas e dos três arquivos foi verificada antes da limpeza. Isso é uma cópia pontual para esta operação, não comprovação de backup recorrente nem de restauração testada. As evidências históricas descritas nas seções anteriores não representam o estado atual das filas ou da conexão Google após este reinício. Não foram excluídos eventos no calendário externo.

Esquema, políticas de acesso, funções, cron, operadores, segredos e controles de supressão de destinatários foram preservados. O administrador permanece em banco separado. O catálogo comercial do admin foi configurado com Essencial R$ 49, Plus R$ 79 e Pro R$ 99 mensais; a conta original de teste tem isenção explícita, sem geração de cobrança ou registro fictício de pagamento.

O domínio administrativo é https://admin.mosaic-labs.co, com DNS e HTTPS validados. Acesso anônimo ao painel redireciona ao login; webhook sem assinatura retorna 401 e com assinatura válida retorna 200. O webhook Resend passou a usar o domínio próprio sem segredo de bypass na URL.


## 24/10/2026 — revisão local dos dez itens de planos e operação

Sem push, deploy, migrações ou alterações de provedores em produção nesta rodada. O estado implantado não foi substituído.

- Itens 1–2: separação dos workers, duas janelas de renovação, dead letter, telemetria e monitor no admin.
- Itens 3–10: recibos por pagamento, exportação por período CSV/XLSX/PDF, Google/Meet por plano, lembretes Pro e preferências do aluno, gestão de emails por plano, central de pendências, limites e upload TUS, regras de autorização e matriz de diferenciação.
- Suíte completa Lessonara: 435 testes passaram; depois, regressão adicional para controle/fórmula em CSV e os dez testes do módulo de arquivos passaram. Admin: 49 testes passaram.
- Lint e builds locais dos dois projetos passaram com Node 24.22.1. Auditoria das dependências de produção do Lessonara: nenhuma vulnerabilidade conhecida reportada.
- SQL 0030/0031 exercitado em PostgreSQL isolado: matriz/cotas em paridade com a aplicação, RLS, acesso cruzado, impedimento de alteração de plano (inclusive sem sub), suspensão, deduplicação, opt-out, falhas e reservas. Gatilho real da migração 0016 bloqueou arquivo acima do plano e soma de documentos/entregas acima da cota.
- Cliente TUS real contra servidor HTTP local: recuperação de 503, um objeto e somente os bytes esperados, sem envio ao Supabase.
- PDFs de dados fictícios renderizados e inspecionados; texto e total conferidos em leitor independente. XLSX de 48 pagamentos aberto com leitor independente, total R$ 14.412,00, valores numéricos, estilos e cabeçalhos congelados verificados.
- Escopo e decisões em [planos e permissões](plans.md) e [jobs e filas](workers.md). `doing.md` é limpo ao encerrar o trabalho local; publicação e QA real permanecem no backlog.

Pendências de aplicação: migrações 0030/0031 e do admin, publicação conjunta, novo cron somente após rotas disponíveis, conferência do limite global de Storage e QA de Google/Resend/Storage reais. O teste local não é um novo pentest nem comprovação de entrega de emails ou upload de 100 MB em produção. Acompanhar também uso físico e reservas incompletas de Storage.


## 24/10/2026 — publicação autorizada da revisão de dez itens

- Lessonara: commit funcional `968233d`, deploy `dpl_ChSLpcGVTBTeaG8VMfuYXzinksTf`, READY, domínio `lessonara.mosaic-labs.co`.
- Admin: commit funcional `c074058`, deploy `dpl_Gs6qbu6ygbXHGEE1vc6vE9MRqzPc`, READY, domínio `admin.mosaic-labs.co`.
- Supabase Lessonara: migrações 0030/0031 validadas com rollback antes de aplicar; 0030/0031/0032 confirmadas via SQL e APIs. Supabase Admin: migração `20261024000006_job_monitoring.sql` aplicada e snapshot privado confirmado.
- Cadeia de migrações: incluída no histórico Git a migração 0026 de administração que já estava aplicada; não foi reaplicada.
- Limite global confirmado no dashboard: Supabase Free fixo em 50 MB. Proprietário escolheu manter sem custo adicional. Interface, servidor e SQL limitam Pro a 50 MB; 100 MB permanece no backlog. Não houve contratação ou upgrade.
- Agendamentos ativos: renovação 08h/18h, retomada condicional a cada cinco minutos, emails/Calendar/lembretes a cada cinco minutos, limpeza 03h. As chamadas usam a referência existente no Vault; segredo não foi alterado nem incluído neste relatório.
- Requests pg_net 2747–2751: cinco respostas HTTP 200, sem timeout. Renovação/lembretes verificaram um aluno e não geraram avisos elegíveis. Emails/Calendar/limpeza concluíram sem falhas. Isso comprova autenticação e execução dos workers, não entrega de email com fila vazia.
- Snapshot posterior confirmou execução automática da janela 18h, além de emails, Calendar e lembretes. Filas: zero pendentes, zero em processamento, zero falhas, zero tentativas esgotadas.
- Tela Pendências carregada pela sessão real do professor, sem erro de servidor. Financeiro mostrou CSV/XLSX/PDF e recibo individual; PDF autenticado baixado em produção e assinatura `%PDF-` confirmada. XLSX/CSV/PDF já haviam passado pela validação local documentada.
- Login dos dois projetos retorna 200. O endpoint de jobs do admin redireciona o cliente anônimo ao login; a sessão do admin expirou e não foi contornada. A conferência visual autenticada do admin exige novo login do proprietário.
- Permanecem separados: QA manual Jitsi/OTP real/matriz de planos/Google sob as regras novas, envio real elegível e entrega por Resend, upload real com interrupção e limites no Storage. Os testes locais não substituem esses cenários nem constituem novo pentest.
