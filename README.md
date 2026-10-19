# Lessonara

Controle de aulas e pacotes para professores particulares. A professora cadastra alunos, horário fixo e pagamentos; cada aluno recebe um link para acompanhar as próprias aulas.

## Regras

- **Planos**: cada professor cria os seus (pacote de N aulas por um preço). No primeiro acesso, o professor precisa salvar seu perfil e ativar um plano; sugestões não são ativadas automaticamente. Valor pode ter override por aluno.
- **Pacote**: vale até ser usado; guarda aulas e valor do momento do pagamento.
- **Agenda fixa**: aulas são geradas a partir do horário semanal. Aula que já passou conta como dada.
- **Falta**: aviso em cima da hora ou não compareceu. Conta como aula.
- **Desmarcada**: aviso com antecedência ou professora cancelou. Não conta.
- **Reposição**: aula extra lançada manualmente. Conta.
- **Lembrete**: email diário para aluno ativo com ≤ 1 aula restante, uma vez por pacote.

- **Materiais**: um arquivo privado na biblioteca pode ser compartilhado com vários alunos, com prazo individual ou acesso sem prazo. A validade inclui o dia escolhido, no fuso de São Paulo.

Lógica do saldo em `src/lib/ledger.ts` (testes: `pnpm test`).

## Setup

### 1. Supabase

1. Crie um projeto em supabase.com (free).
2. SQL Editor → cole e rode `supabase/migrations/0001_init.sql`.
3. Para a biblioteca, rode também `supabase/migrations/0003_documents.sql`. Ela cria o bucket privado, as tabelas, as políticas de acesso e a reserva de espaço.
4. Authentication → Sign In / Providers → desligue **Allow new users to sign up** (só você cria contas).
5. Authentication → Users → **Add user** com email e senha da professora (marque auto-confirm).
6. Project Settings → API Keys: copie a publishable key e a secret key.

### 2. Resend (emails)

1. Crie conta em resend.com (free: 100 emails/dia).
2. Sem domínio verificado, o Resend só envia para o seu próprio email. Para mandar aos alunos, verifique um domínio (Domains → Add).
3. Copie a API key.

### 3. Vercel

1. Suba o repositório no GitHub e importe na Vercel.
2. Configure as variáveis de `.env.example`.
3. O cron em `vercel.json` chama `/api/cron/reminders` todo dia às 9h (12h UTC). A Vercel envia `CRON_SECRET` automaticamente no header.

### Local

```bash
cp .env.example .env.local   # preencha
pnpm install
pnpm dev
```

Testar o cron local:

```bash
curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/reminders
```

## Rotas

| Rota | Quem |
|---|---|
| `/login` | professora |
| `/` | calendário e aulas do dia |
| `/students` | lista de alunos |
| `/payments` | renovação e cobranças |
| `/finance` | entradas e evolução dos recebimentos |
| `/documents` | biblioteca privada de materiais |
| `/students/[id]` | agenda, pacotes, falta/desmarcada/reposição |
| `/settings` | nome e preços padrão |
| `/a/[slug]` | redirecionamento legado, com sessão e vínculo obrigatórios |
| `/api/cron/reminders` | cron diário |

## Biblioteca de materiais

Envie pela aba Documentos e compartilhe no perfil do aluno. O portal autenticado oferece uma aba Materiais com os arquivos liberados. Cada aluno tem sua própria validade; compartilhar de novo atualiza o prazo sem duplicar o arquivo.

O upload vai diretamente do navegador ao Supabase com uma autorização temporária; o arquivo não atravessa uma Server Action da Vercel. Os limites seguem o plano da empresa, conforme a tabela abaixo; documentos e entregas compartilham a cota, incluindo envios incompletos. A cota do plano Supabase é compartilhada pelo projeto. Remova envios incompletos para liberar a reserva.

Downloads exigem uma sessão da professora ou uma sessão do aluno vinculada ao perfil e um compartilhamento válido. O bucket é privado e as URLs assinadas duram no máximo 60 segundos. Excluir um documento remove todos os compartilhamentos; encerrar um acesso individual mantém o arquivo e os demais alunos. Um arquivo já baixado não pode ser revogado.

