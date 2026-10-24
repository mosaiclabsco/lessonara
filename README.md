# Lessonara

Gestão de aulas para professor particular que trabalha sozinho e vende pacotes. O portal web reúne alunos, agenda, créditos, pagamentos, documentos, atividades e comunicação. O aluno acessa seu portal por convite e código de email. O app desktop é dedicado às chamadas; a gestão continua na web.

## Estado do produto

- Perfil e plano de aulas são configurados antes de cadastrar alunos. Planos de aulas dos alunos são separados dos planos da plataforma (Essencial, Plus e Pro).
- Pacotes preservam preço e créditos registrados no pagamento. Aulas passadas contam conforme agenda e ocorrências; faltas/reposições consomem crédito e desmarcações preservam, conforme a regra aplicável. Ocorrências iniciadas têm identidade, data, horário, plano e posição no pacote persistidos; alterar ou excluir um horário não reescreve o passado. Entrada na sala registra participação técnica. Sem exceção registrada, a realização continua presumida pelo horário. Ver [histórico de aulas](docs/lesson-history.md). O cálculo está em `src/lib/ledger.ts`.
- Agenda semanal/mensal e aulas avulsas, feriados, reposições e integração Google Calendar/Meet por professor estão implementados. Gabriel confirmou o teste manual completo de criação, alteração/reagendamento e cancelamento com Calendar/Meet após o hardening em 21/10/2026.
- Documentos privados e entregas de atividades usam upload direto ao Storage autorizado e download de curta duração. Reservas incompletas também consomem cota.
- Emails usa fila durável com retentativas. Aceite pelo provedor e entrega são estados diferentes; a integração de webhooks tem migração/configuração próprias.
- Sala integrada Jitsi é Pro. Primeira entrada entre cinco minutos antes do início e o término previsto; reconexão até trinta minutos depois para quem já participou, validada também no servidor. QA de câmera, áudio e compartilhamento com duas pessoas sob a CSP nova é obrigatório antes de liberar a sala aos alunos.
- Desktop 0.3.1: chamadas, captura de monitor/janela e ferramentas nativas. Há instaladores Mac e Windows; o teste real de mídia depende do sistema operacional.

| Plano da plataforma | Por arquivo | Armazenamento total | Emails e sala integrada | Importação |
|---|---:|---:|---|---|
| Essencial | 20 MB | 1 GB | Não | Não |
| Plus | 100 MB | 5 GB | Não | Sim |
| Pro | 1 GB | 20 GB | Sim | Sim |

Limites de produto não ampliam a cota contratada no Supabase. Emails de acesso necessários à autenticação não são campanhas Pro.

Pix do professor com QR/copia-e-cola e “Já paguei” tem confirmação manual em Pagamentos. Importação guiada por CSV e assistida por CSV/XLSX estão disponíveis no Plus/Pro, com prévia e saldo de abertura separado dos recebimentos; veja [fluxos e operação](docs/product-flows.md). Cadastro autônomo, trial e cobrança da assinatura permanecem no backlog, sem cobrança automática implementada. O marco de ativação definido é **primeiro aluno com agenda e pacote real registrados**; sua instrumentação continua pendente.

O repositório principal é [mosaiclabsco/lessonara](https://github.com/mosaiclabsco/lessonara). A [migração para a organização](docs/repository-migration.md) preservou o histórico e a produção existente.

## Desenvolvimento local

```sh
pnpm install
cp .env.example .env.local
# Preencha as variáveis do seu ambiente; não versione nem compartilhe segredos.
pnpm dev --port 3001
```

Use um ambiente de dados de desenvolvimento para testes. As credenciais administrativas ficam somente no servidor. As chaves usadas pelo navegador devem ser publishable; não habilite API keys legadas para contornar configuração.

## Banco e serviços

Aplicar as migrações de `supabase/migrations/` em ordem numérica, preservando o histórico já aplicado. Não basta executar apenas a migração inicial e a de documentos. Operações do dashboard/hook e Vault exigem configuração separada; uma migração no repositório não comprova sua aplicação no ambiente.

- Supabase: Auth do professor, PostgreSQL com RLS, Storage e Realtime. Provisionamento atual de professores é administrativo; cadastro público permanece desativado até existir o fluxo de produto correspondente.
- Vercel: Next.js/Server Actions/rotas em São Paulo (`gru1`). Preview permanece bloqueado até existir base isolada. Não reutilizar segredos Production em preview.
- Resend: domínio/remetente autorizados e chave restrita de envio. Webhook usa signing secret distinto; ver [operação de entrega](docs/email-delivery.md).
- Google: [setup OAuth, calendário e Meet](docs/google-calendar.md). Segredos/tokens ficam no servidor e os tokens são cifrados.
- Jitsi e desktop: [sala de aula](docs/classroom.md) e [empacotamento desktop](desktop/README.md).

Produção usa envelopes v3 com `EMAIL_ENCRYPTION_KEY_NEXT`, `SEAL_WRITE_VERSION=v3` e `EMAIL_ACCEPT_PREVIOUS_ENVELOPES=false`, após rotação/migração. Não copiar a raiz anterior nem reabilitar formatos antigos por conveniência. Novos ambientes devem gerar suas próprias chaves. A antiga `EMAIL_ENCRYPTION_KEY` só é relevante numa migração planejada de registros históricos.

## Workers

`/api/cron/reminders` prepara lembretes em lotes com cursor/checkpoint duráveis; `/api/cron/emails` processa emails e calendário. As rotas exigem Bearer secreto. O Supabase Cron as chama a cada cinco minutos em horários defasados, conforme [schedule-workers.sql](supabase/operations/schedule-workers.sql), usando referência ao segredo no Vault. Isso não depende de cron frequente da Vercel Hobby.

Há registro de autenticação manual/automática dos dois workers com HTTP 200. Entrega de email real, ausência de filas paradas e conclusão de cada execução precisam de observação própria; uma resposta 200 com fila vazia não comprova o fluxo completo. Monitoramento de interrupção, idade das filas e tentativas esgotadas está no backlog.

## Validação e segurança

```sh
pnpm exec tsc --noEmit
pnpm lint
pnpm test --maxWorkers=1
pnpm build
```

Executar as verificações sequencialmente para preservar os recursos da máquina. As regras de formulário são aplicadas no servidor, com limites no banco quando cabíveis; ver [inventário](docs/form-validation.md).

O [relatório consolidado de segurança](docs/security-review.md) registra o parecer recebido, correções e limitações. O resultado histórico do pentest não certifica mudanças posteriores. QA manual pendente: Jitsi com duas pessoas, OTP real e Essencial × Pro; C8 é hardening pós-lançamento. Backup e restore ainda precisam de confirmação operacional.

## Documentação e prioridades

[Índice central de documentação](docs/README.md). O backlog canônico é [TASKS.md](TASKS.md); `FUTURE_FEATURES.md` aponta para ele, sem manter uma segunda lista.

O [leitor local do backlog](tools/backlog/README.md) roda separadamente:

```sh
node tools/backlog/server.mjs
```

Acesse `http://127.0.0.1:4317`. Prioridades e ordem ficam em `.local/backlog-priorities.json` e não são publicadas. O leitor não cria rotas no app Next.js nem altera o status de uma tarefa por conta própria.
