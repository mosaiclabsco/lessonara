# Revisão de segurança do Lessonara

## Conclusão e escopo

A revisão pré-lançamento foi um pentest de caixa-cinza não destrutivo, com leitura de código e testes dinâmicos autorizados. Não é certificação nem garantia de ausência de falhas. Não cobriu brute force pesado, fuzzing de upload ou engenharia social.

O responsável informou a conclusão de SAST (semgrep, gitleaks, ESLint e TypeScript sem achados pendentes), DAST com ZAP 0 FAIL, matriz D1–D17 sem IDOR/BOLA/BFLA/escalonamento e 280 testes passando no fechamento daquela revisão. Esses números pertencem ao ciclo auditado; não representam uma nova execução do pentest após cada alteração de produto.

Este documento consolida o estado informado e as evidências anteriores, separando correção de código, configuração operacional e cobertura ainda não executada. O relatório detalhado original de 18/10/2026 permanece preservado no arquivo de auditoria do responsável; esta é a visão atual centralizada no repositório.

## Achados e controles

| Itens | Estado da revisão recebida | Evidência/limite |
|---|---|---|
| C1 | Corrigido em configuração | API keys JWT legadas desativadas; assinatura HS256 anterior revogada; ES256 atual |
| C2 | Prazo corrigido; limitação de cookie documentada | Limite absoluto de 24h no portal, hook de token, Data API e RLS. Cookie acessível por JS mantido para cliente de upload/realtime |
| C3 | Corrigido no deploy auditado | Headers/CSP e proteção contra framing. CSP permite inline por compatibilidade com PPR; não é política estrita de nonce. QA de mídia sob CSP segue pendente |
| C4 | Corrigido em código/configuração | Envelopes v3, nova raiz, credencial Google migrada e relida; formatos anteriores recusados e raiz antiga retirada; links de teste anteriores invalidados |
| C5 | Corrigido | Comparação do segredo cron em tempo constante |
| C6 | Alegação de revogação descartada; cleanup melhorado | Logout local revoga a sessão no servidor; limpeza em `finally` reforçada |
| C7 | Hardening corrigido | Tamanho de tag AES-GCM explícito |
| C8 | Pendente, baixo risco, pós-lançamento | ACAO `*` em HTML sem credenciais; sem exploração demonstrada na revisão |
| S1 | Controle confirmado | Cadastro público de professor desativado na configuração auditada |
| S2 | Corrigido em configuração | Turnstile, senha mínima 12, troca segura/senha atual, rate limit no login; login web e desktop conferidos após ativar CAPTCHA |
| S3 | Corrigido em configuração | OTP 600s; 2 verificações por 5 min/IP (24/h nominais com burst do provedor); backend encaminha IP confiável usando chave apropriada |
| S4 | Corrigido em configuração | URL de autenticação HTTPS canônica; sem redirects amplos/wildcards |
| S5 | Corrigido com isolamento restritivo | Proteção Vercel; segredos só Production; preview recusa servir dados até ter base isolada |
| Q1 | Corrigido | Formatação e verificação em CI |
| Q2 | Correção de paginação/execução encerrada no parecer recebido | Lotes, cursor e checkpoint duráveis, workers separados. Novo lembrete preparado/enviado de ponta a ponta ainda precisa de evidência operacional própria |
| Q3–Q4 | Corrigidos | Nomenclatura de IDs e actions de aluno separadas do painel, preservando autorização |

A matriz D1–D17 incluiu anônimo, professor proprietário, acesso cruzado entre professores, tentativa de mutação alheia, elevação de plano, storage, rotas públicas, cron sem segredo e origem inválida. As duas contas de teste eram Pro; isso não cobre a diferença Essencial × Pro.

## Workers e Google: o que foi observado

Em 20/10/2026, o histórico registra `CRON_SECRET` alinhado entre Production e Vault, chamadas manuais e automáticas de ambos os workers com HTTP 200, lote de lembretes concluído sem novos emails elegíveis e uma exclusão técnica de calendário concluída sem erro. Esse teste usou um ID sem evento real correspondente: comprova processamento idempotente da pendência, não a criação de evento/Meet, alteração, convite e cancelamento completos.

Não declarar um novo email real entregue apenas porque uma rota retornou 200 com a fila vazia. Também não confundir aceite da API do provedor com entrega; o webhook possui validação e implantação próprias descritas em [Entrega de emails](email-delivery.md).

## Pendências separadas da conclusão da auditoria

- Testar Jitsi com duas pessoas sob a CSP nova antes de liberar a sala aos alunos.
- Executar OTP com email real, matriz Essencial × Pro e Google Calendar ponta a ponta.
- Tratar C8 como hardening pós-lançamento.
- Confirmar configuração de backup e executar um restore de teste antes de ter clientes reais. Backup/restore ainda não foi verificado; não presumir recursos disponíveis apenas pelo plano do provedor.
- Concluir o cenário operacional de lembrete novo, processamento e entrega autorizada.

Cenários e critérios de encerramento ficam no [checklist de QA](qa-pendente.md) e no [backlog](../TASKS.md). Não marcar uma tarefa como validada por existir código ou um arquivo de migração.

## Mudanças posteriores ao ciclo auditado

A revisão de formulários e o webhook Resend desta rodada têm testes próprios. Não atribuir automaticamente a eles o resultado histórico do SAST/DAST. Antes de publicar, registrar checagens atuais, aplicação das migrações e configuração do segredo/endpoint. Se alguma etapa operacional ficar pendente, documentar explicitamente o estado em vez de declarar a funcionalidade ativa.

## Conferência desta rodada (20/10/2026)

- Migrações 0021/0022 aplicadas após teste transacional com rollback, sem persistir fixtures nem enfileirar emails reais.
- RLS ativo nas duas novas tabelas privadas de eventos e supressões; papel `authenticated` sem execução da RPC de eventos.
- Google: uma conexão sem erro, 14 jobs concluídos e nenhuma fila de calendário pendente; consulta real à API de disponibilidade passou, sem criar eventos/convites. O ciclo completo de evento/Meet continua em QA.
- Dashboard do Supabase mostrou “Last backup: No backups”. Isso não verifica se existe backup externo nem substitui teste de restore; manter a tarefa operacional aberta.
- Webhook Resend criado com seis eventos necessários e signing secret somente no Production da Vercel. A ativação e a entrega após publicação têm evidência operacional separada.

A rodada posterior foi publicada no commit `dc4ac60`. CI de formatação, ESLint, tipos/testes/build passou; a suíte local final teve 51 arquivos e 321 testes aprovados, além da consulta operacional Google executada separadamente. Foram confirmados os nove limites do banco sobre o histórico e os callbacks de entrega, rejeição e spam do Resend. Nenhum SAST/DAST completo novo é alegado por essas verificações. Ver [registro operacional](operations-validation.md).
