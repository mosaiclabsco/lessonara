# Tarefas do Lessonara

**Título:** Padronizar a validação de campos nos formulários do Lessonara
Alternativas: Impedir valores incoerentes nos cadastros e agendamentos do Lessonara · Revisar limites e mensagens de validação nos formulários do sistema

~~~markdown
## Contexto
Durante os testes de ponta a ponta, **Gabriel pediu uma revisão completa da validação** dos formulários do Lessonara. A tarefa abrange os portais de professor e aluno, incluindo cadastros, planos, horários, pagamentos, materiais, atividades e configurações.

## Problema
É necessário confirmar que todos os campos recusam dados incoerentes e apresentam mensagens claras. Existem validações específicas, como moeda com teto de `R$ 99.000,00`, quantidade positiva de créditos e limites de upload por plano (Essencial: `20 MB`; Plus: `100 MB`; Pro: `1 GB` por arquivo), mas ainda falta uma revisão uniforme de todos os formulários.

> **Revisão implementada em 20/10/2026:** inventário, limites e correções em [docs/form-validation.md](docs/form-validation.md). Testes diretos das actions e restrições do banco complementam a validação do navegador.

## Impacto
- Dados inconsistentes podem prejudicar agenda, créditos e comunicação com alunos.
- Mensagens pouco claras dificultam corrigir um preenchimento inválido.
- ⚠️ Não há um incidente comprovado em curso; esta tarefa registra uma melhoria solicitada nos testes.

## O que fazer
1. Inventariar campos obrigatórios e limites já existentes, confirmando o comportamento no navegador e no backend.
2. Definir regras de tamanho, formato, valores máximos e combinações permitidas para cada campo.
3. Recusar entradas inválidas no servidor e no banco quando aplicável, preservando o escopo do professor.
4. Padronizar mensagens, indicação de campos obrigatórios e foco no campo que precisa de correção.
5. Cobrir limites, tentativas de contornar o frontend e casos de concorrência relevantes.

## Critério de aceite
Os formulários recusam dados fora das regras definidas e mostram uma mensagem que permite corrigir o preenchimento. Uma requisição direta ao backend também não consegue gravar os valores inválidos cobertos pela revisão.
~~~

Em editores WYSIWYG, use modo texto ou Markdown para colar a descrição mantendo a formatação.

---

**Título:** Auditoria de segurança pré-lançamento (SAST, DAST e pentest) do Lessonara
Alternativas: Validar a segurança do Lessonara antes da publicação · Rodar SAST/DAST/pentest no Lessonara (Vercel + Supabase)

~~~markdown
## Contexto
O Lessonara (Next.js 16 na Vercel + Supabase) vai ser publicado. Antes disso, Gabriel pediu uma auditoria de AppSec do código e da API publicada, dentro dos ambientes e domínios que ele autorizar. O Codex está alterando o código em paralelo.

## Escopo
- OWASP Top 10 e OWASP API Security Top 10.
- Autenticação, sessões, JWT e cookies (professor: Supabase Auth; aluno: sessão própria em `student_sessions`).
- IDOR/BOLA, BFLA e isolamento entre professores (RLS + rotas com `createAdminClient`).
- Manipulação de parâmetros, mass assignment, validação só no frontend.
- SQLi, XSS, SSRF, secrets expostos.
- Rate limiting, CORS, endpoints indevidamente públicos (`src/lib/public-routes`, `/api/cron/*`).
- Dependências vulneráveis e configurações inseguras (headers, `vercel.json`, Supabase Auth).

## Ferramentas
- SAST + análise arquitetural primeiro.
- `docker run --rm -t ghcr.io/zaproxy/zaproxy:stable zap-baseline.py -t <domínio autorizado>`.
- Skill https://github.com/sam-cre/Security_Audit_Skill.
- Skill https://github.com/secureIO-GmbH/security-skills (modo full).
- SonarQube local, se agregar (code smells, qualidade).

