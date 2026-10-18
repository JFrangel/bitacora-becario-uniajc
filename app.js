const DB_NAME = "bitacora-iterativa";
const DB_VERSION = 1;
const STORE_NAME = "entries";
const MAX_IMAGES = 4;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const DEFAULT_PROJECTS = ["iMujer", "Análisis Jurídico", "Landing Jurídica", "SECOP II", "CALIFRESCA", "Portal web", "Otro"];
const REMOTE_API_URL = "https://script.google.com/macros/s/AKfycbzYaGmwGJSLKMOK2F9bA3D1LKiJ58Vx5VAA2O6U01UirMrINYw8EWKWuKJaGqlLQ_yw/exec";
const ADMIN_SESSION_KEY = "bitacora-admin-pin";

const ui = {
  form: document.querySelector("#entryForm"),
  entryDisclosure: document.querySelector("#entryDisclosure"),
  date: document.querySelector("#entryDate"),
  hours: document.querySelector("#entryHours"),
  project: document.querySelector("#entryProject"),
  objective: document.querySelector("#entryObjective"),
  activity: document.querySelector("#entryActivity"),
  development: document.querySelector("#entryDevelopment"),
  observations: document.querySelector("#entryObservations"),
  result: document.querySelector("#entryResult"),
  photoInput: document.querySelector("#photoInput"),
  evidencePreview: document.querySelector("#evidencePreview"),
  linkLabel: document.querySelector("#linkLabel"),
  linkUrl: document.querySelector("#linkUrl"),
  formMessage: document.querySelector("#formMessage"),
  formTitle: document.querySelector("#formTitle"),
  saveButton: document.querySelector("#saveEntry"),
  cancelEdit: document.querySelector("#cancelEdit"),
  timeline: document.querySelector("#timeline"),
  recordCount: document.querySelector("#recordCount"),
  search: document.querySelector("#searchInput"),
  projectFilter: document.querySelector("#projectFilter"),
  statusFilter: document.querySelector("#statusFilter"),
  activityCount: document.querySelector("#activityCount"),
  hoursCount: document.querySelector("#hoursCount"),
  completedCount: document.querySelector("#completedCount"),
  theme: document.querySelector("#themeSelect"),
  exportButton: document.querySelector("#exportButton"),
  importInput: document.querySelector("#importInput"),
  imageDialog: document.querySelector("#imageDialog"),
  dialogImage: document.querySelector("#dialogImage"),
  dialogCaption: document.querySelector("#dialogCaption"),
  deleteDialog: document.querySelector("#deleteDialog"),
  deleteActivity: document.querySelector("#deleteActivity"),
  deleteMeta: document.querySelector("#deleteMeta"),
  cancelDelete: document.querySelector("#cancelDelete"),
  confirmDelete: document.querySelector("#confirmDelete"),
  toast: document.querySelector("#toast"),
};

let db;
let entries = [];
let editId = null;
let pendingPhotos = [];
let attachedPhotos = [];
let attachedLinks = [];
let activeObjectUrls = [];
let pendingDeleteId = null;
let toastTimer;

function adminKey() {
  try { return sessionStorage.getItem(ADMIN_SESSION_KEY) || ""; } catch { return ""; }
}

function setAdminKey(value) {
  try {
    if (value) sessionStorage.setItem(ADMIN_SESSION_KEY, value);
    else sessionStorage.removeItem(ADMIN_SESSION_KEY);
  } catch { /* Admin mode lasts only for the current tab when storage is unavailable. */ }
}

function requestRemoteEntries() {
  return new Promise((resolve, reject) => {
    const callback = `cb_${crypto.randomUUID().replaceAll("-", "")}`;
    const script = document.createElement("script");
    const timeout = setTimeout(() => finish(new Error("No se pudo conectar con la bitácora compartida.")), 15000);
    function finish(error, data) {
      clearTimeout(timeout);
      delete window[callback];
      script.remove();
      if (error) reject(error);
      else if (!Array.isArray(data?.entries)) reject(new Error("No se pudo leer la hoja compartida."));
      else resolve(data.entries.map((entry) => {
        const recordedAt = String(entry.recordedAt || "");
        return {
          ...entry,
          id: String(entry.id || ""),
          hours: Number(entry.hours || 0),
          objective: String(entry.objective || ""),
          nextStep: String(entry.nextStep || ""),
          blocker: String(entry.blocker || ""),
          links: Array.isArray(entry.links) ? entry.links : parseJson(entry.links),
          photos: Array.isArray(entry.photos) ? entry.photos : parseJson(entry.photos),
          createdAt: Number(entry.createdAt) || Date.parse(recordedAt) || 0,
          updatedAt: Number(entry.updatedAt) || Date.parse(recordedAt) || 0,
        };
      }).filter((entry) => entry.id));
    }
    window[callback] = (data) => finish(null, data);
    script.onerror = () => finish(new Error("No se pudo cargar la bitácora compartida."));
    script.src = `${REMOTE_API_URL}?callback=${callback}`;
    document.head.append(script);
  });
}

