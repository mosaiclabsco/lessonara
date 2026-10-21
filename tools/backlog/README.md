# Leitor local do backlog

Na raiz do repositório:

```sh
node tools/backlog/server.mjs
```

Abra **http://127.0.0.1:4317**. Não exige instalação de dependências, login ou conexão com produção. Encerre com Ctrl+C. Para outra porta, use `BACKLOG_PORT=4318 node tools/backlog/server.mjs`.

Lê as tarefas com checkbox de `TASKS.md`, incluindo seção, descrição e detalhes. Busque, filtre, escolha a prioridade e arraste pela alça ou use as setas em **Minha ordem**. **Copiar ordem** copia a visão filtrada. **Atualizar** relê o Markdown e recupera as preferências salvas. Status de conclusão vem do Markdown e não é editado por este leitor.

As escolhas ficam em `.local/backlog-priorities.json`, fora do controle de versão. Para trabalhar nas prioridades, ler esse arquivo junto de `TASKS.md`: `order` contém IDs ordenados; `priorities` associa IDs a `high`, `medium`, `low` ou `none`. Os IDs são calculados a partir do título, estáveis enquanto ele não mudar; tarefas novas entram no final. Renomear um título gera outro ID e descarta a preferência anterior desse item.

Servidor restrito a `127.0.0.1`, com validação de origem e host nas gravações. Não faz parte das rotas Next.js nem do build/publicação do produto. Não usa banco, Supabase ou emails. Alterar prioridade/ordem não edita o Markdown; o arquivo JSON é compartilhado pelas abas deste computador, com proteção contra sobrescrita de edições concorrentes.
