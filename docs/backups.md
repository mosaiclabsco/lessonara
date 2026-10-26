# Backup e recuperação do Lessonara

## Escopo e operação

A automação está em `.github/workflows/backup.yml` e `scripts/backup/`. É proteção operacional de todos os professores, independentemente do plano comercial; não concede funcionalidades ou acesso ao portal. O ambiente GitHub `production-backup` aceita somente a branch `main`, com permissões `contents: read`. Não há execução com segredos em pull requests ou forks.

- Backup diário previsto para 03h17 de Brasília (06h17 UTC). O GitHub pode atrasar agendamentos.
- Verificação adicional às 09h47 de Brasília: falha se não existir snapshot verificado nas últimas 30 horas.
- Destino: bucket Cloudflare R2 `lessonara-backups`, Standard, sem domínio público nem acesso `r2.dev`.
- Restic criptografa e autentica dados e metadados antes de enviá-los ao R2. A senha não fica no bucket ou no Git.
- Retenção das últimas 14 cópias verificadas. A limpeza só acontece após exportação, upload e leitura de volta com conferência dos hashes. Execuções manuais também contam para essas 14 cópias; não são necessariamente 14 dias se houver várias execuções no mesmo dia.
- Objetos sem alteração são recuperados da cópia anterior e reutilizados. Apenas objetos novos, alterados ou com hash local inválido são novamente baixados do Supabase. Há transferência do banco inteiro a cada exportação.
- Concorrência única no Actions e lease de duas horas no banco; timeout de 90 minutos no workflow. Execuções interrompidas não são declaradas concluídas.

## Conteúdo de cada snapshot

- `database.dump`: schemas da aplicação (`public`, `private` e histórico de migrações, quando existente), dados, funções, índices, constraints, RLS e grants. Exportado por `pg_dump` sob um snapshot de leitura consistente.
- `auth.json`: dados das tabelas gerenciadas do Auth, incluindo identidades e informações sensíveis de autenticação. Exportação consistente na mesma transação por função privada, autorizada expressamente por Gabriel em 25/10/2026. Não representa a configuração administrativa do provedor.
- `storage-metadata.dump`: dados de buckets e objetos. Tabelas internas de multipart, analytics e vetores não usadas pelo produto não são copiadas.
- `storage/`: bytes de cada objeto, com nomes locais derivados por hash para impedir escape de diretório por uma chave de objeto. O manifesto preserva o caminho original dentro do snapshot criptografado.
- `platform-hooks.sql`: triggers customizados em Auth/Storage e políticas de Storage que precisam acompanhar a aplicação.
- `platform.json`: inventário de extensões e nomes de roles, sem suas senhas.
- `vault.json`: entradas do Vault inventariadas, provenientes da configuração de recuperação já criptografada no snapshot anterior. A conta de backup não recebe acesso ao Vault nem sua descriptografia. Hoje existe somente `lessonara_cron_secret`. Uma entrada nova no Vault exige atualizar o inventário e gerar um novo snapshot de bootstrap criptografado antes de considerar sua recuperação coberta.
- `recovery-env.json`: chaves de criptografia da aplicação e configuração necessária à recuperação, reaproveitadas do snapshot anterior. Rotacionar ou adicionar uma chave exige atualizar o bootstrap local privado, gerar um novo snapshot criptografado e validar a leitura dos envelopes. Os parâmetros `BACKUP_RECOVERY_ENV` e `BACKUP_VAULT_ENTRIES` são usados apenas nesse bootstrap manual; não ficam como segredos do GitHub. Não exporta automaticamente todas as variáveis da Vercel.
- `manifest.json`: data, versão Postgres, contagens de tabelas, lista de objetos, tamanhos e hashes de arquivos e dos arquivos auxiliares.

O banco e o Storage não compartilham uma transação distribuída. O script verifica novamente a lista e as versões dos objetos depois da cópia; uma alteração durante a captura faz a execução falhar, preservando os backups anteriores. Isso não congela os uploads nem as escritas da aplicação.

