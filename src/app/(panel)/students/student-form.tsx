"use client";
import { MoneyField } from "@/components/money-field";
import { useI18n } from "@/components/browser-preferences-provider";
import { useState } from "react";
import type { Plan, Student } from "@/lib/data";
import { formatBRL } from "@/lib/dates";
import { PhoneField } from "@/components/phone-field";
export function StudentFields({ student, plans }: { student?: Student; plans: Plan[] }) {
  const { t, locale } = useI18n();
  const initialPlan =
    plans.find((plan) => plan.id === student?.plan_id) ?? (!student ? plans[0] : undefined);
  const [planId, setPlanId] = useState(student?.plan_id ?? initialPlan?.id ?? "");
  return (
    <>
      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="student-name">
            {t("Nome")}
          </label>
          <input
            className="input"
            id="student-name"
            name="name"
            required
            defaultValue={student?.name}
          />
        </div>
        <div>
          <label className="label" htmlFor="student-email">
            {t("Email do aluno")}
          </label>
          <input
            suppressHydrationWarning
            className="input"
            id="student-email"
            name="email"
            type="email"
            required
            maxLength={254}
            defaultValue={student?.email ?? ""}
          />
        </div>
        <div>
          <label className="label" htmlFor="student-phone">
            {t("Telefone / WhatsApp")}
          </label>
          <PhoneField
            id="student-phone"
            name="phone"
            defaultValue={student?.phone}
            defaultCountry={student?.phone_country}
          />
        </div>
        <div>
          <label className="label" htmlFor="student-plan_id">
            {t("Plano")}
          </label>
          <select
            className="input"
            id="student-plan_id"
            name="plan_id"
            required
            value={planId}
            onChange={(event) => {
              setPlanId(event.target.value);
            }}
          >
            <option value="" disabled>
              {t("Selecione um plano")}
            </option>
            {plans.map((plan) => (
              <option key={plan.id} value={plan.id}>
                {plan.name}
                {t(" \u00B7 ")}
                {plan.lessons}
                {t(" aulas \u00B7 ")}
                {formatBRL(plan.price, locale)}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="student-price_override">
            {t("Valor diferente (opcional)")}
          </label>
          <MoneyField
            className="input"
            id="student-price_override"
            name="price_override"
            placeholder={t("usa o valor do plano")}
            defaultValue={student?.price_override ?? ""}
          />
        </div>
      </div>
      <div>
        <label className="label" htmlFor="student-notes">
          {t("Observa\u00E7\u00F5es")}
        </label>
        <textarea
          className="input"
          id="student-notes"
          name="notes"
          rows={2}
          defaultValue={student?.notes ?? ""}
        />
      </div>
    </>
  );
}
