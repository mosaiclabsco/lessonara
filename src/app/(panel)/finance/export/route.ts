import { requireUser } from "@/lib/supabase/server";
import { hasPlatformFeature } from "@/lib/platform-plans";
import { reportCsv, reportXlsx, financialPdf, reportPeriod } from "@/lib/financial-files";
import { readPayments, binaryDownload, downloadHeaders } from "@/lib/financial-download";
import { nowInTZ } from "@/lib/dates";
export async function GET(request: Request) {
  const { supabase, userId, teacher } = await requireUser();
  if (!hasPlatformFeature(teacher.platform_plan, "exports"))
    return new Response("Exportação disponível no Plus e Pro.", {
      status: 403,
      headers: downloadHeaders,
    });
  const url = new URL(request.url);
  let period: string;
  try {
    period = reportPeriod(url.searchParams.get("period") ?? "");
  } catch {
    return new Response("Período inválido.", { status: 400, headers: downloadHeaders });
  }
  const format = url.searchParams.get("format");
  if (!["csv", "xlsx", "pdf"].includes(format ?? ""))
    return new Response("Formato inválido.", { status: 400, headers: downloadHeaders });
  const payments = (await readPayments(supabase, userId, period)).filter(
    (p) => p.paidOn <= nowInTZ().today && p.amount >= 0,
  );
  const report = { teacherName: teacher.name ?? "Professor", period, payments };
  const name = `recebimentos-${period}.${format}`;
  if (format === "csv") return binaryDownload(reportCsv(report), name, "text/csv; charset=utf-8");
  if (format === "xlsx")
    return binaryDownload(
      reportXlsx(report),
      name,
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
  return binaryDownload(await financialPdf(report), name, "application/pdf");
}