## Feriados e contatos

Rode `supabase/migrations/0004_holidays.sql` e `0005_student_phone.sql` para habilitar a configuração de feriados por professora e o telefone dos alunos. Em Configurações, ative a regra e escolha entre consumir a aula do pacote ou manter o crédito para o próximo encontro. A regra vale para todos os alunos da conta e passa a valer a partir do dia seguinte à ativação. Datas são cadastradas manualmente, sempre a partir de amanhã.

A regra fica travada após o início da primeira aula que ela afetar, no fuso de São Paulo. O banco preserva o travamento mesmo se esse aluno ou horário for removido. Feriados de hoje ou anteriores ficam imutáveis. Antes da primeira aula, mudanças em datas, horários e exceções recalculam o momento de travamento. Desmarcações/faltas explícitas mantêm seu significado; reposições consomem crédito normalmente, inclusive em feriados.

Os cadastros guardam telefone/WhatsApp opcional; a cobrança usa esse número como sugestão e permite alterá-lo antes de abrir a conversa. O site envia `noindex, nofollow` no HTML e no cabeçalho HTTP de todas as rotas.

## Atividades e entregas

Rode `supabase/migrations/0006_activities.sql` para criar atividades, entregas e o bucket privado de devoluções. A professora envia pela aba Atividades ou pelo perfil do aluno, usando um arquivo da biblioteca ou somente instruções. O aluno recebe uma aba Atividades no seu link e pode devolver um arquivo dentro do limite do plano do professor, com observações opcionais.

Cada atividade aceita uma entrega concluída. Envios interrompidos podem ser descartados para tentar novamente. As datas de envio, entrega e conferência ficam registradas; o prazo inclui o dia escolhido no fuso de São Paulo. Entregas posteriores continuam permitidas e são sinalizadas. A professora registra comentários e marca como conferida; o aluno acompanha o retorno no mesmo local.

Arquivar interrompe novas entregas e preserva a atividade. Remover o arquivo de uma entrega concluída libera espaço, mantendo datas e comentários. A biblioteca e as entregas compartilham a cota do plano da empresa. A cota gratuita do provedor é compartilhada por todo o projeto. Os uploads passam diretamente pelo Storage com autorização temporária; nenhuma credencial administrativa vai ao navegador.


## Acesso autenticado do aluno e emails centralizados

Cada aluno recebe um link próprio no formato `/p/[teacherId]/s/[slug]`. O identificador do professor e o slug aleatório identificam somente um cadastro; não dão acesso sem o código enviado ao email daquele aluno. As boas-vindas são enfileiradas automaticamente na mesma transação do cadastro. A tela Emails acompanha envios e falhas, sem lista de perfis ou convites públicos.

O OTP tem seis dígitos, validade de dez minutos e cinco tentativas. O aluno solicita o código no seu próprio link. O reenvio tem espera de cinco minutos, imposta no banco; recarregar a página restaura o email e o contador do desafio. Email e código são conferidos para o aluno identificado no link; não há seleção de perfis baseada em email compartilhado.

A sessão fica em cookie HttpOnly, Secure em produção e SameSite=Lax, com prazo absoluto de trinta dias. Cada leitura, download e entrega verifica aluno, professor, email e versão do vínculo. Trocar email, desativar cadastro ou regenerar o link revoga o vínculo. O código não é a sessão: vence em dez minutos; após validá-lo, o aluno continua autenticado por até trinta dias.

Os links antigos `/a/[slug]` encaminham ao link específico. `/student/portal/[id]` só encaminha quando há uma sessão autorizada. Quem acessa a entrada genérica sem sessão é orientado a abrir o convite do próprio professor(a), sem enumeração de alunos.

### Preparar antes de publicar