## Regras
- Sem testes destrutivos, brute force ou exploração ativa em produção.
- Pedir autorização explícita antes de testes ativos.
- Não modificar código sem autorização.

## Entregáveis
- Matriz de testes dinâmicos com usuários de permissões diferentes (professor A, professor B, aluno, anônimo).
- Relatório: confirmadas / suspeitas / não testadas; cada achado com evidência reproduzível, impacto, severidade, arquivo ou endpoint e correção recomendada.

## Critério de aceite
Relatório entregue e priorizado, permitindo mitigar os achados antes da publicação.
~~~

---

**Título:** Pix da professora: configuração, QR Code e "já paguei" no portal do aluno
Alternativas: Exibir o Pix do professor para o aluno pagar o pacote · Facilitar o pagamento de pacotes via Pix sem gateway

~~~markdown
## Contexto
Na análise de produto (out/2026), a cobrança aparece como o ponto mais manual da jornada: a mensagem de WhatsApp não leva forma de pagamento e o professor registra o pagamento à mão. Gateway para os alunos foi descartado: o professor tem poucos alunos e teria que repassar a taxa.

## Problema
O aluno precisa pedir a chave Pix, e o professor precisa conferir o extrato e lançar o pagamento. Sem webhook não há confirmação automática; o ganho está em reduzir o atrito e em gerar um sinal para o professor conferir.

## O que fazer
1. Configurações → nova opção **Pix**: tipo e chave, nome do recebedor e cidade (campos exigidos pelo BR Code). Validar a chave por tipo.
2. Gerar o BR Code estático (EMV + CRC16) com o valor do pacote/renovação e um identificador curto do aluno, mais o QR Code correspondente.
3. Portal do aluno: quando houver renovação pendente, mostrar o QR Code, o copia-e-cola e o valor.
4. Mensagem de cobrança por WhatsApp: incluir o copia-e-cola.
5. Botão **"Já paguei"** no portal: cria um pagamento *aguardando confirmação* e avisa o professor; o professor confirma com um clique em Pagamentos (pré-preenchido), e só então os créditos entram no saldo.
6. Sem Pix configurado, nada aparece (mantém o fluxo atual).

## Fora de escopo
Gateway, webhook bancário, conciliação automática.

## Critério de aceite
Um professor com Pix configurado vê o aluno pagar pelo QR/copia-e-cola, recebe o aviso de "já paguei" e confirma o pagamento em um clique; o saldo só muda após a confirmação.
~~~

---

**Título:** Trial da plataforma e assinatura do professor
Alternativas: Permitir que professores testem o Lessonara antes de assinar · Cadastro self-serve com período de teste e cobrança da assinatura

~~~markdown
## Contexto
Hoje não há cadastro self-serve de professor nem cobrança da assinatura (README: "Nenhuma cobrança automática foi implementada"). Sem isso não dá para adquirir nem monetizar.

## O que fazer
1. Cadastro self-serve do professor com período de teste de **7 dias** (ciclo do professor é semanal: uma semana de aulas + uma cobrança).
2. Trial com acesso a um plano definido (ex.: Plus ou Pro), com contagem regressiva no painel e aviso por email antes do fim.
3. Fim do trial sem assinatura: conta em modo leitura (não perde dados), sem criação de alunos, aulas ou envios.
4. Assinatura: começar manual (Mosaic Labs Admin) enquanto houver poucos professores; migrar para Stripe (ou similar) quando o volume justificar. A taxa do gateway fica absorvida no preço da assinatura.
5. Entitlements continuam aplicados no servidor e no banco (trial/expirado como estados do plano da plataforma).

## Critério de aceite
Um professor novo se cadastra, usa o período de teste sem intervenção, recebe o aviso de fim e, sem assinar, mantém os dados em modo leitura; ao assinar, o acesso volta sem perda.
~~~

---

## Requisitos antes de iniciar o piloto com a professora

