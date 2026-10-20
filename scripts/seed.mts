// Dados de teste. Uso: pnpm seed [email-da-professora]
// Recria só os alunos marcados com "[seed]"; não mexe nos demais.
import { randomBytes } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!,
  {
    auth: { persistSession: false },
  },
);

const SEED = "[seed]";

function check<T>(r: { data: T; error: unknown }): NonNullable<T> {
  if (r.error) throw r.error;
  return r.data as NonNullable<T>;
}

function today(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
}

function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Data do `weekday` (0 = domingo) na semana de `weeksAgo` semanas atrás. */
function weekdayWeeksAgo(weekday: number, weeksAgo: number): string {
  const t = today();
  const current = new Date(`${t}T00:00:00Z`).getUTCDay();
  return addDays(t, weekday - current - weeksAgo * 7);
}

type SeedStudent = {
  name: string;
  note: string;
  email?: string;
  plan: { id: string; price: number };
  price_override?: number;
  active?: boolean;
  schedules: { weekday: number; time: string; weeksAgo: number; endsWeeksAgo?: number }[];
  packages: { weeksAgo: number; lessons: number; amount?: number }[];
  events: {
    kind: "falta" | "desmarcada" | "reposicao";
    weekday: number;
    time: string;
    weeksAgo: number;
  }[];
};

// ---------- Carga em massa (determinística) ----------