function parseJson(value) {
  try { return JSON.parse(value || "[]"); } catch { return []; }
}

function parseHours(value) {
  const normalized = String(value).trim().replace(",", ".");
  return /^\d+(?:\.\d+)?$/.test(normalized) ? Number(normalized) : NaN;
}

function validHours(hours) {
  return Number.isFinite(hours) && hours >= 0.25 && hours <= 24 && Math.abs(hours * 4 - Math.round(hours * 4)) < 1e-8;
}

function formatHours(hours) {
  return new Intl.NumberFormat("es-CO", { maximumFractionDigits: 2 }).format(Number(hours) || 0);
}

function imageSource(photo) {
  if (!photo.url) return createObjectUrl(photo.blob);
  try {
    const url = new URL(photo.url);
    if (url.hostname === "drive.google.com" || url.hostname === "drive.usercontent.google.com") {
      const fileId = url.searchParams.get("id") || url.pathname.match(/\/d\/([^/]+)/)?.[1];
      if (fileId) return `https://lh3.googleusercontent.com/d/${encodeURIComponent(fileId)}`;
    }
  } catch { /* Keep non-standard evidence URLs unchanged. */ }
  return photo.url;
}

function postRemote(payload) {
  const body = new URLSearchParams({ payload: JSON.stringify(payload) });
  return fetch(REMOTE_API_URL, { method: "POST", mode: "no-cors", body })
    .catch(() => { throw new Error("No se pudo conectar con Google. Comprueba tu conexión e intenta de nuevo."); });
}

async function compressPhoto(photo) {
  if (photo.url) return { id: photo.id, name: photo.name, url: photo.url };
  const bitmap = await createImageBitmap(photo.blob);
  const scale = Math.min(1, 1400 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const context = canvas.getContext("2d");
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  let blob;
  for (const quality of [0.76, 0.62, 0.5]) {
    blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
    if (blob && blob.size <= 1_500_000) break;
  }
  if (!blob || blob.size > 1_200_000) throw new Error(`No se pudo comprimir ${photo.name}.`);
  return { id: photo.id, name: photo.name, dataUrl: await blobToDataUrl(blob) };
}

async function requireAdmin() {
  let key = adminKey();
  if (!key) {
    key = window.prompt("Ingresa el PIN de administración para editar la bitácora compartida:") || "";
    if (key) setAdminKey(key);
  }
  if (!key) throw new Error("Se requiere el PIN de administración para guardar cambios.");
  return key;
}

function localDateInputValue() {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60_000;
  return new Date(now.getTime() - offset).toISOString().slice(0, 10);
}

function openDatabase() {
  return new Promise((resolve, reject) => {
    if (!("indexedDB" in window)) {
      reject(new Error("Este navegador no permite guardar la bitácora localmente."));
      return;
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        database.createObjectStore(STORE_NAME, { keyPath: "id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("No se pudo abrir el almacenamiento local."));
  });
}

function transact(mode, action) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, mode);
    const store = transaction.objectStore(STORE_NAME);
    let result;
    try {
      result = action(store);
    } catch (error) {
      reject(error);
      return;
    }
    transaction.oncomplete = () => resolve(result?.result);
    transaction.onerror = () => reject(transaction.error || result?.error || new Error("No se pudo guardar el registro."));
    transaction.onabort = () => reject(transaction.error || new Error("El guardado se canceló."));
  });
}

async function loadEntries() {
  entries = REMOTE_API_URL
    ? await requestRemoteEntries()
    : await transact("readonly", (store) => store.getAll());
  entries.sort(compareTimelineEntries);
  renderProjectChoices();
  renderAll();
}

function renderProjectChoices() {
  const names = [...new Set([...DEFAULT_PROJECTS, ...entries.map((entry) => entry.project.trim()).filter(Boolean)])];
  const datalist = document.querySelector("#projectOptions");
  datalist.replaceChildren(...names.map((name) => {
    const option = document.createElement("option");
    option.value = name;
    return option;
  }));

  const selected = ui.projectFilter.value;
  ui.projectFilter.replaceChildren(new Option("Todas las áreas", ""), ...names.map((name) => new Option(name, name)));
  if (names.includes(selected)) ui.projectFilter.value = selected;
}

function clearObjectUrls() {
  activeObjectUrls.forEach((url) => URL.revokeObjectURL(url));
  activeObjectUrls = [];
}

