"use client";
import { useUploads } from "./upload-provider";
import { usePlatformPlan } from "./platform-plan-provider";
import { ConfirmDialog } from "./dialog";
import { Toast } from "./toast";
import { DocumentPicker } from "./document-picker";
import { Pagination } from "./pagination";
import { FileDownload } from "./file-download";
import { Icon } from "./icon";
import { BusyContent } from "@/components/busy-content";
import { useI18n } from "@/components/browser-preferences-provider";
import { useState, useTransition } from "react";
import Link from "next/link";
import { activityStatus, type Activity, type ActivityDocument } from "@/lib/activities";
import { activityDateTime } from "@/lib/activity-dates";
import { formatDate } from "@/lib/dates";
import { formatFileSize } from "@/lib/document-rules";
import { DOCUMENT_BUCKET, validateDocumentFile } from "@/lib/document-rules";
import {
  beginDocumentUpload,
  finishDocumentUpload,
  removeLibraryDocument,
} from "@/app/(panel)/documents/actions";
import {
  archiveActivity,
  assignActivity,
  removeSubmissionFile,
  reviewActivity,
} from "@/app/(panel)/activities/actions";
async function uploadActivityFile(
  file: File,
  title: string,
  maxBytes: number,
  send: ReturnType<typeof useUploads>["send"],
  subject: string,
) {
  validateDocumentFile(file.name, file.size, maxBytes);
  const prepared = await beginDocumentUpload({
    title: title.slice(0, 120),
    subject,
    fileName: file.name,
    byteSize: file.size,
  });
  if (!prepared.ok) throw new Error(prepared.message);
  await send({
    file,
    bucket: DOCUMENT_BUCKET,
    id: prepared.data.id,
    path: prepared.data.path,
    token: prepared.data.token,
    mimeType: prepared.data.mimeType,
    complete: async () => {
      const done = await finishDocumentUpload(prepared.data.id);
      if (!done.ok) throw new Error(done.message);
    },
    discard: async () => {
      const done = await removeLibraryDocument(prepared.data.id, true);
      if (!done.ok) throw new Error(done.message);
    },
  });
  return prepared.data.id;
}
function ActivityItem({
  activity,
  today,
  documents,
}: {
  documents: ActivityDocument[];
  activity: Activity;
  today: string;
}) {
  const { t, locale } = useI18n();
  const plan = usePlatformPlan();
  const uploads = useUploads();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState("");
  const [remove, setRemove] = useState(false);
  const [busyAction, setBusyAction] = useState("");
  const Card = activity.reviewed_at ? "details" : "section";
  const Heading = activity.reviewed_at ? "summary" : "div";
  return (
    <Card
      data-action-busy={pending}
      className={`card activity-card ${activity.reviewed_at ? "activity-completed" : ""}`}
    >
      <Heading className="section-heading">
        <div>
          <h3>{activity.title}</h3>
          <Link
            className="mt-1 inline-block text-xs text-accent hover:underline"
            href={`/students/${activity.studentId}#activities`}
          >
            {activity.studentName}
          </Link>
        </div>
        <span className="balance-pill">{t(activityStatus(activity, today))}</span>
        {activity.reviewed_at && <Icon name="arrow" className="h-4 w-4 activity-collapse-icon" />}
      </Heading>
      <p className="activity-dates">
        {t("Enviada em ")}
        {activityDateTime(activity.assigned_at, locale)}
        {t(" \u00B7 ")}
        {activity.due_on
          ? t("Entregar at\u00E9 {value0}", { value0: formatDate(activity.due_on, locale) })
          : t("Sem prazo de entrega")}
      </p>
      {activity.instructions && (
        <div className="activity-feedback">
          <h4>{t("Orientações do professor(a)")}</h4>
          <p className="activity-instructions">{activity.instructions}</p>
        </div>
      )}
      {activity.documentId && (
        <div className="mt-4">
          <FileDownload
            href={`/documents/${activity.documentId}/file`}
            label={t("Baixar exercício")}
            name={activity.documentName ?? undefined}
          />
        </div>
      )}
      {activity.submission?.submitted_at && (
        <div className="activity-delivery">
          <h4>{t("Entrega do aluno")}</h4>
          <p className="text-xs text-muted">
            {activityDateTime(activity.submission.submitted_at, locale)}
            {activity.submission.submitted_late ? t(" \u00B7 ap\u00F3s o prazo") : t("")}
          </p>
          <p className="mt-2 text-sm">
            {activity.submission.file_name}
            {t(" \u00B7 ")}
            {formatFileSize(activity.submission.byte_size)}
          </p>
          {activity.submission.note && (
            <p className="activity-instructions">{activity.submission.note}</p>
          )}
          {activity.submission.status === "ready" && (
            <div className="mt-3">
              <FileDownload
                href={`/activities/${activity.id}/submission`}
                label={t("Baixar entrega")}
                name={activity.submission.file_name}
              />
            </div>
          )}
          {activity.submission.status === "deleted" && (
            <p className="mt-2 text-xs text-muted">
              {t("Arquivo removido; hist\u00F3rico da entrega preservado.")}
            </p>
          )}
          <form
            key={`${activity.reviewed_at}-${activity.feedbackDocumentId}`}
            onSubmit={(event) => {
              event.preventDefault();
              if (pending) return;
              setBusyAction("review");
              setMessage("");
              const data = new FormData(event.currentTarget);
              startTransition(async () => {
                try {
                  let documentId = String(data.get("feedback_document") ?? "");
                  const file = data.get("feedback_file");
                  if (file instanceof File && file.size) {
                    documentId = await uploadActivityFile(
                      file,
                      t("Correção · {value0}", { value0: activity.title }),
                      plan.maxFileBytes,
                      uploads.send,
                      t("Correção de atividade"),
                    );
                  }
                  const result = await reviewActivity(
                    activity.id,
                    String(data.get("feedback") ?? ""),
                    documentId,
                  );
                  setMessage(result.ok ? "Conferência registrada." : result.message);
                } catch {
                  setMessage("Não foi possível registrar a conferência.");
                }
              });
            }}
            className="mt-4 space-y-3"
          >
            <label className="label" htmlFor={`feedback-${activity.id}`}>
              {t("Coment\u00E1rio para o aluno (opcional)")}
            </label>
            <textarea
              className="input"
              id={`feedback-${activity.id}`}
              name="feedback"
              rows={3}
              maxLength={4000}
              defaultValue={activity.feedback}
              disabled={pending}
            />
            <div>
              <label className="label">{t("Arquivo da correção (opcional)")}</label>
              <DocumentPicker
                documents={documents}
                name="feedback_document"
                defaultValue={activity.feedbackDocumentId ?? ""}
                fileName="feedback_file"
                disabled={pending}
              />
            </div>
            {activity.feedbackDocumentName && activity.feedbackDocumentId && (
              <FileDownload
                href={`/documents/${activity.feedbackDocumentId}/file`}
                label={t("Baixar correção")}
                name={activity.feedbackDocumentName}
              />
            )}
            <button
              className="btn-ghost"
              aria-busy={pending && busyAction === "review"}
              disabled={pending}
            >
              <BusyContent pending={pending && busyAction === "review"}>
                <Icon name="check" className="h-4 w-4" />
                {activity.reviewed_at
                  ? t("Atualizar confer\u00EAncia")
                  : t("Marcar como conferida")}
              </BusyContent>
            </button>
            {activity.reviewed_at && (
              <p className="text-xs text-muted">
                {t("Conferida em ")}
                {activityDateTime(activity.reviewed_at, locale)}
              </p>
            )}
          </form>
        </div>
      )}
      {activity.submission && !activity.submission.submitted_at && (
        <p className="mt-4 text-xs text-muted">
          {t(
            "Envio do aluno incompleto. Voc\u00EA pode descartar o arquivo para liberar uma nova tentativa.",
          )}
        </p>
      )}
      <div className="activity-controls">
        <button
          className="btn-xs btn-warning"
          aria-busy={pending && busyAction === "archive"}
          disabled={pending}
          onClick={() => {
            setBusyAction("archive");
            setMessage("");
            startTransition(async () => {
              try {
                const result = await archiveActivity(activity.id, !activity.archived_at);
                setMessage(result.ok ? "Atividade atualizada." : result.message);
              } catch {
                setMessage("Não foi possível atualizar a atividade.");
              }
            });
          }}
        >
          <BusyContent pending={pending && busyAction === "archive"}>
            <Icon name="archive" className="h-4 w-4" />
            {activity.archived_at ? t("Reabrir atividade") : t("Arquivar atividade")}
          </BusyContent>
        </button>
        {activity.submission && activity.submission.status !== "deleted" && (
          <>
            <button
              className="btn-xs btn-danger"
              aria-busy={pending && busyAction === "remove"}
              disabled={pending}
              onClick={() => setRemove(true)}
            >
              <BusyContent pending={pending && busyAction === "remove"}>
                <Icon name="trash" className="h-4 w-4" />
                {remove
                  ? t("Confirmar remo\u00E7\u00E3o do arquivo")
                  : activity.submission.submitted_at
                    ? t("Remover arquivo da entrega")
                    : t("Descartar envio incompleto")}
              </BusyContent>
            </button>
          </>
        )}
      </div>
      <ConfirmDialog
        open={remove}
        onClose={() => setRemove(false)}
        title="Remover arquivo da entrega"
        message="O arquivo será removido permanentemente. Datas, comentários e o histórico de entregas concluídas serão preservados."
        confirmLabel="Remover arquivo"
        danger
        pending={pending}
        onConfirm={() => {
          setBusyAction("remove");
          setMessage("");
          startTransition(async () => {
            try {
              const result = await removeSubmissionFile(activity.submission!.id);
              setMessage(result.ok ? "Arquivo removido." : result.message);
              setRemove(false);
            } catch {
              setMessage("Não foi possível remover o arquivo.");
            }
          });
        }}
      />
      {message && <Toast message={t(message)} />}
    </Card>
  );
}
export function TeacherActivities({
  activities,
  documents,
  students,
  studentId,
  today,
  ready,
}: {
  activities: Activity[];
  documents: ActivityDocument[];
  students: {
    id: string;
    name: string;
    active: boolean;
  }[];
  studentId?: string;
  today: string;
  ready: boolean;
}) {
  const { t } = useI18n();
  const plan = usePlatformPlan();
  const uploads = useUploads();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState("");
  const [filter, setFilter] = useState("open");
  const [pageByFilter, setPageByFilter] = useState<Record<string, number>>({});
  const visible = activities.filter((activity) =>
    filter === "all"
      ? true
      : filter === "archived"
        ? Boolean(activity.archived_at)
        : filter === "delivered"
          ? Boolean(activity.submission?.submitted_at) &&
            !activity.reviewed_at &&
            !activity.archived_at
          : filter === "reviewed"
            ? Boolean(activity.reviewed_at) && !activity.archived_at
            : !activity.archived_at && !activity.reviewed_at,
  );
  const page = Math.min(pageByFilter[filter] ?? 0, Math.max(0, Math.ceil(visible.length / 20) - 1));
  const pageItems = visible.slice(page * 20, (page + 1) * 20);
  return (
    <div className="space-y-6">
      <section className="card">
        <div className="section-heading">
          <div>
            <h2>{t("Enviar atividade")}</h2>
            <p>
              {t(
                "Escolha um documento ou envie um exercício personalizado. A atividade fica vinculada somente ao aluno selecionado.",
              )}
            </p>
          </div>
          <Link href="/documents" className="btn-xs">
            <Icon name="book" className="h-4 w-4" />
            {t("Abrir Documentos")}
          </Link>
        </div>
        {!ready ? (
          <p className="mt-5 text-sm text-muted">
            {t("As atividades est\u00E3o em prepara\u00E7\u00E3o.")}
          </p>
        ) : (
          <form
            onSubmit={(event) => {
              event.preventDefault();
              if (pending || uploads.busy) return;
              const form = event.currentTarget;
              const data = new FormData(form);
              setMessage("");
              startTransition(async () => {
                try {
                  let documentId = String(data.get("document_id") ?? "");
                  const file = data.get("activity_file");
                  if (file instanceof File && file.size)
                    documentId = await uploadActivityFile(
                      file,
                      String(data.get("title")),
                      plan.maxFileBytes,
                      uploads.send,
                      t("Atividade individual"),
                    );
                  const result = await assignActivity({
                    studentId: studentId ?? String(data.get("student_id")),
                    documentId,
                    title: String(data.get("title")),
                    instructions: String(data.get("instructions") ?? ""),
                    dueOn: String(data.get("due_on") ?? ""),
                  });
                  setMessage(
                    result.ok ? "Atividade enviada para o link do aluno." : result.message,
                  );
                  if (result.ok) form.reset();
                } catch {
                  setMessage("Não foi possível enviar a atividade.");
                }
              });
            }}
            className="mt-5 space-y-4"
          >
            <fieldset disabled={pending || uploads.busy} className="activity-assignment-grid">
              {!studentId && (
                <div>
                  <label className="label" htmlFor="activity-student">
                    {t("Aluno")}
                  </label>
                  <select
                    className="input"
                    id="activity-student"
                    name="student_id"
                    required
                    defaultValue=""
                  >
                    <option value="" disabled>
                      {t("Selecione um aluno")}
                    </option>
                    {students.map((student) => (
                      <option key={student.id} value={student.id}>
                        {student.name}
                        {!student.active ? t(" \u00B7 inativo") : t("")}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <div>
                <label className="label" htmlFor="activity-title">
                  {t("T\u00EDtulo da atividade")}
                </label>
                <input
                  className="input"
                  id="activity-title"
                  name="title"
                  required
                  maxLength={120}
                  placeholder={t("Ex.: Voz passiva \u00B7 exerc\u00EDcios")}
                />
              </div>
              <div>
                <label className="label" htmlFor="activity-document">
                  {t("Documento ou upload (opcional)")}
                </label>
                <DocumentPicker
                  key={message}
                  documents={documents}
                  name="document_id"
                  fileName="activity_file"
                  disabled={pending || uploads.busy}
                />
              </div>
              <div>
                <label className="label" htmlFor="activity-due">
                  {t("Entregar at\u00E9 (opcional)")}
                </label>
                <input className="input" id="activity-due" name="due_on" type="date" min={today} />
              </div>
              <div className="activity-instructions-field">
                <label className="label" htmlFor="activity-instructions">
                  {t("Instru\u00E7\u00F5es para o aluno (opcional)")}
                </label>
                <textarea
                  className="input"
                  id="activity-instructions"
                  name="instructions"
                  rows={3}
                  maxLength={4000}
                  placeholder={t("O que fazer e como devolver a atividade\u2026")}
                />
              </div>
              <button className="btn activity-send">
                <Icon name="mail" className="h-4 w-4" />
                {pending ? t("Enviando\u2026") : t("Enviar atividade")}
              </button>
            </fieldset>
          </form>
        )}
        {message && <Toast message={t(message)} />}
      </section>
      <div className="filter-tabs activity-filters" aria-label={t("Filtrar atividades")}>
        {[
          { id: "open", label: "Em aberto" },
          { id: "delivered", label: "Entregues" },
          { id: "reviewed", label: "Conferidas" },
          { id: "archived", label: "Arquivadas" },
          { id: "all", label: "Todas" },
        ].map((item) => (
          <button
            key={item.id}
            className={filter === item.id ? "filter-active" : ""}
            aria-pressed={filter === item.id}
            onClick={() => setFilter(item.id)}
          >
            {t(item.label)}
          </button>
        ))}
      </div>
      {visible.length ? (
        pageItems.map((activity) => (
          <ActivityItem key={activity.id} activity={activity} today={today} documents={documents} />
        ))
      ) : (
        <section className="card empty-state">
          <h3>{t("Nenhuma atividade neste filtro")}</h3>
          <p>{t("As atividades enviadas e suas entregas aparecem aqui.")}</p>
        </section>
      )}
      <Pagination
        page={page}
        count={visible.length}
        size={20}
        onChange={(value) => setPageByFilter((previous) => ({ ...previous, [filter]: value }))}
      />
    </div>
  );
}
