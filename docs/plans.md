# Planos, permissões e limites

Estado: publicado em 24/10/2026. Migrações 0030/0031/0032 aplicadas; deploys Lessonara/admin READY. O limite efetivo de arquivo segue o Supabase Free (50 MB), conforme escolha do proprietário. QA de fluxos externos continua separado da publicação.

A assinatura é do professor. Pacotes pagos pelos alunos são outro domínio: trocar Essencial/Plus/Pro não altera créditos nem pagamentos de aulas.

## Recursos implementados

| Recurso | Essencial | Plus | Pro | Pronto | Tratamento por plano / autorização |
| --- | --- | --- | --- | --- | --- |
| Perfil e cadastro de alunos | Sim | Sim | Sim | Sim | Sessão de professor e isolamento por tenant |
| Agenda fixa e datas avulsas | Sim | Sim | Sim | Sim | Sessão, vínculo e conflitos no servidor/banco |
| Histórico de aulas e vínculo ao pacote | Sim | Sim | Sim | Sim | Histórico privado, identidade preservada |
| Pacotes, saldo e pagamentos manuais | Sim | Sim | Sim | Sim | Somente professor responsável |
| Portal do aluno e acesso por código | Sim | Sim | Sim | Sim | Sessão, vínculo e versão de acesso |
| Pix do professor e “Já paguei” | Sim | Sim | Sim | Sim | Créditos após confirmação do professor |
| Cobrança manual pelo WhatsApp | Sim | Sim | Sim | Sim | Dados da própria conta |
| Financeiro e recebimentos | Sim | Sim | Sim | Sim | Dados da própria conta |
| Recibo individual em PDF | Sim | Sim | Sim | Sim | Professor responsável ou aluno dono do pagamento |
| Exportação por período em CSV/XLSX/PDF | — | Sim | Sim | Sim | Endpoint verifica plano e tenant no servidor |
| Atividades e entrega de arquivos | Sim | Sim | Sim | Sim | Aluno associado; cota do professor |
| Biblioteca e compartilhamento privado | Sim | Sim | Sim | Sim | Reserva, cota, autorização e validade |
| Feriados e consumo de crédito | Sim | Sim | Sim | Sim | Regras por professor, preservando histórico |
| Central “O que preciso resolver” | Sim | Sim | Sim | Sim | Categorias premium omitidas e não consultadas sem direito |
| Importação guiada e assistida | — | Sim | Sim | Sim | Aplicação e RPC privada de importação |
| Google Calendar e links Meet | — | Sim | Sim | Sim | UI, OAuth, actions, leitura de tokens e worker |
| Avisos de renovação por email | — | Sim | Sim | Sim | Plano no enfileiramento e antes do envio; preferência do aluno |
| Gestão de envios e falhas de email | — | Sim | Sim | Sim | Navegação, página, actions e RLS |
| Campanhas de email | — | Sim | Sim | Sim | RPC, limites, supressão e opt-out promocional |
| Lembretes de horário por email | — | — | Sim | Sim | Pro no servidor/SQL; aula atual revalidada e opt-out operacional |
| Sala integrada no navegador e desktop | — | — | Sim | Sim | Autorização no servidor antes do token de sala |
| Quadro e ferramentas de anotação | — | — | Sim | Sim | Acesso vinculado à sala autorizada |
| Armazenamento total | 1 GB | 5 GB | 10 GB | Sim | Reserva serializada no banco; documentos e entregas compartilham cota |
| Tamanho máximo por arquivo | 20 MB | 50 MB | 50 MB¹ | Sim | Cliente, servidor e banco; teto do bucket 100 MB |
| Upload em partes com progresso e retomada | Sim | Sim | Sim | Sim | Token assinado para um caminho reservado; mesmos limites por plano |

Exportação é uma conveniência de formato para dados que o professor já pode consultar. A restrição protege o endpoint; não tenta impedir alguém de copiar seus próprios dados manualmente.

## Como as permissões funcionam

- Fonte de aplicação: `src/lib/platform-plans.ts`, com capacidades explícitas e limites; não há papel “Pro” enviado pelo navegador para conceder acesso.
- Apresentação: provider e `hasPlatformFeature` ocultam controles indisponíveis. Isso não é uma barreira de segurança.
- Servidor: `requireUser` autentica; `requirePlatformFeature` e `loadTeacherPlan` usam o plano do professor no banco. Downloads verificam tenant e vínculo antes de buscar o arquivo.
- Banco: RLS mantém isolamento e sessão válida; políticas restritivas adicionais limitam emails e Calendar. RPCs de importação/campanha e enfileiramento também verificam o direito. A matriz SQL privada tem teste de paridade com a aplicação.
- Alteração do plano: o gatilho recusa mudança por `anon`/`authenticated`, inclusive sem `sub`. A administração conserva seu fluxo auditado. Alterar HTML, query string, provider ou localStorage não modifica o plano autoritativo.
- Jobs: verificam novamente o plano ao processar trabalho já enfileirado. Uma aula cancelada/remarcada invalida o lembrete antigo; opt-out também é revalidado antes do envio.
- Downloads: não recebem `teacher_id` do cliente como autorização; recibo de aluno exige sessão vinculada ao aluno e pagamento daquele cadastro. Não se publica PDF/planilha em storage público.