1. Verifique um domínio com acesso ao DNS no Resend. `onboarding@resend.dev` só permite teste para o email da própria conta; não use esse modo para autenticação de alunos reais. Uma caixa postal paga não é necessária para o envio transacional.
2. Configure `EMAIL_FROM` nesse domínio, `RESEND_API_KEY` e `APP_URL` canônica. Configure `EMAIL_ENCRYPTION_KEY` com 32 bytes em hexadecimal (`openssl rand -hex 32`), apenas no servidor/Vercel. Ela protege os códigos e corpos em fila; não use prefixo `NEXT_PUBLIC_` e não registre o valor em logs. Uma chave foi criada somente em `.env.local` durante o desenvolvimento.
3. Rode `0007_student_access_email.sql` depois das migrations existentes e antes de publicar este código. O código e a migration devem ser liberados juntos. Não abra cadastro público no Supabase. Códigos são verificados como tipo `email`; configure OTP com seis dígitos e expiração de 600 segundos. O app impõe prazo de dez minutos mesmo se a validade do provedor for maior.
4. Atualize os emails dos alunos existentes pela professora. Cadastros antigos sem email são preservados, mas não podem acessar o novo portal. Novos cadastros e alterações exigem email válido; não preencha endereços fictícios. A migração não dispara convites para cadastros antigos: use a tela Emails para enviá-los quando estiverem revisados.
5. Faça um teste controlado ponta a ponta: boas-vindas, código recebido, login, materiais, envio de atividade, logout, código repetido/vencido, troca de email e acesso cruzado. A preparação local usa testes e PostgreSQL isolado; o envio real e a configuração do Supabase publicado continuam pendentes até essa etapa.

### Módulo de email

`src/lib/mail` contém templates, criptografia e outbox; `src/lib/email.ts` é o único adaptador do Resend. Boas-vindas são enfileiradas pelo mesmo commit do cadastro no PostgreSQL. Lembretes usam uma chave única por aluno/pacote; OTPs usam uma chave por desafio. A fila tem lease para concorrência, backoff, até cinco tentativas, chave de idempotência do Resend e registro de falhas sem códigos ou conteúdo sensível. Payloads são descartados depois do envio, cancelamento ou falha final. O estado `sent` significa aceito pelo provedor, não confirmação de entrega: bounces/webhooks de entrega ainda não fazem parte desta implementação.

O pedido de OTP dispara a geração e envio em `after()` imediatamente após responder, evitando que o tempo de resposta revele cadastros. Cadastros executam o worker em `after()` e a tela Emails permite processar pendências. O cron diário de lembretes também processa a fila e limpa sessões/desafios expirados. `/api/cron/emails` fornece o mesmo worker, protegido por `CRON_SECRET`, para um agendador autorizado mais frequente. O cron diário existente não garante retry em minutos: configure chamadas regulares (por exemplo, a cada minuto) antes de depender de retry rápido sem interação. Não foi contratado nem configurado um agendador externo durante esta mudança.

Retries preservam o mesmo corpo e remetente. Como a idempotência do Resend vale 24 horas, uma tentativa sem confirmação não é reenviada automaticamente depois de 23 horas; fica com falha para revisão. Emails OTP vencidos, consumidos ou substituídos não são enviados; não reenvie corpos antigos manualmente. Para corrigir um envio de boas-vindas que falhou, revise a configuração e envie um novo convite pela tela Emails.

### Limites e privacidade

Desafios aceitam cinco tentativas e duram dez minutos. Reenvio tem intervalo mínimo de cinco minutos, limite de cinco pedidos por email/hora, vinte por IP/hora e cem globais/hora. Os contadores persistem no banco e usam HMAC de email/IP, sem armazenar o IP original. A resposta pública não informa se o email existe. Na Vercel, somente o header de IP fornecido pelo proxy é utilizado; localmente há um bucket compartilhado. Esse controle não substitui a proteção da borda contra ataques distribuídos.

Arquivos continuam em buckets privados e usam URLs assinadas curtas. Links já assinados ou arquivos já baixados não são revogados retroativamente. Analytics e Speed Insights não são montados nas rotas do aluno para não encaminhar identificadores do portal a esses serviços.


## Frequência semanal e telefones internacionais

