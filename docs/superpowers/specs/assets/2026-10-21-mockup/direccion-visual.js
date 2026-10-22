(() => {
  'use strict';

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const mobileMq = matchMedia('(max-width: 640px)');
  const app = $('#app');

  /* ---------- Datos de ejemplo (hoy = miércoles 21 de octubre de 2026) ---------- */
  const TODAY = new Date(2026, 9, 21);
  const PROJ = { 'iMujer': 'p1', 'SECOP II': 'p2', 'Análisis Jurídico': 'p3', 'CALIFRESCA': 'p4', 'Landing Jurídica': 'p5', 'Portal web': 'p6' };
  const COLS = [{ id: 'todo', name: 'Por hacer' }, { id: 'doing', name: 'En curso' }, { id: 'review', name: 'En revisión' }, { id: 'done', name: 'Completada' }];
  const ROMAN = ['I', 'II', 'III', 'IV'];
  const PEOPLE = { D: 'Director', S: 'Supervisora', B: 'Tú', '': 'Sin asignar' };
  const PRIO = { 1: 'baja', 2: 'media', 3: 'alta' };
  const STATUSES = ['Completada', 'En progreso', 'Pendiente de revisión'];
  const MOBILE_LIMIT = 5;
  const MAX_SUBS = 20;
  const FADE = 56;

  const tasks = [
    { id: 't1', title: 'Revisar cláusulas del convenio de cooperación', description: 'Revisar las cláusulas de supervisión y de modificaciones del convenio y anotar las dudas para la reunión.', subs: [{ t: 'Leer las cláusulas de supervisión', done: true }, { t: 'Marcar las modificaciones', done: false }, { t: 'Redactar las dudas para la reunión', done: false }], proj: 'iMujer', who: 'D', due: '2026-10-24', prio: 3, col: 'todo' },
    { id: 't2', title: 'Mapear procesos abiertos en SECOP II', description: 'Listar los procesos abiertos por entidad y estado, y marcar los que sean relevantes para el análisis.', proj: 'SECOP II', who: 'B', due: '2026-10-28', prio: 2, col: 'todo' },
    { id: 't8', title: 'Preparar presentación de avance para la universidad', proj: 'Portal web', who: 'B', due: '2026-11-03', prio: 2, col: 'todo' },
    { id: 't3', title: 'Redactar concepto sobre contratación directa', proj: 'Análisis Jurídico', who: 'S', due: '2026-10-30', prio: 3, col: 'doing' },
    { id: 't4', title: 'Actualizar los textos de la landing jurídica', subs: [{ t: 'Revisar el texto de inicio', done: true }, { t: 'Actualizar la sección de servicios', done: true }], proj: 'Landing Jurídica', who: 'B', due: '2026-10-20', prio: 1, col: 'doing' },
    { id: 't5', title: 'Verificar registros de CALIFRESCA', description: 'Contrastar los registros del sistema con los reportes del proyecto.', subs: [{ t: 'Descargar los reportes', done: true }, { t: 'Comparar con el sistema', done: false }], proj: 'CALIFRESCA', who: 'B', due: '2026-10-23', prio: 2, col: 'review' },
    { id: 't6', title: 'Informe semanal de actividades', proj: 'Portal web', who: 'B', due: '2026-10-21', prio: 2, col: 'done' },
    { id: 't7', title: 'Matriz de riesgos del convenio', proj: 'iMujer', who: 'S', due: '2026-10-19', prio: 3, col: 'done' },
    { id: 't9', title: 'Revisión inicial de la plataforma y sus funcionalidades', proj: 'iMujer', who: 'B', due: '2026-10-18', prio: 2, col: 'done' },
  ];

  const journal = [
    { id: 'j1', taskId: 't6', date: '2026-10-21', proj: 'Portal web', activity: 'Informe semanal de actividades', hours: 0, status: 'Completada', draft: true },
    { id: 'j2', taskId: 't9', date: '2026-10-18', proj: 'iMujer', activity: 'Revisión inicial de la plataforma y sus funcionalidades', objective: 'Conocer el alcance de la plataforma antes de revisar los documentos.', development: 'Se recorrió la plataforma por secciones y se anotaron las funcionalidades disponibles.', result: 'Identifiqué los documentos pendientes y dejé las dudas para revisión.', observations: 'Pendiente reunión de seguimiento.', hours: 2, status: 'Completada', draft: false, links: [{ label: 'Plataforma', url: 'https://example.com/' }], updatedLabel: '18 oct 2026, 09:32 a. m.' },
    { id: 'j3', date: '2026-10-16', proj: 'SECOP II', activity: 'Búsqueda de procesos de contratación abiertos', objective: 'Listar los procesos relevantes para el análisis.', development: 'Se filtraron los procesos por entidad y por estado.', result: 'Quedó una lista de 12 procesos con su estado actual.', observations: 'Quedan 3 procesos por validar con el equipo.', hours: 3.5, status: 'En progreso', draft: false, links: [], updatedLabel: '16 oct 2026, 05:10 p. m.' },
    { id: 'j4', date: '2026-10-15', proj: 'CALIFRESCA', activity: 'Análisis de requerimientos y propuesta de apoyo', objective: 'Identificar las necesidades del proyecto y proponer alternativas.', development: 'Revisión inicial de las necesidades junto con el equipo.', result: 'Se organizaron los requerimientos para su validación posterior.', observations: '', hours: 4, status: 'Completada', draft: false, links: [], updatedLabel: '15 oct 2026, 04:40 p. m.' },
    { id: 'j5', date: '2026-10-14', proj: 'iMujer', activity: 'Reunión de articulación del proyecto con el semillero', objective: 'Conocer las actividades y el alcance del proyecto.', development: 'Se presentó el propósito del proyecto y las funciones asignadas.', result: 'Quedó claro el rol del becario y las actividades de los próximos días.', observations: 'Pendiente recibir la documentación del proyecto.', hours: 1, status: 'Completada', draft: false, links: [], updatedLabel: '14 oct 2026, 11:15 a. m.' },
  ];

  const history = [
    { t: 'Hoy · 09:42', who: 'S', type: 'moved', text: '«Redactar concepto sobre contratación directa»', detail: 'Por hacer → En curso' },
    { t: 'Hoy · 08:15', who: 'B', type: 'completed', text: '«Informe semanal de actividades»', detail: 'Borrador creado en tu bitácora' },
    { t: 'Ayer · 17:30', who: 'D', type: 'added', text: '«Revisar cláusulas del convenio de cooperación»', detail: 'Asignada al Director · vence el 24 oct' },
    { t: 'Ayer · 11:02', who: 'S', type: 'edited', text: '«Mapear procesos abiertos en SECOP II»', detail: 'Cambió la fecha límite al 28 oct' },
    { t: '19 oct · 16:20', who: 'B', type: 'invited', text: 'a la Supervisora', detail: 'Enlace de un solo uso' },
    { t: '18 oct · 10:05', who: 'D', type: 'removed', text: '«Tarea duplicada de revisión»', detail: '' },
  ];

  const VERB = { moved: 'movió', completed: 'completó', added: 'añadió', edited: 'editó', invited: 'invitó', removed: 'eliminó' };
  const VERB_YOU = { moved: 'moviste', completed: 'completaste', added: 'añadiste', edited: 'editaste', invited: 'invitaste', removed: 'eliminaste' };
  const GLYPH = { moved: '→', completed: '✓', added: '+', edited: '✎', invited: '↗', removed: '×' };

  const state = { theme: 'b', mode: 'dark', view: 'board', proj: '', q: '', compact: false, expanded: {}, jq: '', jproj: '', jstatus: '', jdraft: false, openEntry: {} };
  const cal = { y: 2026, m: 9 };
  let dragId = null;
  let lastMoved = null;
  let toastTimer;
  let enterTimer;

  /* ---------- Utilidades ---------- */
  const isoParts = (iso) => iso.split('-').map(Number);
  const daysTo = (iso) => { if (!iso) return Infinity; const [y, m, d] = isoParts(iso); return Math.round((new Date(y, m - 1, d) - TODAY) / 86400000); };
  const fmtShort = (iso) => { if (!iso) return 'Sin fecha'; const [y, m, d] = isoParts(iso); return new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'short' }).format(new Date(y, m - 1, d)).replace('.', ''); };
  const fmtH = (h) => Number(h).toLocaleString('es-CO', { maximumFractionDigits: 2 });
  const fmtWeekday = (iso) => { const [y, m, d] = isoParts(iso); return new Intl.DateTimeFormat('es-CO', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(y, m - 1, d)); };
  const hoursLabel = (h) => `${fmtH(h)} ${Number(h) === 1 ? 'hora' : 'horas'}`;
  const nowLabel = () => new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date()).replace(/\./g, '');
  const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
  const pvar = (proj) => `var(--${PROJ[proj] || 'p1'})`;
  const parseHours = (v) => { const n = String(v).trim().replace(',', '.'); return /^\d+(?:\.\d+)?$/.test(n) ? Number(n) : NaN; };
  const validHours = (h) => Number.isFinite(h) && h >= 0.25 && h <= 24 && Math.abs(h * 4 - Math.round(h * 4)) < 1e-8;
  const documentedFor = (taskId) => journal.find((j) => j.taskId === taskId && !j.draft);
  const HOURS_MSG = 'Completa los campos. Las horas deben estar entre 0,25 y 24, en incrementos de 0,25.';

  function setNumber(el, to, { decimals = 0, fromZero = false } = {}) {
    const fmt = (n) => n.toLocaleString('es-CO', { maximumFractionDigits: decimals });
    const start = fromZero ? 0 : (el._v ?? 0);
    el._v = to;
    cancelAnimationFrame(el._raf);
    if (reduceMotion || start === to) { el.textContent = fmt(to); return; }
    const t0 = performance.now();
    const tick = (now) => {
      const k = Math.min(1, (now - t0) / 800);
      el.textContent = fmt(start + (to - start) * (1 - Math.pow(1 - k, 3)));
      if (k < 1) el._raf = requestAnimationFrame(tick);
    };
    el._raf = requestAnimationFrame(tick);
  }

  function toast(message) {
    const el = $('#toast');
    el.textContent = message;
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('show'), 3400);
  }

  function sparks(el) {
    if (reduceMotion || !el) return;
    const a = app.getBoundingClientRect();
    const r = el.getBoundingClientRect();
    const cx = r.left - a.left + r.width / 2;
    const cy = r.top - a.top + r.height / 2;
    for (let i = 0; i < 14; i += 1) {
      const s = document.createElement('i');
      const angle = (Math.PI * 2 * i) / 14 + Math.random() * 0.4;
      const dist = 46 + Math.random() * 54;
      s.className = 'spark';
      s.style.left = `${cx}px`;
      s.style.top = `${cy}px`;
      s.style.setProperty('--dx', `${Math.cos(angle) * dist}px`);
      s.style.setProperty('--dy', `${Math.sin(angle) * dist}px`);
      app.append(s);
      setTimeout(() => s.remove(), 850);
    }
  }

  function replayEnter() {
    const stage = $('#stage');
    stage.classList.remove('enter');
    void stage.offsetWidth;
    stage.classList.add('enter');
    clearTimeout(enterTimer);
    enterTimer = setTimeout(() => stage.classList.remove('enter'), 1800);
  }

  /* ---------- Lista de tarjetas con scroll (mecánica de AnimatedList de React Bits) ----------
     Sin barra nativa; degradado suave que crece con el desplazamiento; las tarjetas que salen de la vista
     se encogen y desvanecen (arriba o abajo) y regresan con un rebote; indicador mínimo mientras se desplaza. */
  const slQueue = new Set();
  let slFrame = 0;

  const FADE_STOPS = [[0, 0], [0.15, 0.027], [0.3, 0.163], [0.45, 0.407], [0.6, 0.683], [0.75, 0.897], [0.9, 0.991], [1, 1]];
  const fadeMask = (ft, fb) => {
    const top = FADE_STOPS.map(([p, a]) => `rgba(0,0,0,${a}) ${(ft * p).toFixed(1)}px`);
    const bottom = [...FADE_STOPS].reverse().map(([p, a]) => `rgba(0,0,0,${a}) calc(100% - ${(fb * p).toFixed(1)}px)`);
    return `linear-gradient(to bottom, ${[...top, ...bottom].join(', ')})`;
  };

  /* Se lee primero (posición y tamaño) y se escribe después, así no se fuerzan recálculos de diseño al desplazar.
     El degradado se escribe en línea (sin variables CSS heredadas por todas las tarjetas) y solo cuando cambia, en pasos de 4 px. */
  function layoutSL(el) {
    const max = el.scrollHeight - el.clientHeight;
    const scrollable = max > 1;
    const st = el.scrollTop;
    const vh = el.clientHeight;
    const cards = el.__cards || (el.__cards = $$('[data-sl]', el));
    const geo = cards.map((c) => [c.offsetTop, c.offsetHeight]);
    const ft = scrollable ? Math.min(FADE, st) : 0;
    const fb = scrollable ? Math.min(FADE, Math.max(0, max - st)) : 0;
    const key = `${ft >> 2}|${fb >> 2}`;
    if (el.__fade !== key) { el.__fade = key; const m = fadeMask(ft, fb); el.style.webkitMaskImage = m; el.style.maskImage = m; }
    cards.forEach((card, i) => {
      if (!scrollable || reduceMotion) { if (card.dataset.state) delete card.dataset.state; return; }
      const top = geo[i][0] - st;
      const visible = (Math.min(top + geo[i][1], vh) - Math.max(top, 0)) / Math.max(1, geo[i][1]);
      const next = visible >= 0.34 ? 'in' : (top < 0 ? 'above' : 'below');
      if (card.dataset.state !== next) card.dataset.state = next;
    });
  }

  function scheduleSL(el) {
    slQueue.add(el);
    if (slFrame) return;
    slFrame = requestAnimationFrame(() => { slFrame = 0; slQueue.forEach(layoutSL); slQueue.clear(); });
  }

  const refreshSL = () => $$('.sl').forEach((el) => { el.__cards = null; layoutSL(el); });

  /* ---------- Renderizado ---------- */
  function renderStats(fromZero = false) {
    const documented = journal.filter((j) => !j.draft);
    const hours = documented.reduce((sum, j) => sum + j.hours, 0);
    const drafts = journal.filter((j) => j.draft).length;
    setNumber($('#s-active'), tasks.filter((t) => t.col !== 'done').length, { fromZero });
    setNumber($('#s-week'), tasks.filter((t) => t.col !== 'done' && daysTo(t.due) <= 7).length, { fromZero });
    setNumber($('#s-hours'), hours, { decimals: 2, fromZero });
    setNumber($('#s-drafts'), drafts, { fromZero });
    setNumber($('#j-count'), documented.length, { fromZero });
    setNumber($('#j-done'), documented.filter((j) => j.status === 'Completada').length, { fromZero });
    setNumber($('#j-hours'), hours, { decimals: 2, fromZero });
    setNumber($('#j-drafts'), drafts, { fromZero });
    const badge = $('#draftBadge');
    badge.dataset.n = String(drafts);
    badge.textContent = String(drafts);
    placeIndicator();
  }

  function renderChips() {
    const names = ['', ...Object.keys(PROJ)];
    $('#chips').innerHTML = names.map((n, i) => `<button class="chip${state.proj === n ? ' on' : ''}" data-proj="${esc(n)}" style="--i:${i}">${n ? esc(n) : 'Todos'}</button>`).join('');
  }

  function refreshProjectOptions() {
    const names = Object.keys(PROJ);
    $('#projectOptions').innerHTML = [...new Set([...names, 'Otro'])].map((n) => `<option value="${esc(n)}"></option>`).join('');
    const sel = $('#jproj');
    const keep = state.jproj;
    sel.innerHTML = `<option value="">Todas las áreas</option>${names.map((n) => `<option value="${esc(n)}">${esc(n)}</option>`).join('')}`;
    sel.value = names.includes(keep) ? keep : '';
  }

  function cardHtml(t, n) {
    const late = t.col !== 'done' && daysTo(t.due) < 0;
    const hasDraft = t.col === 'done' && journal.some((j) => j.taskId === t.id && j.draft);
    const doc = t.col === 'done' ? documentedFor(t.id) : null;
    const next = COLS[COLS.findIndex((c) => c.id === t.col) + 1];
    const subs = t.subs || [];
    const subDone = subs.filter((s) => s.done).length;
    const subsHtml = subs.length ? `<div class="subs" title="Subtareas hechas"><span class="subs-bar"><i style="--w:${Math.round((subDone / subs.length) * 100)}%"></i></span><span class="subs-n">${subDone}/${subs.length}</span></div>` : '';
    const mark = t.col === 'done' ? '<span class="done-mark" title="Completada" aria-label="Completada">✓</span>' : '';
    return `<article class="card${lastMoved === t.id ? ' landed' : ''}" data-sl draggable="true" tabindex="0" data-id="${t.id}" data-col="${t.col}" style="--i:${n};--p:${pvar(t.proj)}">
      <div class="card-top"><span class="proj">${esc(t.proj)}</span><span class="card-flags">${mark}<span class="prio" data-p="${t.prio}" title="Prioridad ${PRIO[t.prio]}"><i></i><i></i><i></i></span></span></div>
      <h3>${esc(t.title)}</h3>
      ${subsHtml}
      <div class="card-bot">
        <span class="avatar sm${t.who ? '' : ' none'}" data-who="${t.who}" title="${PEOPLE[t.who]}">${t.who || '–'}</span><span class="who-name">${PEOPLE[t.who]}</span>
        ${doc ? `<span class="hrs" title="Horas documentadas en la bitácora">${fmtH(doc.hours)} h</span>` : ''}
        <span class="due${late ? ' late' : ''}">${late ? `Vencida ${fmtShort(t.due).replace(' de ', ' ')}` : fmtShort(t.due)}</span>
        ${next ? `<button class="next" data-next="${t.id}" aria-label="Mover a ${next.name}" title="Mover a ${next.name}">→</button>` : ''}
      </div>
      ${hasDraft ? '<div class="draft"><span class="dot"></span>Falta documentar en tu bitácora</div>' : ''}
    </article>`;
  }

  function renderBoard() {
    const q = state.q.trim().toLowerCase();
    let n = 0;
    $('#board').classList.toggle('compact', state.compact);
    $('#board').innerHTML = COLS.map((c, ci) => {
      const all = tasks.filter((t) => t.col === c.id && (!state.proj || t.proj === state.proj) && (!q || `${t.title} ${t.proj}`.toLowerCase().includes(q)));
      // En móvil las columnas van apiladas: se muestran 5 y el resto con «Mostrar más». En escritorio cada columna se desplaza sola.
      const limit = mobileMq.matches && !state.expanded[c.id] ? MOBILE_LIMIT : Infinity;
      const items = all.slice(0, limit);
      const rest = all.length - items.length;
      let toggle = '';
      if (rest > 0) toggle = `<button class="more-cards" data-expand="${c.id}">Mostrar ${rest} más</button>`;
      else if (mobileMq.matches && state.expanded[c.id] && all.length > MOBILE_LIMIT) toggle = `<button class="more-cards" data-expand="${c.id}">Mostrar menos</button>`;
      const body = items.length ? items.map((t) => cardHtml(t, n++)).join('') + toggle : '<p class="col-empty">Suelta una tarjeta aquí</p>';
      return `<section class="col" data-col="${c.id}"><header class="col-head"><span class="col-num">${ROMAN[ci]}</span><h2 class="col-name">${c.name}</h2><span class="col-count">${all.length}</span><button class="col-add" data-add="${c.id}" aria-label="Nueva tarea en ${c.name}" title="Nueva tarea en ${c.name}">＋</button></header><div class="col-body sl-wrap"><div class="col-scroll sl">${body}</div></div></section>`;
    }).join('');
    refreshSL();
  }

  function calChip(t) {
    return `<span class="cal-chip${t.col === 'done' ? ' done' : ''}" style="--p:${pvar(t.proj)}" title="${esc(t.title)} · ${PEOPLE[t.who]}">${esc(t.title)}</span>`;
  }

  function renderCalendar() {
    const { y, m } = cal;
    const month = new Intl.DateTimeFormat('es-CO', { month: 'long' }).format(new Date(y, m, 1));
    $('#calTitle').innerHTML = `${esc(month)} <em>${y}</em>`;
    const hoursByDate = {};
    journal.filter((j) => !j.draft).forEach((j) => { hoursByDate[j.date] = (hoursByDate[j.date] || 0) + j.hours; });
    const offset = (new Date(y, m, 1).getDay() + 6) % 7;
    const days = new Date(y, m + 1, 0).getDate();
    const total = Math.ceil((offset + days) / 7) * 7;
    let html = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'].map((d) => `<div class="cal-dow">${d}</div>`).join('');
    for (let i = 0; i < total; i += 1) {
      const d = i - offset + 1;
      if (d < 1 || d > days) { html += '<div class="cal-cell blank"></div>'; continue; }
      const iso = `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const list = tasks.filter((t) => t.due === iso);
      const isToday = y === 2026 && m === 9 && d === 21;
      const hrs = hoursByDate[iso];
      html += `<div class="cal-cell${isToday ? ' today' : ''}" style="--i:${Math.min(i, 40)}"><span class="cal-num">${d}</span>${hrs ? `<span class="cal-hours" title="Horas documentadas ese día">${fmtH(hrs)} h</span>` : ''}${list.slice(0, 2).map(calChip).join('')}${list.length > 2 ? `<span class="cal-more">+${list.length - 2} más</span>` : ''}</div>`;
    }
    $('#calGrid').innerHTML = html;

    const upcoming = tasks.filter((t) => t.col !== 'done' && t.due).sort((a, b) => a.due.localeCompare(b.due)).slice(0, 6);
    $('#upList').innerHTML = upcoming.map((t, i) => {
      const [, mm, dd] = isoParts(t.due);
      const mon = new Intl.DateTimeFormat('es-CO', { month: 'short' }).format(new Date(2026, mm - 1, 1)).replace('.', '');
      const late = daysTo(t.due) < 0;
      return `<li class="up-item" style="--i:${i};--p:${pvar(t.proj)}"><span class="up-date"><span><b>${dd}</b><small>${mon}</small></span></span><div><strong>${esc(t.title)}</strong><span>${esc(t.proj)} · ${PEOPLE[t.who]}${late ? ' · vencida' : ''}</span></div></li>`;
    }).join('');
  }

  /* ---------- Bitácora (mismos campos; presentación rediseñada) ---------- */
  function entryMatches(j) {
    if (state.jproj && j.proj !== state.jproj) return false;
    if (state.jstatus && j.status !== state.jstatus) return false;
    if (state.jdraft && !j.draft) return false;
    const q = state.jq.trim().toLowerCase();
    if (!q) return true;
    const hay = `${j.proj} ${j.activity} ${j.objective || ''} ${j.development || ''} ${j.result || ''} ${j.observations || ''} ${(j.links || []).map((l) => l.label).join(' ')}`.toLowerCase();
    return hay.includes(q);
  }

  function entryCard(j, i) {
    const open = Boolean(state.openEntry[j.id]);
    const top = `<div class="entry-top"><time datetime="${j.date}">${esc(fmtWeekday(j.date))}</time><span class="proj">${esc(j.proj)}</span><span class="stag" data-s="${esc(j.status)}">${esc(j.status)}</span>${j.taskDeleted ? '<span class="stag" data-s="nota">Tarea eliminada</span>' : ''}<span class="hours">${j.draft ? '— horas' : hoursLabel(j.hours)}</span><span class="entry-actions"><button class="ibtn" data-edit="${j.id}" title="Editar registro" aria-label="Editar registro">✎</button></span></div>`;
    const attrs = `class="entry${j.draft ? ' pending' : ''}${open ? ' open' : ''}" data-sl data-entry="${j.id}" data-s="${esc(j.status)}" style="--i:${Math.min(i, 12)};--p:${pvar(j.proj)}"`;
    if (j.draft) {
      return `<article ${attrs}>${top}<h3>${esc(j.activity)}</h3>
        <div class="draft"><span class="dot"></span>Completa los detalles de esta tarea</div>
        <p class="hint">Las horas no se calculan solas: las registras tú al documentar. Mientras tanto no suman a tus indicadores.</p>
        <button class="fill" data-edit="${j.id}">Completar detalles</button></article>`;
    }
    const fields = [['Objetivo', j.objective], ['Desarrollo', j.development], ['Resultado', j.result], ['Observaciones', j.observations]].filter(([, v]) => v);
    const links = (j.links || []).length ? `<div class="entry-links">${j.links.map((l) => `<a class="elink" href="${esc(l.url)}" target="_blank" rel="noopener noreferrer">↗ ${esc(l.label)}</a>`).join('')}</div>` : '';
    return `<article ${attrs}>${top}<h3>${esc(j.activity)}</h3>
      ${j.result ? `<p class="entry-result"><span>Resultado</span>${esc(j.result)}</p>` : ''}
      <div class="entry-body"><div><dl>${fields.map(([k, v]) => `<div><dt>${k}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl>${links}${j.updatedLabel ? `<p class="updated">Última actualización: ${esc(j.updatedLabel)}</p>` : ''}</div></div>
      <button class="entry-more" data-toggle-entry="${j.id}" aria-expanded="${open}">${open ? 'Ocultar detalle' : 'Ver detalle'}</button></article>`;
  }

  function renderJournal() {
    const rows = journal.filter(entryMatches).sort((a, b) => b.date.localeCompare(a.date));
    $('#jcount').textContent = `${rows.length} ${rows.length === 1 ? 'registro' : 'registros'}`;
    $('#journalList').innerHTML = rows.length
      ? rows.map(entryCard).join('')
      : `<div class="empty"><h3>${journal.length ? 'No hay resultados' : 'Todavía no hay actividades'}</h3><p>${journal.length ? 'Prueba otra búsqueda o cambia los filtros.' : 'Completa el formulario para comenzar a construir tu historial de trabajo.'}</p></div>`;
    refreshSL();
  }

  function renderHistory() {
    $('#histList').innerHTML = history.map((h, i) => {
      const you = h.who === 'B';
      return `<li class="hist-item" style="--i:${Math.min(i, 14)}"><time class="hist-time">${esc(h.t)}</time><div class="hist-mark"><span>${GLYPH[h.type]}</span></div>
        <p class="hist-text"><b>${you ? 'Tú' : PEOPLE[h.who]}</b> ${(you ? VERB_YOU : VERB)[h.type]} <i>${esc(h.text)}</i>${h.detail ? `<small>${esc(h.detail)}</small>` : ''}</p></li>`;
    }).join('');
  }

  function renderAll() {
    refreshProjectOptions();
    renderChips();
    renderBoard();
    renderCalendar();
    renderJournal();
    renderHistory();
    renderStats();
  }

  /* ---------- Acciones sobre tareas ---------- */
  function pushHistory(who, type, text, detail) {
    history.unshift({ t: 'Ahora', who, type, text, detail });
  }

  function ensureProject(name) {
    if (!PROJ[name]) PROJ[name] = `p${(Object.keys(PROJ).length % 6) + 1}`;
  }

  // Un borrador por tarea, solo si el responsable es la dueña. Idempotente: si ya existe un registro vinculado no se crea otro.
  function ensureDraft(t) {
    if (t.who !== 'B') return 'none';
    if (journal.some((j) => j.taskId === t.id)) return 'existed';
    journal.unshift({ id: `j${Date.now()}${Math.floor(Math.random() * 1000)}`, taskId: t.id, date: '2026-10-21', proj: t.proj, activity: t.title, objective: t.description || '', hours: 0, status: 'Completada', draft: true });
    return 'created';
  }

  const DRAFT_DETAIL = { none: 'No genera borrador porque la tarea no es tuya', existed: 'Tu registro de bitácora ya existía; no se duplicó', created: 'Borrador creado en tu bitácora' };
  const DRAFT_TOAST = { none: 'Completada · no genera borrador en tu bitácora (no es tuya)', existed: 'Completada · su registro de bitácora ya existía, no se duplica', created: 'Completada · creé un borrador en tu Bitácora para que lo documentes' };

  function moveTask(id, col) {
    const t = tasks.find((x) => x.id === id);
    if (!t || t.col === col) return;
    const from = COLS.find((c) => c.id === t.col).name;
    const to = COLS.find((c) => c.id === col).name;
    t.col = col;
    lastMoved = id;
    if (col === 'done') {
      const result = ensureDraft(t);
      pushHistory('B', 'completed', `«${t.title}»`, DRAFT_DETAIL[result]);
      toast(DRAFT_TOAST[result]);
    } else {
      pushHistory('B', 'moved', `«${t.title}»`, `${from} → ${to}`);
      toast(`Movida a «${to}»`);
    }
    renderAll();
    lastMoved = null;
    sparks($(`.card[data-id="${id}"]`));
  }

  /* ---------- Paneles laterales (tarea y actividad) ---------- */
  const scrim = $('#scrim');
  const drawer = $('#drawer');
  const entryDrawer = $('#entryDrawer');
  const taskForm = $('#taskForm');
  const entryForm = $('#entryForm');
  let drawerTask = null;
  let entryTarget = null;
  const reg = { links: [], files: [] };

  function showPanel(panel) {
    panel.classList.add('open');
    panel.setAttribute('aria-hidden', 'false');
    scrim.classList.add('show');
  }

  const profileDrawer = $('#profileDrawer');

  function closePanels() {
    [drawer, entryDrawer, profileDrawer].forEach((p) => { p.classList.remove('open'); p.setAttribute('aria-hidden', 'true'); });
    scrim.classList.remove('show');
    drawerTask = null;
    entryTarget = null;
    unmountBadge();
    resetProfilePanel();
    scheduleIdle(syncInlineBadge, 150);
  }

  /* ---------- Perfil y carné (Lanyard de React Bits) ---------- */
  const PROFILE_KEY = 'bitacora.mock.profile';
  const PROFILE = { name: 'Jose Frangel Padilla Camacho', role: 'Becario', program: 'Ingeniería de Sistemas', term: '10.º semestre', school: 'Institución Universitaria Antonio José Camacho', group: 'AthenIA', photo: undefined };
  try { Object.assign(PROFILE, JSON.parse(localStorage.getItem(PROFILE_KEY) || '{}')); } catch { /* sin almacenamiento: la maqueta no recuerda el perfil */ }
  if (!PROFILE.photoCustom) PROFILE.photo = undefined;
  const persistProfile = () => {
    try { const { photo, ...rest } = PROFILE; localStorage.setItem(PROFILE_KEY, JSON.stringify(PROFILE.photoCustom ? PROFILE : rest)); } catch { /* la maqueta solo recuerda el perfil si el navegador lo permite */ }
  };

  const CROP_VIEW = 220;
  const DEFAULT_CROP = { x: 90, y: 20, s: 960 };
  const profileView = $('#profileView');
  const profileForm = $('#profileForm');
  const cropCanvas = $('#cropCanvas');
  const journalStage = $('#journalBadgeStage');
  const wideEnough = matchMedia('(min-width: 1101px)');
  const crop = { img: null, base: 1, scale: 1, ox: 0, oy: 0, changed: false, removed: false };
  let badgeCleanup = null;
  let badgeScript = null;
  let drawerSeq = 0;
  let inlineCleanup = null;
  let inlineSeq = 0;
  let logoImg;

  const siblingUrl = (file) => document.querySelector('script[src*="direccion-visual.js"]').src.replace('direccion-visual.js', file);
  const loadImage = (src) => new Promise((resolve) => { const img = new Image(); img.onload = () => resolve(img); img.onerror = () => resolve(null); img.src = src; });
  const canvasOf = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d')]; };
  const cssVar = (name, fallback) => getComputedStyle(app).getPropertyValue(name).trim() || fallback;
  const joinDot = (...parts) => parts.filter(Boolean).join(' · ');
  const hasGroupLogo = () => /athen/i.test(PROFILE.group);

  function nameLines(name) {
    const w = name.trim().split(/\s+/);
    const k = Math.ceil(w.length / 2);
    return w.length > 1 ? [w.slice(0, k).join(' '), w.slice(k).join(' ')] : [w[0] || '', ''];
  }

  function initialsOf(name) {
    const w = name.trim().split(/\s+/);
    const k = Math.ceil(w.length / 2);
    return (w.length > 1 ? w[0][0] + w[k][0] : (w[0] || '?').slice(0, 2)).toUpperCase();
  }

  /* Mejora de imagen: máscara de enfoque (detalle fino) y un poco de claridad local (detalle ancho). No inventa información: evita perderla al reducir y al acercar. */
  function enhanceCanvas(c) {
    const w = c.width; const h = c.height; const x = c.getContext('2d');
    const base = x.getImageData(0, 0, w, h);
    const blurred = (r) => { const [bc, bx] = canvasOf(w, h); bx.filter = `blur(${r}px)`; bx.drawImage(c, 0, 0); return bx.getImageData(0, 0, w, h).data; };
    const fine = blurred(1.6 * (w / 1024)); const wide = blurred(14 * (w / 1024)); const d = base.data; const edge = Math.round(24 * (w / 1024));
    for (let py = edge; py < h - edge; py += 1) {
      for (let px = edge; px < w - edge; px += 1) {
        const i = (py * w + px) * 4;
        for (let k = 0; k < 3; k += 1) { const v = d[i + k]; const detail = (v - fine[i + k]) * 0.35 + (v - wide[i + k]) * 0.08; const nv = v + (detail > 18 ? 18 : detail < -18 ? -18 : detail); d[i + k] = nv < 0 ? 0 : nv > 255 ? 255 : nv; }
      }
    }
    x.putImageData(base, 0, 0);
  }

  /* La foto se guarda como cuadrado de 1024 px, JPEG, máx. 400 KB. */
  function cropToDataUrl(img, t, size = 1024, enhance = true) {
    const [c, x] = canvasOf(size, size);
    const k = size / CROP_VIEW;
    x.imageSmoothingEnabled = true; x.imageSmoothingQuality = 'high';
    x.fillStyle = '#ffffff';
    x.fillRect(0, 0, size, size);
    x.drawImage(img, t.ox * k, t.oy * k, img.width * t.scale * k, img.height * t.scale * k);
    if (enhance) enhanceCanvas(c);
    for (const q of [0.92, 0.86, 0.8, 0.72, 0.62]) {
      const url = c.toDataURL('image/jpeg', q);
      if (url.length * 0.75 <= 400 * 1024) return url;
    }
    return c.toDataURL('image/jpeg', 0.5);
  }

  /* Sin foto guardada, la maqueta usa «carnet.png» (si existe) con un encuadre fijo. */
  async function ensurePhoto() {
    if (PROFILE.photo !== undefined) return;
    const img = await loadImage(siblingUrl('carnet.png'));
    if (!img) { PROFILE.photo = null; return; }
    const k = CROP_VIEW / DEFAULT_CROP.s;
    PROFILE.photo = cropToDataUrl(img, { scale: k, ox: -DEFAULT_CROP.x * k, oy: -DEFAULT_CROP.y * k });
  }

  /* El logotipo es una máscara de una sola tinta (azul oscuro opaco, blanco transparente) que toma el color del tema. */
  async function logoTinted(color, w) {
    if (logoImg === undefined) logoImg = await loadImage(siblingUrl('athenia-mark.png'));
    if (!logoImg) return null;
    const [c, x] = canvasOf(w, Math.round((w * logoImg.height) / logoImg.width));
    x.drawImage(logoImg, 0, 0, c.width, c.height);
    x.globalCompositeOperation = 'source-in';
    x.fillStyle = color;
    x.fillRect(0, 0, c.width, c.height);
    return c;
  }

  function loadBadgeScript() {
    if (window.mountBadge) return Promise.resolve(true);
    if (!badgeScript) {
      badgeScript = new Promise((resolve) => {
        const s = document.createElement('script');
        s.src = siblingUrl('badge.js');
        s.onload = () => resolve(true);
        s.onerror = () => resolve(false);
        document.head.append(s);
      });
    }
    return badgeScript;
  }

  const hasWebGL = () => {
    try { const c = document.createElement('canvas'); return Boolean(c.getContext('webgl2') || c.getContext('webgl')); } catch { return false; }
  };

  /* ---------- Diseños del carné ----------
     Las caras se dibujan en un canvas de 1024 × 1440. Los colores de fondo y de texto salen del estilo activo; el azul y la tipografía de cada diseño son propios.
     Cada diseño es una función `draw(env, front, back, strap)` registrada en DESIGNS. */
  const DESIGN_ORDER = ['olimpo', 'circuito', 'poster', 'suizo', 'clasico'];
  const SERIF = '"Fraunces", "Instrument Serif", Georgia, serif';
  const SANS = '"Space Grotesk", Inter, sans-serif';
  const DESIGNS = {};

  /* Generador pseudoaleatorio con semilla (para patrones repetibles). */
  const seeded = (seed) => { let r = seed; return () => { r = (r * 16807) % 2147483647; return r / 2147483647; }; };

  /* Placa de circuito: trazas ortogonales con giros a 45° y nodos. */
  function pcb(c, W, H, color, seed, count = 34) {
    const rnd = seeded(seed); const G = 48;
    c.strokeStyle = color; c.fillStyle = color; c.lineWidth = 3; c.lineJoin = 'round'; c.lineCap = 'round';
    for (let i = 0; i < count; i += 1) {
      let x = Math.round((rnd() * W) / G) * G; let y = Math.round((rnd() * H) / G) * G;
      c.beginPath(); c.moveTo(x, y);
      const steps = 2 + Math.floor(rnd() * 3);
      for (let k = 0; k < steps; k += 1) {
        const dir = Math.floor(rnd() * 4); const len = (1 + Math.floor(rnd() * 3)) * G;
        if (dir === 0) x += len; else if (dir === 1) x -= len; else if (dir === 2) y += len; else y -= len;
        c.lineTo(x, y);
      }
      c.stroke(); c.beginPath(); c.arc(x, y, 8, 0, Math.PI * 2); c.stroke(); c.beginPath(); c.arc(x, y, 2.5, 0, Math.PI * 2); c.fill();
    }
  }

  function barcode(c, x, y, w, h, color, seed) {
    const rnd = seeded(seed); let cx = x; c.fillStyle = color;
    while (cx < x + w) { const bw = 3 + Math.floor(rnd() * 7); if (cx + bw > x + w) break; c.fillRect(cx, y, bw, h); cx += bw + 3 + Math.floor(rnd() * 6); }
  }

  /* Estrella de cuatro puntas (la del logotipo). */
  function star(c, x, y, R, r, color) {
    c.fillStyle = color; c.beginPath();
    for (let i = 0; i < 8; i += 1) { const ang = (i * Math.PI) / 4 - Math.PI / 2; const rad = i % 2 ? r : R; c.lineTo(x + Math.cos(ang) * rad, y + Math.sin(ang) * rad); }
    c.closePath(); c.fill();
  }

  /* Greca (fris de llave griega) de borde a borde. */
  function meander(c, color, x0, x1, y) {
    c.strokeStyle = color; c.lineWidth = 4; c.lineJoin = 'miter'; c.lineCap = 'butt';
    c.beginPath(); c.moveTo(x0, y + 24); c.lineTo(x1, y + 24); c.stroke();
    for (let x = x0; x + 36 <= x1; x += 48) {
      c.beginPath(); c.moveTo(x, y + 24); c.lineTo(x, y); c.lineTo(x + 36, y); c.lineTo(x + 36, y + 18); c.lineTo(x + 14, y + 18); c.lineTo(x + 14, y + 8); c.lineTo(x + 26, y + 8); c.stroke();
    }
  }

  /* Rellena el recorte `rr` con la foto recortada en cubierta (cover) con un desplazamiento vertical. */
  function drawCover(c, img, x, y, w, h, bias = 0.12) {
    const k = Math.max(w / img.width, h / img.height);
    const sw = w / k; const sh = h / k;
    c.drawImage(img, (img.width - sw) / 2, (img.height - sh) * bias, sw, sh, x, y, w, h);
  }

  /* ===== 1 · Olimpo: editor de código. Letra de programación, sintaxis resaltada, retrato achaflanado y trazas de circuito ===== */
  DESIGNS.olimpo = {
    label: 'Olimpo', note: 'Editor de código: letra de programación, sintaxis resaltada y retrato en cuadrado redondeado', finish: 'glossy',
    async draw(e, f, b, s) {
      const { W, H, M, CX, mono, ink, muted, brand, onBrand, bg, dark, rgba, photo, group, fit, wordmark, deep } = e;
      const CODE = '"JetBrains Mono", ui-monospace, Consolas, monospace';
      const str = dark ? '#7ee0b0' : '#17724b';
      const mk = e.logoOn ? await e.tint(brand, 150) : null;
      const put = (c, text, x, y, color) => { c.fillStyle = color; c.fillText(text, x, y); return c.measureText(text).width; };

      f.fillStyle = bg; f.fillRect(0, 0, W, H);
      const glow = f.createRadialGradient(CX, 640, 30, CX, 640, 620);
      glow.addColorStop(0, rgba(brand, dark ? 0.2 : 0.12)); glow.addColorStop(1, rgba(brand, 0));
      f.fillStyle = glow; f.fillRect(0, 0, W, H);
      f.fillStyle = brand; f.fillRect(0, H - 20, W, 20);

      /* barra de ventana con la pestaña del archivo */
      f.fillStyle = rgba(ink, 0.07); f.beginPath(); f.roundRect(M, 148, W - M * 2, 62, 18); f.fill();
      [brand, rgba(brand, 0.55), rgba(brand, 0.28)].forEach((c, i) => { f.fillStyle = c; f.beginPath(); f.arc(M + 36 + i * 34, 179, 10, 0, Math.PI * 2); f.fill(); });
      f.font = `500 24px ${CODE}`; f.textAlign = 'right'; put(f, 'athenia.ts', W - M - 26, 188, muted); f.textAlign = 'left';

      /* logotipo + AthenIA▌ en letra de programación, centrado */
      const size = 92; f.font = `800 ${size}px ${CODE}`;
      const word = group || 'AthenIA'; const ww = f.measureText(word).width; const cur = 38;
      const lw = mk ? mk.width + 26 : 0; const total = lw + ww + 12 + cur; const x0 = Math.round((W - total) / 2);
      if (mk) f.drawImage(mk, x0, 244);
      wordmark(f, x0 + lw, 330, size, ink, brand, CODE, 800, true);
      f.fillStyle = brand; f.fillRect(x0 + lw + ww + 12, 330 - size * 0.74, cur, size * 0.78);
      f.font = `500 26px ${CODE}`; f.textAlign = 'center'; put(f, '// grupo de investigación en IA', CX, 392, muted);

      /* retrato en un cuadrado redondeado con un contorno fino (sin líneas de circuito) */
      const PS = 400; const PX = (W - PS) / 2; const PY = 440;
      f.strokeStyle = rgba(brand, 0.85); f.lineWidth = 3; f.beginPath(); f.roundRect(PX - 14, PY - 14, PS + 28, PS + 28, 70); f.stroke();
      f.save(); f.beginPath(); f.roundRect(PX, PY, PS, PS, 56); f.clip();
      if (photo) f.drawImage(photo, PX, PY, PS, PS);
      else { f.fillStyle = brand; f.fillRect(PX, PY, PS, PS); f.fillStyle = onBrand; f.font = `800 170px ${CODE}`; f.textAlign = 'center'; f.textBaseline = 'middle'; f.fillText(e.initials, CX, PY + PS / 2 + 20); }
      f.restore(); f.textAlign = 'center'; f.textBaseline = 'alphabetic';

      /* nombre */
      const [l1, l2] = e.lines;
      f.fillStyle = ink; fit(f, l1, 800, 80, W - M * 2, 30, CODE); f.fillText(l1, CX, 938);
      if (l2) { f.fillStyle = brand; fit(f, l2, 800, 80, W - M * 2, 30, CODE); f.fillText(l2, CX, 1024); }

      /* etiqueta como elemento JSX: <Becario de="AthenIA" /> */
      f.font = `600 32px ${CODE}`;
      const segs = [['<', muted], [PROFILE.role.replace(/\s+/g, ''), brand], group ? [' de', ink] : null, group ? ['=', muted] : null, group ? [`"${group}"`, str] : null, [' />', muted]].filter(Boolean);
      const sw = segs.reduce((a, [t]) => a + f.measureText(t).width, 0); const pw = sw + 80; const px0 = CX - pw / 2;
      f.strokeStyle = brand; f.lineWidth = 3; f.beginPath(); f.roundRect(px0, 1058, pw, 72, 36); f.stroke();
      f.textAlign = 'left'; let tx = px0 + 40; segs.forEach(([t, c]) => { tx += put(f, t, tx, 1104, c); });

      /* panel de código: asignaciones con la sintaxis resaltada y la institución como comentario */
      f.fillStyle = rgba(ink, 0.06); f.strokeStyle = rgba(brand, 0.35); f.lineWidth = 2; f.beginPath(); f.roundRect(M, 1170, W - M * 2, 214, 20); f.fill(); f.stroke();
      const lines = [['programa', PROFILE.program], ['semestre', PROFILE.term]].filter(([, v]) => v);
      f.font = `500 32px ${CODE}`; let ly = 1232;
      lines.forEach(([k, v], i) => {
        f.font = `500 22px ${CODE}`; f.textAlign = 'right'; put(f, String(i + 1), M + 62, ly, rgba(muted, 0.7)); f.textAlign = 'left';
        f.font = `500 32px ${CODE}`; let x = M + 94;
        x += put(f, 'const ', x, ly, brand); x += put(f, `${k}`, x, ly, ink); x += put(f, ' = ', x, ly, muted); fit(f, `"${v}";`, 500, 32, W - M - 24 - x, 22, CODE); put(f, `"${v}";`, x, ly, str); ly += 56;
      });
      if (e.school) { f.font = `500 22px ${CODE}`; f.textAlign = 'right'; put(f, String(lines.length + 1), M + 62, ly, rgba(muted, 0.7)); f.textAlign = 'left'; fit(f, `// ${e.school}`, 500, 26, W - M * 2 - 118, 18, CODE); put(f, `// ${e.school}`, M + 94, ly, muted); }

      /* ----- reverso: esqueleto de código, logotipo y export ----- */
      if (e.markBack) {
        b.fillStyle = deep; b.fillRect(0, 0, W, H);
        const g2 = b.createRadialGradient(CX, 600, 40, CX, 600, 760); g2.addColorStop(0, 'rgba(70,130,255,.28)'); g2.addColorStop(1, 'rgba(70,130,255,0)');
        b.fillStyle = g2; b.fillRect(0, 0, W, H);
        const rnd = seeded(41); b.fillStyle = 'rgba(143,186,255,.12)';
        for (let i = 0; i < 26; i += 1) { let x = M + Math.floor(rnd() * 3) * 40; const y = 120 + i * 46; for (let k = 0; k < 2 + Math.floor(rnd() * 3); k += 1) { const w = 50 + Math.floor(rnd() * 190); if (x + w > W - M) break; b.beginPath(); b.roundRect(x, y, w, 14, 7); b.fill(); x += w + 18; } }
        b.drawImage(e.markBack, (W - e.markBack.width) / 2, 330);
        b.font = `800 120px ${CODE}`; b.textAlign = 'left';
        const bw = b.measureText(word).width; const bx = (W - (bw + 12 + 50)) / 2;
        wordmark(b, bx, 900, 120, '#ffffff', '#8fbaff', CODE, 800, true); b.fillStyle = '#8fbaff'; b.fillRect(bx + bw + 12, 900 - 120 * 0.74, 50, 120 * 0.78);
        b.font = `500 28px ${CODE}`; b.textAlign = 'center'; put(b, '// grupo de investigación en', CX, 980, 'rgba(255,255,255,.75)'); put(b, '// inteligencia artificial', CX, 1024, 'rgba(255,255,255,.75)');
        b.font = `600 34px ${CODE}`; b.textAlign = 'left';
        const exp = ['export ', 'default ', word, ';']; const ew = exp.reduce((a, t) => a + b.measureText(t).width, 0); let ex = (W - ew) / 2;
        [['export ', '#8fbaff'], ['default ', '#8fbaff'], [word, '#ffffff'], [';', 'rgba(255,255,255,.6)']].forEach(([t, c]) => { ex += put(b, t, ex, 1330, c); });
        b.font = `500 24px ${CODE}`; b.textAlign = 'center'; put(b, '// UNIAJC · CALI', CX, 1392, 'rgba(255,255,255,.55)');
      } else { b.fillStyle = e.accent; b.fillRect(0, 0, W, H); b.fillStyle = '#0e0e0e'; b.textAlign = 'center'; b.font = `800 130px ${CODE}`; b.fillText('Bitácora', CX, 760); }
      s.fillStyle = e.markBack ? deep : '#0e0e0e'; s.fillRect(0, 0, 1024, 96); s.fillStyle = e.markBack ? '#8fbaff' : e.accent; s.font = `600 34px ${CODE}`; s.textBaseline = 'middle';
      s.fillText(e.markBack ? 'AthenIA.ts // UNIAJC // AthenIA.ts // UNIAJC //' : 'bitacora.ts // UNIAJC // bitacora.ts //', 18, 50);
    },
  };

  /* ===== 2 · Circuito: placa electrónica, marco de visor, datos en columnas y código de barras ===== */
  DESIGNS.circuito = {
    label: 'Circuito', note: 'Placa electrónica, visor, datos tipo terminal y código de barras', finish: 'glossy',
    async draw(e, f, b, s) {
      const { W, H, M, mono, ink, muted, brand, onBrand, bg, dark, rgba, photo, group, label, fit, wrap, wordmark, deep } = e;
      const mk = e.logoOn ? await e.tint(brand, 150) : null;
      f.fillStyle = bg; f.fillRect(0, 0, W, H); pcb(f, W, H, rgba(brand, dark ? 0.17 : 0.13), 11);
      f.fillStyle = brand; f.fillRect(0, 0, 18, H);
      f.textAlign = 'left';
      if (mk) f.drawImage(mk, M, 150);
      const tx = M + (mk ? mk.width + 28 : 0);
      wordmark(f, tx, 236, 88, ink, brand, SANS, 700, true);
      label(f, '// GRUPO DE INVESTIGACIÓN EN IA', tx, 292, muted, 22, 2);
      /* visor */
      const PS = 440; const PX = M + 14; const PY = 400;
      f.save(); f.beginPath(); f.roundRect(PX, PY, PS, PS, 10); f.clip();
      if (photo) drawCover(f, photo, PX, PY, PS, PS, 0.1); else { f.fillStyle = brand; f.fillRect(PX, PY, PS, PS); f.fillStyle = onBrand; f.font = `700 190px ${SANS}`; f.textAlign = 'center'; f.textBaseline = 'middle'; f.fillText(e.initials, PX + PS / 2, PY + PS / 2 + 10); f.textAlign = 'left'; f.textBaseline = 'alphabetic'; }
      f.restore();
      f.strokeStyle = brand; f.lineWidth = 7; f.lineCap = 'square';
      [[PX - 16, PY - 16, 1, 1], [PX + PS + 16, PY - 16, -1, 1], [PX - 16, PY + PS + 16, 1, -1], [PX + PS + 16, PY + PS + 16, -1, -1]].forEach(([x, y, dx, dy]) => { f.beginPath(); f.moveTo(x + dx * 64, y); f.lineTo(x, y); f.lineTo(x, y + dy * 64); f.stroke(); });
      /* datos */
      const RX = PX + PS + 56; const RW = W - M - RX; let ry = PY + 22;
      const row = (k, v, color = ink) => { if (!v) return; label(f, k, RX, ry, muted, 22, 2); f.fillStyle = color; fit(f, v, 600, 36, RW, 24, SANS); ry = wrap(f, v, RX, ry + 46, RW, 42) + 84; };
      row('> PROGRAMA', PROFILE.program); row('> SEMESTRE', PROFILE.term); row('> ROL', PROFILE.role);
      label(f, '> ESTADO', RX, ry, muted, 22, 2); f.fillStyle = brand; f.font = `600 36px ${SANS}`; f.fillText('ACTIVO', RX + 38, ry + 46);
      const dot = { x: RX + 13, y: ry + 34 }; f.beginPath(); f.arc(dot.x, dot.y, 9, 0, Math.PI * 2); f.fill(); ry += 84;
      /* nombre */
      const [l1, l2] = e.lines;
      f.fillStyle = ink; fit(f, l1, 700, 100, W - M * 2, 28, SANS); f.fillText(l1, M, 972);
      if (l2) { f.fillStyle = brand; fit(f, l2, 700, 100, W - M * 2, 28, SANS); f.fillText(l2, M, 1074); }
      f.font = `600 28px ${mono}`; f.letterSpacing = '3px'; const pw = f.measureText(e.pill).width + 64;
      f.fillStyle = brand; f.beginPath(); f.moveTo(M + 18, 1116); f.lineTo(M + pw, 1116); f.lineTo(M + pw, 1172); f.lineTo(M, 1172); f.lineTo(M, 1134); f.closePath(); f.fill();
      f.fillStyle = onBrand; f.textBaseline = 'middle'; f.fillText(e.pill, M + 32, 1146); f.textBaseline = 'alphabetic'; f.letterSpacing = '0px';
      if (e.school) { label(f, 'INSTITUCIÓN', M, 1236, muted, 22, 2); f.fillStyle = ink; f.font = `500 30px ${SANS}`; wrap(f, e.school, M, 1278, W - M * 2, 38); }
      barcode(f, M, 1334, W - M * 2, 52, rgba(brand, 0.85), 5);
      label(f, 'UNIAJC · CALI', M, 1416, muted, 20, 3);

      b.fillStyle = dark ? '#050d1c' : '#0a1a3a'; b.fillRect(0, 0, W, H); pcb(b, W, H, 'rgba(106,165,255,.22)', 23, 44);
      if (e.markBack) { const m2 = await e.tint('#ffffff', 420); b.drawImage(m2, (W - m2.width) / 2, 330); }
      b.textAlign = 'center'; wordmark(b, W / 2, 860, 130, '#ffffff', '#6aa5ff', SANS, 700); b.textAlign = 'center';
      label(b, '> grupo_investigacion: IA', W / 2, 960, 'rgba(255,255,255,.75)', 28, 1); label(b, '> institucion: UNIAJC · CALI', W / 2, 1010, 'rgba(255,255,255,.75)', 28, 1);
      barcode(b, M, 1250, W - M * 2, 64, 'rgba(255,255,255,.8)', 9);
      s.fillStyle = '#050d1c'; s.fillRect(0, 0, 1024, 96); s.fillStyle = '#6aa5ff'; s.font = `500 32px ${mono}`; s.letterSpacing = '4px'; s.textBaseline = 'middle'; s.fillText('ATHENIA // UNIAJC // ATHENIA // UNIAJC //', 18, 50);
      /* Animación (solo con el 3D): el punto de «ACTIVO» late con un halo, calculado en un shader (sin repintar la textura). */
      return { fx: { size: [1024, 1440], dot: [dot.x, dot.y, 9], dotColor: brand } };
    },
  };

  /* ===== 3 · Póster: bloque azul, nombre en condensada gigante y «IA» de fondo ===== */
  DESIGNS.poster = {
    label: 'Póster', note: 'Azul de marca, nombre gigante en condensada, «IA» de fondo', finish: 'glossy', cardColor: '#0b2f73',
    async draw(e, f, b, s) {
      const { W, H, M, CX, mono, photo, group, label, fit, wrap, deep } = e;
      const mk = await e.tint('#ffffff', 150);
      const g = f.createLinearGradient(0, 0, W, H); g.addColorStop(0, '#0a2a6b'); g.addColorStop(0.55, '#1553c9'); g.addColorStop(1, '#0a2a6b');
      f.fillStyle = g; f.fillRect(0, 0, W, H);
      f.fillStyle = 'rgba(255,255,255,.07)'; f.font = '1100px Anton'; f.textAlign = 'right'; f.fillText('IA', W + 40, H + 70);
      f.textAlign = 'left'; if (mk) f.drawImage(mk, M, 120);
      f.fillStyle = '#ffffff'; f.font = `500 26px ${mono}`; f.letterSpacing = '4px'; f.fillText('GRUPO DE INVESTIGACIÓN', M + 186, 176); f.fillText('EN INTELIGENCIA ARTIFICIAL', M + 186, 214); f.letterSpacing = '0px';
      f.save(); f.translate(52, H - 90); f.rotate(-Math.PI / 2); label(f, 'UNIAJC · CALI', 0, 0, 'rgba(255,255,255,.6)', 24, 6); f.restore();
      const R = 200; const cx = W - M - R; const cy = 520;
      f.strokeStyle = 'rgba(255,255,255,.35)'; f.lineWidth = 3; f.beginPath(); f.arc(cx, cy, R + 26, 0, Math.PI * 2); f.stroke();
      f.save(); f.beginPath(); f.arc(cx, cy, R, 0, Math.PI * 2); f.clip();
      if (photo) drawCover(f, photo, cx - R, cy - R, R * 2, R * 2, 0.1); else { f.fillStyle = '#ffffff'; f.fillRect(cx - R, cy - R, R * 2, R * 2); f.fillStyle = '#0b2f73'; f.font = '700 200px Anton'; f.textAlign = 'center'; f.textBaseline = 'middle'; f.fillText(e.initials, cx, cy + 10); f.textBaseline = 'alphabetic'; }
      f.restore();
      f.strokeStyle = '#ffffff'; f.lineWidth = 8; f.beginPath(); f.arc(cx, cy, R, 0, Math.PI * 2); f.stroke();
      f.textAlign = 'left'; f.fillStyle = '#ffffff';
      const words = PROFILE.name.trim().split(/\s+/); const half = Math.ceil(words.length / 2);
      const rows = [words.slice(0, half).join(' ').toUpperCase(), words.slice(half).join(' ').toUpperCase()];
      rows.forEach((t, i) => { if (!t) return; fit(f, t, 400, 150, W - M * 2, 60, 'Anton'); f.fillText(t, M, 900 + i * 150); });
      f.font = `600 30px ${mono}`; f.letterSpacing = '3px'; const pw = f.measureText(e.pill).width + 72;
      f.fillStyle = '#ffffff'; f.beginPath(); f.roundRect(M, 1160, pw, 72, 36); f.fill(); f.fillStyle = '#0b2f73'; f.textBaseline = 'middle'; f.fillText(e.pill, M + 36, 1197); f.textBaseline = 'alphabetic'; f.letterSpacing = '0px';
      f.fillStyle = '#ffffff'; fit(f, e.detail || '', 500, 38, W - M * 2, 26, SANS); f.fillText(e.detail || '', M, 1300);
      if (e.school) { f.fillStyle = 'rgba(255,255,255,.7)'; f.font = `500 24px ${mono}`; f.letterSpacing = '2px'; wrap(f, e.school.toUpperCase(), M, 1346, W - M * 2, 34); f.letterSpacing = '0px'; }

      b.fillStyle = '#f4f7ff'; b.fillRect(0, 0, W, H);
      if (e.logoOn) { const m2 = await e.tint('#0f4aa8', 560); b.drawImage(m2, (W - m2.width) / 2, 250); }
      b.textAlign = 'center'; b.fillStyle = '#0b2f73'; b.font = '300px Anton'; b.fillText('ATHENIA', W / 2, 960);
      label(b, 'GRUPO DE INVESTIGACIÓN EN IA', W / 2, 1040, '#0b2f73', 28, 4);
      b.fillStyle = '#1553c9'; b.fillRect(0, H - 90, W, 90); label(b, 'UNIAJC · CALI', W / 2, H - 36, '#ffffff', 28, 6);
      s.fillStyle = '#0a2a6b'; s.fillRect(0, 0, 1024, 96); s.fillStyle = '#ffffff'; s.font = '600 44px Anton'; s.letterSpacing = '8px'; s.textBaseline = 'middle'; s.fillText('ATHENIA  ·  UNIAJC  ·  ATHENIA  ·  UNIAJC  ·', 18, 52);
    },
  };

  /* ===== 4 · Suizo: retícula limpia, retrato contenido, filas con filetes y un solo acento ===== */
  DESIGNS.suizo = {
    label: 'Suizo', note: 'Minimalista: retícula, filetes finos y mucho aire', finish: 'matte',
    async draw(e, f, b, s) {
      const { W, H, M, CX, mono, ink, muted, brand, onBrand, bg, rgba, photo, group, label, fit, wrap, wordmark } = e;
      const INTER = '"Inter", sans-serif';
      const mk = e.logoOn ? await e.tint(brand, 96) : null;
      f.fillStyle = bg; f.fillRect(0, 0, W, H); f.textAlign = 'left';
      if (mk) f.drawImage(mk, M, 132);
      wordmark(f, M + (mk ? mk.width + 24 : 0), 196, 52, ink, brand, INTER, 700, true);
      f.textAlign = 'right'; label(f, 'GRUPO DE INVESTIGACIÓN EN IA', W - M, 190, muted, 20, 2); f.textAlign = 'left';
      f.fillStyle = rgba(ink, 0.25); f.fillRect(M, 250, W - M * 2, 2);
      /* retrato más pequeño (440 px) a la izquierda y, a su derecha, las filas de datos */
      const PS = 440; const PY = 290; const hair = rgba(ink, 0.18);
      f.save(); f.beginPath(); f.roundRect(M, PY, PS, PS, 14); f.clip();
      if (photo) f.drawImage(photo, M, PY, PS, PS); else { f.fillStyle = brand; f.fillRect(M, PY, PS, PS); f.fillStyle = onBrand; f.font = '700 200px Inter'; f.textAlign = 'center'; f.textBaseline = 'middle'; f.fillText(e.initials, M + PS / 2, PY + PS / 2 + 10); f.textAlign = 'left'; f.textBaseline = 'alphabetic'; }
      f.restore();
      const RX = M + PS + 44; const RW = W - M - RX; let ry = PY;
      const kv = (k, v) => { if (!v) return; f.fillStyle = hair; f.fillRect(RX, ry, RW, 2); label(f, k, RX, ry + 46, muted, 20, 2); f.fillStyle = ink; f.font = `500 34px ${INTER}`; ry = wrap(f, v, RX, ry + 90, RW, 42) + 36; };
      kv('PROGRAMA', PROFILE.program); kv('SEMESTRE', PROFILE.term); kv('ROL', PROFILE.role);
      f.fillStyle = hair; f.fillRect(RX, ry, RW, 2);
      const [l1, l2] = e.lines;
      f.fillStyle = ink; fit(f, l1, 700, 92, W - M * 2, 28, INTER); f.fillText(l1, M, 876);
      if (l2) { f.fillStyle = muted; fit(f, l2, 700, 92, W - M * 2, 28, INTER); f.fillText(l2, M, 970); }
      f.fillStyle = brand; f.fillRect(M, 1018, 16, 16); label(f, e.pill, M + 34, 1034, brand, 26, 3);
      let y = 1090;
      const tr = (k, v) => { if (!v) return; f.fillStyle = hair; f.fillRect(M, y, W - M * 2, 2); label(f, k, M, y + 48, muted, 20, 2); f.fillStyle = ink; f.font = `500 34px ${INTER}`; f.fillText(v, M, y + 100); y += 134; };
      tr('INSTITUCIÓN', e.school); tr('GRUPO', group ? `${group} · grupo de investigación en IA` : '');
      f.fillStyle = hair; f.fillRect(M, y, W - M * 2, 2);

      b.fillStyle = bg; b.fillRect(0, 0, W, H);
      if (e.logoOn) { const m2 = await e.tint(brand, 380); b.drawImage(m2, (W - m2.width) / 2, 420); }
      b.textAlign = 'center'; wordmark(b, CX, 900, 96, ink, brand, INTER, 700); b.textAlign = 'center';
      label(b, 'GRUPO DE INVESTIGACIÓN EN IA', CX, 960, muted, 24, 3); b.fillStyle = hair; b.fillRect(M, 1300, W - M * 2, 2); label(b, 'UNIAJC · CALI', CX, 1356, muted, 24, 4);
      s.fillStyle = ink; s.fillRect(0, 0, 1024, 96); s.fillStyle = bg; s.font = `500 32px ${mono}`; s.letterSpacing = '6px'; s.textBaseline = 'middle'; s.fillText('ATHENIA  ·  UNIAJC  ·  ATHENIA  ·  UNIAJC  ·', 18, 50);
    },
  };

  /* ===== 5 · Clásico: la primera versión del carné (sigue el color y la letra del estilo activo), con AthenIA en el reverso ===== */
  DESIGNS.clasico = {
    label: 'Clásico', note: 'La primera versión: sigue el color y la letra del estilo activo; AthenIA atrás', finish: 'glossy',
    async draw(e, f, b, s) {
      const { W, H, M, CX, mono, body, ink, muted, accent, onAccent, bg, line, photo, group, label, fit, wrap } = e;
      f.fillStyle = bg; f.fillRect(0, 0, W, H); f.fillStyle = accent; f.fillRect(0, H - 20, W, 20); f.textAlign = 'left';
      label(f, group ? group.toUpperCase() : 'BITÁCORA', M, 286);
      const PS = 400; const PY = 330;
      f.save(); f.beginPath(); f.roundRect(M, PY, PS, PS, 48); f.clip();
      if (photo) f.drawImage(photo, M, PY, PS, PS);
      else { f.fillStyle = accent; f.fillRect(M, PY, PS, PS); f.fillStyle = onAccent; f.font = `700 170px ${body}`; f.textAlign = 'center'; f.textBaseline = 'middle'; f.fillText(e.initials, M + PS / 2, PY + PS / 2 + 8); f.textBaseline = 'alphabetic'; }
      f.restore(); f.textAlign = 'left';
      const RX = M + PS + 48; const RW = W - M - RX; let ry = PY + 34;
      const row = (k, v, color = ink) => { if (!v) return; label(f, k, RX, ry, muted, 24, 2); f.fillStyle = color; f.font = `500 38px ${body}`; ry = wrap(f, v, RX, ry + 48, RW, 46) + 60; };
      row('ROL', group ? `${PROFILE.role} de ${group}` : PROFILE.role, accent); row('PROGRAMA', PROFILE.program); row('SEMESTRE', PROFILE.term);
      const [l1, l2] = e.lines;
      f.fillStyle = ink; fit(f, l1, 700, 100, W - M * 2, 28, body); f.fillText(l1, M, 884);
      if (l2) { fit(f, l2, 700, 100, W - M * 2, 28, body); f.fillText(l2, M, 988); }
      f.fillStyle = line; f.globalAlpha = 0.5; f.fillRect(M, 1046, W - M * 2, 2); f.globalAlpha = 1;
      if (e.school) { label(f, 'INSTITUCIÓN', M, 1110, muted, 26, 3); f.fillStyle = ink; f.font = `500 38px ${body}`; wrap(f, e.school, M, 1160, W - M * 2, 48); }
      if (group) { label(f, 'GRUPO', M, 1284, muted, 26, 3); f.fillStyle = ink; f.font = `500 38px ${body}`; f.fillText(`${group} · grupo de investigación en IA`, M, 1334); }

      /* reverso: color de acento con el logotipo y el nombre de AthenIA */
      b.fillStyle = accent; b.fillRect(0, 0, W, H);
      if (e.logoOn) { const m2 = await e.tint(onAccent, 440); b.drawImage(m2, (W - m2.width) / 2, 330); }
      b.fillStyle = onAccent; b.textAlign = 'center'; fit(b, group || 'AthenIA', 700, 150, W - M * 2, 60, body); b.fillText(group || 'AthenIA', CX, 900);
      label(b, 'GRUPO DE INVESTIGACIÓN EN IA', CX, 972, onAccent, 30, 3); label(b, 'UNIAJC · CALI', CX, 1340, onAccent, 28, 6);
      s.fillStyle = '#0e0e0e'; s.fillRect(0, 0, 1024, 96); s.fillStyle = accent; s.font = `500 34px ${mono}`; s.letterSpacing = '6px'; s.textBaseline = 'middle'; s.fillText('ATHENIA  ·  UNIAJC  ·  ATHENIA  ·  UNIAJC  ·', 18, 50);
    },
  };

  async function drawFaces(design, scale) {
    const spec = DESIGNS[design] || DESIGNS.olimpo;
    const mono = cssVar('--font-mono', 'monospace');
    const bg = cssVar('--surface', '#16181c');
    const ink = cssVar('--ink', '#f2f2f0');
    const muted = cssVar('--muted', '#9a9a94');
    const accent = cssVar('--accent', '#f5a623');
    const dark = app.dataset.mode === 'dark';
    const logoOn = hasGroupLogo();
    const brand = logoOn ? (dark ? '#6aa5ff' : '#0f4aa8') : accent;
    const onBrand = logoOn ? (dark ? '#071533' : '#ffffff') : '#0e0e0e';
    const lum = (hex) => { const n = parseInt(String(hex).slice(1), 16); const c = [n >> 16, (n >> 8) & 255, n & 255].map((v) => { const x = v / 255; return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4; }); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };
    const onAccent = /^#[0-9a-f]{6}$/i.test(accent) && lum(accent) < 0.179 ? '#ffffff' : '#0e0e0e';
    const rgba = (hex, a) => { const n = parseInt(String(hex).slice(1), 16); return /^#[0-9a-f]{6}$/i.test(hex) ? `rgba(${n >> 16}, ${(n >> 8) & 255}, ${n & 255}, ${a})` : 'transparent'; };
    await Promise.all([`700 96px ${SERIF}`, `italic 500 96px ${SERIF}`, `500 40px ${SERIF}`, `500 30px ${mono}`, `700 90px ${SANS}`, '700 90px Inter', '400 90px Anton', '800 90px "JetBrains Mono"'].map((f) => document.fonts.load(f).catch(() => null)));
    await ensurePhoto();
    const photo = PROFILE.photo ? await loadImage(PROFILE.photo) : null;

    const W = 1024; const H = 1440; const M = 84; const CX = W / 2;
    const group = PROFILE.group.trim();
    const label = (c, text, x, y, color = muted, size = 30, spacing = 3) => { c.fillStyle = color; c.font = `500 ${size}px ${mono}`; c.letterSpacing = `${spacing}px`; c.fillText(text, x, y); c.letterSpacing = '0px'; };
    const fit = (c, text, weight, size, maxW, min = 28, family = SERIF, style = '') => { let sz = size; do { c.font = `${style} ${weight} ${sz}px ${family}`.trim(); if (c.measureText(text).width <= maxW) break; sz -= 2; } while (sz > min); };
    const wrap = (c, text, x, y, maxW, lineH) => {
      let row = ''; let yy = y;
      text.split(' ').forEach((w) => { const test = row ? `${row} ${w}` : w; if (c.measureText(test).width > maxW && row) { c.fillText(row, x, yy); row = w; yy += lineH; } else row = test; });
      c.fillText(row, x, yy);
      return yy;
    };
    /* Nombre del grupo con «IA» resaltado. `left`: x es el borde izquierdo; si no, el centro. */
    const wordmark = (c, x, y, size, base, accentColor, family = SERIF, weight = 700, left = false) => {
      const word = group || 'AthenIA';
      const cut = /ia$/i.test(word) ? word.length - 2 : word.length;
      c.font = `${weight} ${size}px ${family}`;
      const a1 = word.slice(0, cut); const a2 = word.slice(cut);
      const wa = c.measureText(a1).width; const wb = c.measureText(a2).width;
      const x0 = left ? x : x - (wa + wb) / 2;
      c.textAlign = 'left'; c.fillStyle = base; c.fillText(a1, x0, y); c.fillStyle = accentColor; c.fillText(a2, x0 + wa, y);
      return wa + wb;
    };
    const tint = async (color, w) => logoTinted(color, w);
    const env = {
      W, H, M, CX, mono, bg, ink, muted, accent, dark, brand, onBrand, deep: '#0b2f73', rgba, photo, group, logoOn, label, fit, wrap, wordmark, tint,
      lines: nameLines(PROFILE.name), initials: initialsOf(PROFILE.name), body: cssVar('--font-body', 'Inter, sans-serif'), onAccent,
      pill: (group ? `${PROFILE.role} de ${group}` : PROFILE.role).toUpperCase(),
      detail: joinDot(PROFILE.program, PROFILE.term), school: PROFILE.school,
      markFront: logoOn ? await tint(brand, 190) : null, markBack: logoOn ? await tint('#ffffff', 520) : null,
    };
    const faceCanvas = () => { const [c, x] = canvasOf(W * scale, H * scale); x.scale(scale, scale); return [c, x]; };
    const [front, f] = faceCanvas(); const [back, b] = faceCanvas(); const [strap, s] = canvasOf(1024, 96);
    const out = await spec.draw(env, f, b, s);
    const blobUrl = (cv, type, q) => new Promise((res) => cv.toBlob((bl) => res(URL.createObjectURL(bl)), type, q));
    const [fu, bu, su] = await Promise.all([blobUrl(front, 'image/jpeg', 0.95), blobUrl(back, 'image/jpeg', 0.95), blobUrl(strap, 'image/png')]);
    return { front: fu, back: bu, strap: su, bg: spec.cardColor || bg, finish: spec.finish || 'glossy', fx: out && out.fx };
  }

  /* Caché de caras: entrar a la Bitácora o abrir «Mi perfil» no vuelve a dibujar ni a codificar nada. */
  const faceCache = new Map();
  let profileVersion = 0;
  function invalidateFaces() {
    profileVersion += 1;
    const old = [...faceCache.values()];
    faceCache.clear();
    old.forEach((p) => p.then((f) => ['front', 'back', 'strap'].forEach((k) => URL.revokeObjectURL(f[k]))).catch(() => {}));
  }
  function badgeFaces(design = PROFILE.design || 'olimpo', scale = 2) {
    const key = `${design}|${scale}|${app.dataset.theme}|${app.dataset.mode}|${profileVersion}`;
    if (!faceCache.has(key)) faceCache.set(key, drawFaces(design, scale));
    return faceCache.get(key);
  }

  /* Con `hit`, el lienzo no recibe clics (la cinta pasa por encima de la barra superior sin taparla) y solo la zona de `hit`, debajo de la barra, le reenvía el puntero. */
  function forwardPointer(stage, hit, alive) {
    let tries = 0;
    const wire = () => {
      const canvas = stage.querySelector('canvas');
      if (!canvas) { if (alive() && tries++ < 120) requestAnimationFrame(wire); return; }
      canvas.style.pointerEvents = 'none';
      hit.hidden = false;
      const fwd = (e) => { canvas.dispatchEvent(new PointerEvent(e.type, e)); hit.style.cursor = canvas.style.cursor; };
      ['pointerdown', 'pointermove', 'pointerup', 'pointercancel'].forEach((t) => { hit['on' + t] = fwd; });
    };
    wire();
  }

  async function renderBadge(stage, hint, alive, hit = null) {
    stage.replaceChildren();
    if (hit) hit.hidden = true;
    const faces = await badgeFaces();
    if (!alive()) return null;
    const loaded = !reduceMotion && hasWebGL() && await loadBadgeScript();
    if (!alive()) return null;
    if (loaded && window.mountBadge) {
      stage.dataset.mode = '3d';
      if (hint) hint.hidden = false;
      const cleanup = window.mountBadge(stage, { frontImage: faces.front, backImage: faces.back, strapImage: faces.strap, cardColor: faces.bg, finish: faces.finish, fx: reduceMotion ? undefined : faces.fx, metal: 'silver', size: 0.66, anchor: hit ? 'right' : 'center', strapLength: 0.5, strapWidth: hit ? 0.5 : 0.7, breeze: 0.3 });
      if (hit) forwardPointer(stage, hit, alive);
      return cleanup;
    }
    stage.dataset.mode = 'flat';
    if (hint) hint.hidden = true;
    const img = document.createElement('img');
    img.className = 'badge-flat';
    img.alt = '';
    img.src = faces.front;
    stage.append(img);
    return null;
  }

  function unmountBadge() {
    drawerSeq += 1;
    if (badgeCleanup) { badgeCleanup(); badgeCleanup = null; }
    $('#badgeStage').replaceChildren();
  }

  async function mountDrawerBadge() {
    unmountBadge();
    const seq = drawerSeq;
    const cleanup = await renderBadge($('#badgeStage'), $('#badgeHint'), () => seq === drawerSeq && profileDrawer.classList.contains('open') && !profileView.hidden);
    if (!cleanup) return;
    if (seq === drawerSeq) badgeCleanup = cleanup; else cleanup();
  }

  let inlineKey = '';
  let inlinePending = '';

  function unmountInline() {
    inlineSeq += 1;
    inlineKey = '';
    inlinePending = '';
    if (inlineCleanup) { inlineCleanup(); inlineCleanup = null; }
    journalStage.replaceChildren();
  }

  /* Trabajo pesado fuera del camino de las animaciones: se espera a que el navegador esté libre. */
  const scheduleIdle = (fn, ms = 0) => setTimeout(() => (window.requestIdleCallback ? requestIdleCallback(fn, { timeout: 2000 }) : fn()), ms);

  /* El carné cuelga a un lado de la Bitácora (escritorio ancho). Se monta una sola vez por combinación de estilo, tema, diseño y perfil
     y se deja montado al cambiar de vista (el componente se detiene solo cuando no es visible), así volver a la Bitácora no cuesta nada. */
  async function syncInlineBadge() {
    const wanted = wideEnough.matches && !profileDrawer.classList.contains('open') && gallery.hidden;
    if (!wanted) { unmountInline(); return; }
    const key = `${app.dataset.theme}|${app.dataset.mode}|${PROFILE.design || 'olimpo'}|${profileVersion}`;
    if (key === inlineKey && (inlineCleanup || inlinePending === key)) return;
    unmountInline();
    inlineKey = key;
    inlinePending = key;
    const seq = inlineSeq;
    const cleanup = await renderBadge(journalStage, null, () => seq === inlineSeq, $('#journalBadgeHit'));
    if (seq !== inlineSeq) { if (cleanup) cleanup(); return; }
    inlinePending = '';
    inlineCleanup = cleanup;
  }

  function applyProfileText() {
    const rows = [['Nombre', PROFILE.name], ['Rol', PROFILE.role], ['Programa', joinDot(PROFILE.program, PROFILE.term)], ['Institución', PROFILE.school], ['Grupo', PROFILE.group]];
    $('#profileFacts').innerHTML = rows.filter(([, v]) => v).map(([k, v]) => `<div><dt>${k}</dt><dd>${esc(v)}</dd></div>`).join('');
    const label = `Carné de ${PROFILE.name}, ${PROFILE.role.toLowerCase()}${PROFILE.program ? ` de ${PROFILE.program}` : ''}`;
    $('#badgeStage').setAttribute('aria-label', label);
    journalStage.setAttribute('aria-label', label);
    const who = $('.who-text');
    if (who) who.textContent = RO() ? 'Solo lectura' : `Tú · ${PROFILE.role}`;
  }

  const profileMessage = (text) => { $('#profileMsg').textContent = text; };

  function resetProfilePanel() {
    profileForm.hidden = true;
    profileView.hidden = false;
    $('#profileTitle').textContent = RO() ? 'Perfil' : 'Mi perfil';
  }

  function showProfileView() {
    resetProfilePanel();
    applyProfileText();
    mountDrawerBadge();
  }

  /* ----- Editar perfil y subir la foto (encuadre con arrastre y zoom) ----- */
  function drawCrop() {
    const x = cropCanvas.getContext('2d');
    const k = cropCanvas.width / CROP_VIEW;
    x.clearRect(0, 0, cropCanvas.width, cropCanvas.height);
    x.fillStyle = cssVar('--bg', '#111');
    x.fillRect(0, 0, cropCanvas.width, cropCanvas.height);
    if (crop.img) {
      x.drawImage(crop.img, crop.ox * k, crop.oy * k, crop.img.width * crop.scale * k, crop.img.height * crop.scale * k);
    } else {
      x.fillStyle = cssVar('--accent', '#f5a623');
      x.fillRect(0, 0, cropCanvas.width, cropCanvas.height);
      x.fillStyle = '#0e0e0e'; x.font = `700 ${Math.round(cropCanvas.width * 0.4)}px ${cssVar('--font-body', 'sans-serif')}`; x.textAlign = 'center'; x.textBaseline = 'middle';
      x.fillText(initialsOf(profileForm.elements.name.value || PROFILE.name), cropCanvas.width / 2, cropCanvas.height / 2 + 6);
    }
  }

  function clampCrop() {
    if (!crop.img) return;
    crop.ox = Math.min(0, Math.max(CROP_VIEW - crop.img.width * crop.scale, crop.ox));
    crop.oy = Math.min(0, Math.max(CROP_VIEW - crop.img.height * crop.scale, crop.oy));
  }

  function setCropImage(img, bias) {
    crop.img = img;
    crop.base = CROP_VIEW / Math.min(img.width, img.height);
    crop.scale = crop.base;
    crop.ox = (CROP_VIEW - img.width * crop.scale) / 2;
    crop.oy = -(img.height * crop.scale - CROP_VIEW) * bias;
    $('#cropZoom').value = '1';
    clampCrop();
    drawCrop();
  }

  function zoomCrop(z) {
    if (!crop.img) return;
    const next = crop.base * z;
    const r = next / crop.scale;
    const c = CROP_VIEW / 2;
    crop.ox = c - (c - crop.ox) * r;
    crop.oy = c - (c - crop.oy) * r;
    crop.scale = next;
    crop.changed = true;
    clampCrop();
    drawCrop();
  }

  async function showProfileEdit() {
    unmountBadge();
    profileView.hidden = true;
    profileForm.hidden = false;
    $('#profileTitle').textContent = 'Editar perfil';
    const f = profileForm.elements;
    f.name.value = PROFILE.name; f.role.value = PROFILE.role; f.program.value = PROFILE.program; f.term.value = PROFILE.term; f.school.value = PROFILE.school; f.group.value = PROFILE.group;
    profileMessage('');
    crop.removed = false; crop.changed = false; crop.img = null;
    $('#enhanceToggle').checked = PROFILE.enhance !== false;
    drawCrop();
    await ensurePhoto();
    const img = PROFILE.photo ? await loadImage(PROFILE.photo) : null;
    if (img) setCropImage(img, 0); else drawCrop();
    f.name.focus();
  }

  async function openProfile({ edit = false } = {}) {
    unmountInline();
    showPanel(profileDrawer);
    if (edit) await showProfileEdit(); else showProfileView();
  }

  function saveProfile() {
    const f = profileForm.elements;
    const v = (n) => f[n].value.trim();
    if (v('name').length < 2) { profileMessage('Escribe tu nombre (2 a 60 caracteres).'); f.name.focus(); return; }
    if (v('role').length < 2) { profileMessage('Escribe tu rol (2 a 60 caracteres).'); f.role.focus(); return; }
    PROFILE.enhance = $('#enhanceToggle').checked;
    Object.assign(PROFILE, { name: v('name'), role: v('role'), program: v('program'), term: v('term'), school: v('school'), group: v('group') });
    if (crop.removed) { PROFILE.photo = null; PROFILE.photoCustom = true; }
    else if (crop.changed && crop.img) { PROFILE.photo = cropToDataUrl(crop.img, crop, 1024, $('#enhanceToggle').checked); PROFILE.photoCustom = true; }
    invalidateFaces();
    invalidateFaces();
    persistProfile();
    toast('Perfil actualizado.');
    showProfileView();
  }

  let cropDrag = null;
  cropCanvas.addEventListener('pointerdown', (e) => {
    if (!crop.img) return;
    cropDrag = { x: e.clientX, y: e.clientY, ox: crop.ox, oy: crop.oy };
    cropCanvas.setPointerCapture(e.pointerId);
  });
  cropCanvas.addEventListener('pointermove', (e) => {
    if (!cropDrag) return;
    const f = CROP_VIEW / cropCanvas.getBoundingClientRect().width;
    crop.ox = cropDrag.ox + (e.clientX - cropDrag.x) * f;
    crop.oy = cropDrag.oy + (e.clientY - cropDrag.y) * f;
    crop.changed = true;
    clampCrop();
    drawCrop();
  });
  ['pointerup', 'pointercancel'].forEach((t) => cropCanvas.addEventListener(t, () => { cropDrag = null; }));
  cropCanvas.addEventListener('keydown', (e) => {
    const move = { ArrowLeft: [8, 0], ArrowRight: [-8, 0], ArrowUp: [0, 8], ArrowDown: [0, -8] }[e.key];
    if (!move || !crop.img) return;
    e.preventDefault();
    crop.ox += move[0]; crop.oy += move[1];
    crop.changed = true;
    clampCrop();
    drawCrop();
  });
  $('#cropZoom').addEventListener('input', (e) => zoomCrop(Number(e.target.value)));
  profileForm.elements.name.addEventListener('input', () => { if (!crop.img) drawCrop(); });
  $('#photoFile').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) { profileMessage('Se omitió un archivo que no es una imagen.'); return; }
    if (file.size > 5 * 1024 * 1024) { profileMessage(`${file.name} supera el límite de 5 MB.`); return; }
    const url = URL.createObjectURL(file);
    const img = await loadImage(url);
    URL.revokeObjectURL(url);
    if (!img) { profileMessage('No se pudo leer esa imagen. Prueba con un JPG o un PNG.'); return; }
    profileMessage('');
    crop.removed = false;
    crop.changed = true;
    setCropImage(img, img.height > img.width ? 0.2 : 0.5);
  });
  $('#photoRemove').addEventListener('click', () => { crop.img = null; crop.removed = true; crop.changed = true; drawCrop(); });
  profileForm.addEventListener('submit', (e) => { e.preventDefault(); saveProfile(); });
  $('#profileCancel').addEventListener('click', showProfileView);
  $('#profileEditBtn').addEventListener('click', showProfileEdit);
  /* Geometría del carné de la Bitácora: el lienzo ocupa desde el borde izquierdo de la aplicación (así el carné no se corta al arrastrarlo),
     la cinta cuelga del hueco que la barra abre entre «Invitar» y «Apariencia» (anclaje derecho = 73 % del ancho) y solo la zona bajo la barra recibe el puntero. */
  function syncNavHeight() {
    app.style.setProperty('--nav-h', `${$('.nav').offsetHeight}px`);
    const wide = state.view === 'journal' && wideEnough.matches;
    app.classList.toggle('journal-wide', wide);
    if (!wide) return;
    const a = $('#journalBadge').getBoundingClientRect();
    const r = app.getBoundingClientRect();
    const inv = $('#invite').getBoundingClientRect();
    const ap = $('.appearance').getBoundingClientRect();
    const gapX = (inv.right + ap.left) / 2;
    app.style.setProperty('--stage-left', `${(r.left - a.left).toFixed(1)}px`);
    app.style.setProperty('--stage-w', `${((gapX - r.left) / 0.73).toFixed(1)}px`);
    app.style.setProperty('--hit-left', `${(gapX - a.left - 190).toFixed(1)}px`);
  }
  syncNavHeight();
  addEventListener('resize', syncNavHeight);
  $('#logoutBtn').addEventListener('click', () => { closePanels(); showGate('login'); });
  wideEnough.addEventListener('change', syncInlineBadge);
  scheduleIdle(syncInlineBadge, 2500);   // en frío: el carné queda listo antes de entrar a la Bitácora
  window.__badgeFaces = badgeFaces;

  /* ---------- Pantallas de entrada (sin sesión) ----------
     Inicio de sesión, invitación y los mensajes de enlace inválido, acceso retirado y sin conexión. No muestran ningún dato de la dueña. */
  const GOOGLE_G = '<svg viewBox="0 0 48 48" aria-hidden="true"><path fill="#FFC107" d="M43.6 20.1H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 8 3l5.7-5.7C34 6.1 29.3 4 24 4 13 4 4 13 4 24s9 20 20 20 20-9 20-20c0-1.3-.1-2.3-.4-3.9z"/><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 8 3l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.1H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.3-.4-3.9z"/></svg>';
  const status = (glyph, title, text, button) => `<span class="gate-icon" aria-hidden="true">${glyph}</span><h1 id="gateTitle" class="gate-status">${title}</h1><p class="gate-lead">${text}</p>${button || ''}`;
  const GATES = {
    login: { tab: 'Entrar', html: () => `<p class="eyebrow">Seguimiento académico</p><h1 id="gateTitle">Bitácora<em><span>.</span></em></h1><p class="gate-lead">Tablero, calendario y bitácora de actividades en un solo lugar.</p><button class="gbtn" id="gateGoogle" type="button">${GOOGLE_G}<span>Entrar con Google</span></button><p class="gate-note">Para entrar necesitas una invitación.</p><p class="gate-small">¿Te enviaron un enlace? Ábrelo directamente: no necesitas contraseña ni cuenta de Google.</p>` },
    invite: { tab: 'Invitación', html: () => `<p class="eyebrow">Invitación</p><h1 id="gateTitle">Te invitaron<em><span>.</span></em></h1><p class="gate-lead">Inicia sesión con Google para aceptar. Este enlace es de un solo uso.</p><button class="gbtn" id="gateInviteGoogle" type="button">${GOOGLE_G}<span>Continuar con Google</span></button><p class="gate-small">Usamos tu cuenta solo para identificarte; nunca vemos tu contraseña.</p>` },
    inviteName: { tab: 'Invitación · nombre y rol', html: () => `<p class="eyebrow">Casi listo</p><h1 id="gateTitle" class="gate-status">Hola, Laura<em><span>.</span></em></h1><p class="gate-lead">Entraste como <b>laura.gomez@gmail.com</b>. Confirma cómo quieres aparecer en el tablero.</p><form class="fill-form gate-form" id="gateForm" novalidate><label><span class="lbl">Tu nombre</span><input name="name" type="text" maxlength="60" value="Laura Gómez" autocomplete="name"></label><label><span class="lbl">Tu rol</span><input name="role" type="text" maxlength="60" placeholder="Ej. Directora" autocomplete="off"></label><p class="form-error" id="gateMsg" role="alert"></p><button class="fill primary wide" type="submit">Aceptar y entrar</button></form><p class="gate-small">Verás el tablero, el calendario y el historial, y podrás crear y editar tareas. La Bitácora y las horas son privadas.</p><button class="gate-link" data-gate-go="invite" type="button">Usar otra cuenta</button>` },
    noAccess: { tab: 'Cuenta sin invitación', html: () => status('!', 'Tu cuenta no tiene acceso', 'Iniciaste sesión como <b>carlos.ruiz@gmail.com</b>, pero esa cuenta no tiene una invitación. Pide un enlace de invitación a quien administra la bitácora.', '<button class="gbtn" data-gate-go="login" type="button"><span>Entrar con otra cuenta</span></button>') },
    invalidInvite: { tab: 'Invitación inválida', html: () => status('✕', 'Esta invitación ya no es válida', 'Pudo usarse antes o caducar: duran 7 días. Pide a quien te invitó un enlace nuevo.', '<button class="gbtn" data-gate-go="login" type="button"><span>Ir al inicio</span></button>') },
    invalidLink: { tab: 'Enlace inactivo', html: () => status('✕', 'Este enlace ya no está activo', 'La persona que lo compartió lo desactivó o lo reemplazó por uno nuevo.', '<button class="gbtn" data-gate-go="login" type="button"><span>Ir al inicio</span></button>') },
    revoked: { tab: 'Acceso retirado', html: () => status('!', 'Tu acceso ya no está activo.', 'Se retiró tu acceso a la Bitácora. Si crees que es un error, escribe a quien te invitó.', '<button class="gbtn" data-gate-go="login" type="button"><span>Ir al inicio</span></button>') },
    offline: { tab: 'Sin conexión', html: () => status('↻', 'No se pudo abrir tu bitácora', 'Revisa tu conexión a internet e inténtalo de nuevo.', '<button class="gbtn" id="gateRetry" type="button"><span>Reintentar</span></button>') },
  };
  function RO() { return app.dataset.readonly === 'true'; }
  function setReadonly(on) {
    app.dataset.readonly = String(on);
    $('#roBtn').textContent = on ? 'Salir de solo lectura' : 'Ver como solo lectura';
    $('#profileBtn').textContent = on ? 'U' : 'B';
    $('#profileBtn').setAttribute('aria-label', on ? 'Ver el perfil de quien registra' : 'Ver mi perfil');
    closePanels();
    applyProfileText();
    toast(on ? 'Vista de solo lectura: se ve todo, no se puede editar nada.' : 'Volviste a tu vista.');
  }
  $('#roBtn').addEventListener('click', () => setReadonly(!RO()));
  const gate = $('#gate');
  const gateTabs = $('#gateTabs');
  gateTabs.innerHTML = Object.entries(GATES).filter(([id]) => id !== 'inviteName').map(([id, g]) => `<button type="button" data-gate="${id}">${g.tab}</button>`).join('');

  function showGate(name) {
    $('#gateBody').innerHTML = GATES[name].html();
    $$('#gateTabs button').forEach((b) => b.classList.toggle('on', b.dataset.gate === (name === 'inviteName' ? 'invite' : name)));
    gate.hidden = false;
    const focus = $('#gateGoogle') || $('#gateForm input') || $('.gbtn', gate);
    if (focus) focus.focus({ preventScroll: true });
  }
  function hideGate() { gate.hidden = true; }

  gate.addEventListener('click', (e) => {
    const tab = e.target.closest('[data-gate]');
    if (tab) { showGate(tab.dataset.gate); return; }
    const go = e.target.closest('[data-gate-go]');
    if (go) { showGate(go.dataset.gateGo); return; }
    if (e.target.closest('#gateGoogle')) { hideGate(); toast('Entraste con Google (maqueta).'); return; }
    if (e.target.closest('#gateInviteGoogle')) { showGate('inviteName'); return; }
    if (e.target.closest('#gateRetry')) { hideGate(); toast('Conexión recuperada (maqueta).'); }
  });
  gate.addEventListener('submit', (e) => {
    e.preventDefault();
    const f = e.target.elements;
    const name = f.name.value.trim(); const role = f.role.value.trim();
    const msg = (t) => { $('#gateMsg').textContent = t; };
    if (name.length < 2) { msg('Escribe tu nombre (2 a 60 caracteres).'); f.name.focus(); return; }
    if (role.length < 2) { msg('Escribe tu rol (2 a 60 caracteres).'); f.role.focus(); return; }
    hideGate();
    toast(`Bienvenido/a, ${name}. Entraste como «${role}» (maqueta).`);
  });
  $('#gateBtn').addEventListener('click', () => showGate('login'));
  if (location.hash === '#/entrar') showGate('login');

  /* Galería para comparar los diseños del carné (frente y reverso) y elegir uno. */
  const gallery = $('#designGallery');
  const markCurrentDesign = () => $$('.design-tile').forEach((t) => t.classList.toggle('current', t.dataset.design === (PROFILE.design || 'olimpo')));
  function closeGallery() {
    gallery.hidden = true;
    syncInlineBadge();
  }
  async function openGallery() {
    unmountInline();
    gallery.hidden = false;
    const grid = $('#designGrid');
    grid.innerHTML = DESIGN_ORDER.map((id) => `<article class="design-tile" data-design="${id}"><div class="design-faces"><span class="loading">Dibujando…</span></div><h3>${DESIGNS[id].label}</h3><p>${DESIGNS[id].note}</p><button class="fill primary" type="button" data-pick="${id}">Usar este diseño</button></article>`).join('');
    markCurrentDesign();
    for (const id of DESIGN_ORDER) {
      const faces = await badgeFaces(id, 1);
      const box = grid.querySelector(`[data-design="${id}"] .design-faces`);
      if (!box) return;
      box.innerHTML = `<img src="${faces.front}" alt="Frente del diseño ${DESIGNS[id].label}"><img src="${faces.back}" alt="Reverso del diseño ${DESIGNS[id].label}">`;
    }
  }
  $('#designsBtn').addEventListener('click', openGallery);
  $('#designClose').addEventListener('click', closeGallery);
  gallery.addEventListener('click', (e) => {
    const pick = e.target.closest('[data-pick]');
    if (!pick) return;
    PROFILE.design = pick.dataset.pick;
    persistProfile();
    toast(`Diseño «${DESIGNS[PROFILE.design].label}» aplicado.`);
    closeGallery();
    if (profileDrawer.classList.contains('open') && !profileView.hidden) mountDrawerBadge();
  });
  applyProfileText();

  /* Tarea: crear y ver/editar (mismo formulario) */
  const taskMessage = (text) => { $('#taskMsg').textContent = text; };
  const subRowHtml = (s, i) => `<div class="sub-row"><input type="checkbox" aria-label="Marcar la tarea ${i + 1} como hecha"${s.done ? ' checked' : ''}><input type="text" maxlength="200" placeholder="Tarea ${i + 1}" value="${esc(s.t)}" aria-label="Tarea ${i + 1}"><button type="button" class="rm" data-rmsub aria-label="Quitar esta subtarea">×</button></div>`;

  function renderSubRows(subs = []) {
    const rows = subs.map((s) => ({ ...s }));
    while (rows.length < 3) rows.push({ t: '', done: false });
    $('#subList').innerHTML = rows.map(subRowHtml).join('');
  }

  const readSubs = () => $$('#subList .sub-row').map((r) => ({ t: $('input[type="text"]', r).value.trim(), done: $('input[type="checkbox"]', r).checked })).filter((s) => s.t);

  function renumberSubs() {
    $$('#subList .sub-row').forEach((r, i) => { $('input[type="text"]', r).placeholder = `Tarea ${i + 1}`; });
  }

  function renderTaskHistory() {
    const box = $('#taskHist');
    if (!drawerTask) { box.hidden = true; return; }
    const events = history.filter((h) => h.text.includes(`«${drawerTask.title}»`)).slice(0, 5);
    box.hidden = events.length === 0;
    $('#taskHistList').innerHTML = events.map((h) => `<li><b>${esc(h.t)}</b> · ${h.who === 'B' ? 'Tú' : PEOPLE[h.who]} ${(h.who === 'B' ? VERB_YOU : VERB)[h.type]}${h.detail ? ` — ${esc(h.detail)}` : ''}</li>`).join('');
  }

  function openDrawer(mode, id = null, status = 'todo') {
    closePanels();
    drawerTask = mode === 'edit' ? tasks.find((t) => t.id === id) || null : null;
    const f = taskForm.elements;
    taskForm.reset();
    taskMessage('');
    const del = $('#taskDelete');
    del.hidden = !drawerTask;
    del.classList.remove('confirming');
    del.textContent = 'Eliminar tarea';
    $('#drawerTitle').textContent = drawerTask ? 'Detalle de la tarea' : 'Nueva tarea';
    $('#taskSubmit').textContent = drawerTask ? 'Guardar cambios' : 'Crear tarea';
    if (drawerTask) {
      f.title.value = drawerTask.title;
      f.description.value = drawerTask.description || '';
      f.project.value = drawerTask.proj;
      f.assignee.value = drawerTask.who;
      f.due.value = drawerTask.due || '';
      f.status.value = drawerTask.col;
      taskForm.querySelector(`input[name="prio"][value="${drawerTask.prio}"]`).checked = true;
      renderSubRows(drawerTask.subs || []);
    } else {
      f.status.value = status;
      renderSubRows([]);
    }
    renderTaskHistory();
    $$('input, select, textarea', taskForm).forEach((el) => { el.disabled = RO(); });
    showPanel(drawer);
    setTimeout(() => f.title.focus(), 150);
  }

  function saveTask() {
    const f = taskForm.elements;
    const title = f.title.value.trim();
    const proj = f.project.value.trim();
    if (!title) { taskMessage('Escribe el nombre de la tarea.'); f.title.focus(); return; }
    if (!proj) { taskMessage('Elige o escribe un proyecto.'); f.project.focus(); return; }
    ensureProject(proj);
    const data = {
      title, description: f.description.value.trim(), proj, who: f.assignee.value, due: f.due.value, subs: readSubs(),
      prio: Number(taskForm.querySelector('input[name="prio"]:checked').value), col: f.status.value,
    };
    if (!drawerTask) {
      const t = { id: `t${Date.now()}`, ...data };
      tasks.unshift(t); // las tareas nuevas entran arriba de su columna
      const target = COLS.find((c) => c.id === t.col).name;
      const who = t.who ? `Asignada a ${t.who === 'B' ? 'ti' : PEOPLE[t.who]}` : 'Sin responsable';
      pushHistory('B', 'added', `«${t.title}»`, `${who}${t.due ? ` · vence el ${fmtShort(t.due)}` : ''}`);
      let note = '';
      if (t.col === 'done' && ensureDraft(t) === 'created') {
        pushHistory('B', 'completed', `«${t.title}»`, DRAFT_DETAIL.created);
        note = ' · creé un borrador en tu Bitácora';
      }
      lastMoved = t.id;
      closePanels();
      renderAll();
      lastMoved = null;
      toast(`Tarea creada en «${target}»${note}`);
      sparks($(`.card[data-id="${t.id}"]`));
      return;
    }
    const t = drawerTask;
    const changed = [];
    if (t.title !== data.title) changed.push('nombre');
    if ((t.description || '') !== data.description) changed.push('descripción');
    if (t.proj !== data.proj) changed.push('proyecto');
    if (t.who !== data.who) changed.push('responsable');
    if ((t.due || '') !== data.due) changed.push('fecha límite');
    if (t.prio !== data.prio) changed.push('prioridad');
    const plain = (arr) => JSON.stringify((arr || []).map(({ t: text, done }) => ({ t: text, done })));
    if (plain(t.subs) !== plain(data.subs)) changed.push('subtareas');
    const statusChanged = t.col !== data.col;
    Object.assign(t, { title: data.title, description: data.description, proj: data.proj, who: data.who, due: data.due, prio: data.prio, subs: data.subs });
    if (t.col === 'done' && !statusChanged && changed.includes('responsable') && ensureDraft(t) === 'created') {
      pushHistory('B', 'completed', `«${t.title}»`, DRAFT_DETAIL.created);
    }
    if (changed.length) pushHistory('B', 'edited', `«${t.title}»`, `Cambió: ${changed.join(', ')}`);
    closePanels();
    if (statusChanged) { moveTask(t.id, data.col); return; }
    renderAll();
    toast(changed.length ? 'Cambios guardados.' : 'No había cambios que guardar.');
  }

  function deleteTask() {
    const btn = $('#taskDelete');
    if (!drawerTask) return;
    if (!btn.classList.contains('confirming')) {
      btn.classList.add('confirming');
      btn.textContent = 'Pulsa de nuevo para eliminar';
      return;
    }
    const t = drawerTask;
    tasks.splice(tasks.indexOf(t), 1);
    journal.forEach((j) => { if (j.taskId === t.id) { delete j.taskId; j.taskDeleted = true; } });
    pushHistory('B', 'removed', `«${t.title}»`, 'Los registros de bitácora vinculados se conservan');
    closePanels();
    renderAll();
    toast('Tarea eliminada · su registro de bitácora se conserva');
  }

  /* Actividad de la Bitácora: registrar, editar y completar un borrador (mismos campos de siempre) */
  const regMessage = (text) => { $('#regMsg').textContent = text; };

  function renderRegChips() {
    $('#regChips').innerHTML = [
      ...reg.files.map((n, i) => `<span class="rchip"><b>IMG</b> ${esc(n)}<button type="button" data-rm="file:${i}" aria-label="Quitar evidencia">×</button></span>`),
      ...reg.links.map((l, i) => `<span class="rchip">↗ ${esc(l.label)}<button type="button" data-rm="link:${i}" aria-label="Quitar evidencia">×</button></span>`),
    ].join('');
  }

  function linkFromInputs() {
    const url = $('#linkUrl').value.trim();
    const label = $('#linkLabel').value.trim();
    if (!url) {
      if (label) throw new Error('Completa la dirección web del enlace.');
      return null;
    }
    let parsed;
    try { parsed = new URL(url); } catch { throw new Error('Usa un enlace que comience con http:// o https://.'); }
    if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error('Usa un enlace que comience con http:// o https://.');
    return { label: label || parsed.hostname, url: parsed.href };
  }

  function openEntryPanel(mode, id = null) {
    closePanels();
    entryTarget = mode === 'edit' ? journal.find((j) => j.id === id) || null : null;
    const f = entryForm.elements;
    entryForm.reset();
    reg.links = [];
    reg.files = [];
    regMessage('');
    const del = $('#entryDelete');
    del.hidden = !entryTarget;
    del.classList.remove('confirming');
    del.textContent = 'Eliminar actividad';
    $('#entryBanner').hidden = !(entryTarget && entryTarget.draft);
    $('#entryTitle').textContent = !entryTarget ? 'Nuevo registro' : (entryTarget.draft ? 'Completar detalles' : 'Editar registro');
    $('#entrySubmit').textContent = entryTarget ? 'Guardar cambios' : '＋ Agregar a la bitácora';
    if (entryTarget) {
      const j = entryTarget;
      f.date.value = j.date;
      f.hours.value = j.draft ? '' : fmtH(j.hours);
      f.project.value = j.proj;
      f.activity.value = j.activity;
      f.objective.value = j.objective || '';
      f.development.value = j.development || '';
      f.result.value = j.result || '';
      f.observations.value = j.observations || '';
      const radio = entryForm.querySelector(`input[name="status"][value="${j.status}"]`);
      if (radio) radio.checked = true;
      reg.links = [...(j.links || [])];
    }
    renderRegChips();
    showPanel(entryDrawer);
    setTimeout(() => (entryTarget && entryTarget.draft ? f.hours : f.date).focus(), 150);
  }

  function saveEntryPanel() {
    const f = entryForm.elements;
    try {
      const pending = linkFromInputs();
      if (pending) { reg.links.push(pending); $('#linkLabel').value = ''; $('#linkUrl').value = ''; renderRegChips(); }
    } catch (error) { regMessage(error.message); $('#linkUrl').focus(); return; }
    const hours = parseHours(f.hours.value);
    const data = {
      date: f.date.value, proj: f.project.value.trim(), activity: f.activity.value.trim(),
      objective: f.objective.value.trim(), development: f.development.value.trim(), result: f.result.value.trim(), observations: f.observations.value.trim(),
      hours, status: entryForm.querySelector('input[name="status"]:checked').value, links: [...reg.links], updatedLabel: nowLabel(),
    };
    if (!data.date || !data.proj || !data.activity || !data.result || !validHours(hours)) { regMessage(HOURS_MSG); return; }
    ensureProject(data.proj);
    if (!entryTarget) {
      const entry = { id: `j${Date.now()}`, draft: false, ...data };
      journal.unshift(entry);
      pushHistory('B', 'added', `«${entry.activity}»`, 'Registrada en tu bitácora');
      closePanels();
      renderAll();
      toast('Actividad agregada a tu bitácora.');
      sparks($(`[data-entry="${entry.id}"]`));
      return;
    }
    const j = entryTarget;
    const wasDraft = j.draft;
    Object.assign(j, data, { draft: false });
    pushHistory('B', 'edited', `«${j.activity}»`, wasDraft ? `Documentó ${fmtH(hours)} h en la bitácora` : 'Editó el registro');
    closePanels();
    renderAll();
    toast(wasDraft ? 'Cambios guardados · las horas suman ahora a tus indicadores' : 'Cambios guardados.');
    sparks($(`[data-entry="${j.id}"]`));
  }

  function deleteEntry() {
    const btn = $('#entryDelete');
    if (!entryTarget) return;
    if (!btn.classList.contains('confirming')) {
      btn.classList.add('confirming');
      btn.textContent = 'Pulsa de nuevo para eliminar';
      return;
    }
    const j = entryTarget;
    journal.splice(journal.indexOf(j), 1);
    pushHistory('B', 'removed', `«${j.activity}»`, 'Eliminó el registro de la bitácora');
    closePanels();
    renderAll();
    toast('Registro eliminado.');
  }

  /* ---------- Navegación y apariencia ---------- */
  function placeIndicator() {
    const active = $('.tab.active');
    const ind = $('#indicator');
    if (!active || !ind) return;
    ind.style.width = `${active.offsetWidth}px`;
    ind.style.transform = `translateX(${active.offsetLeft}px)`;
  }

  function setView(view) {
    state.view = view;
    $$('.tab').forEach((t) => t.classList.toggle('active', t.dataset.view === view));
    $$('.view').forEach((s) => s.classList.toggle('active', s.id === `view-${view}`));
    placeIndicator();
    replayEnter();
    if (view === 'board' || view === 'journal') renderStats(true);
    requestAnimationFrame(refreshSL);
    syncNavHeight();
    scheduleIdle(syncInlineBadge, 700);
  }

  const pop = $('#pop');
  const appBtn = $('#appBtn');

  function applyAppearance() {
    app.dataset.theme = state.theme;
    app.dataset.mode = state.mode;
    $$('.opt').forEach((b) => {
      const on = b.dataset.style === state.theme;
      b.classList.toggle('on', on);
      b.setAttribute('aria-pressed', String(on));
    });
    $$('.mode').forEach((b) => {
      const on = b.dataset.mode === state.mode;
      b.classList.toggle('on', on);
      b.setAttribute('aria-pressed', String(on));
    });
    $('#popNote').textContent = 'Los tres estilos tienen tema oscuro y tema claro.';
  }

  function setStyle(theme) {
    state.theme = theme;
    applyAppearance();
    replayEnter();
    renderStats(true);
    requestAnimationFrame(() => { syncNavHeight(); placeIndicator(); refreshSL(); });
    scheduleIdle(syncInlineBadge, 250);
  }

  function setMode(mode) {
    state.mode = mode;
    applyAppearance();
    scheduleIdle(syncInlineBadge, 250);
  }

  function openPop(open) {
    pop.hidden = !open;
    appBtn.setAttribute('aria-expanded', String(open));
  }

  /* ---------- Eventos ---------- */
  $$('.tab').forEach((t) => t.addEventListener('click', () => setView(t.dataset.view)));
  $('#search').addEventListener('input', (e) => { state.q = e.target.value; renderBoard(); });
  $('#invite').addEventListener('click', () => toast('Enlace de un solo uso copiado · caduca en 7 días'));
  $('#exportBtn').addEventListener('click', () => toast('En la app real se descarga bitacora-2026-10-21.json con registros, imágenes y enlaces.'));
  $('#importBtn').addEventListener('click', () => toast('En la app real aquí eliges un archivo .json para restaurar una copia.'));
  $('#newTask').addEventListener('click', () => openDrawer('create'));
  $('#newEntry').addEventListener('click', () => openEntryPanel('create'));
  $('#densBtn').addEventListener('click', (e) => {
    state.compact = !state.compact;
    e.currentTarget.classList.toggle('on', state.compact);
    e.currentTarget.setAttribute('aria-pressed', String(state.compact));
    renderBoard();
  });
  $('#jsearch').addEventListener('input', (e) => { state.jq = e.target.value; renderJournal(); });
  $('#jproj').addEventListener('change', (e) => { state.jproj = e.target.value; renderJournal(); });
  $('#jstatus').addEventListener('change', (e) => { state.jstatus = e.target.value; renderJournal(); });
  $('#jdraft').addEventListener('click', (e) => {
    state.jdraft = !state.jdraft;
    e.currentTarget.classList.toggle('on', state.jdraft);
    e.currentTarget.setAttribute('aria-pressed', String(state.jdraft));
    renderJournal();
  });

  taskForm.addEventListener('submit', (e) => { e.preventDefault(); saveTask(); });
  $('#taskCancel').addEventListener('click', closePanels);
  $('#drawerClose').addEventListener('click', closePanels);
  $('#taskDelete').addEventListener('click', deleteTask);
  $('#subAdd').addEventListener('click', () => {
    const rows = $$('#subList .sub-row');
    if (rows.length >= MAX_SUBS) { toast(`Máximo ${MAX_SUBS} subtareas.`); return; }
    $('#subList').insertAdjacentHTML('beforeend', subRowHtml({ t: '', done: false }, rows.length));
    $$('#subList .sub-row:last-child input[type="text"]')[0].focus();
  });
  $('#subList').addEventListener('click', (e) => {
    const rm = e.target.closest('[data-rmsub]');
    if (!rm) return;
    rm.closest('.sub-row').remove();
    renumberSubs();
  });

  entryForm.addEventListener('submit', (e) => { e.preventDefault(); saveEntryPanel(); });
  $('#entryCancel').addEventListener('click', closePanels);
  $('#entryClose').addEventListener('click', closePanels);
  $('#entryDelete').addEventListener('click', deleteEntry);
  scrim.addEventListener('click', closePanels);
  $('#profileBtn').addEventListener('click', () => openProfile());
  $('#profileClose').addEventListener('click', closePanels);
  $('#addLink').addEventListener('click', () => {
    try {
      const link = linkFromInputs();
      if (!link) throw new Error('Escribe la dirección web del enlace.');
      reg.links.push(link);
      $('#linkLabel').value = '';
      $('#linkUrl').value = '';
      regMessage('');
      renderRegChips();
      $('#linkLabel').focus();
    } catch (error) { regMessage(error.message); $('#linkUrl').focus(); }
  });
  $('#photoInput').addEventListener('change', (e) => {
    let message = '';
    for (const file of e.target.files) {
      if (!file.type.startsWith('image/')) { message = 'Se omitió un archivo que no es una imagen.'; continue; }
      if (file.size > 5 * 1024 * 1024) { message = `${file.name} supera el límite de 5 MB.`; continue; }
      if (reg.files.length >= 4) { message = 'Puedes adjuntar hasta 4 imágenes por registro.'; break; }
      reg.files.push(file.name);
    }
    e.target.value = '';
    regMessage(message);
    renderRegChips();
  });
  $('#regChips').addEventListener('click', (e) => {
    const rm = e.target.closest('[data-rm]');
    if (!rm) return;
    const [kind, index] = rm.dataset.rm.split(':');
    (kind === 'file' ? reg.files : reg.links).splice(Number(index), 1);
    renderRegChips();
  });

  $('#seedMany').addEventListener('click', (e) => {
    const titles = ['Clasificar contratos por entidad', 'Revisar anexos del convenio', 'Actualizar matriz de seguimiento', 'Redactar acta de la reunión', 'Verificar vigencias de pólizas', 'Preparar resumen para el comité', 'Consultar jurisprudencia reciente', 'Ordenar expedientes digitales', 'Responder observaciones del proceso', 'Validar cronograma de entregas'];
    const projects = Object.keys(PROJ);
    const people = ['D', 'S', 'B', 'B', ''];
    titles.forEach((title, i) => tasks.push({ id: `t9${i}${Date.now() % 10000}`, title, proj: projects[i % projects.length], who: people[i % people.length], due: `2026-11-${String(2 + i).padStart(2, '0')}`, prio: (i % 3) + 1, col: 'todo' }));
    e.currentTarget.disabled = true;
    e.currentTarget.textContent = '10 tareas añadidas';
    renderAll();
    toast('Añadí 10 tareas a «Por hacer» para probar columnas largas.');
  });

  $('#calPrev').addEventListener('click', () => { cal.m -= 1; if (cal.m < 0) { cal.m = 11; cal.y -= 1; } renderCalendar(); replayEnter(); });
  $('#calNext').addEventListener('click', () => { cal.m += 1; if (cal.m > 11) { cal.m = 0; cal.y += 1; } renderCalendar(); replayEnter(); });

  appBtn.addEventListener('click', () => openPop(pop.hidden));
  pop.addEventListener('click', (e) => {
    const style = e.target.closest('.opt');
    if (style) setStyle(style.dataset.style);
    const mode = e.target.closest('.mode');
    if (mode && !mode.disabled) setMode(mode.dataset.mode);
  });
  document.addEventListener('click', (e) => { if (!pop.hidden && !e.target.closest('.appearance')) openPop(false); });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { openPop(false); if (!gate.hidden) hideGate(); else if (!gallery.hidden) closeGallery(); else closePanels(); }
    const card = e.target.classList?.contains('card') ? e.target : null;
    if (card && e.key === 'Enter') openDrawer('edit', card.dataset.id);
    if (card && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
      const list = $$('[data-sl]', card.closest('.sl'));
      const next = list[list.indexOf(card) + (e.key === 'ArrowDown' ? 1 : -1)];
      if (next) { e.preventDefault(); next.focus({ preventScroll: true }); next.scrollIntoView({ block: 'nearest', behavior: reduceMotion ? 'auto' : 'smooth' }); }
    }
  });

  app.addEventListener('click', (e) => {
    const next = e.target.closest('[data-next]');
    if (next) {
      const t = tasks.find((x) => x.id === next.dataset.next);
      const target = COLS[COLS.findIndex((c) => c.id === t.col) + 1];
      if (target) moveTask(t.id, target.id);
      return;
    }
    const add = e.target.closest('[data-add]');
    if (add) { openDrawer('create', null, add.dataset.add); return; }
    const expand = e.target.closest('[data-expand]');
    if (expand) { state.expanded[expand.dataset.expand] = !state.expanded[expand.dataset.expand]; renderBoard(); return; }
    const edit = e.target.closest('[data-edit]');
    if (edit) { openEntryPanel('edit', edit.dataset.edit); return; }
    const toggle = e.target.closest('[data-toggle-entry]');
    if (toggle) {
      const id = toggle.dataset.toggleEntry;
      state.openEntry[id] = !state.openEntry[id];
      const card = toggle.closest('.entry');
      card.classList.toggle('open', state.openEntry[id]);
      toggle.setAttribute('aria-expanded', String(state.openEntry[id]));
      toggle.textContent = state.openEntry[id] ? 'Ocultar detalle' : 'Ver detalle';
      setTimeout(refreshSL, 480);
      return;
    }
    const card = e.target.closest('.card');
    if (card && !e.target.closest('button, a')) { openDrawer('edit', card.dataset.id); return; }
    const chip = e.target.closest('[data-proj]');
    if (chip) { state.proj = chip.dataset.proj; renderChips(); renderBoard(); }
  });

  // El scroll no burbujea: se escucha en captura para animar cualquier lista con scroll.
  app.addEventListener('scroll', (e) => {
    const el = e.target;
    if (!el.classList || !el.classList.contains('sl')) return;
    scheduleSL(el);
  }, true);

  const board = $('#board');
  board.addEventListener('pointermove', (e) => {
    const card = e.target.closest('.card');
    if (!card) return;
    const r = card.getBoundingClientRect();
    const x = e.clientX - r.left;
    const y = e.clientY - r.top;
    card.style.setProperty('--mx', `${x}px`);
    card.style.setProperty('--my', `${y}px`);
    card.style.setProperty('--rx', `${((y / r.height - 0.5) * -7).toFixed(2)}deg`);
    card.style.setProperty('--ry', `${((x / r.width - 0.5) * 9).toFixed(2)}deg`);
  });
  board.addEventListener('pointerout', (e) => {
    const card = e.target.closest('.card');
    if (card && !card.contains(e.relatedTarget)) { card.style.removeProperty('--rx'); card.style.removeProperty('--ry'); }
  });
  board.addEventListener('dragstart', (e) => {
    const card = e.target.closest('.card');
    if (!card) return;
    if (RO()) { e.preventDefault(); return; }
    dragId = card.dataset.id;
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', dragId);
    requestAnimationFrame(() => card.classList.add('dragging'));
  });
  board.addEventListener('dragend', () => {
    dragId = null;
    $$('.card.dragging').forEach((c) => c.classList.remove('dragging'));
    $$('.col.over').forEach((c) => c.classList.remove('over'));
  });
  board.addEventListener('dragover', (e) => {
    const col = e.target.closest('.col');
    if (!col || !dragId) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (!col.classList.contains('over')) {
      $$('.col.over').forEach((c) => c.classList.remove('over'));
      col.classList.add('over');
    }
  });
  board.addEventListener('drop', (e) => {
    const col = e.target.closest('.col');
    if (!col || !dragId) return;
    e.preventDefault();
    const id = dragId;
    dragId = null;
    $$('.col.over').forEach((c) => c.classList.remove('over'));
    moveTask(id, col.dataset.col);
  });

  window.addEventListener('resize', placeIndicator);
  window.addEventListener('resize', refreshSL);
  mobileMq.addEventListener('change', renderBoard);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { placeIndicator(); refreshSL(); });
  if ('ResizeObserver' in window) {
    // Las pestañas cambian de ancho cuando termina de cargar la tipografía: se recalcula la píldora.
    const observer = new ResizeObserver(placeIndicator);
    observer.observe($('#tabs'));
    $$('.tab').forEach((t) => observer.observe(t));
  }

  $('#today').textContent = cap(new Intl.DateTimeFormat('es-CO', { weekday: 'long', day: 'numeric', month: 'long' }).format(TODAY));
  renderAll();
  applyAppearance();
  replayEnter();
  renderStats(true);
  requestAnimationFrame(() => { placeIndicator(); refreshSL(); });

  // Expuesto solo para pruebas desde la consola del navegador.
  window.__mock = { moveTask, setStyle, setMode, setView, openDrawer, saveTask, openEntryPanel, saveEntryPanel, tasks, journal, history, state, refreshSL };
})();