function prng(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const FIRST = [
  "Alice",
  "Beatriz",
  "Caio",
  "Daniela",
  "Eduardo",
  "Fernanda",
  "Gabriel",
  "Helena",
  "Igor",
  "Júlia",
  "Kaique",
  "Larissa",
  "Marcelo",
  "Natália",
  "Otávio",
  "Paula",
  "Rafael",
  "Sofia",
  "Tiago",
  "Valentina",
  "Vitor",
  "Yasmin",
  "André",
  "Bianca",
  "Lucas",
  "Camila",
  "Felipe",
  "Isabela",
  "Matheus",
  "Luana",
  "Pedro",
  "Mariana",
  "Gustavo",
  "Letícia",
  "Renan",
  "Clara",
];
const LAST = [
  "Almeida",
  "Barbosa",
  "Cardoso",
  "Costa",
  "Dias",
  "Ferreira",
  "Gomes",
  "Moreira",
  "Nascimento",
  "Oliveira",
  "Pereira",
  "Ribeiro",
  "Santos",
  "Silva",
  "Teixeira",
  "Vieira",
  "Araújo",
  "Carvalho",
  "Freitas",
  "Monteiro",
];

// Peso de cada horário: pouco de manhã, mais à tarde, maioria à noite.
const HOUR_WEIGHTS: Record<number, number> = {
  8: 0.3,
  9: 0.4,
  10: 0.4,
  11: 0.4,
  13: 1.5,
  14: 2,
  15: 2.5,
  16: 3,
  17: 5,
  18: 8,
  19: 8,
  20: 7,
  21: 4,
};
const SATURDAY_HOURS: Record<number, number> = { 9: 2, 10: 3, 11: 3, 12: 1 };
// Média ~7 aulas por dia útil, sábado mais leve.
const SLOTS_PER_DAY: Record<number, number> = { 1: 7, 2: 7, 3: 7, 4: 8, 5: 6, 6: 3 };
const PAIRS: [number, number][] = [
  [1, 3],
  [2, 4],
];

const hhmm = (h: number) => `${String(h).padStart(2, "0")}:00`;

function generateBulk(
  rand: () => number,
  plan1x: { id: string; price: number; lessons: number },
  plan2x: { id: string; price: number; lessons: number },
  reserved: { weekday: number; time: string }[],
): SeedStudent[] {
  const pick = <T,>(arr: T[]) => arr[Math.floor(rand() * arr.length)];
  const between = (a: number, b: number) => a + Math.floor(rand() * (b - a + 1));

  // 1. Sorteia os horários ocupados de cada dia.
  const taken = new Map<number, Set<number>>();
  for (const [wd, target] of Object.entries(SLOTS_PER_DAY)) {
    const weekday = Number(wd);
    const hours = new Set(
      reserved.filter((r) => r.weekday === weekday).map((r) => Number(r.time.slice(0, 2))),
    );
    const pool = { ...(weekday === 6 ? SATURDAY_HOURS : HOUR_WEIGHTS) };
    for (const h of hours) delete pool[h];
    const free = new Set<number>();
    while (hours.size + free.size < target && Object.keys(pool).length) {
      const total = Object.values(pool).reduce((a, b) => a + b, 0);
      let r = rand() * total;
      for (const [h, w] of Object.entries(pool)) {
        if ((r -= w) < 0) {
          free.add(Number(h));
          delete pool[Number(h)];
          break;
        }
      }
    }
    taken.set(weekday, free);
  }

  // 2. Agrupa em alunos: alguns 2x (mesma hora em seg/qua ou ter/qui), resto 1x.
  const slotsOf: { weekday: number; hour: number }[][] = [];
  for (const [a, b] of PAIRS) {
    const common = [...taken.get(a)!].filter((h) => taken.get(b)!.has(h));
    for (const h of common.slice(0, 2 + Math.floor(rand() * 2))) {
      slotsOf.push([
        { weekday: a, hour: h },
        { weekday: b, hour: h },
      ]);
      taken.get(a)!.delete(h);
      taken.get(b)!.delete(h);
    }
  }
  for (const [weekday, hours] of taken) for (const hour of hours) slotsOf.push([{ weekday, hour }]);

  // 3. Monta cada aluno com histórico, pacotes e exceções.
  const names = new Set<string>();
  return slotsOf.map((slots) => {
    let name: string;
    do name = `${pick(FIRST)} ${pick(LAST)}`;
    while (names.has(name));
    names.add(name);

    const plan = slots.length === 2 ? plan2x : plan1x;
    const override =
      rand() < 0.15 ? (slots.length === 2 ? pick([450, 470]) : pick([250, 280])) : undefined;
    const startsWeeksAgo = between(1, 16);
    const roll = rand();
    const kind = roll < 0.07 ? "inativo" : roll < 0.2 ? "devendo" : roll < 0.32 ? "acabando" : "ok";
    const endsWeeksAgo = kind === "inativo" ? between(1, Math.min(4, startsWeeksAgo)) : undefined;

    const events: SeedStudent["events"] = [];
    let used = 0;
    for (const s of slots) {
      for (let k = startsWeeksAgo; k >= (endsWeeksAgo ?? 0); k--) {
        if (weekdayWeeksAgo(s.weekday, k) >= today()) continue;
        const r = rand();
        if (k >= 1 && r < 0.06) {
          events.push({ kind: "falta", weekday: s.weekday, time: hhmm(s.hour), weeksAgo: k });
          used++;
        } else if (k >= 1 && r < 0.12) {
          events.push({ kind: "desmarcada", weekday: s.weekday, time: hhmm(s.hour), weeksAgo: k });
          if (rand() < 0.4) {
            events.push({
              kind: "reposicao",
              weekday: 6,
              time: hhmm(pick([13, 14, 15])),
              weeksAgo: k,
            });
            used++;
          }
        } else used++;
      }
    }

    const size = plan.lessons;
    let count =
      kind === "devendo"
        ? Math.floor((used - 1) / size)
        : kind === "inativo"
          ? Math.ceil(used / size)
          : kind === "acabando"
            ? Math.ceil(used / size)
            : Math.floor(used / size) + 1 + (rand() < 0.3 ? 1 : 0);
    count = Math.max(kind === "devendo" ? 0 : 1, count);

    const weeksPerPackage = size / slots.length;
    const packages = Array.from({ length: count }, (_, i) => ({
      weeksAgo: Math.max(0, startsWeeksAgo - Math.round(i * weeksPerPackage)),
      lessons: size,
      amount: override,
    }));

    return {
      name,
      note: `situação: ${kind}`,
      plan,
      price_override: override,
      active: kind !== "inativo",
      schedules: slots.map((s) => ({
        weekday: s.weekday,
        time: hhmm(s.hour),
        weeksAgo: startsWeeksAgo,
        endsWeeksAgo,
      })),
      packages,
      events,
    };
  });
}

async function getTeacher(emailArg?: string) {
  const teachers = check(await supabase.from("teachers").select("id, email, name"));
  if (emailArg) {
    const t = teachers.find((t) => t.email === emailArg);
    if (t) return { teacher: t, password: null };
  } else if (teachers.length === 1) {
    return { teacher: teachers[0], password: null };
  } else if (teachers.length > 1) {
    throw new Error(
      `Mais de um professor; informe o email: ${teachers.map((t) => t.email).join(", ")}`,
    );
  }

  const email = emailArg ?? "prof@lessonara.test";
  const password = randomBytes(9).toString("base64url");
  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error) throw error;
  const teacher = check(
    await supabase.from("teachers").select("id, email, name").eq("id", data.user.id).single(),
  );
  return { teacher, password };
}

