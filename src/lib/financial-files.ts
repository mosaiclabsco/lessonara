import { PDFDocument, StandardFonts, rgb, type PDFFont } from "pdf-lib";
import { zipSync, strToU8 } from "fflate";
import { fullLogoPng } from "./brand-image.json";
import { formatBRL, formatDate } from "./dates";
import type { IncomePayment } from "./finance";
export type FinancialReport = { teacherName: string; period: string; payments: IncomePayment[] };
export function reportPeriod(value: string) {
  if (
    !/^\d{4}(-(?:0[1-9]|1[0-2]))?$/.test(value) ||
    Number(value.slice(0, 4)) < 2000 ||
    Number(value.slice(0, 4)) > 2100
  )
    throw new Error("Escolha um ano ou mês válido.");
  return value;
}
const clean = (s: string) => s.replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g, "");
const xml = (s: string) =>
  clean(s).replace(
    /[<>&"']/g,
    (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&apos;" })[c]!,
  );
export function reportCsv(report: FinancialReport) {
  const cell = (v: string | number) => {
    const value =
      typeof v === "number"
        ? v.toLocaleString("pt-BR", { useGrouping: false, minimumFractionDigits: 2 })
        : /^[=+@\-]/.test(clean(v).trimStart())
          ? "'" + clean(v)
          : v;
    return '"' + clean(value).replaceAll('"', '""') + '"';
  };
  return (
    "\ufeff" +
    [
      ["Data", "Aluno", "Aulas", "Valor (R$)", "Referência"],
      ...report.payments.map((p) => [
        formatDate(p.paidOn),
        p.studentName,
        String(p.lessons),
        p.amount,
        p.id,
      ]),
    ]
      .map((row) => row.map(cell).join(";"))
      .join("\r\n")
  );
}
export function reportXlsx(report: FinancialReport) {
  const rows: (string | number)[][] = [
    ["", "", "", "Recebimentos"],
    [report.teacherName, "", "", report.period],
    ["Data", "Aluno", "Aulas", "Valor (R$)", "Referência"],
    ...report.payments.map((p) => [formatDate(p.paidOn), p.studentName, p.lessons, p.amount, p.id]),
    [
      "Total",
      "",
      report.payments.reduce((s, p) => s + p.lessons, 0),
      Math.round(report.payments.reduce((s, p) => s + Math.round(p.amount * 100), 0)) / 100,
    ],
  ];
  const sheet = rows
    .map(
      (row, i) =>
        `<row r="${i + 1}"${i === 0 ? ' ht="44" customHeight="1"' : i === 1 ? ' ht="24" customHeight="1"' : ""}>${row
          .map((v, j) => {
            const ref = String.fromCharCode(65 + j) + (i + 1),
              style =
                i === 2 || (i === 0 && j === 3) ? 1 : j === 3 && typeof v === "number" ? 2 : 0;
            return typeof v === "number"
              ? `<c r="${ref}" s="${style}"><v>${v}</v></c>`
              : `<c r="${ref}" s="${style}" t="inlineStr"><is><t xml:space="preserve">${xml(v)}</t></is></c>`;
          })
          .join("")}</row>`,
    )
    .join("");
  const files: Record<string, string> = {
    "[Content_Types].xml":
      '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="png" ContentType="image/png"/><Override PartName="/xl/drawings/drawing1.xml" ContentType="application/vnd.openxmlformats-officedocument.drawing+xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>',
    "_rels/.rels":
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>',
    "xl/workbook.xml":
      '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Recebimentos" sheetId="1" r:id="rId1"/></sheets></workbook>',
    "xl/_rels/workbook.xml.rels":
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>',
    "xl/styles.xml":
      '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><numFmts count="1"><numFmt numFmtId="164" formatCode="&quot;R$&quot; #,##0.00"/></numFmts><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF3D7264"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="1"><border/></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="3"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFill="1"/><xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>',
    "xl/worksheets/sheet1.xml": `<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheetViews><sheetView workbookViewId="0"><pane ySplit="3" topLeftCell="A4" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><cols><col min="1" max="1" width="16" customWidth="1"/><col min="2" max="2" width="38" customWidth="1"/><col min="3" max="4" width="18" customWidth="1"/><col min="5" max="5" width="40" customWidth="1"/></cols><sheetData>${sheet}</sheetData><autoFilter ref="A3:E${Math.max(3, rows.length - 1)}"/><mergeCells count="3"><mergeCell ref="A2:C2"/><mergeCell ref="D2:E2"/><mergeCell ref="D1:E1"/></mergeCells><drawing r:id="rId1"/></worksheet>`,
  };
  files["xl/worksheets/_rels/sheet1.xml.rels"] =
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/drawing" Target="../drawings/drawing1.xml"/></Relationships>';
  files["xl/drawings/drawing1.xml"] =
    '<xdr:wsDr xmlns:xdr="http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><xdr:oneCellAnchor><xdr:from><xdr:col>0</xdr:col><xdr:colOff>95250</xdr:colOff><xdr:row>0</xdr:row><xdr:rowOff>95250</xdr:rowOff></xdr:from><xdr:ext cx="1543050" cy="342900"/><xdr:pic><xdr:nvPicPr><xdr:cNvPr id="1" name="Lessonara" descr="Logo Lessonara"/><xdr:cNvPicPr><a:picLocks noChangeAspect="1"/></xdr:cNvPicPr></xdr:nvPicPr><xdr:blipFill><a:blip xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" r:embed="rId1"/><a:stretch><a:fillRect/></a:stretch></xdr:blipFill><xdr:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="1543050" cy="342900"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></xdr:spPr></xdr:pic><xdr:clientData/></xdr:oneCellAnchor></xdr:wsDr>';
  files["xl/drawings/_rels/drawing1.xml.rels"] =
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/lessonara.png"/></Relationships>';
  return zipSync({
    "xl/media/lessonara.png": Uint8Array.from(Buffer.from(fullLogoPng, "base64")),
    ...Object.fromEntries(
      Object.entries(files).map(([name, value]) => [
        name,
        strToU8('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' + value),
      ]),
    ),
  });
}
function supported(text: string, font: PDFFont) {
  const chars = new Set(font.getCharacterSet());
  return clean(text)
    .replace(/[^\S ]/g, " ")
    .split("")
    .map((c) => (chars.has(c.charCodeAt(0)) ? c : "?"))
    .join("");
}
export async function financialPdf(report: FinancialReport, receipt = false) {
  const pdf = await PDFDocument.create(),
    font = await pdf.embedFont(StandardFonts.Helvetica),
    bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const logo = await pdf.embedPng(fullLogoPng);
  const green = rgb(0.24, 0.45, 0.39),
    ink = rgb(0.16, 0.22, 0.21),
    muted = rgb(0.43, 0.49, 0.47);
  let page = pdf.addPage([595.28, 841.89]),
    y = 0;
  const text = (value: string, x: number, size = 11, heavy = false, color = ink) =>
    page.drawText(supported(value, heavy ? bold : font), {
      x,
      y,
      size,
      font: heavy ? bold : font,
      color,
    });
  const wrap = (value: string, width: number, size = 11) => {
    const lines: string[] = [];
    let line = "";
    for (const char of supported(value, font)) {
      if (font.widthOfTextAtSize(line + char, size) > width) {
        lines.push(line);
        line = "";
      }
      line += char;
    }
    if (line) lines.push(line);
    return lines;
  };
  const header = () => {
    page.drawRectangle({ x: 0, y: 0, width: 596, height: 842, color: rgb(1, 1, 1) });
    page.drawLine({
      start: { x: 42, y: 748 },
      end: { x: 553, y: 748 },
      thickness: 1,
      color: green,
    });
    page.drawImage(logo, { x: 42, y: 790, width: 162, height: 36 });
    y = 769;
    text(
      receipt
        ? "RECIBO DE PAGAMENTO"
        : "RECEBIMENTOS · " +
            (report.period.length === 7
              ? report.period.split("-").reverse().join("/")
              : report.period),
      42,
      10,
      false,
      green,
    );
    y = 717;
    for (const line of wrap(report.teacherName, 500, 13)) {
      text(line, 42, 13, true);
      y -= 18;
    }
    y -= 20;
  };
  header();
  if (receipt) {
    const p = report.payments[0];
    if (!p) throw new Error("Pagamento não encontrado.");
    y -= 10;
    text(formatBRL(p.amount), 42, 32, true, green);
    y -= 45;
    for (const line of wrap(
      `Pagamento recebido de ${p.studentName}, referente a um pacote de ${p.lessons} aulas.`,
      500,
      13,
    )) {
      text(line, 42, 13);
      y -= 21;
    }
    y -= 26;
    text("Recebido em", 42, 10, false, muted);
    y -= 20;
    text(formatDate(p.paidOn), 42, 14, true);
    y -= 40;
    text("Referência do pagamento", 42, 10, false, muted);
    y -= 20;
    text(p.id, 42, 10);
    y -= 55;
    for (const line of wrap(
      "Comprovante emitido a partir do pagamento registrado pelo professor no Lessonara.",
      500,
      10,
    )) {
      text(line, 42, 10, false, muted);
      y -= 16;
    }
  } else {
    const columns = () => {
      text("Recebido em", 42, 10, true);
      text("Aluno / pacote", 142, 10, true);
      text("Valor", 455, 10, true);
      y -= 25;
    };
    columns();
    for (const p of report.payments) {
      const lines = wrap(`${p.studentName} · ${p.lessons} aulas`, 295, 10),
        height = Math.max(32, lines.length * 14 + 12);
      if (y - height < 90) {
        page = pdf.addPage([595.28, 841.89]);
        header();
        columns();
      }
      page.drawLine({
        start: { x: 42, y: y - height + 10 },
        end: { x: 553, y: y - height + 10 },
        thickness: 0.5,
        color: rgb(0.9, 0.93, 0.91),
      });
      text(formatDate(p.paidOn), 42, 10);
      const start = y;
      for (const line of lines) {
        text(line, 142, 10);
        y -= 14;
      }
      y = start;
      text(formatBRL(p.amount), 455, 10, true);
      y -= height;
    }
    if (y < 135) {
      page = pdf.addPage([595.28, 841.89]);
      header();
    }
    y -= 20;
    text("Total recebido", 42, 13, true);
    text(
      formatBRL(report.payments.reduce((s, p) => s + Math.round(p.amount * 100), 0) / 100),
      420,
      13,
      true,
      green,
    );
    y -= 24;
    text(`${report.payments.length} pagamentos no período`, 42, 10, false, muted);
  }
  const pages = pdf.getPages();
  pages.forEach((p, i) => {
    p.drawImage(logo, { x: 42, y: 30, width: 90, height: 20 });
    p.drawText(`${i + 1}/${pages.length}`, {
      x: 520,
      y: 38,
      size: 9,
      font,
      color: muted,
    });
  });
  pdf.setTitle(receipt ? "Recibo de pagamento" : "Recebimentos " + report.period);
  pdf.setAuthor("Lessonara");
  return pdf.save();
}