Decisão de 21/10/2026: os três itens abaixo são obrigatórios para iniciar o piloto. Permanecem abertos enquanto o trabalho segue no portal administrativo; não confundir implementação publicada com liberação do piloto.

- [ ] **Confirmar backup e restauração** — dashboard consultado em 20/10 exibiu “Last backup: No backups”; verificar eventual backup externo e executar restore de teste antes de clientes reais.
- [ ] **Jitsi sob a nova CSP com duas pessoas** — validar câmera, áudio, compartilhamento e WebSocket antes de liberar a sala aos alunos.
- [ ] **Validar QR Code Pix em aplicativo bancário** — conferir leitura do QR/copia-e-cola, recebedor e valor antes do primeiro pagamento. Não exige realizar uma transferência.

## Roadmap de produto (análise out/2026)

Priorização por ICE (pré-PMF, time mínimo, pouco dado). Itens com task detalhada acima estão marcados com ↑.

### Agora

- [x] **Concluir a revisão de validação dos formulários** ↑ — incluir regras no servidor, limites, combinações inválidas e mensagens de correção. Implementada em 20/10/2026: validação compartilhada, mensagens serializadas, limites de campos e migração 0021 aplicada; inventário em [docs/form-validation.md](docs/form-validation.md).
- [x] **Consolidar o relatório de segurança** — Relatório centralizado em [docs/security-review.md](docs/security-review.md), separando corrigidos, descartados, pendentes e cenários ainda não validados. Os resultados informados por Gabriel (SAST limpo, ZAP 0 FAIL, D1–D17 sem violações, C1–C7/S1–S5/Q1–Q4 resolvidos ou descartados e 280 testes) são o registro da revisão recebida, não uma nova execução nesta atualização do backlog.
- [x] **Atualizar README e documentação** — README atualizado e guias centralizados em [docs/README.md](docs/README.md); entradas antigas apontam aos documentos canônicos e `FUTURE_FEATURES.md` não mantém backlog duplicado.
- [ ] **Landing page do Lessonara** — evoluir `/about` para uma página de venda: proposta de valor (controle de aulas e pacotes, cobrança, portal do aluno), prints, planos com preço, FAQ, contato e caminho claro para solicitar participação no piloto. Adicionar o CTA "Testar 7 dias grátis" quando o cadastro autônomo e o trial estiverem prontos. Permitir indexação das páginas comerciais, preservando a privacidade das páginas internas.
- [ ] **Cadastro autônomo + trial de 7 dias + cobrança manual da assinatura** ↑ — implementar após comprovar o onboarding no piloto. Validar se sete dias permitem experimentar o valor; mostrar prazo e avisar antes do fim. Conta expirada preserva dados, informa restrições e permite reativação após pagamento. Medir conversão e motivos de não conversão.
- [x] **Pix da professora + botão "Já paguei"** ↑ — implementado: Configurações → Recebimentos, QR/copia-e-cola com preço do aluno, aviso no portal e confirmação manual/idempotente em Pagamentos. Cobrança WhatsApp inclui instruções. [Fluxo e limites](docs/product-flows.md). Leitura em banco e ganho de tempo com o piloto ainda exigem QA/discovery.
- [ ] **Painel do admin funcional** — papel admin verificado no backend/RLS. Mínimo: lista de professores (plano, status do trial, último acesso, nº de alunos), ativar/desativar conta, registrar pagamento manual da assinatura, ver falhas de email/cron e pedidos de importação de alunos.
  - Em desenvolvimento no repositório `mosaic-labs-admin`: identidade Mosaic Labs, banco administrativo cloud separado e conector real ativos; cinco professores sincronizados por ID, vínculo único/imutável, RLS e quatro páginas autenticadas verificados. Migração `0026` de gestão aplicada no Lessonara após teste com rollback. Frontend ainda local; QA visual e operação humana completa de pagamento/plano/suspensão pendentes. Não marcar o painel inteiro concluído: falhas operacionais, pedidos de importação e demais campos mínimos ainda precisam ser conferidos.