## Acessos e segredos

`supabase/operations/configure-backup.sql` configura uma conta exclusiva `lessonara_backup`, com BYPASSRLS para exportar todos os tenants, três conexões, transações somente leitura por padrão e SELECT nos schemas necessários. Não usa a senha principal do Postgres. O Supabase pode ignorar concessões diretas em schemas gerenciados; o Auth é exportado pela função `private.backup_auth_records()`, sem conceder uma role administrativa. A função não está no schema público e não pode ser executada por `anon`, `authenticated` ou `service_role`.

O modo somente leitura é uma proteção contra acidentes, não uma barreira absoluta contra funções concedidas a PUBLIC pela plataforma. Não atribuir essa conta a usuários do produto. Rotacionar a senha caso o executor seja comprometido. As credenciais R2 têm acesso a objetos somente no bucket de backup, sem administração de buckets.

O segredo do Supabase usado para baixar arquivos e registrar a execução é privilegiado: permanece somente no ambiente protegido do Actions. Não publicar dumps, arquivos, nomes de objetos, dados de Auth, chaves ou diagnósticos sensíveis como artifacts, cache, logs ou summaries de repositório público. O executor usa diretório temporário privado e remove a cópia em claro ao terminar. O primeiro snapshot é preparado manualmente e verificado antes de ativar o agendamento; sem essa semente, a execução automática falha de forma segura.

Preservar a senha Restic em um gerenciador de senhas independente do GitHub. Sem ela, não é possível descriptografar o backup. A cópia local de bootstrap está em `.local/backup-recovery/`, ignorada pelo Git e com permissões restritas; não deve ser a única cópia de recuperação.

## Monitoramento

A migração `0033_backup_operations.sql` permite registrar o job `backup` em `private.job_runs`. O sucesso significa que o snapshot foi enviado e relido com hashes válidos, não que todo o aplicativo foi restaurado naquele dia. A tela Jobs e filas do admin mostra falhas, ausência de execução recente (30 horas) e execução sem conclusão (duas horas). A consulta exige autenticação e permissão administrativa existentes.

A checagem do R2 no Actions também falha quando não encontra cópia recente. Configurar as notificações pessoais de falha do GitHub para receber seus avisos. Não há serviço externo independente de alertas: se o GitHub parar ambos os agendamentos, o admin ainda calcula o atraso quando consultado. Repositórios públicos podem ter agendamentos desativados após 60 dias sem atividade; conferir e reativar pelo GitHub quando necessário.

## Restauração de teste

`scripts/backup/restore_drill.py` aceita apenas uma base descartável em loopback, com nome começando por `lessonara_restore` e confirmação `ISOLATED_RESTORE_ACK=I_CREATED_THIS_EMPTY_LOCAL_DATABASE`. Recusa base com professores ou contas já cadastrados. Não é uma ferramenta para sobrescrever produção.

1. Baixar e descriptografar um snapshot verificado do R2 com Restic, em diretório privado.
2. Preparar Postgres Supabase compatível com a versão do manifesto, Auth e Storage vazios. Registrar as versões das imagens. Bloquear saída de rede do banco e desativar cron; não ligar workers, emails, webhooks ou calendários da cópia.
3. Instalar as dependências de `scripts/backup/requirements.txt` e um cliente Postgres compatível.
4. Executar o drill com `RESTORE_TEST_DSN` da base local. O script recria dados de Auth, restaura a aplicação e os metadados de Storage, aplica hooks e recria entradas do Vault com a chave própria do destino.
5. Conferir todas as contagens do manifesto, checksums dos bytes recuperados, correspondência com metadados e descriptografia do Vault. Registrar somente resultados agregados.
6. Encerrar e remover o ambiente temporário e os arquivos em claro.

### Recuperação real após incidente

Criar um projeto vazio, configurar versões/extensões compatíveis e seguir o procedimento de restauração do Supabase com o inventário acima. Auth e Storage são schemas gerenciados e devem estar inicializados antes da carga. Restaurar grants e políticas; arquivos precisam ser enviados ao Storage privado do destino com bucket e caminho originais. A cópia dos arquivos no disco não os publica automaticamente no novo serviço.

