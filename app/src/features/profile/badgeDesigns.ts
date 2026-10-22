// Los cinco diseños del carné, portados de la maqueta aprobada. Cada diseño dibuja en tres lienzos:
//   frente y reverso (1024 × 1440 lógicos; el factor de escala lo aplica `badgeFaces`) y la cinta (1024 × 96).
// Los colores de fondo y de texto salen del estilo activo; el azul de marca y la tipografía de cada diseño son propios.

export type Ctx2D = CanvasRenderingContext2D;
export type BadgeDesignId = 'olimpo' | 'circuito' | 'poster' | 'suizo' | 'clasico';
export type Finish = 'glossy' | 'matte' | 'holographic';
export type Canvas = HTMLCanvasElement;

/** Halo que late en el sombreador del carné 3D (Circuito): nada se repinta por cuadro. */
export type Fx = { size: [number, number]; dot: [number, number, number]; dotColor: string };
export type DrawResult = { fx?: Fx } | void;

export type DrawEnv = {
  W: number;
  H: number;
  M: number;
  CX: number;
  mono: string;
  body: string;
  bg: string;
  ink: string;
  muted: string;
  accent: string;
  onAccent: string;
  line: string;
  dark: boolean;
  brand: string;
  onBrand: string;
  deep: string;
  rgba: (hex: string, alpha: number) => string;
  photo: CanvasImageSource | null;
  group: string;
  logoOn: boolean;
  name: string;
  role: string;
  program: string;
  term: string;
  school: string;
  lines: [string, string];
  initials: string;
  pill: string;
  detail: string;
  markBack: Canvas | null;
  label: (c: Ctx2D, text: string, x: number, y: number, color?: string, size?: number, spacing?: number) => void;
  fit: (c: Ctx2D, text: string, weight: number, size: number, maxWidth: number, min?: number, family?: string, style?: string) => void;
  wrap: (c: Ctx2D, text: string, x: number, y: number, maxWidth: number, lineHeight: number) => number;
  wordmark: (c: Ctx2D, x: number, y: number, size: number, base: string, accent: string, family?: string, weight?: number, left?: boolean) => number;
  tint: (color: string, width: number) => Promise<Canvas | null>;
};

export type Design = {
  label: string;
  note: string;
  finish: Finish;
  cardColor?: string;
  draw: (env: DrawEnv, front: Ctx2D, back: Ctx2D, strap: Ctx2D) => Promise<DrawResult>;
};

export const DESIGN_ORDER: BadgeDesignId[] = ['olimpo', 'circuito', 'poster', 'suizo', 'clasico'];
export const DEFAULT_DESIGN: BadgeDesignId = 'olimpo';
export const isDesignId = (value: unknown): value is BadgeDesignId => typeof value === 'string' && (DESIGN_ORDER as string[]).includes(value);

const SANS = '"Space Grotesk", Inter, sans-serif';

/** Generador pseudoaleatorio con semilla (para patrones repetibles). */
const seeded = (seed: number) => {
  let r = seed;
  return () => {
    r = (r * 16807) % 2147483647;
    return r / 2147483647;
  };
};

/** Placa de circuito: trazas ortogonales con giros a 45° y nodos. */
function pcb(c: Ctx2D, W: number, H: number, color: string, seed: number, count = 34) {
  const rnd = seeded(seed);
  const G = 48;
  c.strokeStyle = color;
  c.fillStyle = color;
  c.lineWidth = 3;
  c.lineJoin = 'round';
  c.lineCap = 'round';
  for (let i = 0; i < count; i += 1) {
    let x = Math.round((rnd() * W) / G) * G;
    let y = Math.round((rnd() * H) / G) * G;
    c.beginPath();
    c.moveTo(x, y);
    const steps = 2 + Math.floor(rnd() * 3);
    for (let k = 0; k < steps; k += 1) {
      const dir = Math.floor(rnd() * 4);
      const len = (1 + Math.floor(rnd() * 3)) * G;
      if (dir === 0) x += len;
      else if (dir === 1) x -= len;
      else if (dir === 2) y += len;
      else y -= len;
      c.lineTo(x, y);
    }
    c.stroke();
    c.beginPath();
    c.arc(x, y, 8, 0, Math.PI * 2);
    c.stroke();
    c.beginPath();
    c.arc(x, y, 2.5, 0, Math.PI * 2);
    c.fill();
  }
}