- [ ] **Acesso de suporte ao perfil do professor** — futuro: desenhar acesso temporário, explícito e auditável para suporte, com permissões limitadas, indicação visível, expiração e encerramento seguro. Nunca compartilhar a senha ou reutilizar a sessão original do professor. Ainda não implementado.
- [ ] **Eventos do funil de ativação** — definir e gravar (tabela própria ou eventos customizados da Vercel), sem dados pessoais do aluno:
  - `teacher_signed_up` (início do trial)
  - `profile_completed` (nome + duração salvos)
  - `plan_activated` (1º plano de aulas ativo)
  - `first_student_created`
  - `first_schedule_created` (1ª agenda fixa ou aula avulsa)
  - `first_payment_registered` (pagamento/pacote real registrado)
  - `teacher_activated` — **marco de ativação: primeiro aluno com agenda e pacote real registrados**, combinando os estados do mesmo aluno; um pagamento isolado ou dados de teste não bastam
  - `student_portal_accessed` (1º aluno entrou no portal)
  - `trial_ending_notified`, `subscription_started`, `subscription_lapsed`
  - Métricas: % que chega ao marco de ativação em até 7 dias; tempo e ajuda necessária até o primeiro valor; pontos de interrupção do onboarding; conversão trial → assinatura e motivos de não conversão.

### Próximo

- [x] **Importação de alunos (concierge)** — implementadas as duas opções aprovadas: CSV guiado e pedido assistido CSV/XLSX, prévia e confirmação do professor. Plus/Pro, etapa opcional e acesso permanente em Alunos, saldo inicial separado de pagamentos. Operação inicial da equipe pelo comando restrito `scripts/import-support.ts`; painel admin/alerta automático seguem no item de administração. [Limites, operação e recuperação](docs/product-flows.md).
- [ ] **Aluno desmarca pelo portal** — refinar:
  - Aluno desmarca uma aula futura e informa motivo opcional.
  - Dentro do prazo → **desmarcada** (não conta); fora do prazo → **falta** (conta). Professor pode reverter a classificação.
  - Professor fica sabendo **na hora**: aviso no painel (badge + lista "Desmarques recentes") e email imediato para o professor; WhatsApp/push depois, se houver demanda.
  - Aluno recebe confirmação com a classificação ("desmarcada sem custo" / "contará como falta") **antes** de confirmar, para não haver surpresa.
  - Opcional: pedir reposição no mesmo fluxo, sugerindo horários livres da disponibilidade.
- [ ] **Regra de antecedência configurável pelo professor** — Configurações: horas mínimas para desmarcar sem custo (ex.: 2h, 12h, 24h, 48h), com padrão definido. Vale para desmarques feitos pelo aluno e para a classificação manual; mudanças valem só para aulas futuras. Mostrar a regra no portal do aluno.
- [ ] **Discovery leve (contínuo)** — 5–8 entrevistas formais é difícil agora; alternativa:
  - Conversa de 15 min com cada professor que iniciar o trial (onboarding assistido = entrevista).
  - Pergunta curta no painel no fim do trial ("o que faltou para assinar?") e ao cancelar.
  - Campo de feedback/sugestão no menu de suporte.
  - Meta: 1 conversa por semana; registrar dores repetidas aqui.

### Depois

- [ ] **Automatizar a assinatura da plataforma com gateway** — começar com cobrança manual e automatizar quando o volume justificar; preservar a reativação sem perda de dados.
- [ ] **Recibo e exportação para carnê-leão** — recibo por pagamento (PDF/link para o aluno) e exportação mensal dos recebimentos (CSV no formato que facilite o lançamento no carnê-leão: data, pagador, CPF opcional, valor).
  - **24/10/2026, local:** recibo individual PDF e relatório geral CSV/XLSX/PDF implementados e testados, aguardando publicação conjunta. Formato fiscal específico/CPF não fazem parte desta rodada; este item permanece aberto para essa definição.
