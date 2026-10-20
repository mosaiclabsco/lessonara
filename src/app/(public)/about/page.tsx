import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Lessonara · Sua rotina de aulas organizada",
  description:
    "Agenda, alunos, pacotes, materiais e atividades em um só espaço para professores particulares.",
};

export default function AboutPage() {
  return (
    <>
      <section className="public-hero">
        <p className="eyebrow">MAIS TEMPO PARA ENSINAR</p>
        <h1>
          Uma rotina mais leve
          <br />
          para quem ensina.
        </h1>
        <p>
          O Lessonara reúne alunos, aulas, pacotes e materiais em um só espaço. Organize seus
          próximos encontros e acompanhe cada aluno com clareza.
        </p>
        <Link className="btn" href="/login">
          Entrar no meu espaço
        </Link>
      </section>
      <section className="public-features" aria-label="Recursos do Lessonara">
        <article className="card">
          <h2>Agenda e pacotes</h2>
          <p>
            Configure a duração das aulas, os horários fixos ou avulsos e as reposições. Acompanhe
            os créditos e os pagamentos registrados.
          </p>
        </article>
        <article className="card">
          <h2>Materiais e atividades</h2>
          <p>
            Compartilhe documentos, receba entregas e registre correções. Cada aluno acessa seu
            próprio espaço.
          </p>
        </article>
        <article className="card">
          <h2>Google Calendar e Meet</h2>
          <p>
            Com sua autorização, consulte horários ocupados e crie eventos de aula com links do Meet
            e convites para os alunos.
          </p>
        </article>
      </section>
      <section className="public-copy card mb-7">
        <h2>A aula acontece no seu espaço</h2>
        <p>
          A sala online do Lessonara reúne videochamada, compartilhamento de tela e quadro branco.
          Professor e aluno entram pelo próprio acesso ao sistema, sem uma senha extra de sala. Cada
          aula tem sua sala, e o professor troca de encontro manualmente.
        </p>
      </section>
      <section className="public-copy card">
        <h2>Você escolhe conectar sua agenda</h2>
        <p>
          A integração Google é opcional. O Lessonara consulta a disponibilidade da agenda principal
          e cria ou atualiza os eventos das aulas. Os horários ocupados de outros compromissos são
          usados para evitar conflitos, sem mostrar seus títulos.
        </p>
        <p>
          As permissões solicitadas permitem gerenciar eventos e consultar disponibilidade. A
          integração atual usa a agenda principal e envia ao Google os dados necessários para o
          evento e o convite do aluno.
        </p>
        <p>
          Conheça nossa <Link href="/privacy">Política de Privacidade</Link> e os{" "}
          <Link href="/terms">Termos de Uso</Link>. Para falar com a Mosaic Labs sobre o Lessonara:{" "}
          <a href="mailto:lessonara@mosaic-labs.co">lessonara@mosaic-labs.co</a>.
        </p>
      </section>
    </>
  );
}
