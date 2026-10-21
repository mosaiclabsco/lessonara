# Conectar Google Calendar e Meet ao Lessonara

A integração está implementada no backend, por professor. Há registro de conexão e uso em outubro de 2026; novas contas precisam realizar o próprio OAuth. Ela usa a agenda principal, duração definida em cada agendamento e o fuso de São Paulo. Tokens são criptografados no banco e nunca enviados ao navegador.

1. No Google Cloud Console, crie ou selecione um projeto e habilite a **Google Calendar API**.
2. Em Google Auth Platform, configure a marca do aplicativo e o público. Durante os testes, adicione seu email à lista de usuários de teste.
3. Em Acesso a dados, inclua os escopos `https://www.googleapis.com/auth/calendar.events` e `https://www.googleapis.com/auth/calendar.freebusy`.
4. Crie um cliente OAuth do tipo **Aplicativo da Web**. Cadastre exatamente estas URIs de redirecionamento:
   - Produção: `https://lessonara.mosaic-labs.co/integrations/google/callback`
   - Desenvolvimento, se for testar localmente: `http://localhost:3001/integrations/google/callback`
5. Guarde `GOOGLE_CLIENT_ID` e `GOOGLE_CLIENT_SECRET` como variáveis do servidor na Vercel e no `.env.local`. Não use prefixo `NEXT_PUBLIC_` e não envie o segredo pelo chat. `APP_URL` deve apontar para o ambiente correto.
6. Depois de publicar essas variáveis, entre no Lessonara como professor e abra **Configurações → Integrações → Conectar Google**. Escolha a conta e confirme as permissões no Google.
7. Use **Importar aulas existentes** / **Processar pendências** para importar os agendamentos existentes. O processamento é feito em lotes; repetir o botão processa as pendências sem duplicar eventos já sincronizados. Novos agendamentos são enviados após a resposta do app.
8. Confirme a criação de um evento com Meet e teste um horário ocupado. A mini agenda mostra nomes das aulas do Lessonara; compromissos pessoais do Google aparecem apenas como ocupado.

## Comportamento e operação

- Eventos e links Meet são vinculados ao professor que conectou a conta. O aluno vê o link na próxima aula e nas listas de aulas.
- Dias fixos semanais e mensais usam eventos recorrentes. Dias que não existem em um mês não geram ocorrência. Aulas avulsas e reposições usam eventos individuais.
- Desmarcações e feriados cadastrados são excluídos das recorrências sincronizadas.
- A fila tem lease, versão, id estável no Google e até cinco tentativas. Isso evita duplicação e protege alterações feitas enquanto uma sincronização está em andamento.
- O worker protegido `/api/cron/emails` também processa a agenda. O Supabase Cron o chama a cada cinco minutos, com defasagem em relação ao worker de lembretes. A configuração está em `supabase/operations/schedule-workers.sql`; o segredo vem do Vault e não deve ser copiado para documentos.
- Desconectar revoga os tokens e para futuras sincronizações. Eventos já criados permanecem no Google; não são apagados por uma desconexão.
- A consulta de disponibilidade descreve o estado no momento da leitura; alterações feitas diretamente no Google continuam sob controle da conta conectada.
- Em produção, conclua os requisitos de publicação/verificação do OAuth no Google antes de abrir a integração a todos os professores. O Google pode limitar autorizações e validade de tokens no modo de teste.

Documentação oficial: [OAuth para aplicações web](https://developers.google.com/identity/protocols/oauth2/web-server), [criação de eventos e conferências](https://developers.google.com/workspace/calendar/api/v3/reference/events/insert), [consulta de disponibilidade](https://developers.google.com/workspace/calendar/api/v3/reference/freebusy/query).

A importação exige confirmação: cria eventos reais e pode enviar convites aos alunos. Eventos recorrentes compartilham um link Meet; aulas avulsas e reposições têm eventos separados. O botão não aparece habilitado quando a fila e a importação não têm pendências.

## Limite da confirmação atual

Conexão e processamento técnico de fila têm evidências anteriores; isso não substitui o QA completo de criar evento/Meet, alterar e cancelar uma aula real autorizada após as alterações de segurança. Esse cenário continua no [checklist de QA](qa-pendente.md). O estado atual da verificação OAuth no console do Google também exige consulta ao provedor; não inferir aprovação somente porque um token funciona.

Conferência de 20/10/2026: uma conexão armazenada sem erro, 14 jobs em `sent`, nenhum `pending`/`sending`/`failed`, e consulta real `freeBusy` bem-sucedida usando a conexão existente. Não foram criados eventos nem enviados convites nessa conferência.
