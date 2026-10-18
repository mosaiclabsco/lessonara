# Lessonara Chamadas 0.3.0 — teste para Mac

O aplicativo contém login, lista de chamadas e sala. O portal e suas configurações abrem no navegador. Links lessonara:// identificam uma ocorrência, sem senha/JWT. A sessão permanece separada do navegador. Mudanças de sala exigem confirmação.

Compartilhamento usa desktopCapturer e um seletor explícito com miniaturas de telas e janelas; nunca escolhe uma fonte automaticamente. A autorização de gravação de tela do macOS continua necessária. Uma captura corresponde ao monitor ou janela selecionada; múltiplos monitores aparecem como escolhas separadas.

Minimizar durante uma chamada ativa reduz a mesma janela e mantém a mesma conexão em primeiro plano. Voltar à sala ou clicar no ícone do Dock restaura o tamanho anterior. A grade de participantes usa o comando setTileView do Jitsi.

Caneta, laser e texto desenham numa janela transparente sobre o monitor compartilhado, inclusive com a sala reduzida. São controles do professor. Esc ou × desativa a ferramenta e devolve cliques ao aplicativo embaixo. Limpar remove os desenhos. Parar o compartilhamento, trocar de sala ou sair limpa e fecha a sobreposição. Não depende do transporte do quadro/PDF. A captura de uma janela isolada não inclui outras janelas: por isso a anotação externa só fica disponível em Tela inteira.

`npm ci`, `npm test`, `npm run package:mac`. App para Apple Silicon com assinatura ad-hoc de teste, sem notarização Apple nem atualização automática. Sandbox e isolamento de contexto habilitados; IPC com remetente, quadro principal e argumentos validados. O seletor e a sobreposição são páginas locais com CSP e pontes específicas. Nenhuma chave administrativa é embutida.


## Ferramentas de anotação 0.3.0

Durante o compartilhamento de Tela inteira, uma barra própria e arrastável fica sobre o monitor selecionado. Ela permanece disponível após Esc/Desativar, enquanto os cliques voltam ao aplicativo abaixo. O compartilhamento de janelas continua disponível; uma janela isolada não captura a sobreposição externa.

- Laser: traço contínuo com cauda que desvanece em 850 ms.
- Caneta e texto usam uma paleta fixa de dez cores.
- Borracha remove o traço ou texto tocado. Desfazer recupera as últimas alterações.
- Mover texto: arraste com a ferramenta de seleção. Dois cliques reabrem a edição; Texto também permite editar ao clicar num texto existente. Enter confirma, Shift+Enter quebra linha, Esc cancela a edição e desativa a ferramenta.
- A sala tem um quadro compartilhado próprio. PDFs podem ser abertos no computador e apresentados por compartilhamento de tela/janela; não há mais um seletor de PDF dentro da sala. Documentos do portal continuam disponíveis.

O quadro e as anotações externas são superfícies distintas: as externas chegam pela captura de tela; o quadro usa o transporte autenticado de material da aula. A barra externa só é criada após o professor selecionar um monitor para compartilhar. Os IPCs da barra validam janela, quadro principal, ferramenta e cor.