`0008_frequency_international_phone.sql` adiciona `plans.weekly_lessons`, o ajuste opcional `students.weekly_lessons` e `students.phone_country`. A frequência define a quantidade de horários recorrentes e não depende do último pacote pago. Pacotes continuam guardando quantidade de créditos e valor no momento do pagamento. A migration 0011 substitui o ajuste por aluno: a frequência passa a ser definida exclusivamente pelo plano.

Na migração, a regra antiga é convertida uma única vez para os planos existentes (4 aulas → 1/semana; 8 → 2/semana). Depois disso, a frequência é uma configuração explícita. O ajuste legado é preservado no banco para histórico, mas não define novos agendamentos. O banco serializa a inclusão de horários por aluno e rejeita sobreposições que excedam a frequência, inclusive horários futuros. Diminuir a frequência não apaga horários existentes: encerre os excedentes antes de cadastrar outros.

O campo de telefone é compartilhado entre cadastro e diálogo do WhatsApp, com país, bandeira, DDI e formatação nacional. Novas gravações salvam o número no padrão E.164 (`+` e DDI) e o país ISO de duas letras. A biblioteca `libphonenumber-js` valida as regras internacionais; colar um número com `+DDI` reconhece o país. Números antigos são preservados e normalizados ao editar. Telefone continua opcional; o país escolhido é salvo mesmo sem número. O diálogo de cobrança só altera o destinatário da conversa; para atualizar o contato permanentemente, salve no cadastro do aluno.

As migrations 0008 e 0007 foram aplicadas no banco publicado em 2026-10-08 e 2026-10-09, respectivamente. O bootstrap suporta ambas as ordens de aplicação.

## Idioma, aparência e ações

Configurações oferece português brasileiro (padrão), inglês, espanhol e francês; o header do portal autenticado do aluno também oferece essa escolha. Preferências são guardadas em cookies do navegador, sem idioma na URL. O tema padrão é sempre claro até uma escolha explícita. Os temas claro, escuro e do sistema usam a preferência local. Datas são apresentadas no idioma escolhido, preservando o fuso de São Paulo e valores em reais.

Rotas canônicas usam inglês; as URLs antigas em português redirecionam. O seletor de países mostra uma lista curta de países frequentes e pesquisa nomes traduzidos, com rolagem limitada. Ações de gravação desabilitam seus botões e mostram um indicador enquanto aguardam o servidor.

## Ajustes do portal e escopo

A migration `0009_scoped_student_access.sql` vincula cada desafio a um aluno e invalida desafios anteriores sem contexto. Sessões existentes mantêm seu vínculo único. A renovação aparece antes do próximo encontro; o resumo de dia vazio mantém o separador e a mesma altura mínima de uma aula. Materiais vencidos aparecem com download indisponível, e o backend continua recusando downloads após o prazo. Atividades aceitam entregas atrasadas; entregas concluídas ficam recolhidas, com aviso de conferência. Materiais e atividades aceitam prazo nulo.

Veja `FUTURE_FEATURES.md` para múltiplos professores por pessoa e acesso de responsáveis.


## Planos, correções e integração de agenda

As migrations 0010–0013 adicionam valores com centavos, correção com arquivo opcional, planos semanais (1–7) ou mensais (1–31), aulas mensais avulsas ou em dias fixos e reposições vinculadas a uma aula desmarcada. O limite mensal usa o mês do calendário; créditos pagos permanecem separados da frequência. Um dia fixo inexistente no mês não gera aula.

O convite de boas-vindas é de uso único e vale 24 horas. A ativação explícita cria uma sessão de 30 dias para aquele aluno; depois disso o acesso pode ser renovado por OTP. Arquivos têm limite de 20 MB e compartilham a cota privada do professor. Atividades usam páginas de 20 itens por filtro e alunos de 50; o controle aparece somente quando necessário.

O tema escuro usa grafite e conserva os acentos verdes. Comunicação por WhatsApp é editável e profissional; avisos por email passam pela fila centralizada.

