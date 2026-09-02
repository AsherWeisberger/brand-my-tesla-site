/* Brand My Tesla — spot map, perspective decals, and a local demo auction.
   Bids are stored in localStorage for now. Swap `store` for a real backend when ready. */

(() => {
  'use strict';

  const IMG_W = 1792, IMG_H = 1008;
  const CLOSES_AT = new Date('2026-09-30T12:00:00-07:00');
  const MIN_RAISE = 50;

  /* ---------- Spots ---------- */
  const SPOTS = [
    { id: 'hood',     name: 'Hood',                where: 'Center of the hood, the marquee',      size: 'Large',  cm: '90 × 35 cm', in: '35.4 × 13.8 in', floor: 1000, ratio: 90 / 35,       view: 'front34' },
    { id: 'trunk',    name: 'Trunk lid',           where: 'Center of the trunk, under the badge', size: 'Large',  cm: '50 × 15 cm', in: '19.7 × 5.9 in',  floor: 1000, ratio: 50 / 15, view: 'rear' },
    { id: 'door-fl',  name: 'Driver door',         where: 'Front door, driver side',              size: 'Large',  cm: '60 × 30 cm', in: '23.6 × 11.8 in', floor: 750,  ratio: 2,       view: 'side-l' },
    { id: 'door-fr',  name: 'Passenger door',      where: 'Front door, passenger side',           size: 'Large',  cm: '60 × 30 cm', in: '23.6 × 11.8 in', floor: 750,  ratio: 2,       view: 'front34' },
    { id: 'door-rl',  name: 'Driver rear door',    where: 'Rear door, driver side',               size: 'Medium', cm: '45 × 22 cm', in: '17.7 × 8.7 in',  floor: 500,  ratio: 2,       view: 'rear34' },
    { id: 'door-rr',  name: 'Passenger rear door', where: 'Rear door, passenger side',            size: 'Medium', cm: '45 × 22 cm', in: '17.7 × 8.7 in',  floor: 500,  ratio: 2,       view: 'side-r' },
    { id: 'bumper-f', name: 'Front bumper',        where: 'Across the front fascia',              size: 'Medium', cm: '60 × 15 cm', in: '23.6 × 5.9 in',  floor: 750,  ratio: 4,       view: 'front' },
    { id: 'bumper-r', name: 'Rear bumper',         where: 'Across the rear fascia',               size: 'Medium', cm: '60 × 15 cm', in: '23.6 × 5.9 in',  floor: 750,  ratio: 4,       view: 'rear' },
  ];
  const spotById = Object.fromEntries(SPOTS.map(s => [s.id, s]));

  /* ---------- Views: quads are [TL, TR, BR, BL] in 1792x1008 image pixels,
     ordered the way the decal reads (TL = top-left of the logo as the viewer sees it). ---------- */
  const Q = BMT_QUADS;
  const VIEWS = [
    { id: 'front34', label: 'Front ¾', src: 'cars/hero-34.jpg', quads: Q.front34 },
    { id: 'front', label: 'Front', src: 'cars/front.jpg', quads: Q.front },
    { id: 'side-l', label: 'Driver side', src: 'cars/side.jpg', quads: Q['side-l'] },
    { id: 'side-r', label: 'Passenger side', src: 'cars/side.jpg', flip: true, quads: mirrorQuads(Q['side-l'], { 'door-fl': 'door-fr', 'door-rl': 'door-rr' }) },
    { id: 'rear34', label: 'Rear ¾', src: 'cars/rear-34.jpg', quads: Q.rear34 },
    { id: 'rear', label: 'Rear', src: 'cars/rear.jpg', quads: Q.rear },
  ];
  const viewById = Object.fromEntries(VIEWS.map(v => [v.id, v]));

  function mirrorQuads(quads, rename) {
    const out = {};
    for (const [id, p] of Object.entries(quads)) {
      const pl = normPlacement(p);
      const m = pl.c.map(([x, y]) => [IMG_W - x, y]);
      const mb = pl.bow.map(([dx, dy]) => [-dx, dy]);
      // viewer-facing order after a horizontal flip: TL'=mirror(TR), TR'=mirror(TL), BR'=mirror(BL), BL'=mirror(BR); left/right bows swap
      out[rename[id] || id] = { c: [m[1], m[0], m[3], m[2]], bow: [mb[0], mb[3], mb[2], mb[1]], wrap: pl.wrap };
    }
    return out;
  }

  /* ---------- Homography → CSS matrix3d ---------- */
  function adj(m) {
    return [
      m[4] * m[8] - m[5] * m[7], m[2] * m[7] - m[1] * m[8], m[1] * m[5] - m[2] * m[4],
      m[5] * m[6] - m[3] * m[8], m[0] * m[8] - m[2] * m[6], m[2] * m[3] - m[0] * m[5],
      m[3] * m[7] - m[4] * m[6], m[1] * m[6] - m[0] * m[7], m[0] * m[4] - m[1] * m[3],
    ];
  }
  function multmm(a, b) {
    const c = new Array(9);
    for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) {
      let s = 0; for (let k = 0; k < 3; k++) s += a[3 * i + k] * b[3 * k + j];
      c[3 * i + j] = s;
    }
    return c;
  }
  function multmv(m, v) {
    return [m[0] * v[0] + m[1] * v[1] + m[2] * v[2], m[3] * v[0] + m[4] * v[1] + m[5] * v[2], m[6] * v[0] + m[7] * v[1] + m[8] * v[2]];
  }
  function basisToPoints(p1, p2, p3, p4) {
    const m = [p1[0], p2[0], p3[0], p1[1], p2[1], p3[1], 1, 1, 1];
    const v = multmv(adj(m), [p4[0], p4[1], 1]);
    return multmm(m, [v[0], 0, 0, 0, v[1], 0, 0, 0, v[2]]);
  }
  // Maps a w×h rectangle at the origin onto quad [TL,TR,BR,BL]. Returns a CSS matrix3d string.
  function quadTransform(w, h, q) {
    const s = basisToPoints([0, 0], [w, 0], [0, h], [w, h]);
    const d = basisToPoints(q[0], q[1], q[3], q[2]);
    const t = multmm(d, adj(s));
    for (let i = 0; i < 9; i++) t[i] /= t[8];
    const m = [t[0], t[3], 0, t[6], t[1], t[4], 0, t[7], 0, 0, 1, 0, t[2], t[5], 0, t[8]];
    return `matrix3d(${m.map(n => n.toFixed(6)).join(',')})`;
  }

  /* ---------- Store (localStorage demo) ---------- */
  const store = {
    key: 'bmt-bids-v1',
    load() { try { return JSON.parse(localStorage.getItem(this.key)) || {}; } catch { return {}; } },
    save(bids) { try { localStorage.setItem(this.key, JSON.stringify(bids)); } catch {} },
  };
  let bids = store.load(); // { spotId: { amount, company, name, email, logo, at } }
  const state = { view: 'front34', selected: null, previewLogo: null, rawLogo: null, rawType: '', previewText: '', demo: true, cutout: true, carState: null };

  const money = n => '$' + Math.round(n).toLocaleString('en-US');
  const topBid = id => bids[id] || null;
  const currentPrice = id => (bids[id] ? bids[id].amount : spotById[id].floor);
  const minBid = id => (bids[id] ? bids[id].amount + MIN_RAISE : spotById[id].floor);

  /* ---------- Placement geometry ----------
     A placement is 4 corners [TL,TR,BR,BL] plus optional curvature:
       bow:  displacement of each edge midpoint [top,right,bottom,left] in image px, bends the edges
       wrap: [degU, degV] cylinder wrap angle across / along the decal, compresses the far ends like vinyl over a curve
     A homography puts the flat rectangle on the corners, the bow and wrap bend it over the panel. */
  function normPlacement(p) {
    if (Array.isArray(p)) return { c: p, bow: [[0, 0], [0, 0], [0, 0], [0, 0]], wrap: [0, 0] };
    return { c: p.c, bow: p.bow || [[0, 0], [0, 0], [0, 0], [0, 0]], wrap: p.wrap || [0, 0] };
  }
  function wrapMap(t, deg) {
    if (!deg) return t;
    const th = deg * Math.PI / 180;
    return 0.5 + Math.sin(th * (2 * t - 1)) / (2 * Math.sin(th));
  }
  function surface(pl) {
    const [TL, TR, BR, BL] = pl.c;
    const H = multmm(basisToPoints(TL, TR, BL, BR), adj(basisToPoints([0, 0], [1, 0], [0, 1], [1, 1]))); // unit square → corners
    const flat = (u, v) => { const p = multmv(H, [u, v, 1]); return [p[0] / p[2], p[1] / p[2]]; };
    const [bt, br, bb, bl] = pl.bow;
    return (u, v) => {
      const p = flat(wrapMap(u, pl.wrap[0]), wrapMap(v, pl.wrap[1]));
      const eu = 4 * u * (1 - u), ev = 4 * v * (1 - v);
      return [
        p[0] + eu * ((1 - v) * bt[0] + v * bb[0]) + ev * ((1 - u) * bl[0] + u * br[0]),
        p[1] + eu * ((1 - v) * bt[1] + v * bb[1]) + ev * ((1 - u) * bl[1] + u * br[1]),
      ];
    };
  }
  const NU = 32, NV = 10;
  function meshOf(pl) {
    const f = surface(pl), g = [];
    for (let j = 0; j <= NV; j++) { const row = []; for (let i = 0; i <= NU; i++) row.push(f(i / NU, j / NV)); g.push(row); }
    return g;
  }
  function outlineOf(g) {
    const pts = [];
    for (let i = 0; i <= NU; i++) pts.push(g[0][i]);
    for (let j = 1; j <= NV; j++) pts.push(g[j][NU]);
    for (let i = NU - 1; i >= 0; i--) pts.push(g[NV][i]);
    for (let j = NV - 1; j >= 1; j--) pts.push(g[j][0]);
    return pts;
  }

  /* ---------- Stickers: the flat artwork before it is bent onto the car ---------- */
  const SW = 2048, SH = 1024; // power of two so WebGL can mipmap; artwork fills width, height = SW / ratio
  const stickerCache = new Map();
  function stickerCanvas(ratio) {
    const c = document.createElement('canvas'); c.width = SW; c.height = SH; c.artH = Math.min(SH, Math.round(SW / ratio)); return c;
  }
  function loadImage(src) {
    return new Promise(res => { const im = new Image(); im.onload = () => res(im); im.onerror = () => res(null); im.src = src; });
  }
  function fitFontSize(ctx, text, fontOf, maxW, maxH) {
    let size = maxH;
    ctx.font = fontOf(size);
    const w = ctx.measureText(text).width;
    if (w > maxW) size = size * maxW / w;
    return size;
  }
  function spaced(ctx, text, x, y, spacing) {
    let w = 0; for (const ch of text) w += ctx.measureText(ch).width + spacing; w -= spacing;
    let cx = x - w / 2;
    for (const ch of text) { ctx.fillText(ch, cx + ctx.measureText(ch).width / 2, y); cx += ctx.measureText(ch).width + spacing; }
  }
  const SANS = '"Inter", "Helvetica Neue", Arial, sans-serif', SERIF = '"Instrument Serif", Georgia, serif';
  function textSticker(text, ratio, color, opts = {}) {
    const c = stickerCanvas(ratio), ctx = c.getContext('2d'), W = c.width, H = c.artH;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = color;
    const fontOf = s => `${opts.style || ''} ${opts.weight || 700} ${s}px ${opts.family || SANS}`;
    let size = fitFontSize(ctx, text, fontOf, W * 0.9, H * (opts.cap || 0.66));
    if (opts.spacing) { ctx.font = fontOf(size); const w = ctx.measureText(text).width + size * opts.spacing * (text.length - 1); if (w > W * 0.9) size *= (W * 0.9) / w; }
    ctx.font = fontOf(size);
    if (opts.spacing) spaced(ctx, text, W / 2, H / 2, size * opts.spacing); else ctx.fillText(text, W / 2, H / 2);
    return c;
  }
  const MARKS = {
    hood:      r => textSticker('ACME', r, '#141311', { cap: 0.8 }),
    trunk:     r => { const c = stickerCanvas(r), x = c.getContext('2d'), H = c.artH; x.fillStyle = '#1f2a5a';
                 x.textAlign = 'left'; x.textBaseline = 'middle';
                 const size = fitFontSize(x, 'northwind', s => `700 ${s}px ${SANS}`, c.width * 0.72, H * 0.7); x.font = `700 ${size}px ${SANS}`;
                 const tw = x.measureText('northwind').width, mark = size * 0.7, total = tw + mark + size * 0.25, x0 = (c.width - total) / 2;
                 x.beginPath(); x.moveTo(x0, H / 2 + mark / 2); x.lineTo(x0 + mark / 2, H / 2 - mark / 2); x.lineTo(x0 + mark, H / 2 + mark / 2); x.closePath(); x.fill();
                 x.fillText('northwind', x0 + mark + size * 0.25, H / 2 + size * 0.04); return c; },
    'door-fl': r => textSticker('KESTREL', r, '#c8341b', { weight: 600, spacing: 0.22, cap: 0.5 }),
    'door-fr': r => textSticker('Lumen', r, '#145a3a', { family: SERIF, style: 'italic', weight: 400, cap: 0.95 }),
    'door-rl': r => { const c = stickerCanvas(r), x = c.getContext('2d'), H = c.artH; x.fillStyle = x.strokeStyle = '#1f5fd6';
                 x.textAlign = 'left'; x.textBaseline = 'middle';
                 const size = fitFontSize(x, 'orbit', s => `700 ${s}px ${SANS}`, c.width * 0.6, H * 0.72); x.font = `700 ${size}px ${SANS}`;
                 const tw = x.measureText('orbit').width, R = size * 0.34, total = tw + R * 2.6 + size * 0.2, x0 = (c.width - total) / 2;
                 x.lineWidth = R * 0.4; x.beginPath(); x.arc(x0 + R, H / 2, R, 0, Math.PI * 2); x.stroke();
                 x.beginPath(); x.arc(x0 + R * 2.05, H / 2, R * 0.28, 0, Math.PI * 2); x.fill();
                 x.fillText('orbit', x0 + R * 2.6 + size * 0.2, H / 2 + size * 0.04); return c; },
    'door-rr': r => { const c = stickerCanvas(r), x = c.getContext('2d'), H = c.artH; x.fillStyle = '#141311';
                 x.textAlign = 'left'; x.textBaseline = 'middle';
                 const size = fitFontSize(x, 'hexa', s => `700 ${s}px ${SANS}`, c.width * 0.6, H * 0.72); x.font = `700 ${size}px ${SANS}`;
                 const tw = x.measureText('hexa').width, R = size * 0.42, total = tw + R * 2 + size * 0.22, x0 = (c.width - total) / 2, cx = x0 + R, cy = H / 2;
                 x.beginPath(); for (let k = 0; k < 6; k++) { const an = Math.PI / 6 + k * Math.PI / 3; x[k ? 'lineTo' : 'moveTo'](cx + R * Math.cos(an), cy + R * Math.sin(an)); } x.closePath(); x.fill();
                 x.fillText('hexa', x0 + R * 2 + size * 0.22, H / 2 + size * 0.04); return c; },
    'bumper-f': r => textSticker('PALM', r, '#7a4b2a', { spacing: 0.4, cap: 0.62 }),
    'bumper-r': r => textSticker('Verde', r, '#2f7d3a', { family: SERIF, weight: 400, cap: 0.95 }),
  };
  async function imageSticker(src, ratio) {
    const im = await loadImage(src); if (!im) return null;
    const c = stickerCanvas(ratio), ctx = c.getContext('2d'), W = c.width, H = c.artH;
    const k = Math.min((W * 0.94) / im.width, (H * 0.9) / im.height);
    const w = im.width * k, h = im.height * k;
    ctx.drawImage(im, (W - w) / 2, (H - h) / 2, w, h);
    return c;
  }
  // Returns { canvas, kind } for a spot given the current state; cached by content.
  async function stickerFor(spot) {
    const held = topBid(spot.id);
    let key, make, kind = 'vinyl';
    if (held && held.logo) { key = 'held:' + held.logo.slice(0, 64) + held.at; make = () => imageSticker(held.logo, spot.ratio); }
    else if (held) { key = 'heldtext:' + held.company; make = () => textSticker(held.company, spot.ratio, '#141311'); }
    else if (state.previewLogo) { key = 'prev:' + state.previewLogo.slice(-80) + state.previewLogo.length; make = () => imageSticker(state.previewLogo, spot.ratio); }
    else if (state.previewText) { key = 'text:' + state.previewText; make = () => textSticker(state.previewText, spot.ratio, '#141311'); }
    else if (state.demo) { key = 'demo'; make = () => MARKS[spot.id](spot.ratio); kind = 'open'; }
    else { key = 'ghost'; make = () => textSticker(spot.name.toUpperCase(), spot.ratio, 'rgba(20,19,17,.5)', { weight: 600, spacing: 0.18, cap: 0.42 }); kind = 'ghost'; }
    key += '|' + spot.id + '|' + spot.ratio;
    if (!stickerCache.has(key)) stickerCache.set(key, Promise.resolve(make()));
    return { canvas: await stickerCache.get(key), kind };
  }

  /* ---------- Bending the sticker onto the panel ---------- */
  function drawTri(ctx, img, s0, s1, s2, d0, d1, d2) {
    const [x0, y0] = s0, [x1, y1] = s1, [x2, y2] = s2;
    const [u0, v0] = d0, [u1, v1] = d1, [u2, v2] = d2;
    const det = (x1 - x0) * (y2 - y0) - (x2 - x0) * (y1 - y0);
    if (!det) return;
    const a = ((u1 - u0) * (y2 - y0) - (u2 - u0) * (y1 - y0)) / det;
    const b = ((v1 - v0) * (y2 - y0) - (v2 - v0) * (y1 - y0)) / det;
    const c = ((u2 - u0) * (x1 - x0) - (u1 - u0) * (x2 - x0)) / det;
    const d = ((v2 - v0) * (x1 - x0) - (v1 - v0) * (x2 - x0)) / det;
    const e = u0 - a * x0 - c * y0, f = v0 - b * x0 - d * y0;
    // expand the clip a hair so seams between triangles don't show
    const cx = (u0 + u1 + u2) / 3, cy = (v0 + v1 + v2) / 3, ex = 0.7;
    const px = p => { const dx = p[0] - cx, dy = p[1] - cy, l = Math.hypot(dx, dy) || 1; return [p[0] + dx / l * ex, p[1] + dy / l * ex]; };
    const q0 = px(d0), q1 = px(d1), q2 = px(d2);
    ctx.save();
    ctx.beginPath(); ctx.moveTo(q0[0], q0[1]); ctx.lineTo(q1[0], q1[1]); ctx.lineTo(q2[0], q2[1]); ctx.closePath(); ctx.clip();
    ctx.transform(a, b, c, d, e, f);
    ctx.drawImage(img, 0, 0);
    ctx.restore();
  }
  function drawMesh(ctx, img, grid, k) {
    const sw = img.width, sh = img.artH || img.height;
    for (let j = 0; j < NV; j++) for (let i = 0; i < NU; i++) {
      const sx0 = i / NU * sw, sx1 = (i + 1) / NU * sw, sy0 = j / NV * sh, sy1 = (j + 1) / NV * sh;
      const d = p => [p[0] * k, p[1] * k];
      const d00 = d(grid[j][i]), d10 = d(grid[j][i + 1]), d01 = d(grid[j + 1][i]), d11 = d(grid[j + 1][i + 1]);
      drawTri(ctx, img, [sx0, sy0], [sx1, sy0], [sx1, sy1], d00, d10, d11);
      drawTri(ctx, img, [sx0, sy0], [sx1, sy1], [sx0, sy1], d00, d11, d01);
    }
  }
  function tracePath(ctx, pts, k) {
    ctx.beginPath(); pts.forEach((p, i) => ctx[i ? 'lineTo' : 'moveTo'](p[0] * k, p[1] * k)); ctx.closePath();
  }

  /* ---------- WebGL vinyl renderer: textured mesh with mipmaps, anisotropic filtering and MSAA ---------- */
  const glCache = new WeakMap();
  function getGL(canvas) {
    if (glCache.has(canvas)) return glCache.get(canvas);
    const gl = canvas.getContext('webgl', { antialias: true, premultipliedAlpha: true, alpha: true, preserveDrawingBuffer: true });
    if (!gl) { glCache.set(canvas, null); return null; }
    const sh = (type, src) => { const o = gl.createShader(type); gl.shaderSource(o, src); gl.compileShader(o); return o; };
    const prog = gl.createProgram();
    gl.attachShader(prog, sh(gl.VERTEX_SHADER, 'attribute vec2 p; attribute vec2 t; varying vec2 v; void main(){ v = t; gl_Position = vec4(p, 0.0, 1.0); }'));
    gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, `
      precision mediump float; uniform sampler2D s; uniform sampler2D paint; uniform vec2 res; uniform float flip; varying vec2 v;
      float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
      void main(){
        vec4 d = texture2D(s, v, 0.6);                       // decal (premultiplied), slight softness like a photo
        vec2 pu = gl_FragCoord.xy / res; pu.y = 1.0 - pu.y; if (flip > 0.5) pu.x = 1.0 - pu.x;
        vec3 p = texture2D(paint, pu).rgb;
        float L = dot(p, vec3(0.299, 0.587, 0.114));
        float shade = mix(0.55, 1.0, pow(L, 1.4));           // vinyl sits in the paint's shadows
        float gloss = pow(smoothstep(0.80, 1.0, L), 2.0) * 0.55; // and catches its reflections
        vec3 c = d.rgb * shade + gloss * d.a * (0.35 + 0.65 * p);
        float g = (hash(gl_FragCoord.xy) - 0.5) * 0.04 * d.a;
        gl_FragColor = vec4(c + g, d.a);
      }`));
    gl.linkProgram(prog); gl.useProgram(prog);
    const ctx = {
      gl, prog, aniso: gl.getExtension('EXT_texture_filter_anisotropic') || gl.getExtension('WEBKIT_EXT_texture_filter_anisotropic'),
      pBuf: gl.createBuffer(), tBuf: gl.createBuffer(), pLoc: gl.getAttribLocation(prog, 'p'), tLoc: gl.getAttribLocation(prog, 't'),
      textures: new WeakMap(), paintTex: {},
      uRes: gl.getUniformLocation(prog, 'res'), uFlip: gl.getUniformLocation(prog, 'flip'), uS: gl.getUniformLocation(prog, 's'), uPaint: gl.getUniformLocation(prog, 'paint'),
    };
    gl.uniform1i(ctx.uS, 0); gl.uniform1i(ctx.uPaint, 1);
    gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    glCache.set(canvas, ctx);
    return ctx;
  }
  function glTexture(g, img) {
    if (g.textures.has(img)) return g.textures.get(img);
    const gl = g.gl, tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.generateMipmap(gl.TEXTURE_2D);
    if (g.aniso) gl.texParameterf(gl.TEXTURE_2D, g.aniso.TEXTURE_MAX_ANISOTROPY_EXT, Math.min(16, gl.getParameter(g.aniso.MAX_TEXTURE_MAX_ANISOTROPY_EXT)));
    g.textures.set(img, tex);
    return tex;
  }
  function glPaint(g, img, src) {
    const gl = g.gl;
    if (!g.paintTex[src]) {
      const tex = gl.createTexture(); gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, img);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      g.paintTex[src] = tex;
    }
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, g.paintTex[src]); gl.activeTexture(gl.TEXTURE0);
  }
  function glDrawMesh(g, img, grid) {
    const gl = g.gl, pos = [], uv = [], vmax = (img.artH || img.height) / img.height;
    const P = p => [p[0] / IMG_W * 2 - 1, 1 - p[1] / IMG_H * 2];
    for (let j = 0; j < NV; j++) for (let i = 0; i < NU; i++) {
      const u0 = i / NU, u1 = (i + 1) / NU, v0 = j / NV * vmax, v1 = (j + 1) / NV * vmax;
      const d00 = P(grid[j][i]), d10 = P(grid[j][i + 1]), d01 = P(grid[j + 1][i]), d11 = P(grid[j + 1][i + 1]);
      pos.push(...d00, ...d10, ...d11, ...d00, ...d11, ...d01);
      uv.push(u0, v0, u1, v0, u1, v1, u0, v0, u1, v1, u0, v1);
    }
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, glTexture(g, img));
    gl.bindBuffer(gl.ARRAY_BUFFER, g.pBuf); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(pos), gl.STREAM_DRAW);
    gl.enableVertexAttribArray(g.pLoc); gl.vertexAttribPointer(g.pLoc, 2, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, g.tBuf); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(uv), gl.STREAM_DRAW);
    gl.enableVertexAttribArray(g.tLoc); gl.vertexAttribPointer(g.tLoc, 2, gl.FLOAT, false, 0, 0);
    gl.drawArrays(gl.TRIANGLES, 0, pos.length / 2);
  }

  /* ---------- Car states (doors open, frunk, trunk) ----------
     Drop photos into cars/ with these names and the buttons appear on their own:
       doors:  cars/<view>-doors.jpg   e.g. cars/side-doors.jpg, cars/hero-34-doors.jpg
       frunk:  cars/<view>-frunk.jpg   e.g. cars/front-frunk.jpg, cars/hero-34-frunk.jpg
       trunk:  cars/<view>-trunk.jpg   e.g. cars/rear-trunk.jpg, cars/rear-34-trunk.jpg
     Same camera, same car, same studio. Placements stay put; the photo underneath swaps. */
  const STATES = [
    { id: 'doors', label: 'Doors open' },
    { id: 'frunk', label: 'Frunk' },
    { id: 'trunk', label: 'Trunk' },
  ];
  const stateSrc = (view, st) => view.src.replace(/\.jpg$/, `-${st}.jpg`);
  const availableStates = {}; // viewId -> Set of state ids whose photos exist
  async function probeStates() {
    for (const v of VIEWS) {
      availableStates[v.id] = new Set();
      for (const st of STATES) { const im = await loadImage(stateSrc(v, st.id)); if (im) availableStates[v.id].add(st.id); }
    }
    renderStateTabs();
  }
  function currentSrc(view) {
    return (state.carState && availableStates[view.id] && availableStates[view.id].has(state.carState)) ? stateSrc(view, state.carState) : view.src;
  }

  /* ---------- Rendering: the car frame ---------- */
  const frame = document.getElementById('studio-frame');
  const layers = frame.querySelectorAll('.car-img');
  const paintLayers = frame.querySelector('.paint-layers');
  let renderSeq = 0;
  async function renderFrame() {
    const view = viewById[state.view];
    frame.classList.toggle('flip', !!view.flip);
    const seq = ++renderSeq; frame.dataset.seq = seq;
    const vin = frame.querySelector('.car-vinyl'), ui = frame.querySelector('.car-ui');
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    const cw = Math.max(1, Math.round(frame.clientWidth * dpr)), ch = Math.round(cw * IMG_H / IMG_W);
    const k = cw / IMG_W;
    const placements = Object.entries(view.quads).map(([id, p]) => ({ spot: spotById[id], pl: normPlacement(p) }));
    const stickers = await Promise.all(placements.map(p => stickerFor(p.spot)));
    if (frame.dataset.seq !== String(seq)) return;
    const g = getGL(vin);
    const ss = Math.min(Math.max(window.devicePixelRatio || 1, 2), 3);
    const vw = Math.min(4096, Math.round(frame.clientWidth * ss)), vh = Math.round(vw * IMG_H / IMG_W);
    vin.width = vw; vin.height = vh; ui.width = cw; ui.height = ch;
    vin.classList.toggle('gl', !!g);
    let vc = null;
    const src = currentSrc(view);
    if (g) {
      const paintImg = await loadImage(src); if (frame.dataset.seq !== String(seq)) return;
      glPaint(g, paintImg, src);
      g.gl.uniform2f(g.uRes, vw, vh); g.gl.uniform1f(g.uFlip, view.flip ? 1 : 0);
      g.gl.viewport(0, 0, vw, vh); g.gl.clearColor(0, 0, 0, 0); g.gl.clear(g.gl.COLOR_BUFFER_BIT);
    } else { vc = vin.getContext('2d'); vc.imageSmoothingQuality = 'high'; }
    const uc = ui.getContext('2d');
    placements.forEach(({ spot, pl }, n) => {
      const st = stickers[n]; if (!st || !st.canvas) return;
      const grid = meshOf(pl);
      if (g) glDrawMesh(g, st.canvas, grid); else drawMesh(vc, st.canvas, grid, vw / IMG_W);
      if (st.kind === 'ghost') {
        tracePath(uc, outlineOf(grid), k);
        uc.fillStyle = 'rgba(255,255,255,.22)'; uc.fill();
        uc.lineWidth = Math.max(1, 1.2 * k * 2); uc.strokeStyle = 'rgba(255,255,255,.85)'; uc.stroke();
      }
    });
    renderHits(view); renderPins(view);
    paintLayers.classList.remove('fading');
  }

  function renderHits(view) {
    const svg = frame.querySelector('.car-hits');
    svg.innerHTML = '';
    const ns = 'http://www.w3.org/2000/svg';
    for (const [id, p] of Object.entries(view.quads)) {
      const pts = outlineOf(meshOf(normPlacement(p)));
      const poly = document.createElementNS(ns, 'polygon');
      poly.setAttribute('points', pts.map(q => q.map(n => n.toFixed(1)).join(',')).join(' '));
      poly.dataset.spot = id;
      if (state.selected === id) poly.classList.add('selected');
      poly.addEventListener('click', e => { e.stopPropagation(); selectSpot(id, false); });
      svg.appendChild(poly);
    }
    if (calib) renderCalibHandles(svg, view);
  }

  const pinsEl = document.getElementById('pins');
  function renderPins(view) {
    pinsEl.innerHTML = '';
    for (const [id, p] of Object.entries(view.quads)) {
      const grid = meshOf(normPlacement(p));
      const c = grid[Math.round(NV / 2)][Math.round(NU / 2)];
      const top = grid[0][Math.round(NU / 2)];
      const s = spotById[id], b = topBid(id);
      const pin = document.createElement('button');
      pin.type = 'button';
      pin.className = 'pin' + (c[0] > IMG_W * 0.72 ? ' left' : '') + (state.selected === id ? ' selected' : '');
      pin.style.left = (c[0] / IMG_W * 100) + '%';
      pin.style.top = (Math.min(c[1], top[1] - 4) / IMG_H * 100) + '%';
      pin.innerHTML = `<span class="dot"></span><span class="tag"><b>${s.name}</b><small>${b ? b.company + ' · ' : ''}${money(currentPrice(id))}</small></span>`;
      pin.setAttribute('aria-label', `${s.name}, ${money(currentPrice(id))}`);
      pin.addEventListener('click', e => { e.stopPropagation(); selectSpot(id, false); });
      pinsEl.appendChild(pin);
    }
  }

  /* ---------- Views, turning, states ---------- */
  const tabs = document.getElementById('view-tabs');
  function renderTabs() {
    tabs.innerHTML = '';
    for (const v of VIEWS) {
      const b = document.createElement('button');
      b.type = 'button'; b.setAttribute('role', 'tab'); b.textContent = v.label;
      b.setAttribute('aria-selected', v.id === state.view ? 'true' : 'false');
      b.addEventListener('click', () => setView(v.id));
      tabs.appendChild(b);
    }
  }
  const stateTabs = document.getElementById('state-tabs');
  function renderStateTabs() {
    const avail = availableStates[state.view] || new Set();
    stateTabs.innerHTML = '';
    if (!avail.size) { stateTabs.hidden = true; if (state.carState) { state.carState = null; } return; }
    stateTabs.hidden = false;
    for (const st of STATES) {
      if (!avail.has(st.id)) continue;
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'hud-btn'; b.textContent = st.label;
      b.setAttribute('aria-pressed', state.carState === st.id ? 'true' : 'false');
      b.addEventListener('click', () => { state.carState = state.carState === st.id ? null : st.id; swapPhoto(); renderStateTabs(); });
      stateTabs.appendChild(b);
    }
  }
  function swapPhoto() {
    const view = viewById[state.view], src = currentSrc(view);
    const active = frame.querySelector('.car-img.active'), next = [...layers].find(l => l !== active);
    if (active.getAttribute('src') === src) { renderFrame(); return; }
    paintLayers.classList.add('fading');
    const go = () => { next.classList.add('active'); active.classList.remove('active'); renderFrame(); };
    next.onload = go; next.src = src;
    if (next.complete && next.naturalWidth) go();
  }
  function setView(id) {
    if (state.view === id) return;
    state.view = id;
    if (!(availableStates[id] && availableStates[id].has(state.carState))) state.carState = null;
    renderTabs(); renderStateTabs(); swapPhoto();
  }
  function turn(dir) {
    const i = VIEWS.findIndex(v => v.id === state.view);
    setView(VIEWS[(i + dir + VIEWS.length) % VIEWS.length].id);
  }
  frame.parentElement.querySelector('.turn-prev').addEventListener('click', () => { stopTurntable(); turn(-1); });
  frame.parentElement.querySelector('.turn-next').addEventListener('click', () => { stopTurntable(); turn(1); });
  frame.addEventListener('keydown', e => {
    if (e.key === 'ArrowLeft') { stopTurntable(); turn(-1); e.preventDefault(); }
    if (e.key === 'ArrowRight') { stopTurntable(); turn(1); e.preventDefault(); }
  });
  let drag = null;
  frame.addEventListener('pointerdown', e => {
    if (calib || e.target.closest('.pin')) return;
    drag = { x: e.clientX, moved: 0 };
  });
  frame.addEventListener('pointermove', e => {
    if (!drag) return;
    const dx = e.clientX - drag.x;
    if (Math.abs(dx) > 60) { stopTurntable(); turn(dx > 0 ? -1 : 1); drag.x = e.clientX; drag.moved++; frame.classList.add('dragging'); }
  });
  const endDrag = () => { drag = null; frame.classList.remove('dragging'); };
  frame.addEventListener('pointerup', endDrag); frame.addEventListener('pointercancel', endDrag); frame.addEventListener('pointerleave', endDrag);

  let turntableT = null;
  const turntableBtn = document.getElementById('turntable');
  function stopTurntable() { if (turntableT) { clearInterval(turntableT); turntableT = null; turntableBtn.setAttribute('aria-pressed', 'false'); } }
  turntableBtn.addEventListener('click', () => {
    if (turntableT) return stopTurntable();
    turntableBtn.setAttribute('aria-pressed', 'true');
    turn(1); turntableT = setInterval(() => turn(1), 2600);
  });

  document.getElementById('toggle-demo').addEventListener('change', e => { state.demo = e.target.checked; renderFrame(); });

  /* ---------- Selection + sheet ---------- */
  const sheet = document.getElementById('sheet'), sheetBody = document.getElementById('sheet-body');
  function openSheet() { sheet.classList.add('open'); }
  function closeSheet() { sheet.classList.remove('open'); }
  document.getElementById('sheet-close').addEventListener('click', closeSheet);
  document.getElementById('hud-logo').addEventListener('click', () => { openSheet(); setTimeout(() => document.getElementById('logo-input').closest('label').focus(), 50); });

  function selectSpot(id, jumpView) {
    state.selected = id;
    if (jumpView && !viewById[state.view].quads[id]) setView(spotById[id].view);
    const view = viewById[state.view];
    renderHits(view); renderPins(view);
    renderSheet(); renderCards(); renderSchematic(); openSheet();
  }
  function renderSheet() {
    if (!state.selected) {
      sheetBody.innerHTML = `<div class="sheet-eyebrow">Pick a panel</div><div class="sheet-name">Tap the car.</div><p class="sheet-where">Every pin is a panel you can bid on. Turn the car to see them all.</p>`;
      return;
    }
    const s = spotById[state.selected], b = topBid(s.id);
    sheetBody.innerHTML = `
      <div class="sheet-eyebrow">${b ? 'Current bid' : 'Open at floor'}</div>
      <div class="sheet-name">${s.name}</div>
      <div class="sheet-where">${s.where}</div>
      ${b && b.logo ? `<img class="held-logo" src="${b.logo}" alt="${b.company}" style="margin-top:14px">` : ''}
      <div class="sheet-grid">
        <div><div class="k">${b ? 'Top bid' : 'Floor'}</div><div class="v big">${money(currentPrice(s.id))}</div></div>
        <div><div class="k">Held by</div><div class="v">${b ? b.company : 'Nobody yet'}</div></div>
        <div><div class="k">Vinyl size</div><div class="v">${s.cm}<br><span class="muted">${s.in}</span></div></div>
        <div><div class="k">Next bid</div><div class="v">${money(minBid(s.id))}+</div></div>
      </div>
      <div class="sheet-actions">
        <button class="btn btn-primary" type="button" data-bid>Bid ${money(minBid(s.id))}</button>
        <button class="btn btn-ghost" type="button" data-angle>Best angle</button>
      </div>`;
    sheetBody.querySelector('[data-bid]').addEventListener('click', () => openBid(s.id));
    sheetBody.querySelector('[data-angle]').addEventListener('click', () => { stopTurntable(); setView(s.view); });
  }

  /* ---------- Cards + schematic + stats ---------- */
  const cardsEl = document.getElementById('cards');
  function renderCards() {
    cardsEl.innerHTML = '';
    for (const s of SPOTS) {
      const b = topBid(s.id);
      const card = document.createElement('article');
      card.className = 'card' + (s.floor >= 1000 ? ' marquee' : '') + (state.selected === s.id ? ' selected' : '');
      card.innerHTML = `
        <div class="card-top"><div><div class="card-name">${s.name}</div><div class="card-sub">${s.where}</div></div><span class="badge ${b ? 'live' : ''}">${b ? 'Bid live' : s.size}</span></div>
        <div class="card-mid">
          <div class="price">${money(currentPrice(s.id))}<small>${b ? '1 bid · next ' + money(minBid(s.id)) : 'floor · ' + s.cm}</small></div>
          <div class="holder">${b ? (b.logo ? `<img src="${b.logo}" alt="">` : '') + `<span>${b.company}</span>` : '<span class="ph">+</span>'}</div>
        </div>
        <div class="card-actions"><button class="btn btn-primary btn-sm" type="button" data-bid>Bid</button><button class="btn btn-ghost btn-sm" type="button" data-view>View on car</button></div>`;
      card.querySelector('[data-bid]').addEventListener('click', e => { e.stopPropagation(); openBid(s.id); });
      card.querySelector('[data-view]').addEventListener('click', e => { e.stopPropagation(); goToSpot(s.id); });
      card.addEventListener('click', () => goToSpot(s.id));
      cardsEl.appendChild(card);
    }
  }
  function goToSpot(id) {
    stopTurntable();
    selectSpot(id, true);
    document.getElementById('stage').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  const schematic = document.getElementById('schematic');
  schematic.querySelectorAll('.panel').forEach(p => p.addEventListener('click', () => goToSpot(p.dataset.spot)));
  function renderSchematic() {
    schematic.querySelectorAll('.panel').forEach(p => {
      p.classList.toggle('held', !!topBid(p.dataset.spot));
      p.classList.toggle('selected', state.selected === p.dataset.spot);
    });
  }
  function countUp(el, to, fmt) {
    const from = Number(el.dataset.v || 0); el.dataset.v = to;
    if (from === to) { el.textContent = fmt(to); return; }
    const t0 = performance.now(), dur = 900;
    const step = t => { const k = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - k, 3); el.textContent = fmt(Math.round(from + (to - from) * e)); if (k < 1) requestAnimationFrame(step); };
    requestAnimationFrame(step);
  }
  function renderStats() {
    const held = SPOTS.filter(s => bids[s.id]);
    const raised = held.reduce((a, s) => a + bids[s.id].amount, 0);
    countUp(document.getElementById('stat-raised'), raised, money);
    countUp(document.getElementById('stat-taken'), held.length, n => String(n));
    const track = document.getElementById('ticker-track');
    const items = SPOTS.map(s => { const b = topBid(s.id); return `<span><i class="${b ? 'held' : ''}"></i>${s.name} <b>${money(currentPrice(s.id))}</b>${b ? ' · ' + b.company : ''}</span>`; });
    const lead = `<span><i class="held"></i><b>${money(raised)}</b> raised · ${held.length} of ${SPOTS.length} panels have bids</span>`;
    track.innerHTML = [lead, ...items, lead, ...items].join('');
  }
  function tickCountdown() {
    const ms = CLOSES_AT - Date.now();
    const els = [document.getElementById('countdown'), document.getElementById('nav-countdown')];
    let txt = 'Closed';
    if (ms > 0) { const d = Math.floor(ms / 864e5), h = Math.floor(ms % 864e5 / 36e5), m = Math.floor(ms % 36e5 / 6e4); txt = d > 0 ? `${d}d ${h}h` : `${h}h ${m}m`; }
    els.forEach(el => { if (el) el.textContent = txt; });
  }
  tickCountdown(); setInterval(tickCountdown, 30000);

  /* ---------- Logo preview ---------- */
  function readLogo(file, cb) {
    if (!file) return;
    const fr = new FileReader();
    fr.onload = () => cb(fr.result, file.type);
    fr.readAsDataURL(file);
  }
  // Turns an uploaded logo into something a vinyl shop would cut for white paint:
  // downscale, detect a flat background from the border pixels, make it transparent,
  // and if the background was dark, invert so the mark reads dark on white.
  function processLogo(dataUrl, type, cutout, cb) {
    if (type === 'image/svg+xml') return cb(dataUrl, { note: 'SVG used as is.' });
    const im = new Image();
    im.onload = () => {
      const max = 1600, k = Math.min(1, max / Math.max(im.width, im.height));
      const c = document.createElement('canvas'); c.width = Math.round(im.width * k); c.height = Math.round(im.height * k);
      const ctx = c.getContext('2d'); ctx.drawImage(im, 0, 0, c.width, c.height);
      let note = 'Used as uploaded.';
      if (cutout) {
        const W = c.width, H = c.height, id = ctx.getImageData(0, 0, W, H), d = id.data;
        const border = [];
        const step = Math.max(1, Math.floor((W + H) / 300));
        for (let x = 0; x < W; x += step) { border.push(x * 4, ((H - 1) * W + x) * 4); }
        for (let y = 0; y < H; y += step) { border.push((y * W) * 4, (y * W + W - 1) * 4); }
        const opaque = border.filter(i => d[i + 3] > 200);
        if (opaque.length < border.length * 0.6) {
          note = 'Logo already has a transparent background.';
        } else {
          const avg = [0, 0, 0]; opaque.forEach(i => { avg[0] += d[i]; avg[1] += d[i + 1]; avg[2] += d[i + 2]; });
          avg.forEach((v, j) => avg[j] = v / opaque.length);
          const dist = i => Math.hypot(d[i] - avg[0], d[i + 1] - avg[1], d[i + 2] - avg[2]);
          const uniform = opaque.filter(i => dist(i) < 40).length / opaque.length;
          if (uniform < 0.8) {
            note = 'No flat background found, used as uploaded.';
          } else {
            const luma = 0.299 * avg[0] + 0.587 * avg[1] + 0.114 * avg[2];
            let bg = avg;
            if (luma < 110) {
              for (let i = 0; i < d.length; i += 4) { d[i] = 255 - d[i]; d[i + 1] = 255 - d[i + 1]; d[i + 2] = 255 - d[i + 2]; }
              bg = avg.map(v => 255 - v);
              note = 'Background removed. Colors inverted so the mark reads as dark vinyl on white paint.';
            } else {
              note = 'Background removed.';
            }
            const t0 = 28, t1 = 96;
            for (let i = 0; i < d.length; i += 4) {
              const dd = Math.hypot(d[i] - bg[0], d[i + 1] - bg[1], d[i + 2] - bg[2]);
              const a = Math.max(0, Math.min(1, (dd - t0) / (t1 - t0)));
              d[i + 3] = Math.min(d[i + 3], Math.round(a * 255));
            }
            ctx.putImageData(id, 0, 0);
            let x0 = W, y0 = H, x1 = 0, y1 = 0;
            for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (d[(y * W + x) * 4 + 3] > 20) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
            if (x1 > x0 && y1 > y0) {
              const pad = 4, t = document.createElement('canvas');
              t.width = x1 - x0 + 1 + pad * 2; t.height = y1 - y0 + 1 + pad * 2;
              t.getContext('2d').drawImage(c, x0, y0, x1 - x0 + 1, y1 - y0 + 1, pad, pad, x1 - x0 + 1, y1 - y0 + 1);
              return cb(t.toDataURL('image/png'), { note });
            }
          }
        }
      }
      cb(c.toDataURL('image/png'), { note });
    };
    im.src = dataUrl;
  }
  function applyPreviewLogo() {
    if (!state.rawLogo) return;
    processLogo(state.rawLogo, state.rawType, state.cutout, (url, info) => {
      state.previewLogo = url; state.previewText = ''; document.getElementById('logo-text').value = '';
      document.getElementById('logo-note').textContent = info.note;
      renderFrame();
    });
  }
  document.getElementById('logo-input').addEventListener('change', e => {
    readLogo(e.target.files[0], (url, type) => { state.rawLogo = url; state.rawType = type; applyPreviewLogo(); });
  });
  document.getElementById('logo-cutout').addEventListener('change', e => { state.cutout = e.target.checked; applyPreviewLogo(); });
  document.getElementById('logo-text').addEventListener('input', e => { state.previewText = e.target.value.trim(); state.previewLogo = null; renderFrame(); });
  document.getElementById('logo-clear').addEventListener('click', () => {
    state.previewLogo = null; state.rawLogo = null; state.previewText = ''; document.getElementById('logo-text').value = ''; document.getElementById('logo-input').value = '';
    document.getElementById('logo-note').textContent = ''; renderFrame();
  });

  /* ---------- Bidding ---------- */
  const modal = document.getElementById('bid-modal');
  const bidForm = document.getElementById('bid-form');
  let bidSpot = null;
  function openBid(id) {
    bidSpot = id || state.selected || 'hood';
    const s = spotById[bidSpot], b = topBid(bidSpot);
    document.getElementById('bid-title').textContent = s.name;
    document.getElementById('bid-sub').textContent = `${s.cm} vinyl. ${b ? `${b.company} holds it at ${money(b.amount)}. Minimum raise is ${money(MIN_RAISE)}.` : `Floor is ${money(s.floor)}.`}`;
    const amt = document.getElementById('bid-amount');
    amt.min = minBid(bidSpot); amt.value = minBid(bidSpot);
    modal.hidden = false; requestAnimationFrame(() => modal.classList.add('open'));
    setTimeout(() => amt.focus(), 120);
  }
  function closeBid() { modal.classList.remove('open'); setTimeout(() => { modal.hidden = true; bidForm.reset(); }, 220); }
  document.getElementById('bid-close').addEventListener('click', closeBid);
  document.getElementById('nav-bid').addEventListener('click', () => openBid(state.selected));
  modal.addEventListener('click', e => { if (e.target === modal) closeBid(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') { if (!modal.hidden) closeBid(); else closeSheet(); } });
  bidForm.addEventListener('submit', e => {
    e.preventDefault();
    const fd = new FormData(bidForm);
    const amount = Number(fd.get('amount'));
    if (amount < minBid(bidSpot)) { alert(`Minimum bid for this panel is ${money(minBid(bidSpot))}.`); return; }
    const commit = logo => {
      bids[bidSpot] = { amount, company: String(fd.get('company')).trim(), name: String(fd.get('name')).trim(), email: String(fd.get('email')).trim(), logo: logo || null, at: Date.now() };
      store.save(bids);
      closeBid();
      selectSpot(bidSpot, true);
      renderFrame(); renderCards(); renderSchematic(); renderStats();
    };
    const file = document.getElementById('bid-logo').files[0];
    if (file) readLogo(file, (url, type) => processLogo(url, type, true, commit)); else commit(null);
  });

  /* ---------- Waitlist ---------- */
  document.getElementById('join-form').addEventListener('submit', e => {
    e.preventDefault();
    const fd = Object.fromEntries(new FormData(e.target));
    try {
      const list = JSON.parse(localStorage.getItem('bmt-waitlist') || '[]'); list.push({ ...fd, at: Date.now() });
      localStorage.setItem('bmt-waitlist', JSON.stringify(list));
    } catch {}
    document.getElementById('join-msg').textContent = `Thanks ${fd.name.split(' ')[0]}. You're on the list.`;
    e.target.reset();
  });

  /* ---------- Nav + scroll reveal ---------- */
  const nav = document.getElementById('nav');
  const onScroll = () => nav.classList.toggle('scrolled', window.scrollY > 8);
  window.addEventListener('scroll', onScroll, { passive: true }); onScroll();
  const revealEls = [...document.querySelectorAll('.reveal')];
  const revealVisible = () => revealEls.forEach(el => { if (!el.classList.contains('in') && el.getBoundingClientRect().top < window.innerHeight * 0.92) el.classList.add('in'); });
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver(es => es.forEach(en => { if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); } }), { threshold: 0.08 });
    revealEls.forEach(el => io.observe(el));
  }
  window.addEventListener('scroll', revealVisible, { passive: true });
  setTimeout(revealVisible, 400); setTimeout(revealVisible, 1500);

  /* ---------- Calibration mode (?calib=1): drag corners and edge midpoints, copy JSON from the box ---------- */
  const calib = new URLSearchParams(location.search).has('calib');
  let calibOut;
  function renderCalibHandles(svg, view) {
    const ns = 'http://www.w3.org/2000/svg';
    for (const id of Object.keys(view.quads)) {
      if (Array.isArray(view.quads[id])) view.quads[id] = normPlacement(view.quads[id]);
      const pl = view.quads[id], f = surface({ ...pl, bow: [[0, 0], [0, 0], [0, 0], [0, 0]] });
      const mids = [f(0.5, 0), f(1, 0.5), f(0.5, 1), f(0, 0.5)];
      const handle = (p, cls, onMove) => {
        const c = document.createElementNS(ns, 'circle');
        c.setAttribute('class', 'calib-handle ' + cls); c.setAttribute('r', cls === 'mid' ? 7 : 9);
        c.setAttribute('cx', p[0]); c.setAttribute('cy', p[1]);
        c.addEventListener('pointerdown', ev => {
          ev.stopPropagation(); c.setPointerCapture(ev.pointerId);
          const move = mv => {
            const r = svg.getBoundingClientRect();
            onMove(Math.round((mv.clientX - r.left) / r.width * IMG_W), Math.round((mv.clientY - r.top) / r.height * IMG_H));
            renderFrame(); dumpCalib();
          };
          c.addEventListener('pointermove', move);
          c.addEventListener('pointerup', () => c.removeEventListener('pointermove', move), { once: true });
        });
        svg.appendChild(c);
      };
      pl.c.forEach(p => handle(p, 'corner', (x, y) => { p[0] = x; p[1] = y; }));
      mids.forEach((m, i) => handle([m[0] + pl.bow[i][0], m[1] + pl.bow[i][1]], 'mid', (x, y) => { pl.bow[i] = [x - m[0], y - m[1]]; }));
    }
  }
  function dumpCalib() {
    const v = viewById[state.view];
    const lines = Object.entries(v.quads).map(([id, p]) => {
      const pl = normPlacement(p);
      return `    "${id}": {"c": ${JSON.stringify(pl.c)}, "bow": ${JSON.stringify(pl.bow)}, "wrap": ${JSON.stringify(pl.wrap)}},`;
    });
    calibOut.value = `  "${v.id}": {\n${lines.join('\n')}\n  },`;
  }
  if (calib) {
    document.body.classList.add('calib');
    calibOut = document.createElement('textarea'); calibOut.id = 'calib-out'; document.body.appendChild(calibOut);
    state.demo = false;
  }
  window.__bmt = { VIEWS, state, renderFrame, frame, setView, selectSpot, stickerCache, meshOf, normPlacement, surface, basisToPoints, multmv };

  /* ---------- Boot ---------- */
  const qs = new URLSearchParams(location.search);
  if (qs.get('view') && viewById[qs.get('view')]) { state.view = qs.get('view'); layers[0].src = viewById[state.view].src; }
  if (qs.get('text')) { state.previewText = qs.get('text').slice(0, 24); document.getElementById('logo-text').value = state.previewText; }
  if (qs.get('spot') && spotById[qs.get('spot')]) state.selected = qs.get('spot');
  if (qs.has('shot')) document.body.classList.add('shot');
  if (qs.has('page')) document.body.classList.add('page');
  if (qs.get('at')) { document.documentElement.style.scrollBehavior = 'auto'; setTimeout(() => { const el = document.getElementById(qs.get('at')); if (el) el.scrollIntoView(); }, 300); }
  if (qs.has('nodemo')) { state.demo = false; document.getElementById('toggle-demo').checked = false; }
  if (qs.get('logo')) {
    fetch(qs.get('logo')).then(r => r.blob()).then(b => readLogo(new File([b], 'logo', { type: b.type }), (url, type) => { state.rawLogo = url; state.rawType = type; applyPreviewLogo(); })).catch(() => {});
  }
  renderTabs(); renderSheet(); renderCards(); renderSchematic(); renderStats(); renderFrame();
  if (state.selected) openSheet();
  probeStates();
  let resizeT;
  window.addEventListener('resize', () => { clearTimeout(resizeT); resizeT = setTimeout(renderFrame, 120); });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { stickerCache.clear(); renderFrame(); });
  window.addEventListener('load', renderFrame);
})();
