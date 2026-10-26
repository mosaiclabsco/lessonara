# Identidade visual do Lessonara

Os arquivos originais fornecidos para a marca ficam em `public/brand/complete-logo.svg` (símbolo e nome) e `public/brand/logo.svg` (somente símbolo). Preserve as proporções e as cores dos SVGs; não recrie o nome com a fonte do sistema.

Use `Logo` de `src/components/logo.tsx` nas assinaturas da marca, incluindo login, professor, aluno, chamadas e rodapés. Use `LogoMark` para espaços compactos. O SVG completo mantém um fundo claro discreto em superfícies escuras para preservar contraste, sem recolorir a arte.

Emails usam `public/brand/complete-logo.png`, uma cópia derivada do SVG completo para compatibilidade com os clientes de email. O template compartilhado cobre convites de aluno, OTP, lembretes, renovação e campanhas. O convite do professor é emitido pelo Mosaic Admin e aponta para a mesma imagem pública do Lessonara.

Recibos e relatórios PDF, assim como o XLSX financeiro, incorporam os bytes da imagem gerada em `src/lib/brand-image.json`, permitindo leitura offline. CSV continua sendo uma exportação de dados, sem imagem.

Para regenerar os derivados, execute `node scripts/generate-brand-assets.mjs`. O script usa o renderizador Sharp instalado com o Next e atualiza PNG de email, imagem incorporada, favicon ICO, SVG de ícone, ícone Apple e ícone PNG do desktop. No macOS, finalize com `iconutil -c icns /private/tmp/lessonara-brand.iconset -o desktop/icon.icns`. Os derivados são versionados; o build não precisa regenerá-los. Instaladores de desktop já distribuídos exigem uma nova compilação para atualizar o ícone do aplicativo instalado.

A marca é comum a todos os planos, sem alteração de permissões ou cotas. Não substituir marcas e documentos anexados pelos próprios professores.

Validação: builds do Lessonara e do admin aprovados; testes afetados dos emails e exportações aprovados; PDFs e planilha com dados fictícios renderizados e inspecionados. Ícones do desktop atualizados nos arquivos-fonte; instaladores existentes não foram republicados nesta mudança visual.