- [x] **Webhooks do Resend** — publicado em 20/10/2026 com assinatura, deduplicação e status separado de entrega. Simulações oficiais de entrega, rejeição e spam confirmadas no provedor (HTTP 200) e no banco; bloqueio de novos envios conferido. A tela de Emails distingue aceite, entrega, atraso e falha, sem notificação extra ao professor. Evidências em [docs/operations-validation.md](docs/operations-validation.md). O primeiro acesso do aluno continua pendente no item de instrumentação do funil; entrega não comprova acesso ao portal.

- [ ] **Avaliar responsáveis, múltiplos vínculos e escolas** — responsáveis com acesso a vários alunos por convites e permissões próprios; uma pessoa acompanhando aulas com vários professores, preservando a separação dos vínculos; escolas com vários professores, papéis (dono/admin/professor) e financeiro por professor e consolidado. Ver `FUTURE_FEATURES.md`.

### Congelado até haver demanda

- [ ] **Retomar melhorias no desktop e nas ferramentas de anotação** — somente quando houver demanda comprovada.
- [ ] **Retomar expansão da sala online** — somente quando houver demanda comprovada.
- [ ] **Retomar expansão das campanhas de email** — somente quando houver demanda comprovada.
- [ ] **Retomar novos idiomas** — somente quando houver demanda comprovada.

### Decidido

- Sem gateway de pagamento para alunos (taxa teria que ser repassada; poucos alunos por professor).
- Assinatura da plataforma: manual no início, Stripe quando o volume justificar.
- Trial de 7 dias.

### Concluído

- [x] **Google Calendar/Meet real** — OAuth configurado e validado em out/2026 (README e `GOOGLE_CALENDAR_SETUP.md` ainda dizem "falta configurar as credenciais": atualizar).


## QA e hardening após a revisão de segurança

Pendências mantidas em TODO por solicitação de Gabriel em 20/10/2026. Não são bloqueadores da conclusão da auditoria de segurança; o QA da sala é necessário antes de liberar seu uso aos alunos.

- [ ] **C8 — ACAO `*` nas páginas HTML** — hardening de baixo risco, pós-lançamento.
- [ ] **OTP real do aluno ponta a ponta** — recebimento e uso do código, com rejeição dos casos inválidos.
- [ ] **Essencial × Pro** — validar permissões, limites e bloqueios no servidor com planos diferentes.
- [x] **Google Calendar ponta a ponta** — Gabriel confirmou em 21/10/2026 que testou manualmente o fluxo de criar evento/Meet, alterar/reagendar e cancelar após as mudanças de segurança. Validação informada pelo usuário; a conferência técnica anterior de conexão, disponibilidade e fila permanece registrada separadamente.

Cenários e critérios de encerramento: [QA e hardening pendentes](docs/qa-pendente.md).


## Operação e validação do piloto

Consolidação da lista enviada em 20/10/2026. Os itens já descritos no roadmap acima foram complementados no próprio lugar. Nenhuma tarefa foi marcada como concluída apenas por ter sido incluída nesta lista.

### Confiabilidade dos workers e das filas

**Publicado em 24/10/2026:** os dez itens de implementação foram publicados no Lessonara/admin, com migrações 0030/0031/0032 e agendamentos ativados. Cinco workers HTTP 200 e execução automática confirmados, filas sem falhas. Pendências e download PDF autenticado conferidos. Limite global Free de 50 MB confirmado e mantido por escolha do proprietário; 100 MB Pro fica na tarefa específica abaixo. Evidências em [validação operacional](docs/operations-validation.md). QA real elegível e cenários manuais continuam abertos; não houve envio novo porque a fila estava vazia.

