# Recebimentos Pix e importação de alunos

Implementação aprovada em 20/10/2026. O Pix pertence ao professor e serve para receber os pacotes de aulas. A assinatura da plataforma é um fluxo separado.

## Recebimentos Pix

Em **Configurações → Recebimentos**, o professor informa tipo/chave, nome do recebedor e cidade. CPF/CNPJ têm verificação de dígitos; email, telefone E.164 e chave aleatória têm verificação de formato. Nome/cidade são normalizados para o BR Code. Isso não comprova a titularidade da chave: o banco do pagador apresenta o recebedor antes da confirmação.

O portal do aluno tem **Renovar pacote** junto do resumo. **Preparar Pix** cria um retrato do plano, aulas, preço e recebedor; mostra QR Code e copia-e-cola com valor definido. Usa o valor específico do aluno quando não nulo, inclusive zero; caso contrário, o preço do plano. Valor zero não gera cobrança. Sem Pix/plano ativo, o fluxo anterior continua disponível.

**Já paguei** apenas muda a solicitação para aguardando conferência. O professor a revisa em **Pagamentos**, confere o banco, informa a data e confirma ou devolve para revisão. A confirmação registra um pacote com o preço/créditos do retrato e só então libera as aulas. Mudanças posteriores de preço/chave são sinalizadas na revisão. A data não pode estar no futuro. A solicitação e o pacote são confirmados na mesma transação; repetir o envio não duplica créditos.

Cada aluno pode ter um único Pix aberto/aguardando por vez. Um Pix preparado pode ser cancelado para gerar outro com dados atuais; depois de “Já paguei”, somente o professor resolve a pendência. Rejeição e confirmação aparecem no portal. O Pix é estático: não expira no banco, não comprova liquidação, não bloqueia pagamento com valor diferente e não faz conciliação automática. O professor deve usar a confirmação da solicitação em vez de registrar esse mesmo pagamento manualmente.

A cobrança por WhatsApp em Pagamentos inclui valor, recebedor, código e link do portal quando há Pix configurado. Abrir a conversa continua sendo ação explícita do professor.

### Contratos e autorização

- `0023_pix_renewals.sql` e o reforço `0025_request_option_guards.sql`: `teacher_receivables`, `renewal_requests`, índice de uma solicitação aberta/aluno e RPCs transacionais.
- Aluno: sessão e vínculo verificados em cada Server Action; os RPCs de preparar/reportar são exclusivos do backend. Valor, professor e créditos nunca vêm do navegador.
- Professor: leitura própria via RLS com sessão absoluta de 24h. Somente `resolve_student_renewal` pode resolver pelo papel autenticado; verifica professor e bloqueia as linhas antes de escrever.
- QR Code: payload BR Code/EMV, valor em duas casas e CRC16/CCITT-FALSE; a imagem é produzida localmente, sem serviço externo.

