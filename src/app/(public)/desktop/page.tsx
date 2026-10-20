import { Icon } from "@/components/icon";
import { DESKTOP_RELEASE_URL, DESKTOP_WINDOWS_RELEASE_URL } from "@/lib/desktop-links";
export const metadata = { title: "App para computador · Lessonara" };
export default function DesktopDownload() {
  return (
    <article className="public-copy card">
      <h1>Lessonara · Chamadas</h1>
      <p>
        Entre nas aulas pelo aplicativo usando sua conta de professor do plano Pro. Seus alunos
        podem continuar no navegador.
      </p>
      <div className="mt-6 grid gap-6 sm:grid-cols-2">
        <section>
          <h2>Windows</h2>
          <p>Windows de 64 bits · Intel ou AMD</p>
          <a className="btn mt-4" href={DESKTOP_WINDOWS_RELEASE_URL}>
            <Icon name="download" className="h-4 w-4" />
            Baixar para Windows
          </a>
          <p className="text-sm text-muted mt-4">
            Execute o instalador e siga as etapas. Depois, abra o Lessonara e entre com sua conta.
          </p>
        </section>
        <section>
          <h2>Mac</h2>
          <p>Mac com chip Apple Silicon</p>
          <a className="btn mt-4" href={DESKTOP_RELEASE_URL}>
            <Icon name="download" className="h-4 w-4" />
            Baixar para Mac
          </a>
          <p className="text-sm text-muted mt-4">
            Descompacte o arquivo, mova o Lessonara para Aplicativos e abra para entrar com sua
            conta.
          </p>
        </section>
      </div>
      <h2>Como entrar nas aulas</h2>
      <ol className="space-y-3">
        <li>Abra o app e entre com seu email e senha para ver suas chamadas.</li>
        <li>
          Ao entrar numa aula pelo site, escolha “Abrir no app”. O portal continua no navegador.
        </li>
        <li>
          Escolha uma tela inteira ou uma janela para compartilhar. Para usar anotações sobre outros
          aplicativos, compartilhe a tela inteira.
        </li>
      </ol>
      <p className="text-sm text-muted mt-6">
        Versão 0.3.1 de teste. Ao minimizar uma chamada ativa, ela continua numa janela flutuante. A
        barra de anotações oferece caneta, laser, texto, borracha, dez cores e desfazer; Esc libera
        os cliques na tela. No Mac, a barra pode aparecer na transmissão.
      </p>
      <p className="text-sm text-muted">
        Os pacotes de teste ainda não têm assinatura de distribuição para Windows nem notarização da
        Apple. Se o sistema bloquear a abertura, mantenha as proteções e entre na aula pelo
        navegador. No Windows, chamadas e compartilhamento ainda precisam ser conferidos em uso
        real.
      </p>
      <p>
        <a href="/login">Entrar pelo navegador</a>
      </p>
    </article>
  );
}
