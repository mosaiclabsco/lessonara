import { expect, it } from "vitest";
import { slotOccupancy } from "./availability-slot";
const at = (time: string) => Date.parse(`2026-10-12T${time}:00-03:00`);
const gabriel = {
  start: "2026-10-12T11:00:00-03:00",
  end: "2026-10-12T12:00:00-03:00",
  label: "Gabriel Reis",
};
it("identifica o responsável em todas as opções que cruzam o compromisso", () => {
  expect(slotOccupancy([gabriel], at("11:00"), 60).names).toEqual(["Gabriel Reis"]);
  for (const time of ["10:30", "11:30"]) {
    const result = slotOccupancy([gabriel], at(time), 60);
    expect(result.blocked).toBe(true);
    expect(result.names).toEqual(["Gabriel Reis"]);
    expect(result.reason).toBe("lesson");
  }
  expect(slotOccupancy([gabriel], at("12:00"), 60).blocked).toBe(false);
});
it("identifica ambos os responsáveis ao cruzar aulas consecutivas", () => {
  const second = {
    start: "2026-10-12T12:00:00-03:00",
    end: "2026-10-12T13:00:00-03:00",
    label: "Outro aluno",
  };
  expect(slotOccupancy([gabriel, second], at("11:30"), 60).names).toEqual([
    "Gabriel Reis",
    "Outro aluno",
  ]);
  expect(slotOccupancy([gabriel, second], at("12:00"), 60).names).toEqual(["Outro aluno"]);
});
it("mantém a distinção entre Google e aulas locais, com durações diferentes", () => {
  const google = { ...gabriel, label: "Ocupado no Google" };
  expect(slotOccupancy([google], at("11:00"), 60)).toMatchObject({
    blocked: true,
    names: [],
    reason: "google",
  });
  expect(slotOccupancy([gabriel, google], at("11:00"), 60).names).toEqual(["Gabriel Reis"]);
  expect(
    slotOccupancy([{ ...gabriel, end: "2026-10-12T11:45:00-03:00" }], at("11:30"), 30).blocked,
  ).toBe(true);
});

it("keeps a stable group for adjacent options blocked by the same event", () => {
  const groups = ["10:30", "11:00", "11:30"].map(
    (time) => slotOccupancy([gabriel], at(time), 60).groups,
  );
  expect(groups[0]).toEqual(groups[1]);
  expect(groups[1]).toEqual(groups[2]);
});
