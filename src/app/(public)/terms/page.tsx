import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Termos de Uso · Lessonara" };

export default function TermsPage() {
  return (
    <article className="public-copy public-policy card">
      <p className="eyebrow">USO DO SERVIÇO</p>
      <h1>Termos de Uso</h1>
      <p className="public-updated">Atualizados em 9 de outubro de 2026</p>
      <p>
        O Lessonara, da Mosaic Labs, é uma ferramenta de organização de aulas particulares, alunos,
        pacotes, materiais e atividades. Dúvidas sobre o serviço podem ser enviadas a{" "}
        <a href="mailto:lessonara@mosaic-labs.co">lessonara@mosaic-labs.co</a>.
      </p>
      <h2>Conta e acesso</h2>
      <p>
        Use informações corretas e mantenha suas credenciais de acesso protegidas. O professor deve
        compartilhar convites somente com o aluno correspondente e cadastrar dados que esteja
        autorizado a utilizar. O aluno acessa apenas o espaço e os materiais que lhe forem
        disponibilizados.
      </p>
      <h2>Aulas, pacotes e pagamentos</h2>
      <p>
        O professor define duração, frequência, créditos, valores e regras de feriados, faltas e
        reposições. Deve informar essas condições aos alunos. Os registros de pagamento são
        lançamentos administrativos; cadastrar um pagamento no Lessonara não realiza uma
        transferência bancária ou cobrança de cartão.
      </p>
      <p>
        As relações de ensino e os acordos de pagamento são estabelecidos entre professor e aluno.
        Confira os dados antes de confirmar agendamentos, alterações ou exclusões.
      </p>
      <h2>Materiais e atividades</h2>
      <p>
        Compartilhe apenas conteúdos que tenha direito e autorização para usar. Não envie arquivos
        maliciosos, conteúdo ilegal ou dados pessoais desnecessários à atividade. O professor
        escolhe os destinatários dos materiais e é responsável pelas orientações e correções que
        disponibiliza.
      </p>
      <h2>Sala online</h2>
      <p>
        O professor e o aluno vinculados à aula podem acessar a sala do Lessonara durante o horário
        permitido: de 15 minutos antes do início até 30 minutos depois do fim previsto. Compartilhar
        o endereço não concede acesso a outra pessoa. O professor entra como moderador e decide
        manualmente quando sair e trocar de sala; o serviço não o transfere automaticamente para
        outra aula.
      </p>
      <p>
        Áudio, vídeo e compartilhamento dependem dos dispositivos, das permissões do navegador e da
        rede. O quadro e as anotações não são armazenados como material permanente. Gravação e
        transcrição não estão disponíveis nesta versão.
      </p>
      <h2>Integração Google</h2>
      <p>
        A integração é opcional e depende da autorização do titular da conta Google. O Lessonara usa
        a agenda principal para consultar disponibilidade e gerenciar eventos de aula com Meet. Os
        convites são enviados aos emails cadastrados; confira esses endereços antes de agendar.
      </p>
      <p>
        A disponibilidade dos recursos também depende do Google, das permissões concedidas e do
        estado da conexão. Desconectar a integração interrompe novas sincronizações e não remove
        automaticamente eventos existentes. Consulte a{" "}
        <Link href="/privacy">Política de Privacidade</Link> para conhecer o uso dos dados e como
        revogar o acesso.
      </p>
      <h2>Operação e suporte</h2>
      <p>
        O serviço pode receber melhorias e passar por manutenção. Problemas de acesso, sincronização
        ou dados devem ser comunicados a{" "}
        <a href="mailto:lessonara@mosaic-labs.co">lessonara@mosaic-labs.co</a>. A identificação de
        uma falha não substitui a conferência de eventos e registros importantes pelo professor.
      </p>
      <p>
        Eventuais condições comerciais de contratação devem ser apresentadas antes de uma
        contratação. Estes termos não estabelecem cobrança automática nem preços para opções de
        assinatura exibidas como futuras.
      </p>
      <h2>Encerramento e alterações</h2>
      <p>
        Para solicitar encerramento da conta ou tratar da exclusão de dados, utilize o contato de
        suporte. O tratamento de dados segue a <Link href="/privacy">Política de Privacidade</Link>{" "}
        e a legislação aplicável. Publicaremos alterações destes termos nesta página com a data de
        atualização, informando mudanças relevantes aos usuários.
      </p>
    </article>
  );
}