## Recibos e exportações

Recibo é individual, com professor, aluno, data recebida, quantidade de aulas, valor e referência integral do pagamento. Professor baixa no perfil do aluno ou no Financeiro; aluno baixa em Histórico e pacotes. O recibo reflete os registros atuais quando gerado; não é um documento assinado nem um snapshot imutável de emissão.

A exportação do professor é um relatório de recebimentos por mês ou ano: CSV para integração, XLSX com cabeçalho/valores numéricos/filtro e PDF paginado para leitura e impressão. Não é outro recibo. Exclui pagamentos futuros e valores negativos, como a tela financeira. Limite de 10 mil registros por solicitação; períodos grandes devem ser divididos.

CSV neutraliza fórmulas em campos textuais; XLSX usa strings inline para nomes e números reais para valores. Downloads têm cache privado desabilitado e validação de parâmetros no servidor.

## Lembretes e preferências

O cron Pro procura aulas pagas nos próximos 60 minutos, em páginas de 100 alunos com cursor, retomando em chamadas subsequentes quando necessário. Uma execução drena até 20 páginas/20 segundos; o cron roda a cada cinco minutos. Não existe promessa de horário exato: atrasos do agendador/provedor reduzem a antecedência. Emails expiram no início da aula e passam pelo limite de tentativas e idempotência da fila existente.

No menu Emails do portal do aluno há duas escolhas por vínculo: lembretes/renovação e comunicados promocionais. Desativar avisos operacionais impede novos lembretes de aula e renovação, inclusive jobs preparados. Códigos/convites de acesso continuam disponíveis.

Com 30 alunos e duas aulas semanais por aluno, são 60 lembretes por semana, aproximadamente 260 por mês (52 semanas / 12), além de convites, códigos, renovações e campanhas. Monitorar volume no provedor antes de ampliar o piloto.

## Upload e cotas