function createObjectUrl(blob) {
  const url = URL.createObjectURL(blob);
  activeObjectUrls.push(url);
  return url;
}

function showToast(message) {
  ui.toast.textContent = message;
  ui.toast.classList.add("visible");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => ui.toast.classList.remove("visible"), 2600);
}

function formatDate(dateValue, includeWeekday = true) {
  const [year, month, day] = dateValue.split("-").map(Number);
  const date = new Date(year, month - 1, day, 12);
  return new Intl.DateTimeFormat("es-CO", {
    weekday: includeWeekday ? "long" : undefined,
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}

function makeButton(label, className, title) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = className;
  button.textContent = label;
  if (title) {
    button.title = title;
    button.setAttribute("aria-label", title);
  }
  return button;
}

function renderEvidenceEditor() {
  ui.evidencePreview.replaceChildren();
  const items = [
    ...attachedPhotos.map((item, index) => ({ kind: "existing-photo", item, index })),
    ...pendingPhotos.map((item, index) => ({ kind: "pending-photo", item, index })),
    ...attachedLinks.map((item, index) => ({ kind: "link", item, index })),
  ];
  for (const entry of items) {
    const wrap = document.createElement("div");
    wrap.className = "preview-item";
    if (entry.kind.includes("photo")) {
      const img = document.createElement("img");
      img.className = "preview-thumb";
      img.alt = "Vista previa de imagen adjunta";
      img.src = imageSource(entry.item);
      wrap.append(img);
    } else {
      const icon = document.createElement("span");
      icon.className = "preview-link-icon";
      icon.setAttribute("aria-hidden", "true");
      icon.textContent = "↗";
      wrap.append(icon);
    }
    const name = document.createElement("span");
    name.className = "preview-name";
    name.textContent = entry.kind === "link" ? entry.item.label : entry.item.name;
    wrap.append(name);
    const remove = makeButton("×", "remove-evidence", "Quitar evidencia");
    remove.dataset.kind = entry.kind;
    remove.dataset.index = String(entry.index);
    wrap.append(remove);
    ui.evidencePreview.append(wrap);
  }
}

function statusTag(status) {
  const tag = document.createElement("span");
  tag.className = "status-tag";
  tag.dataset.state = status;
  tag.textContent = status;
  return tag;
}

function compareTimelineEntries(a, b) {
  const byDate = b.date.localeCompare(a.date);
  if (byDate) return byDate;
  const orderA = Number(a.order) || 0;
  const orderB = Number(b.order) || 0;
  if (orderA && orderB && orderA !== orderB) return orderA - orderB;
  return b.updatedAt - a.updatedAt || String(a.id).localeCompare(String(b.id));
}

function renderEntry(entry) {
  const card = document.createElement("article");
  card.className = "entry-card";
  card.dataset.state = entry.status;
  const top = document.createElement("div");
  top.className = "entry-top";
  const headingGroup = document.createElement("div");
  const date = document.createElement("p");
  date.className = "entry-date";
  date.textContent = formatDate(entry.date);
  headingGroup.append(date);
  const meta = document.createElement("div");
  meta.className = "entry-meta";
  [entry.project, `${formatHours(entry.hours)} ${Number(entry.hours) === 1 ? "hora" : "horas"}`].forEach((text, index) => {
    if (index > 0) {
      const dot = document.createElement("span");
      dot.className = "meta-dot";
      dot.setAttribute("aria-hidden", "true");
      dot.textContent = "·";
      meta.append(dot);
    }
    const item = document.createElement("span");
    item.textContent = text;
    meta.append(item);
  });
  meta.append(statusTag(entry.status));
  headingGroup.append(meta);
  top.append(headingGroup);
  const actions = document.createElement("div");
  actions.className = "entry-actions";
  if (!REMOTE_API_URL || adminKey()) {
    const dayEntries = entries.filter((item) => item.date === entry.date).sort(compareTimelineEntries);
    const currentIndex = dayEntries.findIndex((item) => item.id === entry.id);
    const filtersActive = Boolean(ui.search.value.trim() || ui.projectFilter.value || ui.statusFilter.value);
    for (const [direction, glyph, label, disabled] of [
      [-1, "↑", "Subir dentro de esta fecha", currentIndex === 0],
      [1, "↓", "Bajar dentro de esta fecha", currentIndex === dayEntries.length - 1],
    ]) {
      const move = makeButton(glyph, "icon-button move-button", filtersActive ? "Quita los filtros para reordenar" : label);
      move.dataset.action = "move";
      move.dataset.id = entry.id;
      move.dataset.direction = String(direction);
      move.disabled = disabled || filtersActive || dayEntries.length < 2;
      actions.append(move);
    }
    const edit = makeButton("Editar", "icon-button", "Editar registro");
    edit.textContent = "✎";
    edit.dataset.action = "edit";
    edit.dataset.id = entry.id;
    const remove = makeButton("Eliminar", "icon-button danger", "Eliminar registro");
    remove.textContent = "×";
    remove.dataset.action = "delete";
    remove.dataset.id = entry.id;
    actions.append(edit, remove);
  }
  top.append(actions);
  card.append(top);

  const copy = document.createElement("div");
  copy.className = "entry-copy";
  const details = [
    ["Actividad", entry.activity, "actividad"],
    ["Objetivo", entry.objective || "", "objective"],
    ["Desarrollo", entry.nextStep || "", "development"],
    ["Resultado", entry.result, "result"],
    ["Observaciones", entry.blocker || "", "observaciones"],
  ];
  for (const [label, text, key] of details) {
    if (!text) continue;
    const detail = document.createElement("div");
    detail.className = `entry-detail entry-detail-${key}`;
    const heading = document.createElement("span");
    heading.className = "entry-label";
    heading.textContent = label;
    const paragraph = document.createElement("p");
    paragraph.textContent = text;
    detail.append(heading, paragraph);
    copy.append(detail);
  }
  card.append(copy);

  const hasEvidence = entry.photos?.length || entry.links?.length;
  if (hasEvidence) {
    const evidence = document.createElement("div");
    evidence.className = "entry-evidence";
    for (const photo of entry.photos || []) {
      const image = document.createElement("img");
      image.className = "timeline-thumb";
      image.alt = photo.name;
      image.src = imageSource(photo);
      image.tabIndex = 0;
      image.setAttribute("role", "button");
      image.setAttribute("aria-label", `Ampliar imagen: ${photo.name}`);
      image.addEventListener("click", () => openImage(photo));
      image.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          openImage(photo);
        }
      });
      evidence.append(image);
    }
    for (const link of entry.links || []) {
      const anchor = document.createElement("a");
      anchor.className = "timeline-link";
      anchor.href = link.url;
      anchor.target = "_blank";
      anchor.rel = "noopener noreferrer";
      anchor.textContent = `↗ ${link.label}`;
      evidence.append(anchor);
    }
    card.append(evidence);
  }
  return card;
}

