# Sala de aula do Lessonara

A sala usa o Jitsi já instalado em meet.mosaic-labs.co. A autenticação de teste em aula.mosaic-labs.co permanece separada; o Lessonara valida sua própria sessão de professor ou de aluno.

## Acesso

- Aluno entra pelo código enviado ao email no portal. Não há nova senha de sala.
- Professor usa o login do Lessonara e entra como moderador; o aluno entra como membro.
- O backend verifica aluno ativo, professor proprietário ou vínculo válido da sessão do aluno e a ocorrência real da agenda, incluindo cancelamentos, faltas e feriados.
- Janela de entrada: 5 minutos antes do início até 30 minutos depois do fim, considerando a duração persistida da aula e São Paulo. O card continua visível antes da abertura com “Disponível às HH:mm”; após fechar, o resumo passa para a próxima aula. A mesma regra bloqueia a emissão do JWT no servidor.
- A sala aberta nunca troca automaticamente para outra aula. Professor e aluno saem e entram em outro encontro manualmente.

## Identidade e tokens

As aulas virtuais carregam sourceKind/sourceId/date. A URL /classroom/<student>/<sourceKind>/<sourceId>/<date> identifica a ocorrência, mas não autoriza ninguém sozinha. O POST /join confere a sessão e a origem da requisição antes de emitir o JWT.

A identidade opaca da sala é um HMAC de versão, aluno, origem e data, usando a chave de assinatura do Jitsi. A sala é a mesma ao recarregar e distinta por ocorrência, sem duplicar a agenda em outra tabela. Rotacionar a chave também muda as identidades das salas.

O JWT vale apenas nessa sala e expira no fim da janela de entrada. Não troca uma chamada em andamento quando o horário termina; uma nova entrada ou reconexão depois da janela é bloqueada. A chave de assinatura fica exclusivamente no servidor; não usa NEXT_PUBLIC_. Tokens e sala não recebem Analytics ou Speed Insights do Lessonara, e o endpoint usa no-store.

## Configuração

JITSI_URL, JITSI_APP_ID e JITSI_APP_SECRET devem ser definidos em Production no Vercel. O emissor e a chave precisam coincidir com os configurados no Prosody. Valores não são documentados nem commitados.

Sem as três variáveis válidas, o portal conserva seu link Google Meet existente. Com a sala configurada, Entrar na aula abre o Jitsi dentro do Lessonara. O professor também tem entrada no perfil do aluno e no resumo do dia do calendário. A integração Google e seus eventos existentes continuam disponíveis.

## Vídeo e quadro

Usa external_api.js do Jitsi próprio, com pré-entrada para dispositivos, microfone e câmera inicialmente desligados, compartilhamento de tela e anotações de tela instaladas na PoC. Não há gravação nem transcrição. O quadro nativo do Jitsi fica desativado no Lessonara.

## Quadro do Lessonara

O professor abre um quadro temporário com caneta, laser, texto, borracha, seleção para mover texto, desfazer e dez cores. Texto é colocado na posição clicada; a ferramenta de seleção permite arrastar e dois cliques reabrem a edição. Esc desativa a ferramenta sem apagar o quadro. O aluno acompanha em modo de leitura. PDF deixou de ser uma opção da sala: no app, o professor pode abrir seus arquivos no computador e compartilhar a janela ou monitor. Os documentos do portal permanecem disponíveis.

O backend autentica cada operação. Somente o professor proprietário publica o estado. Um estado criptografado e autenticado vincula as anotações à ocorrência e ao proprietário, com validade de 12 horas. Mensagens transportam apenas esse estado criptografado pelo Supabase Realtime em partes limitadas, em um canal opaco derivado da identidade da sala; o backend verifica a autorização antes da leitura, sem confiar no papel informado pelo cliente. As validações restringem as cores à paleta e limitam os traços, pontos e textos.

As anotações do quadro não são gravadas no banco. Um participante que permanece na sala pode retransmitir o último estado válido a quem entrar ou recarregar. Quando todos saem, o estado temporário se perde. O transporte do quadro continua autenticando snapshots; sua latência é distinta da sobreposição nativa, transmitida dentro da captura de tela. Os endpoints e o visualizador legado de PDF permanecem disponíveis para compatibilidade técnica, sem entrada de PDF na nova interface.

A mídia depende da rede: o túnel Cloudflare transporta o acesso web, não a mídia UDP. O 1:1 pode usar P2P; o fallback por JVB/TURN precisa de conectividade apropriada. A verificação de protocolo confirma autenticação e papéis, mas não substitui teste de câmera e áudio reais entre duas redes.

## Validação

Testes de unidade cobrem janela, ocorrência, identidade da sala, papéis, aula atual e bloqueios. A QA HTTP usa contas temporárias isoladas, com sessões reais de professor/aluno, e remove esses registros ao terminar. A QA XMPP usa tokens emitidos pelo endpoint do Lessonara contra o Prosody real.

## Plano Pro e desktop

A página, o endpoint de entrada e o endpoint de material verificam o plano da empresa proprietária da turma. Emails e sala integrada são recursos Pro. O professor pode escolher navegador ou app; o aluno continua no navegador. O link nativo transporta somente a identidade da ocorrência, e o app autentica seu próprio usuário. Ver [desktop/README.md](../desktop/README.md) para empacotamento e limites desta versão.


## Desktop 0.3.1 focado em chamadas

`/calls` exibe login e lista de aulas sem a navegação do portal. O app abre somente essa rota e ocorrências validadas; os links do portal abrem no navegador. O destino de login é limitado a `/calls` ou `/`, sem redirecionamento externo.

O seletor nativo do aplicativo lista monitores inteiros e janelas, com miniaturas, e só concede a fonte explicitamente selecionada. Cancelar, mudar de sala ou fechar o seletor nega a captura. Não altera permissões do macOS.

Minimizar uma chamada ativa transforma a mesma janela em uma janela pequena flutuante; não reinicia o Jitsi. O Dock e Voltar à sala restauram suas dimensões. Uma barra nativa arrastável reúne seleção, caneta, laser contínuo com cauda de 850 ms, texto, borracha, desfazer, limpeza e dez cores. Esc ou × devolve os cliques ao aplicativo abaixo, mantendo a barra disponível para selecionar outra ferramenta. Dois cliques editam texto e a seleção permite movê-lo. Interromper a captura fecha a barra e limpa os desenhos. Compartilhar uma janela não captura a sobreposição e deixa esses controles externos desabilitados. O quadro interno usa seu próprio transporte.

A versão 0.3.1 oferece instalador Windows x64 e corrige o foco da caixa de texto externa. A proteção de conteúdo é aplicada somente à barra no Windows; o canvas continua capturável. No Mac, a barra pode aparecer ao aluno por limitações do ScreenCaptureKit. Os testes de instalação e inicialização no Windows não substituem uma chamada real de câmera/áudio/compartilhamento.