**24/10/2026 — itens 3–10 preparados localmente:** recibos por pagamento, exportação Plus/Pro, bloqueios de Google/Meet, lembretes de aula Pro com opt-out do aluno, gestão de emails por plano, central de pendências, limites 20/50/100 MB e 1/5/10 GB e TUS com progresso/retomada na mesma aba. Permissões centralizadas na aplicação/SQL e regras de trabalho no AGENTS.md; matriz e limitações em [docs/plans.md](docs/plans.md). Não foram publicados nem aplicados no Supabase. Permanecem para a entrega conjunta: migrações 0030/0031 e admin, agendamento, limite global do Storage, QA real de Google/Resend/Storage e monitoramento do uso físico/reservas incompletas. A política de desmarcação e os módulos pedagógicos continuam no backlog. Prioridades do leitor local foram preservadas.

**24/10/2026 — revisão dos itens 1 e 2, implementada localmente, sem publicação:** renovação às 08h/18h com retomada condicional, rotas separadas para emails/Calendar/limpeza diária, encerramento de tentativas esgotadas e telemetria. Tela “Jobs e filas” preparada no admin, com consulta periódica apenas enquanto visível, status, filas e histórico. Renovação e campanhas passam a Plus/Pro; emails de acesso preservados no Essencial. Regressão de renovação cobre histórico após remoção da agenda e entrada antecipada na sala. Detalhes: [Jobs e filas](docs/workers.md). Migrações, cron e validação real continuam pendentes até a entrega conjunta dos dez itens; os checkboxes operacionais abaixo permanecem abertos.


O histórico da sessão registra correção do `CRON_SECRET` em produção, respostas HTTP 200 dos dois workers e execução automática pelo Supabase Cron. Também registra uma pendência técnica de calendário processada. Isso não comprova, por si só, um novo lembrete preparado e enviado de ponta a ponta. Referências e evidências devem entrar na documentação operacional.

- [ ] **Consolidar a validação dos dois workers em produção** — registrar a correção do segredo e as evidências das execuções, sem armazenar seu valor. Validar o ciclo completo com cenário elegível e destinatário autorizado: lembrete preparado, email processado e pendência de calendário resolvida. Distinguir execução HTTP bem-sucedida, processamento concluído e entrega do email.
- [x] **Detectar interrupção ou execução incompleta dos workers** — acompanhar última execução, progresso e conclusão; limiares e alertas visuais publicados no admin em 24/10/2026; não há notificação externa independente.
- [x] **Dar visibilidade às filas** — mostrar pendências por idade, filas sem progresso, falhas de envio, número de tentativas, tentativas esgotadas e conclusão dos workers. Indicadores e histórico publicados no admin em 24/10/2026; retomada automática é limitada e idempotente, e reenvio de falha definitiva exige revisão.

### Público e pesquisa com professores e alunos

- [x] **Segmento inicial definido** — professor particular que trabalha sozinho e vende pacotes de aulas. Diretriz de produto definida por Gabriel; a aderência ao público ainda deve ser validada no piloto.
- [ ] **Recrutar um pequeno grupo para o piloto** — incluir professores além do usuário inicial e registrar interesse e participação.
- [ ] **Entrevistar sobre situações reais recentes** — última renovação, conferência de saldo, desmarcação e trabalho feito fora do sistema; registrar as alternativas usadas e separar fatos observados de hipóteses.
- [ ] **Observar alunos usando o portal** — pedir que acessem, encontrem a próxima aula e consultem o saldo; registrar dificuldades e ajuda necessária sem conduzir as respostas.
- [ ] **Executar onboarding assistido e acompanhar pelo menos dois ciclos semanais** — registrar tempo, intervenções e dificuldades de cada professor. A importação assistida está detalhada no roadmap.
- [ ] **Validar disposição real de pagar** — entender motivos para continuar ou abandonar e testar se a diferenciação entre Essencial, Plus e Pro é compreendida e valorizada.
- [ ] **Medir retenção e indicações** — usar os resultados do piloto para orientar a próxima rodada de investimento no produto.

