# Histórico durável de aulas

Cada ocorrência tem UUID próprio e preserva aluno/professor, origem, data, horário, duração, retrato do plano e do pacote pago, posição do crédito e primeira entrada técnica registrada. `lesson_occurrences` é a fonte histórica; previsões futuras continuam calculadas sob demanda. No perfil do aluno do professor, a aba Histórico separa aulas anteriores da agenda e permite agrupar por mês ou pacote. O portal do aluno usa o mesmo saldo e os mesmos registros.

## Captura e alterações

A migração 0029 consolida as ocorrências já iniciadas a partir dos dados disponíveis no momento da aplicação. O carregamento dos saldos consolida novas ocorrências; gatilhos no banco também preservam o estado anterior antes de alterações de planos, vínculos do aluno, horários, pagamentos e regras de feriado. Isso cobre alterações via Data API além das Server Actions.

A confirmação técnica de entrada na conferência consolida a ocorrência mesmo quando acontecer cinco minutos antes do início. Reconexões e os dois participantes convergem para a mesma ocorrência e primeiro horário de entrada. A entrada não consome crédito antecipadamente nem confirma sozinha que a aula foi dada.

Encerrar ou remover um horário preserva as aulas anteriores. Mudanças de plano, preço ou duração não substituem os retratos já registrados. Recriar um horário igual não duplica uma ocorrência histórica não desmarcada no mesmo instante. A exclusão do próprio aluno continua sendo exclusão de seus dados, incluindo seu histórico.

## Créditos e correções

A regra financeira existente permanece: depois do início previsto, uma aula sem exceção é presumida como dada. A interface identifica essa presunção. Falta e reposição consomem crédito; desmarcação preserva; feriados conservam a política registrada na captura. Isso também atende aulas realizadas fora do Jitsi.

Cada ocorrência reserva uma posição no pacote; previsões futuras usam as posições disponíveis. Uma desmarcação libera o crédito, sem apagar a identificação anterior. Uma correção posterior registra antes/depois, data e usuário em `lesson_occurrence_changes`. Desfazer uma desmarcação pode exigir realocação de um crédito já ocupado, sem duplicar o consumo. Pagamentos posteriores podem cobrir aulas antes sem pacote. O saldo inicial negativo usa os primeiros créditos como quitação, sem inventar aulas passadas.

Pagamentos já vinculados ao histórico não podem ser excluídos nem ter valor, quantidade ou data reescritos. Essa proteção no banco impede corromper os vínculos salvos. Um fluxo específico de estorno/ajuste financeiro não faz parte desta entrega. O saldo inicial também fica protegido depois de haver histórico.

## Autorização e operação

Tabelas sem escrita direta para clientes; professor lê somente seu próprio histórico, com sessão válida de 24 horas. Aluno acessa pelo backend autorizado existente. `ensure_lesson_history` autoriza todos os alunos do lote antes de capturar, limita a 200 IDs e serializa por aluno. As leituras posteriores têm paginação para evitar truncamento pelo limite da Data API. Origens, planos e pacotes são referências históricas, sem exclusão em cascata desses vínculos.

Os testes PostgreSQL em memória executam a migração e os gatilhos, além dos testes do saldo. Rodar sequencialmente:

```sh
pnpm exec vitest run --maxWorkers=1
pnpm exec tsc --noEmit
pnpm build
```

## Limites do histórico anterior

A consolidação inicial utiliza somente os registros ainda existentes. Não recupera horários já apagados ou versões antigas de planos não armazenadas anteriormente, nem comprova presenças antigas. Nenhuma presença é inventada. QA de mídia da sala com duas pessoas continua separado desta validação de persistência.

## Validação da entrega

377 testes aprovados, incluindo oito cenários PostgreSQL em memória e regressões de saldo. TypeScript, lint e build passaram. A migração foi validada com rollback e aplicada ao Supabase de produção; a captura repetida preservou a identidade das ocorrências. As quatro consultas de relacionamento usadas no portal e nos workers também passaram contra o banco real após a migração. A conferência de interface e publicação é registrada na conclusão da entrega.
