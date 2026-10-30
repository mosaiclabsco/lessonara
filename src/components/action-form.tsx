"use client";
import { isFormFailure } from "@/lib/form-validation";
import { Toast } from "./toast";
import {
  createContext,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
  type ButtonHTMLAttributes,
} from "react";
import { useFormStatus } from "react-dom";
import { useI18n } from "./browser-preferences-provider";
import { notify } from "./toast";
import { Icon, type IconName } from "./icon";
import { BusyContent } from "./busy-content";
const GroupContext = createContext<{
  active: string | null;
  setActive: (id: string | null) => void;
} | null>(null);
export function useActionGroup() {
  return useContext(GroupContext);
}
export function ActionGroup({ children, className }: { children: ReactNode; className?: string }) {
  const [active, setActive] = useState<string | null>(null);
  return (
    <GroupContext value={{ active, setActive }}>
      <div className={className} data-action-busy={Boolean(active)}>
        {children}
      </div>
    </GroupContext>
  );
}
function FormContents({
  children,
  blocked,
  errorField,
}: {
  children: ReactNode;
  blocked: boolean;
  errorField: string;
}) {
  const { pending } = useFormStatus();
  const fields = useRef<HTMLFieldSetElement>(null);
  useEffect(() => {
    if (pending || blocked || !fields.current) return;
    for (const element of fields.current.querySelectorAll<
      HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    >("input,select,textarea")) {
      if (element.dataset.validationError) {
        element.removeAttribute("aria-invalid");
        delete element.dataset.validationError;
      }
      if (errorField && element.name === errorField && element.type !== "hidden") {
        element.setAttribute("aria-invalid", "true");
        element.dataset.validationError = "true";
        element.focus();
      }
    }
  }, [pending, blocked, errorField]);
  return (
    <fieldset ref={fields} className="action-fields" disabled={blocked || pending}>
      {children}
    </fieldset>
  );
}
export function ActionForm({
  action,
  children,
  className,
  id,
}: {
  action: (data: FormData) => unknown | Promise<unknown>;
  children: ReactNode;
  className?: string;
  id?: string;
}) {
  const group = useContext(GroupContext);
  const formId = useId();
  const running = useRef(false);
  const preserveValues = useRef(false);
  const [error, setError] = useState("");
  const [errorField, setErrorField] = useState("");
  const { t } = useI18n();
  async function run(data: FormData) {
    if (running.current || group?.active) return;
    running.current = true;
    group?.setActive(formId);
    setError("");
    setErrorField("");
    preserveValues.current = false;
    try {
      const result = await action(data);
      if (isFormFailure(result)) {
        preserveValues.current = true;
        setError(result.validation.message);
        setErrorField(result.validation.field);
        return;
      }
      window.dispatchEvent(new Event("lessonara:pending-changed"));
      notify(t("Alterações salvas."));
    } catch (cause) {
      preserveValues.current = true;
      if (
        cause &&
        typeof cause === "object" &&
        "digest" in cause &&
        typeof cause.digest === "string" &&
        cause.digest.startsWith("NEXT_")
      )
        throw cause;
      setError(
        cause instanceof Error && !("digest" in cause)
          ? cause.message
          : "Não foi possível concluir a ação. Tente novamente.",
      );
    } finally {
      running.current = false;
      group?.setActive(null);
    }
  }
  return (
    <form
      id={id}
      className={className}
      action={run}
      onReset={(event) => {
        if (preserveValues.current) event.preventDefault();
      }}
      onSubmit={(event) => {
        if (running.current) event.preventDefault();
      }}
    >
      <FormContents
        blocked={Boolean(group?.active && group.active !== formId)}
        errorField={errorField}
      >
        {children}
      </FormContents>
      {error && <Toast message={t(error)} kind="error" />}
    </form>
  );
}
export function SubmitButton({
  children,
  className = "btn",
  pendingLabel = "Processando…",
  disabled = false,
  icon = "check",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { pendingLabel?: string; icon?: IconName | null }) {
  const { pending } = useFormStatus();
  const { t } = useI18n();
  return (
    <button
      {...props}
      type="submit"
      className={className}
      disabled={pending || disabled}
      aria-busy={pending}
    >
      <BusyContent pending={pending} label={t(pendingLabel)}>
        {icon && <Icon name={icon} className="h-4 w-4" />}
        {children}
      </BusyContent>
    </button>
  );
}