Google Calendar/Meet está preparado por professor, com tokens criptografados, disponibilidade e sincronização com retentativas. Falta configurar as credenciais OAuth e testar a conexão real. Veja [GOOGLE_CALENDAR_SETUP.md](GOOGLE_CALENDAR_SETUP.md).


## Agendamento e revisão de interface

A migration 0014 adiciona a duração configurável (15–180 minutos) do professor e uma cópia dessa duração em cada agendamento. A configuração afeta aulas novas; conflitos locais, disponibilidade Google e eventos Meet respeitam a duração. O seletor permite escolher horários livres, destaca a escolha e recarrega após salvar. Erros esperados de agendamento são retornados explicitamente, sem mensagem minificada do React.

Configurações é dividida em Geral, Integrações, Feriados e Planos. Valores usam máscara de centavos durante a digitação e limite de R$ 99.000,00 no frontend e backend. Frequência e créditos continuam separados, com sugestões de quantidade e duração aproximada do pacote. As escolhas de idioma/aparência estão disponíveis após o login.

Correções usam uma única origem de arquivo por vez: biblioteca pesquisável ou novo upload. O formulário é renovado após salvar. Resultados de ações aparecem em notificações temporárias; avisos persistentes e instruções permanecem no contexto. A sincronização Google mostra uma confirmação antes de importar/processar pendências e fica desabilitada quando não há itens.


## Primeiro acesso e planos da plataforma

A migration 0015 remove os planos automáticos de contas novas. O professor precisa salvar nome/duração e ativar um plano antes de cadastrar alunos, materiais ou atividades. O bloqueio é aplicado na interface, nas ações de criação e no banco. Contas anteriores com alunos vinculados têm suas configurações preservadas; sugestões não utilizadas exigem confirmação. As preferências de idioma/aparência continuam sendo por navegador.

A conta de teste pode ser colocada no fluxo inicial mantendo seus alunos e configurações existentes como sugestões. Um aluno ativo sem horário vigente ou data avulsa futura aparece como pendente; reposições têm uma aba própria.

Plano da empresa apresenta Essencial, Plus e Pro. Emails e a sala integrada são exclusivos do Pro; login e convites dos alunos permanecem disponíveis em todos os planos. A implementação não cria cobranças ou contratações. O identificador do plano da plataforma não pode ser alterado pelo usuário através da API. Regras comerciais e cobrança ficam para a etapa de assinaturas.

Veja [TASKS.md](TASKS.md) para a revisão completa de validação dos formulários.

## Sala online

Veja [CLASSROOM.md](CLASSROOM.md) para a integração Jitsi, autenticação, configuração e limites de rede.

## Assinaturas e limites — versão de teste

Aplique `0016_platform_entitlements.sql` antes de publicar o código de planos. A coluna de plano continua protegida contra alterações pela própria conta.

| Plano | Arquivo | Total de documentos e entregas | Emails e sala integrada |
|---|---:|---:|---|
| Essencial | 20 MB | 1 GB | Pro necessário |
| Plus | 100 MB | 5 GB | Pro necessário |
| Pro | 1 GB | 20 GB | Incluídos |

As cotas são aplicadas nas ações e no banco, com reserva serializada e verificação do tamanho real antes de concluir um arquivo. O provedor de arquivos mantém seus próprios limites globais e capacidade física. Configurar estes planos não altera nem contrata o plano Supabase. Nenhuma cobrança automática foi implementada.

O histórico por mês inclui programação e aulas anteriores. Por pacote, inclui aulas vinculadas ao pagamento e distingue utilizadas, agendadas e saldo; aulas futuras não contam como utilizadas.

## App desktop de teste

`desktop/` contém um app Electron para Mac Apple Silicon e Windows x64. Para desenvolvimento: `npm ci` e `npm test` nessa pasta. Empacote com `npm run package:mac` ou `npm run package:windows`; a distribuição de teste atual é a release `desktop-v0.3.1`. O workflow manual `Desktop Windows` gera e valida o instalador antes de publicá-lo.