### Ativação e uso recorrente

- [x] **Marco de ativação definido** — primeiro aluno com agenda e pacote real registrados. Instrumentação e validação dessa definição seguem pendentes no item de eventos do funil.
- [ ] **Ampliar o checklist de onboarding** — além de perfil e plano, incluir aluno, agenda, pacote e convite; mostrar ao professor a próxima ação necessária para começar a usar o produto.
- [ ] **Medir uso recorrente por ações úteis** — definir e acompanhar ações de agenda, saldo, renovação e pagamentos, além de simples acessos ao sistema.
- [ ] **Medir o ciclo de renovação** — tempo e quantidade de intervenções entre aviso de renovação e pagamento confirmado; comparar o fluxo atual com o protótipo Pix/“Já paguei”.

### Resumo de pendências e evolução condicionada a evidência

- [ ] **Testar manualmente “O que preciso resolver”** — validar se um resumo ajuda o professor a agir antes de construir uma tela dedicada.
- [ ] **Implementar o resumo somente se demonstrar utilidade** — reunir alunos sem agenda, renovações, correções e falhas de comunicação; adicionar alertas específicos apenas para as pendências que realmente gerarem ação.

### Dependências e ordem de aprendizado

Primeiro recrutar e acompanhar o piloto com onboarding e importação assistidos. Usar as observações para ajustar a ativação, testar renovação e validar preço. O cadastro autônomo vem depois de comprovar o onboarding; automação da assinatura e importação CSV dependem do custo e volume da operação. A rotina contínua de discovery, canal de feedback e coleta dos motivos de cancelamento permanecem no roadmap acima.

## Módulos de aprendizado e evolução — propostas de roadmap

Origem: solicitação de 23/10/2026. Escopo e critérios completos em [docs/learning-modules.md](docs/learning-modules.md). Não implementados. Prioridade indicada é da proposta; respeitar bloqueadores do piloto e a ordenação pessoal.

- [ ] **CORE-01 — Reutilizar o domínio existente** — Alta / fundação. Requisitos e critérios de aceite: seção `CORE-01` da especificação.
- [ ] **CORE-02 — Registrar o modelo mínimo de evidências** — Alta / fundação. Requisitos e critérios de aceite: seção `CORE-02` da especificação.
- [ ] **CORE-03 — Definir privacidade, retenção e controle de acesso** — Alta / fundação. Requisitos e critérios de aceite: seção `CORE-03` da especificação.
- [ ] **LG-01 — Catálogo de habilidades e conteúdos** — Alta / MVP. Requisitos e critérios de aceite: seção `LG-01` da especificação.
- [ ] **SL-01 — Criar atividades de speaking** — Alta / MVP. Requisitos e critérios de aceite: seção `SL-01` da especificação.
- [ ] **SL-02 — Gravar e enviar respostas em áudio** — Alta / MVP. Requisitos e critérios de aceite: seção `SL-02` da especificação.
- [ ] **SL-03 — Avaliar respostas e manter histórico de tentativas** — Alta / MVP. Requisitos e critérios de aceite: seção `SL-03` da especificação.
- [ ] **SL-04 — Proteger e armazenar áudios privados** — Alta / MVP. Requisitos e critérios de aceite: seção `SL-04` da especificação.
- [ ] **LG-02 — Registrar desempenho por habilidade** — Alta / MVP. Requisitos e critérios de aceite: seção `LG-02` da especificação.
- [ ] **LG-03 — Painel de evolução do aluno** — Média / MVP. Requisitos e critérios de aceite: seção `LG-03` da especificação.
- [ ] **LG-04 — Sugerir revisões com evidências** — Média / pós-MVP inicial. Requisitos e critérios de aceite: seção `LG-04` da especificação.
- [ ] **PL-01 — Gerar relatório individual em rascunho** — Alta / MVP. Requisitos e critérios de aceite: seção `PL-01` da especificação.
- [ ] **PL-02 — Pré-visualizar e aprovar relatórios** — Alta / MVP. Requisitos e critérios de aceite: seção `PL-02` da especificação.
- [ ] **PL-03 — Exportar PDF e compartilhar relatórios privados** — Alta / MVP. Requisitos e critérios de aceite: seção `PL-03` da especificação.
- [ ] **SL-05 — Assistente de speaking com aprovação docente** — Baixa / pós-MVP. Requisitos e critérios de aceite: seção `SL-05` da especificação.
- [ ] **LG-05 — Revisão espaçada por regras explícitas** — Baixa / futuro. Requisitos e critérios de aceite: seção `LG-05` da especificação.
- [ ] **PL-04 — Comparar períodos com dados compatíveis** — Média / pós-MVP. Requisitos e critérios de aceite: seção `PL-04` da especificação.
- [ ] **PL-05 — Assistente de relatórios fundamentados em registros** — Baixa / futuro. Requisitos e critérios de aceite: seção `PL-05` da especificação.