Reconfigurar URLs, chaves públicas/secretas do novo projeto, Auth hooks, CAPTCHA, OTP, redirects e políticas do provedor; trocar conexões no backend e no admin. Restaurar chaves antigas de criptografia da aplicação para poder ler os envelopes existentes. Recriar os segredos do Vault, nunca confiar que o ciphertext de outro projeto será descriptografado pela chave nova. Usuários podem precisar entrar novamente. Reconfigurar Google/Resend e cron somente após conferir integridade e a fila, evitando reenvios ou sincronizações duplicados. Credenciais de roles não são recuperadas pelo dump e precisam de novas senhas.

Não testar esse procedimento sobre o projeto de produção. Um drill de integridade de banco e arquivos não comprova login, vídeo, envio real de email ou Calendar ponta a ponta na infraestrutura substituta.

## Custos e limites

R2 Standard inclui 10 GB-mês, 1 milhão de operações Classe A e 10 milhões Classe B mensais; excedentes são cobrados automaticamente. Gabriel autorizou sua ativação em 25/10/2026. Não usar Infrequent Access ou expiração por lifecycle diretamente no repositório Restic (apagaria blocos compartilhados entre snapshots).

O primeiro snapshot tem banco lógico comprimido inferior a 1 MB e um arquivo de 689 bytes. Isso é pequeno perante a franquia, mas não é uma garantia de custo zero futuro. Monitorar o tamanho real do repositório, operações R2 e egress do Supabase. No Free, transferências de backup compartilham a franquia com o aplicativo; o reaproveitamento de arquivos reduz esse consumo.

## Evidências

25/10/2026: exportação real com Postgres 17.11 enviada ao R2 e baixada de volta; hashes conferidos. Drill em Postgres Supabase `17.11.0.004`, Auth `v2.197.0` e Storage `v1.79.36`, em rede Docker interna sem saída do banco. Recuperadas 67 tabelas, 1.133 registros e um arquivo de 689 bytes, com contagens completas e integridade dos arquivos verificadas. O Vault foi recriado com a chave própria do destino e o segredo corresponde ao de produção (comparação por hash, sem expor seu valor). A chave de aplicação recuperada descriptografou um envelope Google restaurado, sem chamar o Google.

O teste do fluxo de reaproveitamento também concluiu um backup sem fornecer as chaves de aplicação/Vault pelo ambiente do executor. Testes locais: 12 casos Python, quatro testes SQL de autorização/lease e 50 testes no admin. Build do admin, TypeScript e lint focados passaram. O workflow foi publicado em `eccbc4e`, com ajuste do cliente Postgres em `5c787ad`. A execução pelo GitHub Actions [40249812435](https://github.com/mosaiclabsco/lessonara/actions/runs/40249812435) concluiu exportação, criptografia, envio, leitura de volta e retenção, usando as chaves de recuperação do snapshot criptografado. Os [checks completos](https://github.com/mosaiclabsco/lessonara/actions/runs/40249810945) também passaram. O primeiro run falhou na instalação do cliente e não chegou a acessar o banco. Em 26/10/2026, a [checagem independente de cópia recente](https://github.com/mosaiclabsco/lessonara/actions/runs/40322320233) também concluiu com sucesso. O workflow está ativo; a primeira execução natural do cron ainda não foi observada. As execuções comprovadas foram disparadas manualmente pelo mesmo workflow publicado.

## Referências

- [Backups Supabase](https://supabase.com/docs/guides/platform/backups)
- [Backup e restauração](https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore)
- [Conta de backup e RLS](https://supabase.com/kb/troubleshooting/pg_dump-fails-with-query-would-be-affected-by-row-level-security-policy)
- [R2: preços](https://developers.cloudflare.com/r2/pricing/)
- [Retenção Restic](https://restic.readthedocs.io/en/stable/060_forget.html)
- [Agendamentos GitHub Actions](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows)
