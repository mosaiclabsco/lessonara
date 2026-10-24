# Lessonara — Módulos de Aprendizado e Evolução

Tipo: Product Backlog / Feature Specification. Status: propostas para roadmap, não implementadas. Origem: solicitação de 23/10/2026. Público: professores de inglês e seus alunos.

Objetivo: evoluir a organização de aulas para também praticar, acompanhar e demonstrar a aprendizagem. As prioridades abaixo pertencem a esta proposta e não substituem os bloqueadores do piloto nem as prioridades pessoais já salvas no leitor local.

## EPIC 01 — SpeakLoop: prática oral e feedback

Professores criam atividades de speaking, alunos gravam respostas e acompanham correções e evolução. Problema: áudios no WhatsApp dificultam organizar atividades, localizar feedbacks e consultar o histórico.

### SL-01 — Criar atividade de Speaking
Prioridade: alta. Fase: MVP.
Como professor, quero criar uma atividade para praticar comunicação oral fora da aula.
Requisitos: tipo Speaking / Audio; título, descrição, instruções e prazo; áudio de referência opcional; um ou mais alunos; duração máxima da resposta; reutilizar a atribuição existente.
Aceite: atividade, instruções e prazo visíveis ao aluno associado; estados pendente, entregue e avaliada; acesso exclusivo aos alunos associados e professor responsável.

### SL-02 — Gravar e enviar respostas em áudio
Prioridade: alta. Fase: MVP.
Como aluno, quero gravar diretamente no produto.
Requisitos: navegador desktop e dispositivos móveis compatíveis; upload alternativo; ouvir e descartar antes do envio; limite inicial sugerido de 3 minutos; validar tamanho, formato e duração; reenvio conforme configuração.
Aceite: prévia reproduzível; professor e aluno reproduzem o áudio enviado; erros claros de upload; arquivos privados.

### SL-03 — Avaliação do professor
Prioridade: alta. Fase: MVP.
Como professor, quero ouvir respostas e registrar observações.
Requisitos: player na correção; feedback textual; critérios opcionais de pronúncia, fluência, vocabulário e gramática; classificação manual precisa melhorar, adequado ou excelente; solicitar nova tentativa; histórico de tentativas e feedbacks.
Aceite: aluno consulta feedback; avaliação ligada à tentativa correta; novas tentativas nunca apagam o histórico.

### SL-04 — Segurança e armazenamento dos áudios
Prioridade: alta. Fase: MVP.
Requisitos e aceite: storage privado; acesso apenas ao professor responsável e aluno; URLs temporárias ou autenticação; política de retenção e exclusão; informar armazenamento; isolamento entre professores e organizações. Validar acesso cruzado, expiração e exclusão.

### SL-05 — Assistente de IA para Speaking
Prioridade: baixa. Fase: pós-MVP.
Possibilidades: transcrição; possíveis problemas gramaticais; reformulações naturais; palavras para revisão de pronúncia; comparação de tentativas; sugestões de feedback aprovadas pelo professor.
Aceite: IA apoia e nunca substitui automaticamente o julgamento docente; informar limitações e processamento das gravações; permissões apropriadas antes do uso. Transcrições e avaliações podem estar incorretas.

## EPIC 02 — LearningGap: lacunas de aprendizagem

Identificar habilidades e conteúdos a reforçar com resultados de atividades e avaliações. Problema: anotações individuais perdem o histórico de domínio e revisão.

### LG-01 — Catálogo de habilidades e conteúdos
Prioridade: alta. Fase: MVP.
Categorias iniciais: Speaking, Listening, Reading, Writing, Grammar, Vocabulary e Pronunciation. Professor cadastra e personaliza conteúdos como Simple Past, Present Perfect, Phrasal Verbs e Conditional Sentences e os associa às atividades.
Aceite: vários conteúdos por atividade; reutilização; consulta das atividades relacionadas ao conteúdo.

### LG-02 — Registro do desempenho por habilidade
Prioridade: alta. Fase: MVP.
Avaliar por habilidade após corrigir a atividade: ainda não avaliado, precisa reforçar, em desenvolvimento e demonstrou domínio; observações opcionais; histórico; evidências tradicionais e SpeakLoop.
Aceite: associação aluno/habilidade/atividade; avaliação revisável com histórico consultável; concluir atividade não significa dominar conteúdo.

### LG-03 — Painel de evolução do aluno
Prioridade: média. Fase: MVP.
Seção Evolução no perfil: habilidades trabalhadas, última avaliação, reforços, atividades relacionadas; filtros de período e categoria.
Aceite: só alunos autorizados; evidências consultáveis para cada status; ausência de avaliações significa falta de dados, não baixo desempenho.

