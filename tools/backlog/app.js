const $ = (selector) => document.querySelector(selector);
const priorities = { high: "Alta", medium: "Média", low: "Baixa", none: "Sem prioridade" };
const weight = { high: 0, medium: 1, low: 2, none: 3 };
let tasks = [],
  order = [],
  saved = { revision: 0, priorities: {} },
  busy = false,
  dragged = null;
function text(tag, value, className) {
  const node = document.createElement(tag);
  node.textContent = value;
  if (className) node.className = className;
  return node;
}
function priority(task) {
  return saved.priorities[task.id] || "none";
}
function ordered() {
  const map = new Map(tasks.map((task) => [task.id, task]));
  return order.map((id) => map.get(id)).filter(Boolean);
}
function visible() {
  const query = $("#search").value.trim().toLocaleLowerCase("pt-BR");
  let list = ordered().filter(
    (task) =>
      (!query ||
        `${task.body} ${task.section} ${task.details.join(" ")}`
          .toLocaleLowerCase("pt-BR")
          .includes(query)) &&
      (!$("#section").value || task.section === $("#section").value) &&
      (!$("#priority").value || priority(task) === $("#priority").value) &&
      ($("#status").value === "all" || task.done === ($("#status").value === "done")),
  );
  if ($("#sort").value === "priority")
    list.sort((a, b) => weight[priority(a)] - weight[priority(b)]);
  return list;
}
function clean(value) {
  return value.replace(/\*\*(.*?)\*\*/g, "$1").replace(/`([^`]+)`/g, "$1");
}
function render() {
  const list = visible(),
    manual = $("#sort").value === "manual";
  $("#pending-count").textContent = tasks.filter((task) => !task.done).length;
  $("#result-count").textContent =
    `${list.length} ${list.length === 1 ? "tarefa" : "tarefas"} nesta visão`;
  $("#empty").hidden = !!list.length;
  const fragment = document.createDocumentFragment();
  list.forEach((task, index) => {
    const card = document.createElement("article");
    card.className = "task";
    card.dataset.priority = priority(task);
    const handle = text("button", "⠿", "handle");
    handle.type = "button";
    handle.disabled = busy || !manual;
    handle.title = "Arraste para mudar a ordem. Alternativa: use as setas.";
    handle.setAttribute("aria-label", `Alça para ordenar ${task.title}`);
    handle.draggable = manual && !busy;
    handle.addEventListener("dragstart", (event) => {
      dragged = task.id;
      event.dataTransfer.setData("text/plain", task.id);
      event.dataTransfer.effectAllowed = "move";
      card.classList.add("dragging");
    });
    handle.addEventListener("dragend", () => {
      dragged = null;
      document
        .querySelectorAll(".dragging,.drop-target")
        .forEach((node) => node.classList.remove("dragging", "drop-target"));
    });
    card.addEventListener("dragover", (event) => {
      if (dragged && manual && !busy) {
        event.preventDefault();
        event.dataTransfer.dropEffect = "move";
        card.classList.add("drop-target");
      }
    });
    card.addEventListener("dragleave", () => card.classList.remove("drop-target"));
    card.addEventListener("drop", (event) => {
      event.preventDefault();
      card.classList.remove("drop-target");
      if (dragged && dragged !== task.id && !busy) reposition(dragged, task.id);
      dragged = null;
    });
    const content = document.createElement("div");
    content.className = "task-content";
    content.append(text("div", task.section || "Backlog", "category"), text("h2", task.title));
    if (task.done) content.querySelector("h2").append(text("span", "Concluída", "completed"));
    const description = clean(
      task.body.startsWith(`**${task.title}**`)
        ? task.body.slice(task.title.length + 4).replace(/^\s*[—–:]?\s*/, "")
        : task.body === task.title
          ? ""
          : task.body,
    );
    if (description) content.append(text("p", description, "description"));
    if (task.details.length) {
      const details = document.createElement("details");
      details.append(
        text("summary", "Ver detalhes"),
        text("div", clean(task.details.join("\n")), "detail-content"),
      );
      content.append(details);
    }
    const select = document.createElement("select");
    select.className = "priority-select";
    select.setAttribute("aria-label", `Prioridade: ${task.title}`);
    select.disabled = busy;
    Object.entries(priorities).forEach(([key, label]) => {
      const option = text("option", label);
      option.value = key;
      select.append(option);
    });
    select.value = priority(task);
    select.addEventListener("change", () =>
      change(() => (saved.priorities[task.id] = select.value)),
    );
    const move = document.createElement("div");
    move.className = "move";
    for (const [delta, label, symbol] of [
      [-1, "Subir", "↑"],
      [1, "Descer", "↓"],
    ]) {
      const button = text("button", symbol);
      button.type = "button";
      button.title = label;
      button.setAttribute("aria-label", `${label}: ${task.title}`);
      button.disabled = busy || !manual || (delta === -1 ? index === 0 : index === list.length - 1);
      button.addEventListener("click", () => {
        const target = list[index + delta];
        if (delta < 0) reposition(task.id, target.id);
        else reposition(target.id, task.id);
      });
      move.append(button);
    }
    card.append(
      handle,
      text("span", String(index + 1).padStart(2, "0"), "rank"),
      content,
      select,
      move,
    );
    fragment.append(card);
  });
  $("#tasks").replaceChildren(fragment);
  $("#refresh").disabled = busy;
  $("#copy").disabled = busy || !list.length;
}
function reposition(id, before) {
  change(() => {
    order.splice(order.indexOf(id), 1);
    order.splice(order.indexOf(before), 0, id);
  });
}
async function change(mutate) {
  if (busy) return;
  const previous = JSON.parse(JSON.stringify({ order, saved }));
  mutate();
  busy = true;
  $("#error").hidden = true;
  $("#save-status").textContent = "Salvando…";
  render();
  try {
    const response = await fetch("/api/state", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ revision: saved.revision, order, priorities: saved.priorities }),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "Falha ao salvar.");
    saved = result;
    $("#save-status").textContent = "✓ Salvo neste computador";
  } catch (error) {
    order = previous.order;
    saved = previous.saved;
    $("#error").textContent = error.message;
    $("#error").hidden = false;
    $("#save-status").textContent = "Não salvo";
  } finally {
    busy = false;
    render();
  }
}
async function load() {
  if (busy) return;
  busy = true;
  $("#refresh").disabled = true;
  $("#error").hidden = true;
  try {
    const response = await fetch("/api/backlog");
    if (!response.ok) throw new Error("Não foi possível abrir TASKS.md.");
    const data = await response.json();
    tasks = data.tasks;
    saved = data.state;
    const ids = new Set(tasks.map((task) => task.id));
    order = [
      ...saved.order.filter((id) => ids.has(id)),
      ...tasks.filter((task) => !saved.order.includes(task.id)).map((task) => task.id),
    ];
    saved.priorities = Object.fromEntries(
      Object.entries(saved.priorities).filter(([id]) => ids.has(id)),
    );
    const section = $("#section"),
      selected = section.value;
    section.replaceChildren(text("option", "Todas as etapas"));
    section.firstChild.value = "";
    [...new Set(tasks.map((task) => task.section))].filter(Boolean).forEach((value) => {
      const option = text("option", value);
      option.value = value;
      section.append(option);
    });
    if ([...section.options].some((option) => option.value === selected)) section.value = selected;
    $("#save-status").textContent = saved.updatedAt
      ? "✓ Prioridades recuperadas"
      : "Pronto para organizar";
  } catch (error) {
    $("#error").textContent = error.message;
    $("#error").hidden = false;
    $("#save-status").textContent = "Falha na leitura";
  } finally {
    busy = false;
    render();
  }
}
["#search", "#section", "#priority", "#status", "#sort"].forEach((selector) =>
  $(selector).addEventListener(selector === "#search" ? "input" : "change", render),
);
$("#refresh").addEventListener("click", load);
$("#copy").addEventListener("click", async () => {
  const lines = visible().map(
    (task, index) =>
      `${index + 1}. [${priorities[priority(task)]}] ${task.title}\n   ${task.section} · TASKS.md:${task.line}`,
  );
  try {
    await navigator.clipboard.writeText(`Ordem de trabalho — Lessonara\n\n${lines.join("\n\n")}`);
    $("#save-status").textContent = "✓ Ordem copiada";
  } catch {
    $("#error").textContent =
      "O navegador não permitiu copiar. A ordem continua salva no arquivo local.";
    $("#error").hidden = false;
  }
});
load();
