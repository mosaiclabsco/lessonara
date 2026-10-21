# Entrega de emails e webhook Resend

## Estados apresentados

O processamento da fila e a entrega são estados diferentes. O worker mantém `pending`, `sending`, `sent`, `failed` e `cancelled`; `sent` significa que a API aceitou o envio. A coluna `delivery_status` guarda o resultado informado pelo webhook.

| Tela de Emails | Significado |
|---|---|
| Aguardando envio / Enviando | Trabalho pendente ou em processamento |
| Aceito pelo provedor | Resend aceitou, sem confirmação de entrega |
| Entregue ao servidor de email | Servidor do destinatário aceitou; não comprova leitura nem caixa principal |
| Entrega atrasada | Falha temporária; o provedor ainda tenta entregar |
| Falha no envio | Falha do worker ou evento de falha, rejeição, supressão ou spam |
| Cancelado | Envio cancelado por mudança de dados, permissões ou supressão |

Não há notificação extra ao professor. O resultado aparece no histórico de Emails. Emails históricos sem eventos continuam como aceitos pelo provedor; não são convertidos retroativamente em entregues por suposição.

## Configuração operacional

1. Aplicar `0022_email_delivery_events.sql` antes de publicar os leitores dos novos campos e o worker que consulta supressões.
2. Configurar no Resend o endpoint HTTPS `/api/webhooks/resend` do ambiente correto, com eventos `email.delivered`, `email.delivery_delayed`, `email.bounced`, `email.complained`, `email.failed` e `email.suppressed`.
3. Guardar o signing secret como `RESEND_WEBHOOK_SECRET` somente no servidor do ambiente. A chave de envio restrita não tem permissão de administrar webhooks; não ampliar sua permissão apenas por isso.
4. Publicar o endpoint com o segredo, conferir uma entrega de teste autorizada pelo provedor e verificar a atualização do registro correspondente. Uma resposta de teste sem `provider_id` de um email real não prova mudança de status de um envio real.
5. Conferir no painel do provedor as entregas/retries do webhook. Falha de gravação no banco responde 503 para permitir nova tentativa. Sem segredo, a rota permanece fechada com 503.

## Integridade e privacidade

O SDK verifica assinatura Svix sobre o corpo original, incluindo a janela temporal da assinatura. A rota limita o corpo a 32 KB, recusa assinatura inválida e confirma eventos autenticados que não são usados. Não há autorização por sessão de professor nessa rota: a autorização é a assinatura do provedor.

O banco deduplica pelo identificador estável `svix-id` e conserva somente tipo, horários e ID opaco do provedor; o corpo inteiro e o endereço recebido no webhook não são armazenados. O destinatário é obtido da própria outbox. Eventos que chegam antes de o worker gravar `provider_id` ficam registrados e são aplicados quando essa referência é gravada. Reclamações e rejeições permanentes prevalecem sobre eventos atrasados ou fora de ordem.

Bounce permanente, reclamação de spam e supressão interrompem novos envios ao endereço e cancelam os que ainda estão pendentes. O worker confere a supressão antes de enviar, inclusive OTP. Uma mensagem já em trânsito no provedor pode ser entregue apesar de um bloqueio posterior. A supressão segue o endereço; corrigir o email do aluno permite usar o endereço novo. Não existe desbloqueio automático de um endereço que reclamou de spam.

## Verificação

Os testes locais assinam o contrato de evento com chave exclusivamente de teste e cobrem autenticação, adulteração, replay expirado, falha do banco, corpo grande, eventos ignorados e bloqueio de destinatário. Migração, configuração do endpoint e entrega real precisam de evidência própria antes de declarar a integração ativa em produção.

Referências: [verificação de assinatura](https://resend.com/docs/webhooks/verify-webhooks-requests) e [tipos de evento](https://resend.com/docs/webhooks/event-types).
