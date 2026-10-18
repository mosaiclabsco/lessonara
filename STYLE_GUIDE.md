# Padrões de interface do Lessonara

Aplicam-se ao portal do professor, ao portal do aluno e às telas web da sala. Reutilize os componentes de `src/components`; não crie estilos locais para controles equivalentes.

## Ações

- Use `Button`, `SubmitButton` ou links com as mesmas classes. Todo botão de ação deve ter ícone e texto; ações apenas com ícone exigem nome acessível.
- Ação principal: verde Lessonara. Secundária: borda e texto verdes, fundo discreto no hover. Vermelho é reservado para ações destrutivas. Cinza indica bloqueio real.
- Use `FormActions`: cancelar, voltar e fechar à esquerda; confirmar, salvar, criar e enviar à direita. Mantenha 24 px entre os campos e as ações, sem aproximar o rodapé da borda do card.
- Durante uma ação, mostre o spinner somente no controle acionado e desabilite as ações concorrentes. Não altere a largura do botão quando o rótulo mudar.

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

- O header é fixo, com controle do menu e conta do professor. O título da página identifica a tela; não repetir slogans acima dele.
- Cards de documentos reservam a mesma linha para o assunto, mesmo sem assunto. Textos longos truncam com acesso ao texto completo pelo título.
- Planos salvos aparecem como resumo; criar e editar usam o mesmo modal. A ordem salva deve ser usada também nas seleções de plano.
- Respeite contraste, teclado, nomes acessíveis e layout móvel. Cores devem vir das variáveis do tema.
