# Convite e definição de senha do professor

O administrador convida professores em **Lessonara → Contas → Convidar professor**. Nome, email e plano inicial são validados no servidor. O plano selecionado pertence à plataforma e precisa estar ativo; o acesso efetivo é aplicado pelo mecanismo autoritativo do Lessonara. Contas novas começam em avaliação no cadastro comercial, sem registrar pagamento ou liberar créditos de aulas.

O professor recebe um email com **Definir minha senha** e escolhe sua própria senha, com no mínimo 12 caracteres. Não há senha provisória enviada por email. Depois de salvar, entra normalmente pelo login do Lessonara.

Para uma conta de professor existente, o envio prepara um link de recuperação: preserva o cadastro, os dados, o plano e a assinatura. Selecionar um plano diferente durante o convite é recusado; alterações comerciais usam o fluxo próprio de troca de plano. O acesso ao Mosaic Admin é independente.

## Link e proteção

A página `/login/password` recebe o token no fragmento do endereço. Abrir a página não consome o link; a validação ocorre ao enviar o formulário. O servidor aceita somente convite ou recuperação válidos, confirma o usuário no Supabase Auth e seu vínculo de professor e aplica limites por IP e por link.

Se o provedor rejeitar a nova senha após consumir o token, a tentativa pode ser repetida com uma prova criptografada em cookie HttpOnly, Secure em produção, SameSite Strict, restrito à página e válido por até 15 minutos. Esse cookie não é uma sessão normal do portal. Após concluir, ele é apagado e as sessões do professor são encerradas; é necessário fazer login com a nova senha.

Convite e recuperação são autenticação básica em todos os planos. A emissão e o reenvio exigem administrador no backend; não dependem da funcionalidade comercial de campanhas de email. Tokens, links e senhas não são registrados na auditoria. O status informa envio aceito pelo provedor e definição de senha, sem afirmar entrega sem confirmação.

## Verificação

Testes automatizados cobrem validação de senha, vínculo de professor, token inválido ou reutilizado, limites de tentativas, cookie de repetição e proibição de alterar outra conta ou plano. O teste real solicitado usa somente a conta já existente do responsável pelo produto. O recebimento do email e a escolha da senha precisam ser confirmados pelo destinatário antes de convidar a professora do piloto.

Validação desta implementação: 452 testes do Lessonara aprovados, build e lint dos arquivos alterados aprovados; publicação conferida na Vercel e tela inspecionada no navegador. O email real de teste foi aceito pelo provedor e teve acompanhamento e auditoria registrados. O plano existente permaneceu Essential. Entrega na caixa de entrada e submissão da senha pelo destinatário continuam aguardando confirmação; a chave de envio não permite consultar a entrega no provedor.

O limite de OTP de recuperação configurado no provedor é 600 segundos. Use o link de recuperação em até 10 minutos do envio. O cookie de repetição de até 15 minutos somente existe depois de um token válido ser resgatado; ele não prolonga a validade do link ainda não utilizado.
