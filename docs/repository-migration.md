# Migração do repositório para Mosaic Labs

Em 21/10/2026, o código do Lessonara passou a usar [mosaiclabsco/lessonara](https://github.com/mosaiclabsco/lessonara) como repositório principal. O destino estava vazio. A cópia preservou os 65 commits anteriores sem squash, rebase ou alteração de autoria, além das quatro tags `desktop-v0.1.0` até `desktop-v0.3.1` com os mesmos objetos Git.

## Git e arquivos locais

- `origin` aponta para o repositório da organização.
- A origem anterior permanece disponível pelo remoto `legacy`, sem apagar ou sobrescrever seu conteúdo.
- Foi criado um mirror de segurança antes da cópia. Branches/tags foram enviadas sem force push e conferidas pelos identificadores.
- Alterações locais não commitadas foram preservadas. Em particular, a migração administrativa `0026_platform_management.sql` e seu script de verificação permanecem trabalho em desenvolvimento; não foram aplicados em produção nem incluídos no deploy de validação.
- Não havia issues/PRs, segredos de Actions ou webhooks tradicionais de repositório para migrar. A integração da Vercel usa a aplicação Git, reconectada separadamente.

## Desktop

As quatro releases e os sete arquivos de instaladores/checksums foram copiados mantendo nomes, descrições e classificação de pré-release. Cada arquivo foi conferido por tamanho e SHA256 antes de publicar a release correspondente. Os timestamps e identificadores das releases são novos; os commits e tags continuam originais.

O repositório separado de downloads públicos e os links já usados pelo produto permanecem funcionando. Mudar o repositório de código não exige invalidar esses downloads.

## Vercel e produção

A integração Git do projeto existente foi alterada para `mosaiclabsco/lessonara`, branch `main`. O usuário tornou o novo repositório público; isso permite sua conexão ao plano Hobby atual. Nenhuma mudança de plano ou cobrança foi realizada.

Foram preservados o projeto, histórico de deploys, variáveis de ambiente e os domínios existentes. A publicação de validação usou o commit `3936046633b20f2e6bc5ce143b4e951a92d3deff` diretamente do novo repositório, sem enviar a árvore de trabalho local. O deploy ficou `READY`, com aliases de produção atribuídos. O login em `https://lessonara.mosaic-labs.co/login` respondeu HTTP 200.

O banco, Auth, filas, Vault e integrações de email/Google não foram movidos ou recriados nesta operação. A configuração de região `gru1` continua em `vercel.json`.

## Próximas publicações

Usar `origin/main` na organização. Releases do workflow Windows passam a usar o novo repositório por meio de `github.repository`. Credenciais locais, diretório `.vercel/` e `.env.local` permanecem fora do Git.

O portal administrativo Mosaic Labs é um projeto separado, ainda em desenvolvimento local. Sua reformulação visual e a correção de login não foram publicadas no Lessonara como parte desta migração.