function renderTimeline() {
  clearObjectUrls();
  const query = ui.search.value.trim().toLocaleLowerCase("es-CO");
  const project = ui.projectFilter.value;
  const status = ui.statusFilter.value;
  const visible = entries.filter((entry) => {
    if (project && entry.project !== project) return false;
    if (status && entry.status !== status) return false;
    const searchable = `${entry.project} ${entry.objective || ""} ${entry.activity} ${entry.nextStep || ""} ${entry.result} ${entry.blocker || ""} ${entry.links?.map((link) => link.label).join(" ") || ""}`.toLocaleLowerCase("es-CO");
    return !query || searchable.includes(query);
  });
  ui.timeline.replaceChildren();
  ui.recordCount.textContent = `${visible.length} ${visible.length === 1 ? "registro" : "registros"}`;
  if (visible.length === 0) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    const mark = document.createElement("span");
    mark.className = "empty-mark";
    mark.setAttribute("aria-hidden", "true");
    mark.textContent = query || project || status ? "⌕" : "▤";
    const title = document.createElement("h3");
    title.textContent = query || project || status ? "No hay resultados" : "Todavía no hay actividades";
    const note = document.createElement("p");
    note.textContent = query || project || status ? "Prueba otra búsqueda o cambia los filtros." : "Completa el formulario para comenzar a construir tu historial de trabajo.";
    empty.append(mark, title, note);
    ui.timeline.append(empty);
    return;
  }
  visible
    .sort(compareTimelineEntries)
    .forEach((entry) => ui.timeline.append(renderEntry(entry)));
}

