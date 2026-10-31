import { ButtonLink } from "@/components/button";
import { DESKTOP_RELEASE_URL, DESKTOP_WINDOWS_RELEASE_URL } from "@/lib/desktop-links";
import { getTranslator } from "@/lib/i18n/server";
export const metadata = { title: "App para computador · Lessonara" };
export default async function DesktopDownload() {
  const { t } = await getTranslator();
  return (
    <article className="public-copy card">
      <h1>{t("Lessonara · Chamadas")}</h1>
      <p>
        {t(
          "Entre nas aulas pelo aplicativo usando sua conta de professor do plano Pro. Seus alunos podem continuar no navegador.",
        )}
      </p>
      <div className="mt-6 grid gap-6 sm:grid-cols-2">
        <section className="min-w-0">
          <h2>Windows</h2>
          <p>{t("Windows de 64 bits · Intel ou AMD")}</p>
          <ButtonLink
            icon="download"
            variant="primary"
            className="mt-4 w-full whitespace-normal! text-center"
            href={DESKTOP_WINDOWS_RELEASE_URL}
            prefetch={false}
          >
            {t("Baixar na Microsoft Store")}
          </ButtonLink>
          <p className="text-sm text-muted mt-4">
            {t("Instale pela Microsoft Store. Depois, abra o Lessonara e entre com sua conta.")}
          </p>
        </section>
        <section className="min-w-0">
          <h2>Mac</h2>
          <p>{t("Mac com chip Apple Silicon")}</p>
          <ButtonLink
            icon="download"
            variant="primary"
            className="mt-4 w-full whitespace-normal! text-center"
            href={DESKTOP_RELEASE_URL}
            download
            prefetch={false}
          >
            {t("Baixar para Mac")}
          </ButtonLink>
          <p className="text-sm text-muted mt-4">
            {t(
              "Descompacte o arquivo, mova o Lessonara para Aplicativos e abra para entrar com sua conta.",
            )}
          </p>
          <p className="text-sm text-muted">
            {t(
              "A versão para Mac ainda não tem notarização da Apple. Se o sistema bloquear a abertura, entre na aula pelo navegador.",
            )}
          </p>
        </section>
      </div>
      <h2>{t("Como entrar nas aulas")}</h2>
      <ol className="space-y-3">
        <li>{t("Abra o app e entre com seu email e senha para ver suas chamadas.")}</li>
        <li>
          {t(
            "Ao entrar numa aula pelo site, escolha “Abrir no app”. O portal continua no navegador.",
          )}
        </li>
        <li>
          {t(
            "Escolha uma tela inteira ou uma janela para compartilhar. Para usar anotações sobre outros aplicativos, compartilhe a tela inteira.",
          )}
        </li>
      </ol>
      <p className="text-sm text-muted mt-6">
        {t(
          "Ao minimizar uma chamada ativa, ela continua numa janela flutuante. Use caneta, laser e texto durante o compartilhamento; Esc libera os cliques na tela. No Mac, a barra pode aparecer na transmissão.",
        )}
      </p>
      <ButtonLink icon="video" className="mt-6" href="/login">
        {t("Entrar pelo navegador")}
      </ButtonLink>
    </article>
  );
}
