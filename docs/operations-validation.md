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

[QA manual](qa-pendente.md): Jitsi com duas pessoas sob CSP, OTP real, Essencial × Pro e ciclo Google completo. C8 continua hardening de baixo risco pós-lançamento. O dashboard Supabase exibiu “Last backup: No backups”; backup externo e restore não foram verificados. Monitoramento contínuo de workers, filas sem progresso e tentativas esgotadas continua no backlog.

Na rodada de 20/10, Pix e importação eram [propostas documentadas](product-flows.md). A implementação posterior está registrada abaixo.

## Pix e importação — 21/10/2026

Migrações **0023, 0024 e 0025** aplicadas no Supabase após validação com fixtures fictícias e rollback. Nenhum aluno real foi criado/alterado, nenhum pagamento real foi confirmado e nenhum email/convite Google real foi enviado por esses testes.

O roteiro [verify-pix-import.sql](../supabase/operations/verify-pix-import.sql) foi executado também após a aplicação. Cobriu: preço zero sem cobrança, retrato de preço/chave, “Já paguei” sem créditos, confirmação idempotente, bloqueio cruzado, saldo inicial sem pacote/recebimento, convites não solicitados ausentes da fila, reversão integral em conflito de agenda, prévia desatualizada, plano de outra conta, restrição Essencial, opções nulas, sessão expirada, RLS e bucket privado. Fixtures das duas contas tinham registros próprios para tornar a leitura cruzada verificável. Tudo foi revertido.

A suíte local final passou com **56 arquivos / 353 testes**. Inclui decodificação independente do QR renderizado para o payload Pix original. TypeScript, ESLint, formatação e build de produção passaram. A conferência visual local usou exclusivamente dados fictícios, em desktop e largura de 390 px, com QR, formulário de recebimentos, revisão do professor e escolha guiada/assistida. A rota de demonstração foi removida e o proxy restaurado antes da publicação.

O comando operacional de suporte foi executado em leitura contra a fila privada; retornou vazia. Isso valida a inicialização/acesso do comando, sem alegar atendimento de um pedido real. O modo assistido depende de um operador consultar a fila e preparar o CSV; ainda não há painel admin web/alerta automático. Originais encerrados têm limpeza imediata com repetição pelo worker, com contadores na resposta e metadados pendentes visíveis ao operador.

Leitura do QR em app bancário, pagamento/confirmação com professor/aluno real, planilha real do piloto e ganho de tempo continuam no [QA](qa-pendente.md). O ciclo completo assistido não foi executado com dados pessoais reais. Os resultados históricos do pentest não são uma reauditoria automática dessas funcionalidades novas.