### LG-04 — Sugestões de revisão
Prioridade: média. Fase: pós-MVP inicial.
Regras explícitas: repetição de precisa reforçar; dificuldade recente após domínio; sinalização do professor; falta de prática recente como candidata a revisão, nunca deficiência comprovada.
Lista com motivo, origem, criação de atividade vinculada e ações dispensar/concluir.
Aceite: não afirmar esquecimento sem evidência; origem consultável; sugestões não alteram avaliações automaticamente.

### LG-05 — Revisão espaçada inteligente
Prioridade: baixa. Fase: futuro.
Intervalos pelo histórico, exercícios curtos, frequência adaptada a novas respostas e aprovação/edição docente de exercícios gerados por IA. Primeira versão com regras explícitas e dados reais, sem exigir IA.

## EPIC 03 — ProgressLetter: relatórios de evolução

Relatórios profissionais e personalizados com dados existentes, evitando reunir informações manualmente para mostrar resultados a alunos ou responsáveis.

### PL-01 — Geração de relatório individual
Prioridade: alta. Fase: MVP.
Selecionar aluno e período; consolidar registros; atividades atribuídas, concluídas e pendentes; habilidades avaliadas e reforços quando disponíveis; frequência apenas com presença confiável; objetivos, conquistas e próximos passos editáveis; rascunho.
Aceite: quantitativos correspondem ao período; não inventar métricas quando faltarem dados; observações personalizáveis; salvar rascunho.

### PL-02 — Pré-visualização e aprovação
Prioridade: alta. Fase: MVP.
Prévia profissional identificando professor e aluno; resumo, pontos positivos, melhorias e próximos objetivos; edição; aprovação e publicação; datas de geração e publicação.
Aceite: rascunhos invisíveis ao aluno; alterações não modificam silenciosamente versões publicadas; professor pode cancelar publicação.

### PL-03 — Exportação e compartilhamento
Prioridade: alta. Fase: MVP.
PDF; relatório aprovado no portal; histórico por período; download autorizado; notificação opcional.
Aceite: aluno acessa apenas seus relatórios; arquivos e links privados; professor pode retirar publicação; responsáveis exigem autorização e fluxo próprio.

### PL-04 — Comparação entre períodos
Prioridade: média. Fase: pós-MVP.
Atividades realizadas, mudanças de avaliações, metas concluídas e histórico de speaking; gráficos somente com dados suficientes e comparáveis.
Aceite: períodos claros; não misturar escalas/critérios incompatíveis; quantidade de atividades não representa automaticamente aumento de proficiência.

### PL-05 — Assistente de IA para relatórios
Prioridade: baixa. Fase: futuro.
Resumo narrativo fundamentado, conquistas/dificuldades, objetivos futuros, linguagem para adultos ou responsáveis, português e inglês.
Aceite: toda afirmação fundamentada em registros; revisão e aprovação do professor antes da publicação.

## Requisitos compartilhados

### CORE-01 — Integração com o domínio existente
Reutilizar cadastros, autenticação passwordless do aluno, vínculos professor/aluno, aulas, atividades, materiais, notificações quando disponíveis e autorização/isolamento. Não criar cadastros paralelos.

### CORE-02 — Modelo mínimo de evidências
Associar aluno, atividade ou submissão, habilidade/conteúdo, avaliação, data e professor responsável. Base de LearningGap e ProgressLetter.

### CORE-03 — Privacidade e controle de acesso
Áudios, avaliações e relatórios privados; professor apenas seus alunos autorizados e aluno apenas seus dados; retenção/exclusão; informar provedores externos de IA; consentimento e regras específicas para menores.

## Ordem recomendada de implementação

1. Fundação: CORE-01, CORE-02, CORE-03 e LG-01.
2. Speaking: SL-01 a SL-04, entrega/correção manual e LG-02.
3. Evolução: LG-03 e LG-04.
4. Relatórios: PL-01 a PL-03, revisão docente e PDF.
5. Inteligência: SL-05, LG-05, PL-04 e PL-05, somente após validar fluxos manuais e utilidade dos registros.

## Métricas de valor

- SpeakLoop: percentual entregue, quantidade corrigida, tempo entre entrega e feedback.
- LearningGap: percentual avaliado por habilidade, revisões sugeridas aplicadas, evolução após reforço.
- ProgressLetter: percentual gerado/publicado, tempo de preparação e alunos que consultaram relatórios.

## Fora do escopo inicial

Correção totalmente automática de pronúncia; diagnóstico exclusivamente por IA; grades curriculares completas automáticas; relatórios sem aprovação docente; gravação automática das videoaulas; rankings públicos.

## Critério de encerramento da proposta

Cada item permanece aberto até implementação e validação dos próprios critérios. Definir retenção, consentimento, limites, compatibilidade móvel e custos de storage antes de implementar. Valores sugeridos, como três minutos, ainda precisam de validação de produto.
