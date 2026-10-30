# Lessonara Chamadas 0.3.1 — teste para Mac e Windows

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

## Permissão de tela após atualizar uma versão de teste

As versões atuais têm assinatura ad-hoc. A identidade designada inclui o hash do executável e pode mudar entre builds; uma entrada ativada nos Ajustes pode corresponder à versão anterior. Uma assinatura Developer ID consistente é necessária para manter a identidade nas atualizações distribuídas.

Se o seletor não abrir mesmo com a permissão ativada, feche o Lessonara com ⌘Q. Em Privacidade e Segurança → Gravação do Áudio do Sistema e da Tela, remova somente a entrada Lessonara e adicione `/Applications/Lessonara.app` novamente. Autorize e reabra. Não apague permissões de outros aplicativos nem desative proteções do sistema.

O fluxo de captura verifica permissões negadas antes de enumerar fontes. A enumeração tem limite de 20 segundos, explica falhas e permite tentar novamente; resultados atrasados não abrem seletores de requisições já encerradas. Isso evita espera silenciosa, mas não concede nem restaura a autorização do macOS. A captura continua exigindo uma seleção explícita de tela/janela.


## Windows 0.3.1

`npm run package:windows` gera instalador NSIS x64 para o usuário atual, sem exigir instalação administrativa. O instalador registra `lessonara://` e atalhos; o app continua restrito a chamadas. O workflow manual `Desktop Windows` compila e testa em Windows, verifica instalação silenciosa, registro do protocolo e inicialização e publica uma pré-release com SHA-256. Não sobrescreve releases existentes. A janela de compartilhamento nunca é escolhida automaticamente.

A barra externa usa proteção de conteúdo somente no Windows, sem proteger o canvas dos desenhos. Em Windows 10 versão 2004 ou posterior, essa proteção solicita a exclusão da barra da captura; isso ainda precisa ser conferido numa chamada real. No macOS, ScreenCaptureKit pode ignorar essa proteção, portanto a barra pode aparecer ao aluno durante o compartilhamento da tela inteira. Não há garantia de ocultação no Mac.

O texto não captura mais o ponteiro do canvas no clique que abre o editor. O evento evita a mudança de foco padrão; Enter confirma, Shift+Enter mantém a quebra de linha, e composição de teclado não encerra o editor antecipadamente. As atualizações Mac de teste continuam usando assinatura ad-hoc e podem exigir refazer a permissão de tela.

## Distribuição pública dos instaladores

O código e o workflow de compilação permanecem no repositório privado. Os instaladores para download ficam em `gabrielgoncalvesr/lessonara-downloads`, separado do código do produto. O workflow Windows publica sua pré-release no repositório privado; a cópia para distribuição pública é manual.

Após conferir os testes e os hashes, publique somente os instaladores e seus arquivos `.sha256` na release pública correspondente. Nunca envie o repositório de código nem os arquivos de ambiente. Atualize `src/lib/desktop-links.ts` apenas para arquivos públicos existentes e confira os downloads sem autenticação.


## Próxima prévia Windows 0.3.2

O artefato passa a usar `Lessonara-0.3.2.exe`, mantendo `Lessonara.exe` como executável instalado. O workflow de instalação/hashes acompanha o novo nome. A distribuição pública só será atualizada após build Windows e existência do arquivo público. Esta mudança não assina o instalador; [opções e limitações de assinatura](windows-signing.md).
