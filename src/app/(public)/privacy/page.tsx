import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Política de Privacidade · Lessonara" };

export default function PrivacyPage() {
  return (
    <article className="public-copy public-policy card">
      <p className="eyebrow">TRANSPARÊNCIA SOBRE SEUS DADOS</p>
      <h1>Política de Privacidade</h1>
      <p className="public-updated">Atualizada em 11 de outubro de 2026</p>
      <p>
        Esta política explica o tratamento de dados no Lessonara, serviço da Mosaic Labs para
        organização de aulas particulares. O contato para privacidade e suporte é{" "}
        <a href="mailto:lessonara@mosaic-labs.co">lessonara@mosaic-labs.co</a>.
      </p>
      <h2>Dados usados pelo serviço</h2>
      <p>
        Usamos os dados da conta do professor, como nome e email, suas preferências e configurações
        de aula. O professor cadastra os dados dos alunos, incluindo nome, email e telefone quando
        informado, além de planos, horários, créditos, registros de pagamentos, materiais,
        atividades, entregas e comentários de correção. Esses dados permitem organizar as aulas,
        disponibilizar o espaço do aluno e enviar comunicações relacionadas ao serviço.
      </p>
      <p>
        Registros técnicos de acesso, erros e desempenho ajudam a operar e proteger o serviço. O
        registro de pagamentos é administrativo; o Lessonara não solicita dados de cartão para essa
        função.
      </p>
      <h2>Conexão com Google Calendar e Meet</h2>
      <p>
        A conexão é opcional e depende da autorização do professor. Solicitamos as permissões de
        gerenciamento de eventos (calendar.events) e consulta de disponibilidade
        (calendar.freebusy). Embora a permissão de eventos concedida pelo Google tenha alcance sobre
        os calendários da conta, a implementação atual utiliza a agenda principal.
      </p>
      <p>
        Consultamos intervalos ocupados para evitar sobreposição de aulas, sem importar títulos ou
        descrições de compromissos pessoais para a lista de disponibilidade. Criamos, atualizamos e
        removemos eventos das aulas gerenciadas pelo Lessonara. Para isso, enviamos ao Google dados
        como horário, duração, identificação da aula e nome e email do aluno. O aluno pode receber
        um convite do Google Calendar. Armazenamos os links do Meet e identificadores necessários à
        sincronização.
      </p>
      <p>
        Os tokens de acesso e renovação são armazenados de forma criptografada no servidor para
        manter a conexão e sincronizar aulas sem pedir autorização a cada operação. Não são exibidos
        aos alunos.
      </p>
      <p>
        O uso e a transferência de informações recebidas das APIs do Google seguem a{" "}
        <a href="https://developers.google.com/terms/api-services-user-data-policy">
          Google API Services User Data Policy
        </a>
        , incluindo seus requisitos de uso limitado. Esses dados servem às funções visíveis de
        agenda e aulas; não são vendidos, usados para anúncios ou para treinamento de modelos de
        inteligência artificial. Acesso humano a esses dados fica limitado às situações permitidas
        pela política do Google, como suporte com autorização, segurança ou obrigação legal.
      </p>
      <h2>Sala de aula do Lessonara</h2>
      <p>
        A sala online utiliza Jitsi hospedado em infraestrutura administrada pela Mosaic Labs.
        Professor e aluno entram com sua sessão do Lessonara; o servidor valida o vínculo com a aula
        e emite uma autorização limitada à sala e ao seu horário. Nome de exibição e identificador
        do participante são usados na videochamada. Câmera, microfone e compartilhamento de tela
        dependem das permissões e ações no navegador.
      </p>
      <p>
        A comunicação pode ser direta entre participantes ou passar pela infraestrutura de vídeo e
        serviços de conexão de rede. Participantes recebem o áudio, vídeo, tela e anotações que você
        compartilhar; informações técnicas de conexão, como endereços de rede, são necessárias à
        chamada. A sala não oferece gravação ou transcrição nesta versão. O professor pode
        apresentar um PDF da sua área de Documentos ou enviar um novo arquivo para ela. O documento
        selecionado fica visível aos participantes autorizados daquela aula, por links temporários.
        Somente o professor pode escrever no PDF ou no quadro nesta versão. Os arquivos enviados
        permanecem em Documentos privada do professor. O quadro e as anotações são temporários na
        chamada e não são salvos como uma nova versão do PDF; deixam de estar disponíveis quando
        todos os participantes saem.
      </p>
      <h2>Aplicativo desktop de teste</h2>
      <p>
        O app para Mac abre o Lessonara em uma janela própria. O professor autentica sua conta
        dentro do app; a sessão é armazenada no computador separadamente da sessão do navegador. O
        link de abertura identifica apenas a ocorrência da aula e não contém senha ou token da
        chamada. Câmera, microfone e compartilhamento de tela dependem da autorização no app e no
        sistema operacional. O aluno pode continuar usando o navegador.
      </p>
      <h2>Serviços que processam dados</h2>
      <p>
        Usamos Vercel para hospedagem e métricas técnicas de uso e desempenho; Supabase para
        autenticação, banco de dados e armazenamento de arquivos; Resend para emails do serviço; e
        Google para Calendar e Meet quando a conexão estiver ativa. Esses fornecedores podem
        processar dados em outros países conforme sua infraestrutura e políticas. O compartilhamento
        atende à operação dessas funções e às obrigações aplicáveis, sem venda de dados pessoais.
      </p>
      <p>
        Materiais, entregas e correções ficam disponíveis aos professores e alunos vinculados às
        respectivas atividades e compartilhamentos. Emails e convites usam os endereços cadastrados
        pelo professor.
      </p>
      <h2>Cookies e proteção</h2>
      <p>
        Cookies de sessão permitem autenticar professores e alunos. Cookies de preferência guardam
        idioma e aparência neste navegador. Usamos conexão HTTPS, controles de acesso por conta e
        arquivos privados com links temporários de download. Um arquivo já baixado pode permanecer
        com quem o recebeu.
      </p>
      <h2>Conservação e desconexão</h2>
      <p>
        Os dados são mantidos enquanto necessários à prestação do serviço, aos registros solicitados
        pelo professor, à segurança e ao cumprimento de obrigações legais. Pedidos de exclusão são
        avaliados considerando essas finalidades e as retenções legalmente necessárias; cópias de
        segurança seguem os ciclos de armazenamento dos serviços utilizados.
      </p>
      <p>
        Você pode desconectar o Google em Configurações → Integrações ou revogar o acesso nas{" "}
        <a href="https://myaccount.google.com/permissions">permissões da sua Conta Google</a>. Ao
        desconectar pelo Lessonara, removemos as credenciais da conexão e solicitamos a revogação do
        token. Isso interrompe a sincronização, mas não apaga automaticamente os eventos já criados
        na agenda Google. Para solicitar remoção de dados e eventos associados, entre em contato.
      </p>
      <h2>Seus direitos e contato</h2>
      <p>
        Você pode solicitar confirmação do tratamento, acesso, correção, informações sobre
        compartilhamento e, quando aplicável, portabilidade, bloqueio, anonimização, exclusão ou
        revogação de consentimento. Envie o pedido a{" "}
        <a href="mailto:lessonara@mosaic-labs.co">lessonara@mosaic-labs.co</a>. Podemos pedir
        informações necessárias para verificar sua identidade sem expor dados de outra pessoa.
      </p>
      <p>
        O professor é responsável pelos dados e conteúdos que cadastra e compartilha de seus alunos.
        Pedidos sobre esses registros podem exigir sua participação. A proteção de dados de crianças
        e adolescentes deve observar as regras aplicáveis e o melhor interesse do aluno.
      </p>
      <h2>Atualizações desta política</h2>
      <p>
        Publicaremos as alterações nesta página com a data de atualização. Mudanças nas finalidades
        de uso dos dados Google serão informadas e, quando exigido, dependerão de nova autorização
        antes do novo uso.
      </p>
      <p>
        <Link href="/about">Conheça o Lessonara</Link> · <Link href="/terms">Termos de Uso</Link>
      </p>
    </article>
  );
}