async function moveEntry(id, direction) {
  const entry = entries.find((item) => item.id === id);
  if (!entry) return;
  const dayEntries = entries.filter((item) => item.date === entry.date).sort(compareTimelineEntries);
  const index = dayEntries.findIndex((item) => item.id === id);
  const nextIndex = index + direction;
  if (nextIndex < 0 || nextIndex >= dayEntries.length) return;
  [dayEntries[index], dayEntries[nextIndex]] = [dayEntries[nextIndex], dayEntries[index]];
  const ids = dayEntries.map((item) => item.id);
  if (REMOTE_API_URL) {
    const key = await requireAdmin();
    await postRemote({ action: "reorder", key, date: entry.date, ids });
    for (let attempt = 0; attempt < 8; attempt += 1) {
      const fresh = await requestRemoteEntries();
      const savedIds = fresh.filter((item) => item.date === entry.date).sort(compareTimelineEntries).map((item) => item.id);
      if (savedIds.join("|") === ids.join("|")) {
        entries = fresh.sort(compareTimelineEntries);
        renderAll();
        showToast("Orden del día guardado.");
        return;
      }
      if (attempt < 7) await new Promise((resolve) => setTimeout(resolve, 1000));
    }
    setAdminKey("");
    renderAll();
    throw new Error("No se confirmó el nuevo orden. Actualiza la bitácora e inténtalo de nuevo.");
  }
  dayEntries.forEach((item, order) => { item.order = order + 1; });
  await Promise.all(dayEntries.map((item) => transact("readwrite", (store) => store.put(item))));
  entries.sort(compareTimelineEntries);
  renderAll();
  showToast("Orden del día guardado.");
}

function renderSummary() {
  ui.activityCount.textContent = String(entries.length);
  const hours = entries.reduce((total, entry) => total + Number(entry.hours || 0), 0);
  ui.hoursCount.textContent = formatHours(hours);
  ui.completedCount.textContent = String(entries.filter((entry) => entry.status === "Completada").length);
}

function renderAll() {
  renderSummary();
  renderTimeline();
}

function setMessage(message, isError = false) {
  ui.formMessage.textContent = message;
  ui.formMessage.classList.toggle("error", isError);
}

function resetForm() {
  ui.form.reset();
  ui.date.value = localDateInputValue();
  ui.hours.value = "2";
  editId = null;
  attachedPhotos = [];
  attachedLinks = [];
  pendingPhotos = [];
  ui.formTitle.textContent = "Nuevo registro";
  ui.entryDisclosure.open = false;
  ui.saveButton.textContent = "＋ Agregar a la bitácora";
  ui.cancelEdit.classList.add("hidden");
  ui.photoInput.value = "";
  setMessage("");
  clearObjectUrls();
  renderEvidenceEditor();
}

function beginEdit(entry) {
  ui.entryDisclosure.open = true;
  editId = entry.id;
  ui.date.value = entry.date;
  ui.hours.value = formatHours(entry.hours);
  ui.project.value = entry.project;
  ui.objective.value = entry.objective || "";
  ui.activity.value = entry.activity;
  ui.development.value = entry.nextStep || "";
  ui.observations.value = entry.blocker || "";
  ui.result.value = entry.result;
  const selectedStatus = ui.form.querySelector(`input[name="status"][value="${CSS.escape(entry.status)}"]`);
  if (selectedStatus) selectedStatus.checked = true;
  attachedPhotos = [...(entry.photos || [])];
  attachedLinks = [...(entry.links || [])];
  pendingPhotos = [];
  ui.formTitle.textContent = "Editar registro";
  ui.saveButton.textContent = "Guardar cambios";
  ui.cancelEdit.classList.remove("hidden");
  setMessage("");
  renderEvidenceEditor();
  document.querySelector("#formTitle").scrollIntoView({ behavior: "smooth", block: "start" });
}

function validateWebUrl(value) {
  const url = new URL(value);
  if (!["https:", "http:"].includes(url.protocol)) throw new Error("Usa un enlace que comience con http:// o https://.");
  return url.href;
}

function linkFromInputs() {
  const rawUrl = ui.linkUrl.value.trim();
  const label = ui.linkLabel.value.trim();
  if (!rawUrl) {
    if (label) throw new Error("Completa la dirección web del enlace.");
    return null;
  }
  const url = validateWebUrl(rawUrl);
  return { id: crypto.randomUUID(), label: label || new URL(url).hostname, url };
}

function addLink() {
  let link;
  try {
    link = linkFromInputs();
    if (!link) throw new Error("Escribe la dirección web del enlace.");
  } catch (error) {
    setMessage(error.message || "La dirección del enlace no es válida.", true);
    ui.linkUrl.focus();
    return;
  }
  attachedLinks.push(link);
  ui.linkLabel.value = "";
  ui.linkUrl.value = "";
  setMessage("");
  clearObjectUrls();
  renderEvidenceEditor();
  ui.linkLabel.focus();
}

function addPhotos(fileList) {
  const files = [...fileList];
  let message = "";
  for (const file of files) {
    if (!file.type.startsWith("image/")) {
      message = "Se omitió un archivo que no es una imagen.";
      continue;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      message = `${file.name} supera el límite de 5 MB.`;
      continue;
    }
    if (attachedPhotos.length + pendingPhotos.length >= MAX_IMAGES) {
      message = `Puedes adjuntar hasta ${MAX_IMAGES} imágenes por registro.`;
      break;
    }
    pendingPhotos.push({ id: crypto.randomUUID(), name: file.name, type: file.type, blob: file });
  }
  ui.photoInput.value = "";
  setMessage(message, Boolean(message));
  clearObjectUrls();
  renderEvidenceEditor();
}

