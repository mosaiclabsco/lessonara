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
