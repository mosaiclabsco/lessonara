# Assinatura Windows — opções verificadas em 29/10/2026

O instalador atual é uma prévia sem assinatura de editor. Alterar o nome não cria confiança no Windows. A próxima prévia usa `Lessonara-0.3.2.exe`; o aplicativo instalado continua `Lessonara.exe`. Não orientar a desativar SmartScreen ou antivírus.

## Opções

- **Microsoft Store com MSIX:** distribuição mundial; a Store assina o pacote após certificação. Exige cadastro, empacotamento MSIX e revisão do protocolo/captura/atualizações. Publicar o EXE tradicional na Store não transfere a obrigação de assiná-lo ao Microsoft.
- **Certificado OV de uma autoridade confiável:** opção para distribuição direta no Brasil, sujeita à validação de identidade, preço e HSM/token da emissora. O material Microsoft indica faixa típica de US$150–300/ano, sem garantir o preço final da emissora.
- **Azure Artifact Signing:** preço básico informado de aproximadamente US$9,99/mês, mas a disponibilidade pública consultada restringe organizações a EUA/Canadá/UE/Reino Unido e indivíduos a EUA/Canadá. Não assumir elegibilidade de um titular no Brasil.

Assinatura válida identifica o editor e permite acumular reputação; não garante ausência imediata de todo alerta SmartScreen para uma versão nova. Certificado autoassinado não resolve a distribuição pública.

## Estado e próxima ação

Nenhum certificado/serviço foi contratado ou configurado. Selecionar Store/MSIX ou uma emissora que valide o titular; somente depois integrar assinatura de executável e instalador com timestamp no CI, segredo protegido e verificação Authenticode. A versão curta não deve ser apresentada como assinada.

Fontes oficiais: [opções Microsoft](https://learn.microsoft.com/en-us/windows/apps/package-and-deploy/code-signing-options), [SmartScreen](https://learn.microsoft.com/en-us/windows/apps/package-and-deploy/smartscreen-reputation).