async function main() {
  const { teacher, password } = await getTeacher(process.argv[2]);
  if (!teacher.name) {
    check(await supabase.from("teachers").update({ name: "Prof. Teste" }).eq("id", teacher.id));
  }

  const plans = check(
    await supabase.from("plans").select("id, lessons, price").eq("teacher_id", teacher.id),
  );
  const plan1x = plans.find((p) => p.lessons === 4);
  const plan2x = plans.find((p) => p.lessons === 8);
  if (!plan1x || !plan2x) throw new Error("Planos padrão (4 e 8 aulas) não encontrados.");

  check(
    await supabase.from("students").delete().eq("teacher_id", teacher.id).like("notes", `${SEED}%`),
  );

  const students: SeedStudent[] = [
    {
      name: "Ana Souza",
      note: "2x por semana, saldo folgado, uma falta e uma desmarcada",
      plan: plan2x,
      schedules: [
        { weekday: 1, time: "18:00", weeksAgo: 3 },
        { weekday: 3, time: "18:00", weeksAgo: 3 },
      ],
      packages: [
        { weeksAgo: 3, lessons: 8 },
        { weeksAgo: 0, lessons: 8 },
      ],
      events: [
        { kind: "falta", weekday: 1, time: "18:00", weeksAgo: 2 },
        { kind: "desmarcada", weekday: 3, time: "18:00", weeksAgo: 1 },
      ],
    },
    {
      name: "Bruno Lima",
      note: "Pacote quase acabando (usa o email da professora pra testar o lembrete)",
      email: teacher.email,
      plan: plan1x,
      schedules: [{ weekday: 4, time: "19:00", weeksAgo: 3 }],
      packages: [{ weeksAgo: 3, lessons: 4 }],
      events: [],
    },
    {
      name: "Carla Mendes",
      note: "Devendo: aulas dadas sem pacote",
      plan: plan1x,
      schedules: [{ weekday: 5, time: "10:00", weeksAgo: 6 }],
      packages: [{ weeksAgo: 6, lessons: 4 }],
      events: [],
    },
    {
      name: "Diego Rocha",
      note: "Valor diferente (R$ 250), desmarcou e fez reposição",
      plan: plan1x,
      price_override: 250,
      schedules: [{ weekday: 2, time: "20:00", weeksAgo: 4 }],
      packages: [
        { weeksAgo: 4, lessons: 4, amount: 250 },
        { weeksAgo: 0, lessons: 4, amount: 250 },
      ],
      events: [
        { kind: "desmarcada", weekday: 2, time: "20:00", weeksAgo: 2 },
        { kind: "reposicao", weekday: 6, time: "11:00", weeksAgo: 2 },
      ],
    },
    {
      name: "Eva Martins",
      note: "Inativa: parou há 3 semanas, pacote usado inteiro",
      plan: plan1x,
      active: false,
      schedules: [{ weekday: 1, time: "09:00", weeksAgo: 6, endsWeeksAgo: 3 }],
      packages: [{ weeksAgo: 6, lessons: 4 }],
      events: [],
    },
  ];

  const bulk = generateBulk(
    prng(42),
    plan1x,
    plan2x,
    students.flatMap((s) => s.schedules.filter((sc) => !sc.endsWeeksAgo)),
  );
  console.log(`Cenários: ${students.length} · Carga: ${bulk.length} alunos`);
  students.push(...bulk);

  for (const s of students) {
    const student = check(
      await supabase
        .from("students")
        .insert({
          teacher_id: teacher.id,
          slug: randomBytes(9).toString("base64url"),
          name: s.name,
          email: s.email ?? null,
          plan_id: s.plan.id,
          price_override: s.price_override ?? null,
          active: s.active ?? true,
          notes: `${SEED} ${s.note}`,
        })
        .select("id, slug")
        .single(),
    );
    check(
      await supabase.from("schedules").insert(
        s.schedules.map((sc) => ({
          student_id: student.id,
          weekday: sc.weekday,
          time: sc.time,
          starts_on: weekdayWeeksAgo(sc.weekday, sc.weeksAgo),
          ends_on: sc.endsWeeksAgo ? weekdayWeeksAgo(sc.weekday, sc.endsWeeksAgo) : null,
        })),
      ),
    );
    check(
      await supabase.from("packages").insert(
        s.packages.map((p) => ({
          student_id: student.id,
          paid_on: addDays(today(), -p.weeksAgo * 7),
          lessons: p.lessons,
          amount: p.amount ?? s.price_override ?? s.plan.price,
        })),
      ),
    );
    if (s.events.length) {
      check(
        await supabase.from("lesson_events").insert(
          s.events.map((e) => ({
            student_id: student.id,
            kind: e.kind,
            date: weekdayWeeksAgo(e.weekday, e.weeksAgo),
            time: e.time,
          })),
        ),
      );
    }
    if (!bulk.includes(s)) console.log(`✓ ${s.name.padEnd(14)} /a/${student.slug}`);
  }

  console.log(`\nProfessor: ${teacher.email}`);
  if (password) console.log(`Senha:     ${password}  (usuário criado agora)`);
  else console.log("Senha:     a que você definiu no Supabase");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