function removeEditorEvidence(button) {
  const index = Number(button.dataset.index);
  if (button.dataset.kind === "existing-photo") attachedPhotos.splice(index, 1);
  if (button.dataset.kind === "pending-photo") pendingPhotos.splice(index, 1);
  if (button.dataset.kind === "link") attachedLinks.splice(index, 1);
  clearObjectUrls();
  renderEvidenceEditor();
}

async function saveEntry(event) {
  event.preventDefault();
  try {
    const draftLink = linkFromInputs();
    if (draftLink) {
      attachedLinks.push(draftLink);
      ui.linkLabel.value = "";
      ui.linkUrl.value = "";
      renderEvidenceEditor();
    }
  } catch (error) {
    setMessage(error.message || "Revisa la dirección del enlace.", true);
    ui.linkUrl.focus();
    return;
  }
  const selectedStatus = ui.form.querySelector('input[name="status"]:checked');
  const existing = editId ? entries.find((entry) => entry.id === editId) : null;
  const record = {
    id: editId || crypto.randomUUID(),
    date: ui.date.value,
    hours: parseHours(ui.hours.value),
    project: ui.project.value.trim(),
    objective: ui.objective.value.trim(),
    activity: ui.activity.value.trim(),
    nextStep: ui.development.value.trim(),
    blocker: ui.observations.value.trim(),
    result: ui.result.value.trim(),
    status: selectedStatus?.value || "Completada",
    photos: [...attachedPhotos, ...pendingPhotos],
    links: [...attachedLinks],
    createdAt: existing?.createdAt || Date.now(),
    updatedAt: Date.now(),
  };
  if (!record.date || !record.project || !record.activity || !record.result || !validHours(record.hours)) {
    setMessage("Completa los campos. Las horas deben estar entre 0,25 y 24, en incrementos de 0,25.", true);
    return;
  }
  ui.saveButton.disabled = true;
  setMessage("Guardando…");
  try {
    if (REMOTE_API_URL) {
      const key = await requireAdmin();
      const previousUpdate = Number(existing?.updatedAt || 0);
      const photos = await Promise.all(record.photos.map(compressPhoto));
      const remoteRecord = { ...record, photos };
      await postRemote({ action: "save", key, entry: remoteRecord });
      let saved;
      for (let attempt = 0; attempt < 8; attempt += 1) {
        await loadEntries();
        saved = entries.find((entry) => entry.id === record.id);
        if (saved && remoteEntryMatches(saved, remoteRecord) && saved.updatedAt >= previousUpdate) break;
        if (attempt < 7) await new Promise((resolve) => setTimeout(resolve, 1000));
      }
      if (!saved || !remoteEntryMatches(saved, remoteRecord) || saved.updatedAt < previousUpdate) {
        setAdminKey("");
        renderAll();
        throw new Error("Google no confirmó la actividad y sus enlaces. Los datos siguen en el formulario; revisa el PIN e inténtalo de nuevo.");
      }
    } else {
      await transact("readwrite", (store) => store.put(record));
      await loadEntries();
    }
    resetForm();
    showToast(existing ? "Cambios guardados." : "Actividad agregada a tu bitácora.");
  } catch (error) {
    setMessage(error.message || "No se pudo guardar. Comprueba el espacio disponible en el navegador.", true);
  } finally {
    ui.saveButton.disabled = false;
  }
}

function remoteEntryMatches(saved, expected) {
  const linksMatch = JSON.stringify((saved.links || []).map(({ label, url }) => ({ label, url }))) ===
    JSON.stringify((expected.links || []).map(({ label, url }) => ({ label, url })));
  const photosMatch = (saved.photos || []).length === (expected.photos || []).length &&
    (saved.photos || []).every((photo, index) => photo.id === expected.photos[index]?.id && photo.name === expected.photos[index]?.name);
  return saved.date === expected.date && saved.project === expected.project &&
    String(saved.objective || "") === String(expected.objective || "") &&
    saved.activity === expected.activity && saved.result === expected.result &&
    String(saved.nextStep || "") === String(expected.nextStep || "") &&
    String(saved.blocker || "") === String(expected.blocker || "") &&
    Number(saved.hours) === Number(expected.hours) && saved.status === expected.status && linksMatch && photosMatch;
}