function barcode(c: Ctx2D, x: number, y: number, w: number, h: number, color: string, seed: number) {
  const rnd = seeded(seed);
  let cx = x;
  c.fillStyle = color;
  while (cx < x + w) {
    const bw = 3 + Math.floor(rnd() * 7);
    if (cx + bw > x + w) break;
    c.fillRect(cx, y, bw, h);
    cx += bw + 3 + Math.floor(rnd() * 6);
  }
}

/** Rellena el recorte con la foto en cubierta (cover) con un desplazamiento vertical. */
function drawCover(c: Ctx2D, img: CanvasImageSource & { width: number; height: number }, x: number, y: number, w: number, h: number, bias = 0.12) {
  const k = Math.max(w / img.width, h / img.height);
  const sw = w / k;
  const sh = h / k;
  c.drawImage(img, (img.width - sw) / 2, (img.height - sh) * bias, sw, sh, x, y, w, h);
}

type Sized = CanvasImageSource & { width: number; height: number };
const sized = (photo: CanvasImageSource): Sized => photo as Sized;

export const DESIGNS: Record<BadgeDesignId, Design> = {
  /* ===== 1 · Olimpo: editor de código. Letra de programación, sintaxis resaltada y retrato en un cuadrado redondeado ===== */
  olimpo: {
    label: 'Olimpo',
    note: 'Editor de código: letra de programación, sintaxis resaltada y retrato en cuadrado redondeado',
    finish: 'glossy',
    async draw(e, f, b, s) {
      const { W, H, M, CX, ink, muted, brand, onBrand, bg, dark, rgba, photo, group, fit, wordmark, deep } = e;
      const CODE = '"JetBrains Mono", ui-monospace, Consolas, monospace';
      const str = dark ? '#7ee0b0' : '#17724b';
      const mk = e.logoOn ? await e.tint(brand, 150) : null;
      const put = (c: Ctx2D, text: string, x: number, y: number, color: string) => {
        c.fillStyle = color;
        c.fillText(text, x, y);
        return c.measureText(text).width;
      };

      f.fillStyle = bg;
      f.fillRect(0, 0, W, H);
      const glow = f.createRadialGradient(CX, 640, 30, CX, 640, 620);
      glow.addColorStop(0, rgba(brand, dark ? 0.2 : 0.12));
      glow.addColorStop(1, rgba(brand, 0));
      f.fillStyle = glow;
      f.fillRect(0, 0, W, H);
      f.fillStyle = brand;
      f.fillRect(0, H - 20, W, 20);

      /* barra de ventana con la pestaña del archivo */
      f.fillStyle = rgba(ink, 0.07);
      f.beginPath();
      f.roundRect(M, 148, W - M * 2, 62, 18);
      f.fill();
      [brand, rgba(brand, 0.55), rgba(brand, 0.28)].forEach((color, i) => {
        f.fillStyle = color;
        f.beginPath();
        f.arc(M + 36 + i * 34, 179, 10, 0, Math.PI * 2);
        f.fill();
      });
      f.font = `500 24px ${CODE}`;
      f.textAlign = 'right';
      put(f, 'athenia.ts', W - M - 26, 188, muted);
      f.textAlign = 'left';

      /* logotipo + AthenIA▌ en letra de programación, centrado */
      const size = 92;
      f.font = `800 ${size}px ${CODE}`;
      const word = group || 'AthenIA';
      const ww = f.measureText(word).width;
      const cur = 38;
      const lw = mk ? mk.width + 26 : 0;
      const total = lw + ww + 12 + cur;
      const x0 = Math.round((W - total) / 2);
      if (mk) f.drawImage(mk, x0, 244);
      wordmark(f, x0 + lw, 330, size, ink, brand, CODE, 800, true);
      f.fillStyle = brand;
      f.fillRect(x0 + lw + ww + 12, 330 - size * 0.74, cur, size * 0.78);
      f.font = `500 26px ${CODE}`;
      f.textAlign = 'center';
      put(f, '// grupo de investigación en IA', CX, 392, muted);

      /* retrato en un cuadrado redondeado con un contorno fino (sin líneas de circuito) */
      const PS = 400;
      const PX = (W - PS) / 2;
      const PY = 440;
      f.strokeStyle = rgba(brand, 0.85);
      f.lineWidth = 3;
      f.beginPath();
      f.roundRect(PX - 14, PY - 14, PS + 28, PS + 28, 70);
      f.stroke();
      f.save();
      f.beginPath();
      f.roundRect(PX, PY, PS, PS, 56);
      f.clip();
      if (photo) f.drawImage(photo, PX, PY, PS, PS);
      else {
        f.fillStyle = brand;
        f.fillRect(PX, PY, PS, PS);
        f.fillStyle = onBrand;
        f.font = `800 170px ${CODE}`;
        f.textAlign = 'center';
        f.textBaseline = 'middle';
        f.fillText(e.initials, CX, PY + PS / 2 + 20);
      }
      f.restore();
      f.textAlign = 'center';
      f.textBaseline = 'alphabetic';

      /* nombre */
      const [l1, l2] = e.lines;
      f.fillStyle = ink;
      fit(f, l1, 800, 80, W - M * 2, 30, CODE);
      f.fillText(l1, CX, 938);
      if (l2) {
        f.fillStyle = brand;
        fit(f, l2, 800, 80, W - M * 2, 30, CODE);
        f.fillText(l2, CX, 1024);
      }

      /* etiqueta como elemento JSX: <Becario de="AthenIA" /> */
      f.font = `600 32px ${CODE}`;
      const segs = [
        ['<', muted],
        [e.role.replace(/\s+/g, ''), brand],
        group ? [' de', ink] : null,
        group ? ['=', muted] : null,
        group ? [`"${group}"`, str] : null,
        [' />', muted],
      ].filter((seg): seg is [string, string] => seg !== null);
      const sw = segs.reduce((a, [t]) => a + f.measureText(t).width, 0);
      const pw = sw + 80;
      const px0 = CX - pw / 2;
      f.strokeStyle = brand;
      f.lineWidth = 3;
      f.beginPath();
      f.roundRect(px0, 1058, pw, 72, 36);
      f.stroke();
      f.textAlign = 'left';
      let tx = px0 + 40;
      segs.forEach(([t, color]) => {
        tx += put(f, t, tx, 1104, color);
      });

      /* panel de código: asignaciones con la sintaxis resaltada y la institución como comentario */
      f.fillStyle = rgba(ink, 0.06);
      f.strokeStyle = rgba(brand, 0.35);
      f.lineWidth = 2;
      f.beginPath();
      f.roundRect(M, 1170, W - M * 2, 214, 20);
      f.fill();
      f.stroke();
      const lines = ([['programa', e.program], ['semestre', e.term]] as Array<[string, string]>).filter(([, v]) => v);
      f.font = `500 32px ${CODE}`;
      let ly = 1232;
      lines.forEach(([k, v], i) => {
        f.font = `500 22px ${CODE}`;
        f.textAlign = 'right';
        put(f, String(i + 1), M + 62, ly, rgba(muted, 0.7));
        f.textAlign = 'left';
        f.font = `500 32px ${CODE}`;
        let x = M + 94;
        x += put(f, 'const ', x, ly, brand);
        x += put(f, `${k}`, x, ly, ink);
        x += put(f, ' = ', x, ly, muted);
        fit(f, `"${v}";`, 500, 32, W - M - 24 - x, 22, CODE);
        put(f, `"${v}";`, x, ly, str);
        ly += 56;
      });
      if (e.school) {
        f.font = `500 22px ${CODE}`;
        f.textAlign = 'right';
        put(f, String(lines.length + 1), M + 62, ly, rgba(muted, 0.7));
        f.textAlign = 'left';
        fit(f, `// ${e.school}`, 500, 26, W - M * 2 - 118, 18, CODE);
        put(f, `// ${e.school}`, M + 94, ly, muted);
      }

      /* ----- reverso: esqueleto de código, logotipo y export ----- */
      if (e.markBack) {
        b.fillStyle = deep;
        b.fillRect(0, 0, W, H);
        const g2 = b.createRadialGradient(CX, 600, 40, CX, 600, 760);
        g2.addColorStop(0, 'rgba(70,130,255,.28)');
        g2.addColorStop(1, 'rgba(70,130,255,0)');
        b.fillStyle = g2;
        b.fillRect(0, 0, W, H);
        const rnd = seeded(41);
        b.fillStyle = 'rgba(143,186,255,.12)';
        for (let i = 0; i < 26; i += 1) {
          let x = M + Math.floor(rnd() * 3) * 40;
          const y = 120 + i * 46;
          for (let k = 0; k < 2 + Math.floor(rnd() * 3); k += 1) {
            const w = 50 + Math.floor(rnd() * 190);
            if (x + w > W - M) break;
            b.beginPath();
            b.roundRect(x, y, w, 14, 7);
            b.fill();
            x += w + 18;
          }
        }
        b.drawImage(e.markBack, (W - e.markBack.width) / 2, 330);
        b.font = `800 120px ${CODE}`;
        b.textAlign = 'left';
        const bw = b.measureText(word).width;
        const bx = (W - (bw + 12 + 50)) / 2;
        wordmark(b, bx, 900, 120, '#ffffff', '#8fbaff', CODE, 800, true);
        b.fillStyle = '#8fbaff';
        b.fillRect(bx + bw + 12, 900 - 120 * 0.74, 50, 120 * 0.78);
        b.font = `500 28px ${CODE}`;
        b.textAlign = 'center';
        put(b, '// grupo de investigación en', CX, 980, 'rgba(255,255,255,.75)');
        put(b, '// inteligencia artificial', CX, 1024, 'rgba(255,255,255,.75)');
        b.font = `600 34px ${CODE}`;
        b.textAlign = 'left';
        const exp = ['export ', 'default ', word, ';'];
        const ew = exp.reduce((a, t) => a + b.measureText(t).width, 0);
        let ex = (W - ew) / 2;
        (
          [
            ['export ', '#8fbaff'],
            ['default ', '#8fbaff'],
            [word, '#ffffff'],
            [';', 'rgba(255,255,255,.6)'],
          ] as Array<[string, string]>
        ).forEach(([t, color]) => {
          ex += put(b, t, ex, 1330, color);
        });
        b.font = `500 24px ${CODE}`;
        b.textAlign = 'center';
        put(b, '// UNIAJC · CALI', CX, 1392, 'rgba(255,255,255,.55)');
      } else {
        b.fillStyle = e.accent;
        b.fillRect(0, 0, W, H);
        b.fillStyle = '#0e0e0e';
        b.textAlign = 'center';
        b.font = `800 130px ${CODE}`;
        b.fillText('Bitácora', CX, 760);
      }
      s.fillStyle = e.markBack ? deep : '#0e0e0e';
      s.fillRect(0, 0, 1024, 96);
      s.fillStyle = e.markBack ? '#8fbaff' : e.accent;
      s.font = `600 34px ${CODE}`;
      s.textBaseline = 'middle';
      s.fillText(e.markBack ? 'AthenIA.ts // UNIAJC // AthenIA.ts // UNIAJC //' : 'bitacora.ts // UNIAJC // bitacora.ts //', 18, 50);
    },
  },

  /* ===== 2 · Circuito: placa electrónica, marco de visor, datos en columnas y código de barras ===== */
  circuito: {
    label: 'Circuito',
    note: 'Placa electrónica, visor, datos tipo terminal y código de barras',
    finish: 'glossy',
    async draw(e, f, b, s) {
      const { W, H, M, mono, ink, muted, brand, onBrand, bg, dark, rgba, photo, label, fit, wrap, wordmark } = e;
      const mk = e.logoOn ? await e.tint(brand, 150) : null;
      f.fillStyle = bg;
      f.fillRect(0, 0, W, H);
      pcb(f, W, H, rgba(brand, dark ? 0.17 : 0.13), 11);
      f.fillStyle = brand;
      f.fillRect(0, 0, 18, H);
      f.textAlign = 'left';
      if (mk) f.drawImage(mk, M, 150);
      const tx = M + (mk ? mk.width + 28 : 0);
      wordmark(f, tx, 236, 88, ink, brand, SANS, 700, true);
      label(f, '// GRUPO DE INVESTIGACIÓN EN IA', tx, 292, muted, 22, 2);
      /* visor */
      const PS = 440;
      const PX = M + 14;
      const PY = 400;
      f.save();
      f.beginPath();
      f.roundRect(PX, PY, PS, PS, 10);
      f.clip();
      if (photo) drawCover(f, sized(photo), PX, PY, PS, PS, 0.1);
      else {
        f.fillStyle = brand;
        f.fillRect(PX, PY, PS, PS);
        f.fillStyle = onBrand;
        f.font = `700 190px ${SANS}`;
        f.textAlign = 'center';
        f.textBaseline = 'middle';
        f.fillText(e.initials, PX + PS / 2, PY + PS / 2 + 10);
        f.textAlign = 'left';
        f.textBaseline = 'alphabetic';
      }
      f.restore();
      f.strokeStyle = brand;
      f.lineWidth = 7;
      f.lineCap = 'square';
      (
        [
          [PX - 16, PY - 16, 1, 1],
          [PX + PS + 16, PY - 16, -1, 1],
          [PX - 16, PY + PS + 16, 1, -1],
          [PX + PS + 16, PY + PS + 16, -1, -1],
        ] as Array<[number, number, number, number]>
      ).forEach(([x, y, dx, dy]) => {
        f.beginPath();
        f.moveTo(x + dx * 64, y);
        f.lineTo(x, y);
        f.lineTo(x, y + dy * 64);
        f.stroke();
      });
      /* datos */
      const RX = PX + PS + 56;
      const RW = W - M - RX;
      let ry = PY + 22;
      const row = (k: string, v: string, color = ink) => {
        if (!v) return;
        label(f, k, RX, ry, muted, 22, 2);
        f.fillStyle = color;
        fit(f, v, 600, 36, RW, 24, SANS);
        ry = wrap(f, v, RX, ry + 46, RW, 42) + 84;
      };
      row('> PROGRAMA', e.program);
      row('> SEMESTRE', e.term);
      row('> ROL', e.role);
      label(f, '> ESTADO', RX, ry, muted, 22, 2);
      f.fillStyle = brand;
      f.font = `600 36px ${SANS}`;
      f.fillText('ACTIVO', RX + 38, ry + 46);
      const dot = { x: RX + 13, y: ry + 34 };
      f.beginPath();
      f.arc(dot.x, dot.y, 9, 0, Math.PI * 2);
      f.fill();
      /* nombre */
      const [l1, l2] = e.lines;
      f.fillStyle = ink;
      fit(f, l1, 700, 100, W - M * 2, 28, SANS);
      f.fillText(l1, M, 972);
      if (l2) {
        f.fillStyle = brand;
        fit(f, l2, 700, 100, W - M * 2, 28, SANS);
        f.fillText(l2, M, 1074);
      }
      f.font = `600 28px ${mono}`;
      f.letterSpacing = '3px';
      const pw = f.measureText(e.pill).width + 64;
      f.fillStyle = brand;
      f.beginPath();
      f.moveTo(M + 18, 1116);
      f.lineTo(M + pw, 1116);
      f.lineTo(M + pw, 1172);
      f.lineTo(M, 1172);
      f.lineTo(M, 1134);
      f.closePath();
      f.fill();
      f.fillStyle = onBrand;
      f.textBaseline = 'middle';
      f.fillText(e.pill, M + 32, 1146);
      f.textBaseline = 'alphabetic';
      f.letterSpacing = '0px';
      if (e.school) {
        label(f, 'INSTITUCIÓN', M, 1236, muted, 22, 2);
        f.fillStyle = ink;
        f.font = `500 30px ${SANS}`;
        wrap(f, e.school, M, 1278, W - M * 2, 38);
      }
      barcode(f, M, 1334, W - M * 2, 52, rgba(brand, 0.85), 5);
      label(f, 'UNIAJC · CALI', M, 1416, muted, 20, 3);

      b.fillStyle = dark ? '#050d1c' : '#0a1a3a';
      b.fillRect(0, 0, W, H);
      pcb(b, W, H, 'rgba(106,165,255,.22)', 23, 44);
      if (e.markBack) {
        const m2 = await e.tint('#ffffff', 420);
        if (m2) b.drawImage(m2, (W - m2.width) / 2, 330);
      }
      b.textAlign = 'center';
      wordmark(b, W / 2, 860, 130, '#ffffff', '#6aa5ff', SANS, 700);
      b.textAlign = 'center';
      label(b, '> grupo_investigacion: IA', W / 2, 960, 'rgba(255,255,255,.75)', 28, 1);
      label(b, '> institucion: UNIAJC · CALI', W / 2, 1010, 'rgba(255,255,255,.75)', 28, 1);
      barcode(b, M, 1250, W - M * 2, 64, 'rgba(255,255,255,.8)', 9);
      s.fillStyle = '#050d1c';
      s.fillRect(0, 0, 1024, 96);
      s.fillStyle = '#6aa5ff';
      s.font = `500 32px ${mono}`;
      s.letterSpacing = '4px';
      s.textBaseline = 'middle';
      s.fillText('ATHENIA // UNIAJC // ATHENIA // UNIAJC //', 18, 50);
      /* Animación (solo con el 3D): el punto de «ACTIVO» late con un halo, calculado en un sombreador (sin repintar la textura). */
      return { fx: { size: [1024, 1440], dot: [dot.x, dot.y, 9], dotColor: brand } };
    },
  },

  /* ===== 3 · Póster: bloque azul, nombre en condensada gigante y «IA» de fondo ===== */
  poster: {
    label: 'Póster',
    note: 'Azul de marca, nombre gigante en condensada, «IA» de fondo',
    finish: 'glossy',
    cardColor: '#0b2f73',
    async draw(e, f, b, s) {
      const { W, H, M, mono, photo, label, fit, wrap } = e;
      const mk = await e.tint('#ffffff', 150);
      const g = f.createLinearGradient(0, 0, W, H);
      g.addColorStop(0, '#0a2a6b');
      g.addColorStop(0.55, '#1553c9');
      g.addColorStop(1, '#0a2a6b');
      f.fillStyle = g;
      f.fillRect(0, 0, W, H);
      f.fillStyle = 'rgba(255,255,255,.07)';
      f.font = '1100px Anton';
      f.textAlign = 'right';
      f.fillText('IA', W + 40, H + 70);
      f.textAlign = 'left';
      if (mk) f.drawImage(mk, M, 120);
      f.fillStyle = '#ffffff';
      f.font = `500 26px ${mono}`;
      f.letterSpacing = '4px';
      f.fillText('GRUPO DE INVESTIGACIÓN', M + 186, 176);
      f.fillText('EN INTELIGENCIA ARTIFICIAL', M + 186, 214);
      f.letterSpacing = '0px';
      f.save();
      f.translate(52, H - 90);
      f.rotate(-Math.PI / 2);
      label(f, 'UNIAJC · CALI', 0, 0, 'rgba(255,255,255,.6)', 24, 6);
      f.restore();
      const R = 200;
      const cx = W - M - R;
      const cy = 520;
      f.strokeStyle = 'rgba(255,255,255,.35)';
      f.lineWidth = 3;
      f.beginPath();
      f.arc(cx, cy, R + 26, 0, Math.PI * 2);
      f.stroke();
      f.save();
      f.beginPath();
      f.arc(cx, cy, R, 0, Math.PI * 2);
      f.clip();
      if (photo) drawCover(f, sized(photo), cx - R, cy - R, R * 2, R * 2, 0.1);
      else {
        f.fillStyle = '#ffffff';
        f.fillRect(cx - R, cy - R, R * 2, R * 2);
        f.fillStyle = '#0b2f73';
        f.font = '700 200px Anton';
        f.textAlign = 'center';
        f.textBaseline = 'middle';
        f.fillText(e.initials, cx, cy + 10);
        f.textBaseline = 'alphabetic';
      }
      f.restore();
      f.strokeStyle = '#ffffff';
      f.lineWidth = 8;
      f.beginPath();
      f.arc(cx, cy, R, 0, Math.PI * 2);
      f.stroke();
      f.textAlign = 'left';
      f.fillStyle = '#ffffff';
      const words = e.name.trim().split(/\s+/);
      const half = Math.ceil(words.length / 2);
      const rows = [words.slice(0, half).join(' ').toUpperCase(), words.slice(half).join(' ').toUpperCase()];
      rows.forEach((t, i) => {
        if (!t) return;
        fit(f, t, 400, 150, W - M * 2, 60, 'Anton');
        f.fillText(t, M, 900 + i * 150);
      });
      f.font = `600 30px ${mono}`;
      f.letterSpacing = '3px';
      const pw = f.measureText(e.pill).width + 72;
      f.fillStyle = '#ffffff';
      f.beginPath();
      f.roundRect(M, 1160, pw, 72, 36);
      f.fill();
      f.fillStyle = '#0b2f73';
      f.textBaseline = 'middle';
      f.fillText(e.pill, M + 36, 1197);
      f.textBaseline = 'alphabetic';
      f.letterSpacing = '0px';
      f.fillStyle = '#ffffff';
      fit(f, e.detail || '', 500, 38, W - M * 2, 26, SANS);
      f.fillText(e.detail || '', M, 1300);
      if (e.school) {
        f.fillStyle = 'rgba(255,255,255,.7)';
        f.font = `500 24px ${mono}`;
        f.letterSpacing = '2px';
        wrap(f, e.school.toUpperCase(), M, 1346, W - M * 2, 34);
        f.letterSpacing = '0px';
      }

      b.fillStyle = '#f4f7ff';
      b.fillRect(0, 0, W, H);
      if (e.logoOn) {
        const m2 = await e.tint('#0f4aa8', 560);
        if (m2) b.drawImage(m2, (W - m2.width) / 2, 250);
      }
      b.textAlign = 'center';
      b.fillStyle = '#0b2f73';
      b.font = '300px Anton';
      b.fillText('ATHENIA', W / 2, 960);
      label(b, 'GRUPO DE INVESTIGACIÓN EN IA', W / 2, 1040, '#0b2f73', 28, 4);
      b.fillStyle = '#1553c9';
      b.fillRect(0, H - 90, W, 90);
      label(b, 'UNIAJC · CALI', W / 2, H - 36, '#ffffff', 28, 6);
      s.fillStyle = '#0a2a6b';
      s.fillRect(0, 0, 1024, 96);
      s.fillStyle = '#ffffff';
      s.font = '600 44px Anton';
      s.letterSpacing = '8px';
      s.textBaseline = 'middle';
      s.fillText('ATHENIA  ·  UNIAJC  ·  ATHENIA  ·  UNIAJC  ·', 18, 52);
    },
  },

  /* ===== 4 · Suizo: retícula limpia, retrato contenido, filas con filetes y un solo acento ===== */
  suizo: {
    label: 'Suizo',
    note: 'Minimalista: retícula, filetes finos y mucho aire',
    finish: 'matte',
    async draw(e, f, b, s) {
      const { W, H, M, CX, mono, ink, muted, brand, onBrand, bg, rgba, photo, group, label, wrap, wordmark, fit } = e;
      const INTER = '"Inter", sans-serif';
      const mk = e.logoOn ? await e.tint(brand, 96) : null;
      f.fillStyle = bg;
      f.fillRect(0, 0, W, H);
      f.textAlign = 'left';
      if (mk) f.drawImage(mk, M, 132);
      wordmark(f, M + (mk ? mk.width + 24 : 0), 196, 52, ink, brand, INTER, 700, true);
      f.textAlign = 'right';
      label(f, 'GRUPO DE INVESTIGACIÓN EN IA', W - M, 190, muted, 20, 2);
      f.textAlign = 'left';
      f.fillStyle = rgba(ink, 0.25);
      f.fillRect(M, 250, W - M * 2, 2);
      /* retrato más pequeño (440 px) a la izquierda y, a su derecha, las filas de datos */
      const PS = 440;
      const PY = 290;
      const hair = rgba(ink, 0.18);
      f.save();
      f.beginPath();
      f.roundRect(M, PY, PS, PS, 14);
      f.clip();
      if (photo) f.drawImage(photo, M, PY, PS, PS);
      else {
        f.fillStyle = brand;
        f.fillRect(M, PY, PS, PS);
        f.fillStyle = onBrand;
        f.font = '700 200px Inter';
        f.textAlign = 'center';
        f.textBaseline = 'middle';
        f.fillText(e.initials, M + PS / 2, PY + PS / 2 + 10);
        f.textAlign = 'left';
        f.textBaseline = 'alphabetic';
      }
      f.restore();
      const RX = M + PS + 44;
      const RW = W - M - RX;
      let ry = PY;
      const kv = (k: string, v: string) => {
        if (!v) return;
        f.fillStyle = hair;
        f.fillRect(RX, ry, RW, 2);
        label(f, k, RX, ry + 46, muted, 20, 2);
        f.fillStyle = ink;
        f.font = `500 34px ${INTER}`;
        ry = wrap(f, v, RX, ry + 90, RW, 42) + 36;
      };
      kv('PROGRAMA', e.program);
      kv('SEMESTRE', e.term);
      kv('ROL', e.role);
      f.fillStyle = hair;
      f.fillRect(RX, ry, RW, 2);
      const [l1, l2] = e.lines;
      f.fillStyle = ink;
      fit(f, l1, 700, 92, W - M * 2, 28, INTER);
      f.fillText(l1, M, 876);
      if (l2) {
        f.fillStyle = muted;
        fit(f, l2, 700, 92, W - M * 2, 28, INTER);
        f.fillText(l2, M, 970);
      }
      f.fillStyle = brand;
      f.fillRect(M, 1018, 16, 16);
      label(f, e.pill, M + 34, 1034, brand, 26, 3);
      let y = 1090;
      const tr = (k: string, v: string) => {
        if (!v) return;
        f.fillStyle = hair;
        f.fillRect(M, y, W - M * 2, 2);
        label(f, k, M, y + 48, muted, 20, 2);
        f.fillStyle = ink;
        f.font = `500 34px ${INTER}`;
        f.fillText(v, M, y + 100);
        y += 134;
      };
      tr('INSTITUCIÓN', e.school);
      tr('GRUPO', group ? `${group} · grupo de investigación en IA` : '');
      f.fillStyle = hair;
      f.fillRect(M, y, W - M * 2, 2);

      b.fillStyle = bg;
      b.fillRect(0, 0, W, H);
      if (e.logoOn) {
        const m2 = await e.tint(brand, 380);
        if (m2) b.drawImage(m2, (W - m2.width) / 2, 420);
      }
      b.textAlign = 'center';
      wordmark(b, CX, 900, 96, ink, brand, INTER, 700);
      b.textAlign = 'center';
      label(b, 'GRUPO DE INVESTIGACIÓN EN IA', CX, 960, muted, 24, 3);
      b.fillStyle = hair;
      b.fillRect(M, 1300, W - M * 2, 2);
      label(b, 'UNIAJC · CALI', CX, 1356, muted, 24, 4);
      s.fillStyle = ink;
      s.fillRect(0, 0, 1024, 96);
      s.fillStyle = bg;
      s.font = `500 32px ${mono}`;
      s.letterSpacing = '6px';
      s.textBaseline = 'middle';
      s.fillText('ATHENIA  ·  UNIAJC  ·  ATHENIA  ·  UNIAJC  ·', 18, 50);
    },
  },

  /* ===== 5 · Clásico: la primera versión del carné (sigue el color y la letra del estilo activo), con AthenIA en el reverso ===== */
  clasico: {
    label: 'Clásico',
    note: 'La primera versión: sigue el color y la letra del estilo activo; AthenIA atrás',
    finish: 'glossy',
    async draw(e, f, b, s) {
      const { W, H, M, CX, mono, body, ink, muted, accent, onAccent, bg, line, photo, group, label, fit, wrap } = e;
      f.fillStyle = bg;
      f.fillRect(0, 0, W, H);
      f.fillStyle = accent;
      f.fillRect(0, H - 20, W, 20);
      f.textAlign = 'left';
      label(f, group ? group.toUpperCase() : 'BITÁCORA', M, 286);
      const PS = 400;
      const PY = 330;
      f.save();
      f.beginPath();
      f.roundRect(M, PY, PS, PS, 48);
      f.clip();
      if (photo) f.drawImage(photo, M, PY, PS, PS);
      else {
        f.fillStyle = accent;
        f.fillRect(M, PY, PS, PS);
        f.fillStyle = onAccent;
        f.font = `700 170px ${body}`;
        f.textAlign = 'center';
        f.textBaseline = 'middle';
        f.fillText(e.initials, M + PS / 2, PY + PS / 2 + 8);
        f.textBaseline = 'alphabetic';
      }
      f.restore();
      f.textAlign = 'left';
      const RX = M + PS + 48;
      const RW = W - M - RX;
      let ry = PY + 34;
      const row = (k: string, v: string, color = ink) => {
        if (!v) return;
        label(f, k, RX, ry, muted, 24, 2);
        f.fillStyle = color;
        f.font = `500 38px ${body}`;
        ry = wrap(f, v, RX, ry + 48, RW, 46) + 60;
      };
      row('ROL', group ? `${e.role} de ${group}` : e.role, accent);
      row('PROGRAMA', e.program);
      row('SEMESTRE', e.term);
      const [l1, l2] = e.lines;
      f.fillStyle = ink;
      fit(f, l1, 700, 100, W - M * 2, 28, body);
      f.fillText(l1, M, 884);
      if (l2) {
        fit(f, l2, 700, 100, W - M * 2, 28, body);
        f.fillText(l2, M, 988);
      }
      f.fillStyle = line;
      f.globalAlpha = 0.5;
      f.fillRect(M, 1046, W - M * 2, 2);
      f.globalAlpha = 1;
      if (e.school) {
        label(f, 'INSTITUCIÓN', M, 1110, muted, 26, 3);
        f.fillStyle = ink;
        f.font = `500 38px ${body}`;
        wrap(f, e.school, M, 1160, W - M * 2, 48);
      }
      if (group) {
        label(f, 'GRUPO', M, 1284, muted, 26, 3);
        f.fillStyle = ink;
        f.font = `500 38px ${body}`;
        f.fillText(`${group} · grupo de investigación en IA`, M, 1334);
      }

      /* reverso: color de acento con el logotipo y el nombre de AthenIA */
      b.fillStyle = accent;
      b.fillRect(0, 0, W, H);
      if (e.logoOn) {
        const m2 = await e.tint(onAccent, 440);
        if (m2) b.drawImage(m2, (W - m2.width) / 2, 330);
      }
      b.fillStyle = onAccent;
      b.textAlign = 'center';
      fit(b, group || 'AthenIA', 700, 150, W - M * 2, 60, body);
      b.fillText(group || 'AthenIA', CX, 900);
      label(b, 'GRUPO DE INVESTIGACIÓN EN IA', CX, 972, onAccent, 30, 3);
      label(b, 'UNIAJC · CALI', CX, 1340, onAccent, 28, 6);
      s.fillStyle = '#0e0e0e';
      s.fillRect(0, 0, 1024, 96);
      s.fillStyle = accent;
      s.font = `500 34px ${mono}`;
      s.letterSpacing = '6px';
      s.textBaseline = 'middle';
      s.fillText('ATHENIA  ·  UNIAJC  ·  ATHENIA  ·  UNIAJC  ·', 18, 50);
    },
  },
};