Referências: [Manual Pix do Banco Central](https://www.bcb.gov.br/content/estabilidadefinanceira/pix/Regulamento_Pix/II_ManualdePadroesparaIniciacaodoPix.pdf), [biblioteca de QR Code](https://github.com/soldair/node-qrcode). Leitura em app bancário e teste de usabilidade com professor/aluno permanecem QA; testes automatizados não substituem esse teste.

## Importação: duas opções, sempre com revisão

Disponível em **Plus e Pro**, com validação no servidor e no banco. O Essencial mantém cadastro manual. O passo **Já tem alunos? Importe seus dados** é opcional depois de perfil/plano, pode ser pulado e não impede usar o sistema. A sugestão depende do estado da jornada, sem regra baseada na idade da conta. **Alunos → Importar dados** permanece acessível depois.

### Importar com modelo CSV

Baixar o modelo, preencher os dados e enviar um CSV UTF-8. A prévia mostra nome/contato, plano, valor específico, saldo inicial, início e horários. Linhas com erro não podem ser selecionadas. O professor pode desmarcar linhas válidas e deve confirmar que revisou os dados antes de gravar. Não há criação/atualização automática de planos: o `codigo_plano` identifica um plano ativo da própria conta e permanece estável após renomear. O código é gerado pelo banco e aparece em Configurações → Planos; o prefixo `#` é opcional no CSV. Arquivos antigos com a coluna `plano` por nome continuam aceitos somente quando o nome identifica exatamente um plano ativo. Não misturar as duas colunas.

Colunas obrigatórias do arquivo, com células opcionais conforme indicado:

| Coluna | Regra |
|---|---|
| `nome`, `email` | Nome de até 120 caracteres e email válido; possíveis duplicatas são bloqueadas |
| `telefone`, `pais` | Telefone opcional; país ISO de duas letras, BR quando vazio |
| `codigo_plano` | Código de um plano ativo da conta, com ou sem `#`; não muda com o nome |
| `valor_diferente` | Opcional; 0 a 99000,00; sem separador de milhar |
| `saldo_inicial` | Inteiro entre -1000 e 1000; vazio equivale a zero |
| `inicio` | AAAA-MM-DD, hoje ou no futuro |
| `horarios` | Opcional; separados por `|`: `seg 18:00`, `15 18:00` para mensal fixo, `AAAA-MM-DD 18:00` para avulso |
| `observacoes` | Opcional, até 4000 caracteres |

O saldo inicial representa o que já estava disponível/devido no dia da migração. Fica em `students.opening_credits`, separado de `packages`; não cria recebimento nem histórico financeiro fictício. Agendas começam hoje ou no futuro para não consumir novamente aulas anteriores. Saldo negativo é quitado pelos créditos dos próximos pacotes; o histórico identifica essa compensação.

A confirmação relê regras, plano, duplicatas e conflitos. Uma falha reverte alunos, agendas, saldo e jobs do lote inteiro. O hash do arquivo e a confirmação idempotente impedem reimportar a mesma versão. Uma revisão preparada novamente pela equipe invalida a revisão antiga. Não sobrescrevemos alunos existentes. O professor escolhe explicitamente se quer enviar convites; a opção começa desmarcada. Agendas confirmadas entram na sincronização Google existente, quando conectada.

### Quero ajuda da equipe

O professor envia CSV ou XLSX sem macros. Gera um pedido privado, **Aguardando equipe**. A equipe baixa o original, prepara o CSV no modelo e disponibiliza a prévia no mesmo pedido. A equipe não confirma em nome do professor. Ele abre o pedido e faz a mesma revisão/seleção/confirmação do fluxo guiado.

A primeira operação de suporte usa um comando restrito a quem já possui as credenciais administrativas do backend; não existe ainda um painel admin web ou alerta automático para a equipe. O operador deve consultar os pedidos durante o piloto. Não apresentar o envio como atendimento instantâneo ou com SLA.

```sh
# Em computador autorizado, com ambiente privado configurado:
node --env-file=.env.local --import tsx scripts/import-support.ts list
node --env-file=.env.local --import tsx scripts/import-support.ts download ID /caminho/privado/original.xlsx
# Preparar localmente e conferir o CSV, sem serviços externos.
node --env-file=.env.local --import tsx scripts/import-support.ts prepare ID /caminho/privado/preparado.csv
node --env-file=.env.local --import tsx scripts/import-support.ts cleanup ID
```

Não copiar chaves administrativas para navegador, frontend ou repositório. O comando não envia notificações ou confirma importações. Arquivos baixados localmente exigem descarte pelo operador após o atendimento.

### Limites, retenção e recuperação

Até **512 KB/arquivo**, **200 alunos/lote** e **dois pedidos abertos/professor**. Essas cotas são próprias da importação; não substituem a cota de Documentos. A opção guiada não guarda o arquivo original. A assistida usa bucket privado `lessonara-imports`, sem políticas de acesso direto pelo navegador; o backend autoriza o download do dono e a equipe usa credenciais administrativas existentes. Não enviamos os arquivos a serviços externos de análise.

Originais assistidos são removidos quando o pedido é concluído/cancelado. Falhas deixam `object_path` registrado; o worker de emails tenta novamente em lotes de dez e informa `imports.removed`/`imports.failed`. A equipe pode executar `cleanup` para pedido encerrado. Prévias são descartadas na conclusão/cancelamento; metadados e IDs resultantes permanecem para rastreabilidade. Pedidos abertos permanecem até o atendimento ou cancelamento: não há expiração silenciosa.

Antes de confirmar, é possível corrigir o arquivo ou cancelar o pedido sem criar alunos. Depois de confirmar, não existe desfazer destrutivo automático: a equipe confere `result_ids` e as alterações posteriores antes de qualquer correção. Não apagar alunos com pagamentos, aulas ou convites já usados como se a importação nunca tivesse acontecido.

## Verificação

Testes unitários cobrem payload/CRC e decodificação independente dos pixels do QR Pix, formatos, limites, autorização das ações, CSV, duplicatas, horários, saldos e limpeza. `supabase/operations/verify-pix-import.sql` exercita as regras transacionais com dados fictícios e rollback, sem chamadas a bancos, Google ou provedor de emails. A leitura bancária do QR, a migração de uma planilha real do piloto e o ganho de tempo de renovação continuam QA/discovery.