async function deleteEntry(id) {
  const entry = entries.find((item) => item.id === id);
  if (!entry) return;
  if (REMOTE_API_URL) {
    const key = await requireAdmin();
    await postRemote({ action: "delete", key, id });
    entries = await requestRemoteEntries();
    if (entries.some((item) => item.id === id)) throw new Error("No se pudo eliminar el registro. Revisa el PIN.");
    entries.sort(compareTimelineEntries);
    renderAll();
  } else {
    await transact("readwrite", (store) => store.delete(id));
  }
  if (editId === id) resetForm();
  if (!REMOTE_API_URL) await loadEntries();
  showToast("Registro eliminado.");
}

function openDeleteConfirmation(id) {
  const entry = entries.find((item) => item.id === id);
  if (!entry) return;
  pendingDeleteId = id;
  ui.deleteActivity.textContent = entry.activity;
  ui.deleteMeta.textContent = `${entry.project} · ${formatDate(entry.date, false)}`;
  ui.deleteDialog.showModal();
  ui.cancelDelete.focus();
}

async function confirmPendingDelete() {
  if (!pendingDeleteId || ui.confirmDelete.disabled) return;
  const id = pendingDeleteId;
  ui.confirmDelete.disabled = true;
  try {
    await deleteEntry(id);
    ui.deleteDialog.close();
  } catch (error) {
    showToast(error.message || "No se pudo eliminar el registro.");
  } finally {
    ui.confirmDelete.disabled = false;
  }
}

function openImage(photo) {
  clearObjectUrls();
  ui.dialogImage.src = imageSource(photo);
  ui.dialogCaption.textContent = photo.name;
  ui.imageDialog.showModal();
}

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error || new Error("No se pudo leer una imagen."));
    reader.readAsDataURL(blob);
  });
}