Supabase recomenda TUS para arquivos acima de 6 MB, instabilidade e progresso: [documentação oficial](https://supabase.com/docs/guides/storage/uploads/resumable-uploads). O app usa chunks de 6 MB e o hostname direto de Storage, liberado especificamente na CSP. O arquivo vai do navegador ao Storage, sem atravessar o corpo de uma Server Action.

O painel fixo permite acompanhar percentual, pausar, retomar e descartar. Persiste ao navegar pelo app na mesma aba. Fechar/recarregar a aba interrompe; a página avisa e o navegador pode pedir confirmação. Não se promete envio em segundo plano com navegador fechado nem retomada automática após recarregar. Dentro da mesma sessão, o TUS retoma as partes confirmadas após falhas de rede, com retentativas finitas. Tokens assinados expiram conforme o provedor; se expirarem, descarte e selecione o arquivo novamente.

Uma reserva serializada contabiliza o tamanho esperado e há no máximo três reservas incompletas por professor. Identidade, caminho, tipo e tamanho da reserva não podem ser alterados para reduzir a cota depois. A confirmação verifica o tamanho e tipo reais e o gatilho do banco verifica o objeto existente; arquivos incompletos não são disponibilizados ao aluno. Arquivos antigos não são apagados em downgrade; novos envios obedecem aos limites atuais.

O token assinado permite gravar em um caminho, mas não embute a cota individual do plano. O teto do bucket limita o tamanho físico a 100 MB; a confirmação recusa divergência da reserva. Isso exige acompanhar reservas/objetos incompletos e uso físico no provedor: a cota lógica não substitui monitoramento de Storage. Não alteramos o schema gerenciado `storage.objects`.

Na publicação, conferir também o limite global do projeto Supabase: ele pode ser menor que o teto configurado no bucket. Sem essa validação, não declarar envio de 100 MB comprovado em produção.

## Propostas ainda não implementadas

Estes itens ficam no backlog e não devem ser anunciados como disponíveis:

- Speaking: atividade de áudio, gravação/upload, feedback e histórico de tentativas.
- LearningGap: catálogo de habilidades, avaliação por habilidade, painel de evolução e sugestões com evidências.
- ProgressLetter: relatórios revisados pelo professor, PDF pedagógico, publicação no portal e comparação entre períodos.
- Logo/apresentação personalizada da professora e relatórios com sua identidade.
- Política configurável de antecedência e desmarcação solicitada pelo aluno com consequência de crédito.
- IA para speaking, revisão espaçada e relatórios, após validação dos fluxos manuais.

Proposta de destino para os módulos pedagógicos e identidade: Pro. Ainda não há componentes/flags ativas que os liberem, porque não foram implementados. A especificação completa permanece em `docs/learning-modules.md` e as tarefas em `TASKS.md`.

## Entrega e validação

Publicação autorizada e concluída em 24/10/2026. Migrações 0030/0031/0032 e do admin foram aplicadas antes do código; os agendamentos foram ativados após os deploys READY. Foram confirmadas respostas 200 dos cinco workers pelo Vault/pg_net, execuções automáticas e download PDF autenticado. Os cenários externos elegíveis/QA manual continuam registrados no backlog.

Testes locais não substituem um novo pentest ou testes reais com Google/Resend/Storage. As amostras dos arquivos e os testes de protocolo usam dados fictícios e servidor local, sem envio em produção.


¹ **Limite efetivo confirmado no provedor em 24/10/2026:** Supabase Free fixa o limite global em 50 MB. O direito de produto Pro permanece planejado em 100 MB, mas interface, servidor e SQL usam 50 MB enquanto o provedor não for ampliado. Migração `0032_storage_provider_ceiling.sql`. Nenhuma assinatura paga foi contratada nesta publicação. Elevar para 100 MB exige primeiro ampliar o limite real do provedor e então atualizar o teto efetivo da aplicação/SQL.

### Renovação no portal do aluno

Pix permanece disponível nos três planos, com autenticação e autorização no servidor. O resumo oferece renovação quando o saldo chega a uma aula ou menos. A antecipação fica em Histórico e pacotes, independentemente do saldo. Preparação, QR Code, copia-e-cola e aviso de pagamento ficam em modal; fechar o modal preserva a solicitação. Nenhum crédito é liberado sem confirmação do professor.

### Convite e definição de senha do professor

Disponíveis no Essencial, Plus e Pro como parte da autenticação. Criação e reenvio exigem administrador no backend. O plano inicial vem do cadastro comercial validado no servidor e é aplicado pelo fluxo administrativo autoritativo. Reenvio/recuperação de conta existente preservam plano, dados e cobrança. O destinatário escolhe a senha; links são temporários e de uso único. O recurso não habilita emails promocionais ou lembretes nos planos sem esses benefícios.

A unicidade de emails é regra de identidade comum a todos os planos: professor único no produto; aluno único por professor, incluindo inativos. Ela não restringe o mesmo aluno a um único professor.

## Preferências de email e proteção de downloads

Todos os alunos podem configurar separadamente lembretes de aula, avisos de renovação e campanhas; isso não concede funcionalidades ao professor. Aula continua exclusiva Pro; renovação/campanhas seguem Plus/Pro. A migração 0036 copia a opção operacional anterior para as duas opções novas. Preparação SQL/worker e envio revalidam o tipo de preferência, o plano e o vínculo do aluno, inclusive em retry. O lembrete é preparado na janela de uma hora antes da aula; a renovação depende do saldo do pacote, não de dias fixos.

Recibos básicos continuam em todos os planos e somente para o próprio tenant/aluno. Exportações financeiras continuam Plus/Pro. A migração 0037 acrescenta um contador persistente exclusivo do servidor para impedir geração/emissão repetitiva. As rotas retornam 429 e Retry-After com o tempo real de espera, ou 503 se o contador estiver indisponível; a autorização é mantida antes de emitir arquivos.

- Recibo: mesmo recibo a cada 10 s; até 10/min e 60/h por identidade. Botão mostra preparação e pausa de 10 s após sucesso; recarregar/trocar URL não elimina o limite do servidor.
- Exportação CSV/XLSX/PDF: mesma combinação período/formato a cada 10 s; até 6/min e 30/h por professor.
- Documentos, materiais, arquivos de atividade/feedback e arquivo original de importação: mesma chave a cada 3 s; até 30/min e 300/h por identidade. A emissão dos links é limitada; URLs assinadas já emitidas continuam válidas por sua curta duração, e arquivos já salvos pertencem ao usuário. O visualizador da sala usa seu fluxo próprio de material e não recebe limitação de chunks de PDF.

Login já possui limites persistentes por conta/IP/par: professor 20 por conta, 60 por IP e 10 por par a cada 15 min; solicitação do código do aluno 5/h por email e espera de 5 min, 20/h por IP e limite global 100/h. A verificação limita a cinco tentativas por código. Esses controles foram preservados; não há alteração de sessões ou planos.

Validação de 28/10/2026: suíte com 476 testes, lint, formatação e build aprovados. QA visual local conferiu calendário claro/escuro, tooltips, alinhamento, escolhas independentes e botão com pausa/reativação. Migrações 0036/0037 aplicadas; contador de produção validado com chave sintética removida após a checagem, sem afetar cota real; acesso anônimo negado. Nenhum email real foi disparado no QA.

### Histórico e suporte administrativo (2026-10-28)
Pacotes, reconstrução retroativa e correções manuais estão disponíveis em todos os planos. Data do pagamento não altera automaticamente os horários: o professor confirma a reconstrução usando a agenda atual desde a data inicial, limitada aos últimos dois anos. Registros retroativos e manuais são presumidos e mantêm sua origem visível, sem afirmar presença. A gestão permite marcar dada/falta/desconsiderar, com auditoria; para mudar data/hora, desconsiderar e lançar a aula correta. Feriados e exceções continuam aplicados. A alocação usa a ordem cronológica das aulas e dos pagamentos; pacotes antecipados cobrem os próximos créditos livres. Remoção via RPC preserva as aulas, registra o pagamento removido em tabela privada e recalcula créditos; remoção direta de pagamento usado continua bloqueada.

Acessar como exige sessão administrativa, operador habilitado na origem e confirmação no email do administrador. Desafio vinculado à sessão e professor: 5 minutos, até 5 tentativas, intervalo mínimo de 1 minuto e 10 desafios/hora. Token opaco de uso único em fragmento, válido por 2 minutos; somente POST explícito inicia sessão. Sessão de suporte dura até 15 minutos, preserva RLS/tenant e plano real, possui faixa identificada e encerramento próprio. O token inicial de autenticação não sai do servidor; um refresh com prazo reduzido precede a gravação de cookies. Suspensão/revogação e expiração são verificadas no banco e na renovação; mapeamentos consumidos são mantidos como auditoria. A sessão do Lessonara neste navegador é substituída; as demais sessões da professora não são encerradas.

Planos recorrentes exigem ao menos um horário fixo vigente antes de registrar novo pacote. A trava é aplicada pela UI e por trigger no banco, inclusive em inserções diretas e confirmação de Pix. Planos flexíveis permitem pagamento anterior ao agendamento. Pagamentos anteriores à implantação da trava são preservados.

Validação: backup privado #11 (2026-10-28), testes de retroatividade/idempotência/correções/remover pagamento, isolamento e expiração; QA móvel a 390 px sem transbordamento, modal, foco e fechamento externo/por navegação. Migração 0038 aplicada e seis aulas do cadastro com agenda reconstruídas desde 08/10, marcadas retroativas/presumidas. O cadastro sem agenda não foi reconstruído. Migrações 0038, 0039 e 0040 aplicadas. Publicação coordenada dos dois portais inclui a trava de horário e o acesso temporário aprovado. Resgate de suporte tem limite adicional de 20 tentativas/minuto por IP, sem registrar IPs/códigos/tokens em auditoria. Solicitação e autorização aparecem no histórico administrativo da conta. O last_sign_in_at do Supabase inclui sessões de suporte; não é prova isolada de login realizado pessoalmente pelo professor.

### Endereços curtos dos alunos
Em todos os planos, o portal permanente abre diretamente em `/a/<slug>`; slug globalmente único apenas identifica o cadastro e não substitui sessão/vínculo. O servidor resolve o professor, valida aluno ativo e a autorização continua vinculada ao aluno e à versão de acesso. Links antigos com professor validam a combinação antes de redirecionar ao endereço curto. Convites de primeiro acesso usam `/i/<token>`, preservando a validade de 24 horas, uso único e ativação por POST; após ativar, o destino é o portal curto. Emails, copiar link, mensagens de cobrança e retorno da sala usam o endereço permanente. Nenhum encurtador externo ou redução de entropia de tokens.

### Ajustes móveis e feedback de downloads — 28/10/2026

Onboarding manual, menu móvel, encerramento de horário em modal, seletores de arquivo e disponibilidade com dia/data respeitam os planos e vínculos existentes. Importação e exportação continuam exclusivas de Plus/Pro; recibos e apresentação clara de emails estão em todos os planos. Downloads CSV/XLSX/PDF exibem preparação e pausa de 10 segundos após sucesso; respostas 429 usam o prazo real de Retry-After. Verificações autoritativas de sessão, plano e tenant continuam nas rotas existentes. Mudanças apenas de apresentação não alteram permissões, cobrança ou registros de aulas.