O app possui sessão própria. Um link `lessonara://classroom/<student>/<kind>/<source>/<date>` leva à ocorrência no domínio canônico, sem senha ou JWT no link. No primeiro acesso, faça login no app. O acesso continua sendo autorizado pelo backend e exige Pro, vínculo e horário válidos. A troca de sala é manual; links para outras salas pedem confirmação antes de sair da atual. O aluno pode permanecer no navegador.

Este teste usa as ferramentas atuais da sala. Não implementa overlay de anotação sobre outros programas nem reverte o quadro. Configure Google pelo navegador. A assinatura local ad-hoc não é notarização Apple; uma distribuição final exige preparar assinatura/notarização antes de recomendar o instalador a usuários finais.


### Chamadas desktop e campanhas de email

O desktop 0.3.1 reúne apenas login, lista e sala de chamadas; o portal fica na web. Há escolha explícita de monitor inteiro ou janela, modo flutuante preservando a chamada e anotação nativa sobre a tela inteira. Ver `desktop/README.md` e `CLASSROOM.md`.

Emails do Pro agora permite preparar uma campanha, selecionar até 100 alunos e revisar antes de confirmar. A função `queue_email_campaign` valida escopo, Pro, estado dos alunos, opt-out, deduplicação por email, idempotência e limites por professor. A confirmação agenda um `after()` que processa somente os trabalhos da campanha, espaçando envios; pendências continuam visíveis e podem ser retomadas pelo worker existente. Mensagens são texto escapado e os corpos em fila seguem criptografados. O cancelamento de campanhas promocionais tem confirmação e não impede emails de acesso ou avisos das aulas. Migração: `0017_campaign_emails.sql`. Nenhuma campanha real foi enviada durante a validação de desenvolvimento.


### Correções de segurança publicadas em 19/10/2026

Os headers globais de CSP, proteção contra enquadramento, `nosniff`, referrer e permissões mantêm o Jitsi e a origem Supabase configurados. A CSP preserva scripts inline exigidos pelo shell estático/PPR; ela não é uma CSP estrita com nonce. `unsafe-eval` só é permitido no desenvolvimento. Não aplicar COEP/COOP globalmente sem validar as integrações.

Os envelopes novos usam `v2.<finalidade>.<dados>`, AES-256-GCM com tag de 16 bytes, AAD e HKDF por finalidade. OAuth Google, credenciais, OTP, campanhas, corpo de envio, cancelamento promocional e material da sala têm contextos distintos. Leitura do formato antigo exige `allowLegacy` explícito nos consumidores existentes. Manter a chave raiz atual durante a transição para preservar credenciais e filas; remover o fallback só depois de migrar os registros persistidos e tratar os links antigos. Links novos de cancelamento expiram após 365 dias; os já enviados no formato antigo continuam aceitos.

A publicação dessa mudança exige transição coordenada dos leitores: instâncias antigas não entendem envelopes v2. Publicar primeiro com `SEAL_WRITE_VERSION=v1` para atualizar os leitores sem produzir dados que instâncias antigas não entendem. Depois de drenar as instâncias antigas, configurar `SEAL_WRITE_VERSION=v2` e publicar os produtores v2. O padrão do código é v2; a primeira etapa exige explicitamente v1 na configuração do deploy. A alteração de derivação do fingerprint reinicia as janelas dos contadores anteriores uma vez; não altera hashes das sessões dos alunos. A publicação em produção foi concluída em duas etapas em 19/10/2026: leitores compatíveis com escrita v1, seguidos de escrita v2. Login real de teste, páginas protegidas, headers e emissão de estado OAuth v2 foram conferidos no domínio público. A migração dos registros antigos e a retirada do fallback legado continuam pendentes.

O login do professor aplica limites persistidos na RPC existente `allow_student_auth`: 60 tentativas/IP, 20/conta e 10/par IP+conta em 15 minutos. Email e IP são enviados ao contador como HMAC. Falha do contador bloqueia a autenticação. A proteção do endpoint direto do Supabase Auth continua dependendo das configurações do provedor; o limite da Server Action não o substitui.