function dataUrlToBlob(dataUrl) {
  const [metadata, contents] = dataUrl.split(",", 2);
  const mime = metadata.match(/data:([^;]+)/)?.[1] || "application/octet-stream";
  const binary = atob(contents || "");
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

async function exportBackup() {
  if (!entries.length) {
    showToast("Aún no hay registros para descargar.");
    return;
  }
  ui.exportButton.disabled = true;
  ui.exportButton.textContent = "Preparando copia…";
  try {
    const backupEntries = await Promise.all(entries.map(async (entry) => ({
      ...entry,
      photos: await Promise.all((entry.photos || []).map(async (photo) => (
        photo.url ? { ...photo, blob: undefined } : { ...photo, blob: undefined, dataUrl: await blobToDataUrl(photo.blob) }
      ))),
    })));
    const backup = { format: "bitacora-iterativa", version: 1, exportedAt: new Date().toISOString(), entries: backupEntries };
    const blob = new Blob([JSON.stringify(backup)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `bitacora-${localDateInputValue()}.json`;
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    showToast("Copia descargada con imágenes y enlaces.");
  } catch {
    showToast("No se pudo crear la copia. Intenta con menos imágenes.");
  } finally {
    ui.exportButton.disabled = false;
    ui.exportButton.textContent = "Descargar copia";
  }
}

async function importBackup(file) {
  try {
    if (file.size > 30 * 1024 * 1024) throw new Error("La copia supera el límite de 30 MB.");
    const parsed = JSON.parse(await file.text());
    if (parsed.format !== "bitacora-iterativa" || parsed.version !== 1 || !Array.isArray(parsed.entries)) {
      throw new Error("Ese archivo no es una copia de esta bitácora.");
    }
    const restored = parsed.entries.map((entry) => {
      if (!entry || typeof entry.id !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(entry.date) ||
          typeof entry.project !== "string" || typeof entry.activity !== "string" || typeof entry.result !== "string" ||
          !validHours(Number(entry.hours)) ||
          !["Completada", "En progreso", "Pendiente de revisión"].includes(entry.status)) {
        throw new Error("La copia contiene un registro con datos inválidos.");
      }
      const photos = (entry.photos || []).map((photo) => {
        if (typeof photo.url === "string" && /^https:\/\//.test(photo.url)) {
          return { id: String(photo.id || crypto.randomUUID()), name: String(photo.name || "Imagen"), url: photo.url };
        }
        if (typeof photo.dataUrl !== "string" || !/^data:image\//.test(photo.dataUrl)) throw new Error("La copia contiene una imagen inválida.");
        const blob = dataUrlToBlob(photo.dataUrl);
        if (blob.size > MAX_IMAGE_BYTES) throw new Error("La copia contiene una imagen de más de 5 MB.");
        return { id: String(photo.id || crypto.randomUUID()), name: String(photo.name || "Imagen"), type: blob.type, blob };
      });
      if (photos.length > MAX_IMAGES) throw new Error(`Cada registro puede tener máximo ${MAX_IMAGES} imágenes.`);
      const links = (entry.links || []).map((link) => ({
        id: String(link.id || crypto.randomUUID()),
        label: String(link.label || "Enlace").slice(0, 80),
        url: validateWebUrl(String(link.url || "")),
      }));
      return {
        id: entry.id,
        date: entry.date,
        hours: Number(entry.hours),
        project: entry.project.slice(0, 100),
        activity: entry.activity.slice(0, 1500),
        result: entry.result.slice(0, 1500),
        status: entry.status,
        photos,
        links,
        createdAt: Number(entry.createdAt) || Date.now(),
        updatedAt: Number(entry.updatedAt) || Date.now(),
      };
    });
    if (!window.confirm(`Se agregarán o actualizarán ${restored.length} registros de la copia. ¿Continuar?`)) return;
    for (const entry of restored) await transact("readwrite", (store) => store.put(entry));
    await loadEntries();
    showToast(`Copia restaurada: ${restored.length} registros.`);
  } catch (error) {
    showToast(error.message || "No se pudo restaurar esta copia.");
  } finally {
    ui.importInput.value = "";
  }
}

function setTheme(theme) {
  document.documentElement.dataset.theme = theme;
  document.querySelector('meta[name="theme-color"]').content = theme === "dark" ? "#090b0c" : "#f5f7f6";
  ui.theme.value = theme;
  try { localStorage.setItem("bitacora-theme", theme); } catch { /* Theme preference is optional. */ }
}

ui.form.addEventListener("submit", saveEntry);
document.querySelector("#addLink").addEventListener("click", addLink);
ui.linkUrl.addEventListener("keydown", (event) => { if (event.key === "Enter") { event.preventDefault(); addLink(); } });
ui.photoInput.addEventListener("change", () => addPhotos(ui.photoInput.files));
ui.evidencePreview.addEventListener("click", (event) => {
  const button = event.target.closest(".remove-evidence");
  if (button) removeEditorEvidence(button);
});
ui.timeline.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-action]");
  if (!button) return;
  const record = entries.find((entry) => entry.id === button.dataset.id);
  if (!record) return;
  if (button.dataset.action === "edit") beginEdit(record);
  if (button.dataset.action === "delete") openDeleteConfirmation(record.id);
  if (button.dataset.action === "move") moveEntry(record.id, Number(button.dataset.direction)).catch((error) => showToast(error.message || "No se pudo cambiar el orden."));
});
ui.cancelDelete.addEventListener("click", () => ui.deleteDialog.close());
ui.confirmDelete.addEventListener("click", confirmPendingDelete);
ui.deleteDialog.addEventListener("close", () => { pendingDeleteId = null; });
ui.cancelEdit.addEventListener("click", resetForm);
ui.search.addEventListener("input", renderTimeline);
ui.projectFilter.addEventListener("change", renderTimeline);
ui.statusFilter.addEventListener("change", renderTimeline);
ui.theme.addEventListener("change", () => setTheme(ui.theme.value));
document.querySelector("#adminToggle").addEventListener("click", () => {
  if (adminKey()) {
    setAdminKey("");
    renderAll();
    showToast("Sesión de administración cerrada.");
    return;
  }
  const key = window.prompt("Ingresa el PIN de administración:");
  if (key) {
    setAdminKey(key);
    renderAll();
    showToast("Administración habilitada en esta pestaña.");
  }
});
ui.exportButton.addEventListener("click", exportBackup);
ui.importInput.addEventListener("change", () => { if (ui.importInput.files?.[0]) importBackup(ui.importInput.files[0]); });
ui.imageDialog.addEventListener("close", () => { ui.dialogImage.removeAttribute("src"); clearObjectUrls(); });

const adminToggle = document.querySelector("#adminToggle");
adminToggle.hidden = !REMOTE_API_URL;
document.querySelector("#privacyText").textContent = REMOTE_API_URL
  ? "Registros y evidencias visibles para cualquiera con el enlace. Solo la administración puede modificarlos."
  : "Los registros y las imágenes se guardan en este navegador hasta conectar el almacenamiento compartido.";

let savedTheme = "dark";
try { savedTheme = localStorage.getItem("bitacora-theme") || "dark"; } catch { /* Theme preference is optional. */ }
setTheme(savedTheme);
ui.date.value = localDateInputValue();
const startup = REMOTE_API_URL
  ? loadEntries()
  : openDatabase().then((database) => { db = database; return loadEntries(); });
startup
  .catch((error) => {
    ui.formMessage.textContent = error.message;
    ui.formMessage.classList.add("error");
    ui.saveButton.disabled = true;
    ui.timeline.innerHTML = '<div class="empty-state"><h3>No se pudo abrir tu bitácora</h3><p>Comprueba la conexión con la hoja compartida e intenta recargar.</p></div>';
  });
