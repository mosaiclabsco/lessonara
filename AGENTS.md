Leia `STYLE_GUIDE.md` antes de alterar interfaces. Reutilize os componentes compartilhados e valide os portais do professor e do aluno.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Rastreamento de trabalho

Para trabalho com múltiplos itens, registrar o escopo ativo em `doing.md` antes de implementar. Manter checklist, decisões, validações e bloqueios atualizados por item, inclusive após retomada de contexto. Ao concluir o escopo autorizado, limpar o conteúdo de `doing.md`; pendências futuras e validação de produção ficam em `TASKS.md`, sem marcar como entregues por inferência. Não publicar quando a sessão restringir publicação.

## Autorização por plano

Toda feature deve declarar planos elegíveis e limites em `src/lib/platform-plans.ts` e documentar a decisão em `docs/plans.md`. A interface consome essa definição apenas para apresentação; segurança exige verificar o plano autoritativo do professor no servidor, autenticação, vínculo e isolamento por tenant em páginas, actions, APIs, downloads e workers. Não aceitar plano, papel ou teacher_id enviados pelo cliente como autorização. Replicar invariantes necessários nas RPCs/RLS/Storage; alterações de plano somente pelo fluxo administrativo autorizado. Testar acesso direto negado, outro tenant, downgrade com trabalho já na fila e concorrência de cotas. Flags de UI/localStorage não concedem direitos. Documentar migrações e publicação separadamente da implementação local.