## Revisão após os testes de agenda — 23/10/2026

- [ ] **Revisão de agenda, onboarding, Google e sala — discutir antes de implementar** — lista completa `REV-01` a `REV-12` em [docs/review-agenda-sala-onboarding.md](docs/review-agenda-sala-onboarding.md). Inclui projeção de datas, checklist opcional, OAuth, encerramento/recriação, bloqueios/órfãos Google, liberação de horários, reposições, Excalidraw, entrada/reconexão/extensão, remarcação, identidade da sala e presença/persistência. Preservar as demais prioridades; nenhuma mudança funcional nesta rodada.

### Encaminhamento da revisão de agenda e sala

- [x] **Investigar o aviso OAuth e os bloqueios Google** — marca aprovada, acesso a dados ainda em análise; duas séries de teste antigas identificadas e futuras ocorrências removidas com autorização específica, preservando o passado. Aprovação final pelo Google continua externa e pendente.
- [x] **Implementar os ajustes autorizados da revisão de agenda** — recorte de futuras aulas pelos créditos, checklist opcional, ocultação de horários encerrados sem excluir histórico, disponibilidade ampliada/agrupada, modal de reposição, quadro maior com fonte e registro para reconexão. Código e migração validados; ver [registro da revisão](docs/review-agenda-sala-onboarding.md) para publicação e limites de QA.
- [x] **Definir histórico de aulas diante de mudanças de plano e horário** — discutir antes de implementar: projeções futuras sob demanda e ocorrências passadas consolidadas com retrato dos dados. Considerar upgrade/downgrade, exclusão de origem, encerramento/recriação, correções e auditoria. Não reescrever retroativamente o histórico. Incluir confirmação técnica de entrada, identidade da aula dentro do pacote e aba Histórico no perfil do aluno, agrupada por mês/pacote; participação não confirma sozinha realização ou débito, e reconexões não podem duplicar registros.

- [x] **Persistir ocorrências e separar o histórico de aulas** — 24/10/2026. UUID, data, horário, duração, plano/pacote e posição do crédito preservados; captura antes de mudanças e no callback de entrada, correções auditadas e aba Histórico. Ver [regras e limites](docs/lesson-history.md). Não confundir entrada técnica com confirmação de realização.


### Limite físico de arquivo do provedor

- [ ] **Liberar 100 MB por arquivo no Pro após ampliar o provedor** — revisão de publicação em 24/10/2026 confirmou Supabase Free com teto global fixo de 50 MB. Aplicação/SQL passam a respeitar 50 MB efetivos para impedir erro de upload; Essencial continua 20 MB. Avaliar o custo do upgrade e, depois de autorizado/ativado, ampliar o teto global, `PROVIDER_MAX_FILE_BYTES` e a função SQL, testar arquivo entre 50 e 100 MB e atualizar a matriz. Não marcar como concluído pelo teto do bucket: o global tem precedência.
