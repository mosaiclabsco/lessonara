import palette from "../../desktop/annotation-palette.json";
import type { ClassroomRef } from "./classroom";
export type PdfPoint = [number, number];
export type PdfStroke = {
  id: string;
  page: number;
  kind: "pen" | "laser";
  points: PdfPoint[];
  at: number;
  color?: string;
  times?: number[];
};
export type PdfText = {
  id: string;
  page: number;
  x: number;
  y: number;
  text: string;
  fontSize?: number;
  color?: string;
};
export type MaterialState = {
  documentId: string | null;
  board: boolean;
  scrollY: number;
  page: number;
  strokes: PdfStroke[];
  texts: PdfText[];
};
export type MaterialGrant = {
  ref: ClassroomRef;
  teacherId: string;
  state: MaterialState;
  issuedAt: number;
  expiresAt: number;
};
export const emptyMaterial = (): MaterialState => ({
  documentId: null,
  board: false,
  scrollY: 0,
  page: 1,
  strokes: [],
  texts: [],
});
const idValid = (v: unknown) => typeof v === "string" && /^[A-Za-z\d_-]{1,80}$/.test(v);
const pageValid = (v: unknown) => Number.isInteger(v) && Number(v) >= 1 && Number(v) <= 2000;
const ink = (value: unknown) => {
  if (value === undefined) return undefined;
  if (typeof value !== "string" || !palette.some((item) => item.value === value))
    throw new Error("Cor inválida.");
  return value;
};
const coord = (v: unknown) => typeof v === "number" && Number.isFinite(v) && v >= 0 && v <= 1;
export function validateMaterial(value: unknown): MaterialState {
  if (!value || typeof value !== "object") throw new Error("Material inválido.");
  const v = value as MaterialState;
  if (
    v.documentId !== null &&
    (typeof v.documentId !== "string" || !/^[a-f\d-]{36}$/i.test(v.documentId))
  )
    throw new Error("Documento inválido.");
  if (
    typeof v.board !== "boolean" ||
    (v.board && v.documentId) ||
    !pageValid(v.page) ||
    !Array.isArray(v.strokes) ||
    !Array.isArray(v.texts) ||
    v.strokes.length > 200 ||
    v.texts.length > 30
  )
    throw new Error(
      "Material inválido ou limite de anotações atingido. Limpe o quadro para continuar.",
    );
  let points = 0;
  const strokes = v.strokes.map((s) => {
    if (
      !s ||
      !idValid(s.id) ||
      !pageValid(s.page) ||
      !["pen", "laser"].includes(s.kind) ||
      !Array.isArray(s.points) ||
      s.points.length > 500 ||
      !Number.isFinite(s.at)
    )
      throw new Error("Traço inválido.");
    points += s.points.length;
    const times = s.times;
    if (
      times !== undefined &&
      (!Array.isArray(times) ||
        times.length !== s.points.length ||
        times.some((time) => !Number.isFinite(time)))
    )
      throw new Error("Tempos de traço inválidos.");
    return {
      id: s.id,
      page: s.page,
      kind: s.kind,
      at: s.at,
      color: ink(s.color),
      ...(times ? { times } : {}),
      points: s.points.map((p) => {
        if (!Array.isArray(p) || p.length !== 2 || !p.every(coord))
          throw new Error("Ponto inválido.");
        return p.map((n) => Math.round(n * 100000) / 100000) as PdfPoint;
      }),
    };
  });
  if (points > 4000)
    throw new Error("Limite de anotações atingido. Limpe o quadro para continuar.");
  const texts = v.texts.map((t) => {
    if (
      !t ||
      !idValid(t.id) ||
      !pageValid(t.page) ||
      !coord(t.x) ||
      !coord(t.y) ||
      typeof t.text !== "string" ||
      t.text.length > 200 ||
      (t.fontSize !== undefined &&
        (!Number.isInteger(t.fontSize) || t.fontSize < 12 || t.fontSize > 72))
    )
      throw new Error("Texto inválido.");
    return {
      id: t.id,
      page: t.page,
      x: t.x,
      y: t.y,
      text: t.text,
      fontSize: t.fontSize ?? 24,
      color: ink(t.color),
    };
  });
  const scrollY = v.scrollY ?? 0;
  if (!coord(scrollY)) throw new Error("Posição inválida.");
  const result = {
    documentId: v.documentId,
    board: v.board,
    scrollY,
    page: v.page,
    strokes,
    texts,
  };
  if (JSON.stringify(result).length > 95000)
    throw new Error("Limite de anotações atingido. Limpe o quadro para continuar.");
  return result;
}
export function grantMatches(grant: MaterialGrant, ref: ClassroomRef, now = Date.now()) {
  return (
    grant?.expiresAt > now &&
    grant.issuedAt <= now + 10000 &&
    ["studentId", "sourceKind", "sourceId", "date"].every(
      (k) => grant.ref?.[k as keyof ClassroomRef] === ref[k as keyof ClassroomRef],
    )
  );
}
