import { expect, it } from "vitest";
import { unzipSync, strFromU8 } from "fflate";
import { PDFDocument } from "pdf-lib";
import { reportCsv, reportXlsx, financialPdf, reportPeriod } from "./financial-files";
const report = {
  teacherName: "Professora Júlia",
  period: "2026-10",
  payments: [
    {
      id: "payment",
      studentId: "student",
      studentName: '=HYPERLINK("evil")',
      paidOn: "2026-10-01",
      amount: 300.25,
      lessons: 4,
    },
  ],
};
it("CSV preserva acentos, separador e neutraliza fórmulas vindas do cadastro", () => {
  const csv = reportCsv(report);
  expect(csv.startsWith("\ufeff")).toBe(true);
  expect(csv).toContain("300,25");
  expect(csv).toContain("'" + "=HYPERLINK");
  expect(csv).toContain(";");
});
it("XLSX tem células numéricas, estilos e texto inline sem fórmulas executáveis", () => {
  const zip = unzipSync(reportXlsx(report)),
    sheet = strFromU8(zip["xl/worksheets/sheet1.xml"]);
  expect(sheet).toContain("<v>300.25</v>");
  expect(sheet).toContain('t="inlineStr"');
  expect(sheet).not.toContain("<f>");
  expect(zip["xl/media/lessonara.png"].slice(0, 8)).toEqual(
    new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]),
  );
  expect(sheet).toContain('<drawing r:id="rId1"/>');
  expect(strFromU8(zip["xl/drawings/_rels/drawing1.xml.rels"])).toContain("../media/lessonara.png");
  expect(strFromU8(zip["xl/styles.xml"])).toContain("FF3D7264");
});
it("PDF individual é válido e relatório pagina sem perder pagamentos", async () => {
  const receipt = await PDFDocument.load(await financialPdf(report, true));
  expect(receipt.getPageCount()).toBe(1);
  const many = {
    ...report,
    payments: Array.from({ length: 100 }, (_, i) => ({
      ...report.payments[0],
      id: String(i),
      studentName: "Aluno de nome longo ".repeat(4),
    })),
  };
  const pdf = await PDFDocument.load(await financialPdf(many));
  expect(pdf.getPageCount()).toBeGreaterThan(3);
});
it.each(["2026-13", "2026-00", "../../etc", "2026-1", "1999", "2101"])(
  "recusa período inválido %s",
  (value) => expect(() => reportPeriod(value)).toThrow(),
);

it("CSV limpa controles antes de detectar fórmulas", () => {
  const value = { ...report, payments: [{ ...report.payments[0], studentName: "\x1f=1+1" }] };
  expect(reportCsv(value)).toContain("'=");
});
