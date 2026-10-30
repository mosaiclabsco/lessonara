# Microsoft Store — preparação do piloto

Estado em 30/10/2026: configuração e workflow preparados; **nenhum pacote foi enviado à Store, nenhuma listagem foi criada e nenhum pacote foi assinado pela Microsoft**. Falta concluir o acesso ao Partner Center e obter a identidade real do aplicativo. O aviso de atualização dos termos da conta Microsoft exige revisão pessoal do titular. A visibilidade desejada ainda aguarda confirmação; a preparação não autoriza listagem pública.

## Identidade e conta

1. Concluir o aviso da conta na aba aberta; se necessário, iniciar o cadastro gratuito por https://storedeveloper.microsoft.com. O titular escolhe Individual ou Company e conclui a verificação de identidade e os contratos. Company exige a entidade jurídica real; o nome da marca não substitui esse cadastro.
2. No Partner Center, reservar o nome do app e abrir Product management → Product identity.
3. Copiar exatamente `Package/Identity/Name`, `Package/Identity/Publisher` e `Package/Properties/PublisherDisplayName`. Não usar os valores sintéticos dos testes nem inventar um Publisher. Estes campos são identidade pública, sem senha/certificado.

## Pacote

A versão fixada de electron-builder (26.17.0) tem target `appx`, aceito no fluxo Microsoft Store para apps MSIX/AppX. Não renomear `.exe` ou `.appx` para fingir conversão. O perfil `electron-builder.store.cjs` reaproveita o aplicativo e o protocolo `lessonara://`, sem hooks de registro NSIS. O registro vem do manifesto; não tentamos registrá-lo em runtime quando o Electron detecta contexto Windows Store.

O workflow manual **Desktop Store package**, apenas na main, exige os três campos reais de identidade e gera o artefato `store-package-for-review` por sete dias. Não envia arquivos para o Partner Center, não cria release pública e não escolhe a audiência. O pacote de entrada ainda não é confiável para instalação direta fora da Store; a Microsoft o assina após certificação.

Alternativa em Windows com as variáveis `STORE_IDENTITY_NAME`, `STORE_PUBLISHER` e `STORE_PUBLISHER_DISPLAY_NAME` definidas no ambiente:

```powershell
npm ci
npm test
python -B -m unittest discover -s scripts -p 'test_*.py'
npm run package:store
python scripts/verify-store-package.py out/store/Lessonara-0.3.3-store-x64.appx
```

O verificador exige identidade/editor correspondentes, executável presente, protocolo exato, idiomas PT/EN/ES/FR e somente `runFullTrust`, `internetClient`, `webcam` e `microphone`. Full trust é necessário para este app Electron desktop e sua sobreposição/captura; não concede direitos de administrador. A conta e o backend continuam controlando professor, plano, vínculo e ocorrência da aula. O pacote não concede acesso por si só.

## Audiência e validação antes de enviar

- Para um piloto restrito, configurar **Private audience**, com grupo de contas Microsoft dos testadores, antes da primeira submissão. "Hidden" ou um link não listado não equivalem a uma lista de contas autorizadas. Não trocar para audiência pública por inferência.
- Os testadores precisam usar a conta Microsoft convidada na Store. Usar a identidade Microsoft da professora confirmada por ela; não assumir que todo email de login do Lessonara seja uma conta Microsoft.
- Preencher descrição, ícones, screenshots reais e links de privacidade/suporte. Identificar claramente que é um cliente de chamadas para contas Lessonara existentes; o portal completo abre no navegador. Não prometer recursos de portal dentro do app.
- Fornecer ao processo de revisão uma conta de teste em dados fictícios, em canal apropriado e separado dos logs/artefatos públicos; não enviar credenciais reais de professores ou alunos.
- No Windows, validar o pacote adquirido pela Store: primeiro login, aula pelo protocolo, câmera, áudio bidirecional, compartilhamento de tela/janela, caneta/laser/texto, sair/entrar e atualização. Conferir convivência com a prévia NSIS; remover instalações só com ação/consentimento do titular.
- Conferir o nome do editor, a assinatura e o status de aprovação. Pacote gerado, upload e aprovação são etapas distintas. Atualizar links do portal somente depois de existir uma distribuição funcional na audiência escolhida.

## Referências oficiais

- [Cadastro de desenvolvedor](https://learn.microsoft.com/en-us/windows/apps/publish/partner-center/open-a-developer-account)
- [Identidade do app](https://learn.microsoft.com/en-us/windows/apps/publish/view-app-identity-details)
- [Visibilidade de apps MSIX](https://learn.microsoft.com/en-us/windows/apps/publish/publish-your-app/msix/visibility-options)
- [Beta testing e audiência privada](https://learn.microsoft.com/en-us/windows/apps/publish/beta-testing-and-targeted-distribution)
- [Assinatura de código e distribuição pela Store](https://learn.microsoft.com/en-us/windows/apps/package-and-deploy/code-signing-options)
- [Target AppX do electron-builder](https://www.electron.build/docs/appx/)
