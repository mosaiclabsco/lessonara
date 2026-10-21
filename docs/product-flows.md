# Próximos fluxos: recebimentos e importação

Propostas de produto discutidas em 20/10/2026. Pix e importação assistida ainda não estão implementados. São decisões separadas da revisão de formulários e do webhook de entrega.

## Pix do professor para receber aulas

Configuração em **Configurações → Recebimentos**, com chave/tipo, nome do recebedor e cidade. Esses dados pertencem ao professor; não são os dados de assinatura do Lessonara.

No portal do aluno, mostrar um card **Renovar pacote** junto do saldo/renovação, com quantidade de aulas, valor, QR Code com o valor preenchido e Pix copia-e-cola. O valor deve respeitar `price_override` do aluno quando existir, inclusive zero, senão o preço atual do plano de aulas. Pagamentos anteriores preservam seus valores históricos. Se o valor final for zero, não apresentar cobrança Pix; o professor registra a concessão/renovação sem pagamento conforme o fluxo de créditos. Ao mudar preço/chave antes da confirmação, mostrar os dados vigentes e guardar um retrato da solicitação para o professor conferir divergências.

O botão **Já paguei** deve ficar nesse mesmo card, depois dos dados de pagamento, e mudar para **Aguardando confirmação do professor** após a ação. Não deixar o aluno repetir solicitações para a mesma renovação nem tratar o clique como pagamento recebido. No painel do professor, exibir a pendência em **Pagamentos**, com aluno, plano, valor e quantidade de aulas preenchidos; o professor confere o extrato e confirma. A confirmação deve ser atômica/idempotente para não duplicar pacote. Créditos entram somente nessa confirmação.

Um QR Code Pix estático pode incluir um valor predeterminado. Isso facilita o pagamento, mas não confirma liquidação nem impede que outro meio/valor seja usado. O plano de implementação deve usar o padrão BR Code/EMV com CRC e testar leitura em aplicativos bancários; não desenvolver um pagamento novo sem essa validação.

A cobrança por WhatsApp pode incluir instruções e copia-e-cola do mesmo pacote. Sem Pix configurado, preservar os fluxos atuais. Sem gateway ou confirmação bancária automática nessa primeira versão.

## Importação assistida no onboarding e depois dele

A recomendação é um passo opcional **Já tem alunos? Importe seus dados** no onboarding, com ação clara de pular. Manter **Importar dados** acessível depois em Alunos e/ou Configurações → Dados. Não ocultar por idade da conta ou data de cadastro: um professor pode migrar dados semanas depois. O onboarding usa estado da jornada (concluído, pulado ou pendente), não a data de criação, para mostrar a sugestão sem bloquear o restante.

Começar como importação assistida: receber planilha/CSV e, quando necessário, dados enviados em outro formato; mapear alunos, contatos, planos, agendas e saldos; apresentar prévia com erros e duplicatas; solicitar revisão explícita antes de gravar. Informar limites, retenção do arquivo e quem terá acesso. Não incluir os arquivos enviados em ferramentas externas por padrão.

**Proposta de plano, ainda sem mudança de entitlement:** disponibilizar a importação assistida em Plus e Pro; Essencial mantém cadastro manual. No piloto, pode ser um benefício concedido manualmente para aprender com a operação, sem prometer importações ilimitadas. O esforço por atendimento e o volume de dados devem orientar a cota e a futura automação CSV.

Antes de implementar, definir: formato inicial, tratamento de duplicatas, representação de saldo de abertura sem inventar pagamento histórico e como desfazer uma importação com segurança. Os pedidos devem aparecer na operação administrativa. Medir tempo de atendimento, correções e resultado do onboarding.

Referência de fluxo existente: [ferramenta de importação do HubSpot](https://knowledge.hubspot.com/import-and-export/understand-the-import-tool), com mapeamento de colunas e criação/atualização de registros. A escolha de disponibilidade permanente e enquadramento Plus/Pro acima é uma recomendação para o Lessonara, não uma regra copiada de outro produto.

Padrão técnico do QR Code: [Manual de Padrões para Iniciação do Pix, Banco Central](https://www.bcb.gov.br/content/estabilidadefinanceira/pix/Regulamento_Pix/II_ManualdePadroesparaIniciacaodoPix.pdf), incluindo o caso de QR Code estático com valor definido.
