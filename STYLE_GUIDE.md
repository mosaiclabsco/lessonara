# Padrões de interface do Lessonara

Aplicam-se ao portal do professor, ao portal do aluno e às telas web da sala. Reutilize os componentes de `src/components`; não crie estilos locais para controles equivalentes.

## Ações

- Use `Button`, `SubmitButton` ou links com as mesmas classes. Todo botão de ação deve ter ícone e texto; ações apenas com ícone exigem nome acessível.
- Ação principal: verde Lessonara. Secundária: borda e texto verdes, fundo discreto no hover. Vermelho é reservado para ações destrutivas. Cinza indica bloqueio real.
- Use `FormActions`: cancelar, voltar e fechar à esquerda; confirmar, salvar, criar e enviar à direita. Para uma ação isolada de cancelar/voltar, use `FormActions align="start"`. Mantenha 24 px entre os campos e as ações, sem aproximar o rodapé da borda do card.
- Durante uma ação, mostre o spinner somente no controle acionado e desabilite as ações concorrentes. Não altere a largura do botão quando o rótulo mudar.

- Menus de contexto, perfil e ações de três pontos usam `DropdownMenu` / `menu-action`: sem borda, sem sombra individual e destaque discreto somente ao passar o mouse ou focar. Ações destrutivas usam texto vermelho.
- Use ícone `back` para voltar; `arrow` indica avanço. Ordenação usa `SortableList`, com alça para arrastar, suporte a toque e alternativa por teclado.

## Campos

- Texto, select, data, seletor de documento e moeda usam altura de 46 px, fonte de 14 px, raio de 12 px e o mesmo anel de foco de 3 px. Textareas crescem conforme o conteúdo.
- Use `.label` e `htmlFor`; obrigatoriedade é indicada por um único asterisco, além de `required` no controle. Agrupamentos usam `fieldset` e `legend`.
- Use `MoneyField` (prefixo R$, máscara em tempo real, até R$ 99.000,00), `FileInput`, `DocumentPicker`, `TimeField` e `PhoneField`. Não copie o markup desses controles.
- DocumentPicker mostra o título em uma linha; detalhes de arquivo aparecem na lista de escolha.

## Diálogos e feedback

- Use `Dialog` e `ConfirmDialog`; nunca `window.confirm`, `alert` ou `prompt` no portal. O componente usa a top layer do navegador, prende o foco, permite Escape, restaura o foco e bloqueia fechamento durante a confirmação.
- Separe título, descrição, conteúdo e rodapé. Use botões com ícones e a mesma ordem do restante do sistema.
- Use `Toast`/`notify` para resultado de ações: sucesso verde e erro vermelho. Não substitua estados vazios ou instruções permanentes por notificações.

## Estrutura e listas

- O header permanece visível e contém a conta do professor; o scroll é da área de conteúdo. O controle de recolher integra o menu lateral no desktop e aparece no header no celular. O título da página identifica a tela; não repetir slogans acima dele.
- Cards de documentos reservam a mesma linha para o assunto, mesmo sem assunto. Textos longos truncam com acesso ao texto completo pelo título.
- Planos salvos aparecem como resumo; criar e editar usam o mesmo modal. A ordem salva deve ser usada também nas seleções de plano.
- Respeite contraste, teclado, nomes acessíveis e layout móvel. Cores devem vir das variáveis do tema.

- No menu recolhido, o controle de expandir e os links usam a mesma caixa de 44 px e o mesmo eixo central. Indicadores e badges ocultos não podem reservar margem ou deslocar os ícones.
