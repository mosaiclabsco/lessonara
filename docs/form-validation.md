# Validação dos formulários

Revisão de implementação de 20/10/2026. Regras compartilhadas em `src/lib/form-validation.ts`, usadas pelas Server Actions. A validação do navegador facilita o preenchimento; o servidor recusa chamadas diretas inválidas. RLS, vínculo do aluno e permissões por plano continuam obrigatórios.

## Inventário e regras

| Área | Regras no servidor | Limites e observações |
|---|---|---|
| Professor | Nome obrigatório ao configurar; duração inteira em passos de 15 minutos | Nome até 120 caracteres; duração de 15 a 180 minutos |
| Aluno | Nome e email obrigatórios; email normalizado; telefone validado por país; plano obrigatório | Nome 120, email 254, observações 4.000; criação exige plano ativo do próprio professor |
| Planos de aulas | Nome não vazio, créditos inteiros, moeda válida, frequência e modo compatíveis | Créditos 1–1.000; preço R$ 0–99.000; semana 1–7, mês 1–31; avulsas somente no mensal |
| Horários | Data real, dia inteiro e hora de meia em meia hora antes de consultar Google | Dia semanal 0–6; mensal 1–31; encerramento exige data; banco protege vínculos e conflitos |
| Pagamentos | Data real, créditos inteiros e valor limitado | Créditos 1–1.000; R$ 0–99.000; observações 4.000 |
| Reposições e marcações | Data real, horário válido, tipo de ocorrência restrito e vínculo de origem válido | Observações 4.000; servidor rejeita tipo forjado fora de falta/desmarcada na ação de marcação |
| Documentos | Título, assunto, extensão, nome, tamanho, cota e validade | Título 120; assunto 80; nome de arquivo 180; confirmação confere tamanho e MIME armazenados |
| Atividades | Título, instruções, prazo, feedback e tipo booleano de arquivamento | Título 120; instruções e comentários 4.000; conferência exige entrega existente |
| Entrega do aluno | Vínculo da sessão, tamanho/cota e nota | Nota 4.000; autorização antes de reservar upload e confirmar entrega |
| Feriados | Nome, data real futura, política enumerada e booleano | Nome 120; criação a partir de amanhã; sugestões limitadas à lista calculada |
| Campanhas | Assunto, mensagem, IDs, consentimento, propriedade e plano | Assunto 120 sem quebra de linha; mensagem 10.000; até 100 alunos por envio e cota diária |
| Login e OTP | Validações próprias e limites persistidos, CAPTCHA no login do professor | OTP de seis dígitos; expiração e tentativas verificadas no servidor; validação não substitui autenticação |
| Preferências | Origem da requisição e enums de idioma/tema | Payload inválido é rejeitado |
| Suporte | Ação `mailto:` | Sem formulário de envio ou armazenamento no servidor; não apresentar como ticket aberto |

Arquivos seguem os limites do plano: Essencial 20 MB/1 GB total, Plus 100 MB/5 GB, Pro 1 GB/20 GB. A cota é compartilhada por documentos e entregas, incluindo reservas incompletas. Esses limites de produto não aumentam a capacidade contratada no provedor.

## Comportamento dos erros

Erros de preenchimento nas ações de formulário retornam dados serializáveis com campo e mensagem, sem depender de exceções que o Next.js oculta em produção. `ActionForm` mostra a mensagem, evita sucesso falso e foca o campo após liberar os controles. O editor de planos e o fluxo de reposição reconhecem esse retorno e preservam a edição.

Datas impossíveis, frações, `NaN`, números em notação científica, arquivo no lugar de texto, nomes vazios e textos acima do limite são rejeitados. Campos de linha única não aceitam caracteres de controle; observações permitem quebras de linha.

Histórico de pagamentos, agendas e reposições pode conter datas passadas: esta revisão não inventa uma proibição geral. O fluxo sugerido de reposição oferece datas a partir de hoje na interface; o registro histórico continua permitido. A disponibilidade Google é uma fotografia da consulta, não uma reserva atômica externa.

## Banco e validação

`0021_form_validation.sql` adiciona limites de nomes, observações, moeda e créditos, protegendo gravações que tentem contornar a aplicação. Constraints `NOT VALID` passam a proteger novas gravações/alterações, sem apagar ou reescrever histórico. Em 20/10/2026, as nove novas constraints foram aplicadas em produção após dry-run transacional com rollback. As nove constraints também foram validadas contra os registros existentes, sem violações. Evidências em [Validação operacional](operations-validation.md).

Testes de regressão: `form-validation.test.ts`, `teacher-form-actions.test.ts`, `plan-frequency.test.ts`, `document-rules.test.ts`, testes de documentos/atividades/sessões existentes. Os testes de actions exercitam a chamada direta e verificam ausência de gravação e de consulta Google com entradas inválidas.

## Recebimentos e importação

Pix valida a chave por tipo, dígitos de CPF/CNPJ, limites BR Code e valor positivo de até R$ 99.000. Dados do pacote são obtidos no servidor e preservados numa solicitação; a confirmação não aceita preço/créditos enviados pelo navegador. O banco exige uma escolha booleana explícita e data de recebimento válida.

Importação valida plano Plus/Pro, arquivo de até 512 KB, UTF-8/CSV ou original XLSX assistido, até 200 linhas, colunas, contatos, nome de plano ativo, saldo inicial, início e horários. A confirmação exige revisão explícita, seleção válida e versão atual; RLS/RPCs repetem as regras de propriedade, plano, sessão e conflitos. [Contrato e limites](product-flows.md).
