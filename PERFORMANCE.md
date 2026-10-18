# Desempenho do portal

## Execução e acesso a dados

- Funções da Vercel executam em São Paulo (`gru1`), perto do Supabase (`sa-east-1`). A configuração está versionada em `vercel.json` e exige um novo deploy.
- `requireUser` valida a sessão e a existência do professor e retorna seu perfil. `React.cache` reutiliza esse resultado somente dentro da requisição/renderização; não é cache global de dados de usuários.
- Nome, plano da plataforma e configuração inicial devem reutilizar esse perfil. Não consultar novamente `teachers` para cada consumidor.
- Iniciar leituras independentes em paralelo. Paginação continua sequencial por necessidade e todas as consultas preservam o escopo do professor/RLS.
- A visão de alunos precisa do saldo e da próxima aula; não remover agenda/pacotes/exceções necessários ao cálculo. Reutilizar os vínculos de alunos já carregados pelo servidor ao chamar `loadLedgers`.
- Alunos, pagamentos e calendário preparam somente suas respectivas projeções. Configurações busca os dados da aba ativa (`?tab=`); a prévia de sincronização só é calculada ao abrir a integração Google.

## Medições

`src/lib/performance.ts` registra JSON no servidor com `event=performance`, `request_id`, `stage`, `duration_ms`, `elapsed_ms`, `outcome` e `region`. O identificador agrupa etapas da mesma renderização RSC. Não é um trace distribuído completo entre serviços.

Etapas: `auth.session`, `auth.teacher`, `supabase.<tabela/RPC>`, `overview.students`, `ledger.reads`, `ledger.compute`, `overview.directory/payments/calendar`, `settings.page`, `settings.<aba>` e `google.preview`.

- `supabase.*` mede a chamada HTTP até receber os headers; as etapas de leitura incluem também a desserialização dos resultados.
- Etapas podem se sobrepor. Não somar durações de consultas paralelas para obter o tempo total.
- `settings.page` prepara a estrutura; o conteúdo da aba tem sua própria etapa. Usar o tempo completo da função na Vercel para avaliar a resposta inteira.
- `outcome=ok` significa que a operação instrumentada retornou; respostas de erro HTTP podem retornar normalmente e devem ser avaliadas também pelos erros da aplicação.
- URLs, filtros, identificadores de alunos, cookies, tokens, corpos e mensagens de erro não são registrados por este módulo.
- Definir `PERFORMANCE_LOGGING=false` desabilita a saída. Não usar cache global para melhorar artificialmente medições de dados privados.

## Referência anterior às alterações

Produção, 17/10/2026 às 23:42 (São Paulo), versão `bc8b817`, conta de teste com quatro alunos:

| Tela | Duração da função | Resposta completa |
| --- | ---: | ---: |
| Alunos | 1,90 s | 2,1 s |
| Configurações | 2,87 s | 3,1 s |

A requisição de Alunos registrou 13 chamadas externas ao Supabase, incluindo quatro leituras de professor e duas de alunos. Função em `iad1`, banco em `sa-east-1`. São amostras pontuais dos logs, não percentis ou benchmark de carga. Comparar respostas completas com respostas completas; uma resposta estática/parcial inicial não significa que os dados já chegaram.

## Resultado observado após as alterações

Produção em `gru1`, versão `907b2af`, 18/10/2026 entre 00:09 e 00:12 (São Paulo), mesmos quatro alunos. Verificado no painel de Runtime Logs da Vercel.

| Requisição | Duração da função | Resposta completa | Observação |
| --- | ---: | ---: | --- |
| Alunos, primeiro acesso após deploy | 808 ms | 1,9 s | Middleware: 705 ms; houve busca de chaves públicas de autenticação |
| Alunos, navegação seguinte | 240 ms | 445 ms | Middleware: 12 ms; nove consultas REST ao banco |
| Configurações/Geral, primeiro GET de navegação | 212 ms | 660 ms | Middleware: 392 ms; duas consultas REST ao banco |
| Configurações/Geral, navegação seguinte (POST de continuação RSC) | 111 ms | 149 ms | Middleware: 10 ms; dados novamente consultados |

Amostra instrumentada da navegação de Alunos às 00:12:16:

| Etapa | Duração |
| --- | ---: |
| Validação da sessão | 2 ms |
| Leitura/autorização do professor | 55 ms |
| Leitura de alunos e plano associado | 88 ms |
| Leituras paralelas de agenda, pacotes, exceções e feriados | 78 ms |
| Cálculo dos saldos | 2 ms |
| Visão de alunos completa | 227 ms |

A verificação inicial de existência de plano ativo ocorreu em paralelo à consulta de alunos. Os nove acessos REST foram: professor, plano ativo, alunos, horários, pacotes, eventos, agendamentos avulsos, regras de feriado e feriados. Antes eram 13, com quatro leituras de professor e duas de alunos.

As seis abas de Configurações e a abertura do detalhe Google foram conferidas em produção sem salvar formulários ou disparar sincronização. A prévia Google só apareceu nos logs ao abrir seu detalhe (271 ms nessa amostra).

Essas amostras confirmam redução do trabalho e do tempo de navegação, mas não constituem teste de carga nem garantia de latência. O primeiro acesso após deploy ainda variou devido à inicialização/autenticação. Manter essa diferença visível ao avaliar novas alterações.
