import { createServer } from "node:http";
import { readFile, writeFile, mkdir, rename } from "node:fs/promises";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { dirname, resolve, join } from "node:path";

const directory = dirname(fileURLToPath(import.meta.url));
const root = resolve(directory, "../..");
const stateDirectory = join(root, ".local");
const statePath = join(stateDirectory, "backlog-priorities.json");
const port = Number(process.env.BACKLOG_PORT || 4317);
const host = `127.0.0.1:${port}`;
const origin = `http://${host}`;
let writing = false;

export function parseBacklog(markdown) {
  const headings = [];
  const tasks = [];
  const occurrences = new Map();
  let fenced = false;
  for (const [index, line] of markdown.split("\n").entries()) {
    if (/^\s*(?:~~~|```)/.test(line)) {
      fenced = !fenced;
      continue;
    }
    if (fenced) continue;
    const heading = line.match(/^(#{1,6})\s+(.+)/);
    if (heading) {
      headings.length = heading[1].length - 1;
      headings.push(heading[2]);
    }
    const match = line.match(/^\s*- \[([ xX])\]\s+(.+)/);
    if (!match) continue;
    const title = match[2].match(/^\*\*(.+?)\*\*/)?.[1] || match[2];
    const identity = title.normalize("NFC").toLowerCase();
    const occurrence = occurrences.get(identity) || 0;
    occurrences.set(identity, occurrence + 1);
    const id = createHash("sha256").update(`${identity}:${occurrence}`).digest("hex").slice(0, 20);
    tasks.push({
      id,
      title,
      body: match[2],
      done: match[1].toLowerCase() === "x",
      section: headings.filter(Boolean).slice(1).join(" / "),
      line: index + 1,
      details: [],
    });
    continue;
  }
  // Keep each task's explanatory bullets and event names until the next task/heading.
  const lines = markdown.split("\n");
  for (const task of tasks) {
    for (let index = task.line; index < lines.length; index++) {
      if (/^#{1,6}\s|^\s*- \[[ xX]\]|^\s*(?:~~~|```)/.test(lines[index])) break;
      if (lines[index].trim()) task.details.push(lines[index].trim());
    }
  }
  return tasks;
}

async function state() {
  try {
    return JSON.parse(await readFile(statePath, "utf8"));
  } catch (error) {
    if (error.code === "ENOENT") return { revision: 0, order: [], priorities: {} };
    throw error;
  }
}
function respond(response, status, body, type = "application/json; charset=utf-8") {
  response.writeHead(status, {
    "Content-Type": type,
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Content-Security-Policy":
      "default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'",
  });
  response.end(typeof body === "string" ? body : JSON.stringify(body));
}
const server = createServer(async (request, response) => {
  try {
    if (request.headers.host !== host) return respond(response, 403, { error: "Host inválido." });
    const path = new URL(request.url, origin).pathname;
    if (request.method === "GET" && path === "/api/backlog") {
      const tasks = parseBacklog(await readFile(join(root, "TASKS.md"), "utf8"));
      return respond(response, 200, {
        tasks,
        state: await state(),
        source: "TASKS.md",
        stateFile: ".local/backlog-priorities.json",
      });
    }
    if (request.method === "PUT" && path === "/api/state") {
      if (
        request.headers.origin !== origin ||
        !request.headers["content-type"]?.startsWith("application/json")
      )
        return respond(response, 403, { error: "Origem inválida." });
      let buffer = "";
      for await (const chunk of request) {
        buffer += chunk;
        if (Buffer.byteLength(buffer) > 100_000)
          return respond(response, 413, { error: "Dados muito grandes." });
      }
      let input;
      try {
        input = JSON.parse(buffer);
      } catch {
        return respond(response, 400, { error: "JSON inválido." });
      }
      const tasks = parseBacklog(await readFile(join(root, "TASKS.md"), "utf8"));
      const ids = new Set(tasks.map((task) => task.id));
      if (
        !input ||
        !Array.isArray(input.order) ||
        input.order.length > ids.size ||
        new Set(input.order).size !== input.order.length ||
        input.order.some((id) => !ids.has(id)) ||
        !input.priorities ||
        typeof input.priorities !== "object" ||
        Array.isArray(input.priorities) ||
        Object.entries(input.priorities).some(
          ([id, priority]) => !ids.has(id) || !["high", "medium", "low", "none"].includes(priority),
        )
      )
        return respond(response, 400, {
          error: "Ordem ou prioridades inválidas. Atualize a lista.",
        });
      if (writing)
        return respond(response, 409, {
          error: "Há outro salvamento em andamento. Tente novamente.",
        });
      writing = true;
      try {
        const previous = await state();
        if (input.revision !== previous.revision)
          return respond(response, 409, {
            error: "A lista mudou em outra aba. Atualize antes de editar.",
          });
        const next = {
          revision: previous.revision + 1,
          updatedAt: new Date().toISOString(),
          source: "TASKS.md",
          order: input.order,
          priorities: input.priorities,
        };
        await mkdir(stateDirectory, { recursive: true });
        await writeFile(`${statePath}.tmp`, `${JSON.stringify(next, null, 2)}\n`, { mode: 0o600 });
        await rename(`${statePath}.tmp`, statePath);
        return respond(response, 200, next);
      } finally {
        writing = false;
      }
    }
    const assets = {
      "/": ["index.html", "text/html; charset=utf-8"],
      "/app.js": ["app.js", "text/javascript; charset=utf-8"],
      "/style.css": ["style.css", "text/css; charset=utf-8"],
    };
    if (request.method === "GET" && Object.hasOwn(assets, path)) {
      const [file, type] = assets[path];
      return respond(response, 200, await readFile(join(directory, file), "utf8"), type);
    }
    return respond(response, 404, { error: "Não encontrado." });
  } catch (error) {
    console.error("Falha no leitor:", error.message);
    respond(response, 500, { error: "Não foi possível ler ou salvar o backlog." });
  }
});
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  server.listen(port, "127.0.0.1", () =>
    console.log(`Backlog local: ${origin}\nPrioridades: ${statePath}\nCtrl+C para encerrar.`),
  );
  server.on("error", (error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
