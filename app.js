/* Brand My Tesla — spot map, perspective decals, and a local demo auction.
   Bids are stored in localStorage for now. Swap `store` for a real backend when ready. */

(() => {
  'use strict';

  const IMG_W = 1792, IMG_H = 1008;
  const CLOSES_AT = new Date('2026-09-30T12:00:00-07:00');
  const MIN_RAISE = 50;

  /* ---------- Spots ---------- */
  const SPOTS = [
    { id: 'hood',     name: 'Hood',                where: 'Center of the hood, the marquee',      size: 'Large',  cm: '60 × 20 cm', in: '23.6 × 7.9 in',  floor: 1000, ratio: 3,       view: 'front34' },
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
    for (const [id, q] of Object.entries(quads)) {
      const m = q.map(([x, y]) => [IMG_W - x, y]);
      // viewer-facing order after a horizontal flip: TL'=mirror(TR), TR'=mirror(TL), BR'=mirror(BL), BL'=mirror(BR)
      out[rename[id] || id] = [m[1], m[0], m[3], m[2]];
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
  const state = { view: 'front34', selected: null, previewLogo: null, previewText: '', showOpen: true };

  const money = n => '$' + Math.round(n).toLocaleString('en-US');
  const topBid = id => bids[id] || null;
  const currentPrice = id => (bids[id] ? bids[id].amount : spotById[id].floor);
  const minBid = id => (bids[id] ? bids[id].amount + MIN_RAISE : spotById[id].floor);

  /* ---------- Rendering: car frames ---------- */
  function fitOverlay(frame) {
    const ov = frame.querySelector('.car-overlay');
    const k = frame.clientWidth / IMG_W;
    ov.style.transform = `scale(${k})`;
  }

  function decalContent(spot) {
    const held = topBid(spot.id);
    const el = document.createElement('div');
    if (held && held.logo) {
      el.className = 'decal vinyl';
      const img = document.createElement('img'); img.src = held.logo; img.alt = held.company;
      el.appendChild(img);
    } else if (held) {
      el.className = 'decal vinyl';
      el.appendChild(brandText(held.company, spot));
    } else if (state.previewLogo) {
      el.className = 'decal vinyl open';
      const img = document.createElement('img'); img.src = state.previewLogo; img.alt = 'Your logo';
      el.appendChild(img);
    } else if (state.previewText) {
      el.className = 'decal vinyl open';
      el.appendChild(brandText(state.previewText, spot));
    } else {
      el.className = 'decal open';
      const ph = document.createElement('div'); ph.className = 'ph';
      ph.innerHTML = `Your logo<small>${spot.name} · ${money(currentPrice(spot.id))}</small>`;
      el.appendChild(ph);
    }
    return el;
  }

  function brandText(text, spot) {
    const d = document.createElement('div'); d.className = 'brandtext'; d.textContent = text;
    return d;
  }

  function renderFrame(frame) {
    const view = viewById[frame.dataset.view];
    const img = frame.querySelector('.car-img');
    if (img.getAttribute('src') !== view.src) img.src = view.src;
    frame.classList.toggle('flip', !!view.flip);
    frame.classList.toggle('hide-open', !state.showOpen);
    const ov = frame.querySelector('.car-overlay');
    ov.innerHTML = '';
    const W = 600;
    for (const [id, q] of Object.entries(view.quads)) {
      const spot = spotById[id];
      const H = Math.round(W / spot.ratio);
      const d = decalContent(spot);
      d.style.width = W + 'px'; d.style.height = H + 'px';
      d.style.transform = quadTransform(W, H, q);
      d.style.fontSize = Math.round(H * 0.42) + 'px';
      const ph = d.querySelector('.ph'); if (ph) ph.style.fontSize = Math.round(H * 0.26) + 'px';
      const bt = d.querySelector('.brandtext'); if (bt) fitText(bt, W, H);
      d.dataset.spot = id;
      ov.appendChild(d);
    }
    const hits = frame.querySelector('.car-hits');
    if (hits) renderHits(hits, view);
    fitOverlay(frame);
  }

  function fitText(el, w, h) {
    const len = Math.max(el.textContent.length, 3);
    el.style.fontSize = Math.min(h * 0.72, (w * 0.9) / (len * 0.68)) + 'px';
  }

  function renderHits(svg, view) {
    svg.innerHTML = '';
    const ns = 'http://www.w3.org/2000/svg';
    for (const [id, q] of Object.entries(view.quads)) {
      const poly = document.createElementNS(ns, 'polygon');
      poly.setAttribute('points', q.map(p => p.join(',')).join(' '));
      poly.dataset.spot = id;
      if (state.selected === id) poly.classList.add('selected');
      poly.addEventListener('click', () => selectSpot(id, false));
      const t = document.createElementNS(ns, 'title'); t.textContent = `${spotById[id].name} · ${money(currentPrice(id))}`;
      poly.appendChild(t);
      svg.appendChild(poly);
    }
    // Price tag for the selected spot
    if (state.selected && view.quads[state.selected]) {
      const q = view.quads[state.selected];
      const cx = (q[0][0] + q[1][0] + q[2][0] + q[3][0]) / 4;
      const top = Math.min(q[0][1], q[1][1]);
      const label = `${spotById[state.selected].name}  ·  ${money(currentPrice(state.selected))}`;
      const w = label.length * 12 + 28, h = 38;
      const g = document.createElementNS(ns, 'g');
      const r = document.createElementNS(ns, 'rect');
      r.setAttribute('class', 'tag-bg'); r.setAttribute('rx', 19);
      r.setAttribute('x', cx - w / 2); r.setAttribute('y', top - h - 14); r.setAttribute('width', w); r.setAttribute('height', h);
      const tx = document.createElementNS(ns, 'text');
      tx.setAttribute('class', 'tag'); tx.setAttribute('x', cx); tx.setAttribute('y', top - h - 14 + 26); tx.setAttribute('text-anchor', 'middle');
      tx.textContent = label;
      g.appendChild(r); g.appendChild(tx); svg.appendChild(g);
    }
    if (calib) renderCalibHandles(svg, view);
  }

  const heroFrame = document.getElementById('hero-frame');
  const studioFrame = document.getElementById('studio-frame');
  function renderAll() {
    heroFrame.dataset.view = 'front34';
    renderFrame(heroFrame);
    studioFrame.dataset.view = state.view;
    renderFrame(studioFrame);
    renderTabs(); renderSpotList(); renderSpotDetail(); renderTable(); renderStats();
  }
  window.addEventListener('resize', () => { fitOverlay(heroFrame); fitOverlay(studioFrame); });

  /* ---------- View tabs + turning ---------- */
  const tabs = document.getElementById('view-tabs');
  function renderTabs() {
    tabs.innerHTML = '';
    for (const v of VIEWS) {
      const b = document.createElement('button');
      b.type = 'button'; b.role = 'tab'; b.textContent = v.label;
      b.setAttribute('aria-selected', v.id === state.view ? 'true' : 'false');
      b.addEventListener('click', () => setView(v.id));
      tabs.appendChild(b);
    }
  }
  function setView(id) {
    state.view = id;
    studioFrame.dataset.view = id;
    renderFrame(studioFrame); renderTabs();
  }
  function turn(dir) {
    const i = VIEWS.findIndex(v => v.id === state.view);
    setView(VIEWS[(i + dir + VIEWS.length) % VIEWS.length].id);
  }
  studioFrame.querySelector('.turn-prev').addEventListener('click', e => { e.stopPropagation(); turn(-1); });
  studioFrame.querySelector('.turn-next').addEventListener('click', e => { e.stopPropagation(); turn(1); });
  studioFrame.addEventListener('keydown', e => {
    if (e.key === 'ArrowLeft') { turn(-1); e.preventDefault(); }
    if (e.key === 'ArrowRight') { turn(1); e.preventDefault(); }
  });
  // Drag to turn
  let drag = null;
  studioFrame.addEventListener('pointerdown', e => {
    if (calib || e.target.closest('.turn')) return;
    drag = { x: e.clientX, moved: 0 };
    studioFrame.setPointerCapture(e.pointerId);
  });
  studioFrame.addEventListener('pointermove', e => {
    if (!drag) return;
    const dx = e.clientX - drag.x;
    if (Math.abs(dx) > 70) { turn(dx > 0 ? 1 : -1); drag.x = e.clientX; drag.moved++; studioFrame.classList.add('dragging'); }
  });
  const endDrag = () => { drag = null; studioFrame.classList.remove('dragging'); };
  studioFrame.addEventListener('pointerup', endDrag);
  studioFrame.addEventListener('pointercancel', endDrag);

  document.getElementById('toggle-outlines').addEventListener('change', e => {
    state.showOpen = e.target.checked; renderFrame(studioFrame); renderFrame(heroFrame);
  });

  /* ---------- Selection ---------- */
  function selectSpot(id, jumpView) {
    state.selected = id;
    if (jumpView && !viewById[state.view].quads[id]) setView(spotById[id].view);
    renderFrame(studioFrame); renderSpotList(); renderSpotDetail();
  }

  const spotList = document.getElementById('spot-list');
  function renderSpotList() {
    spotList.innerHTML = '';
    for (const s of SPOTS) {
      const li = document.createElement('li');
      if (s.id === state.selected) li.classList.add('selected');
      const b = topBid(s.id);
      li.innerHTML = `<div class="sl-name">${s.name}</div><div class="sl-price">${money(currentPrice(s.id))}<small>${b ? b.company : 'floor'}</small></div><div class="sl-meta">${s.size} · ${s.cm}</div>`;
      li.addEventListener('click', () => selectSpot(s.id, true));
      spotList.appendChild(li);
    }
  }

  const detail = document.getElementById('spot-detail');
  function renderSpotDetail() {
    if (!state.selected) {
      detail.innerHTML = `<div class="panel-eyebrow">Selected spot</div><div class="spot-empty">Click a panel on the car, or pick one from the list below.</div>`;
      return;
    }
    const s = spotById[state.selected]; const b = topBid(s.id);
    detail.innerHTML = `
      <div class="panel-eyebrow">Selected spot</div>
      <div class="spot-detail-name">${s.name}</div>
      <div class="spot-detail-where">${s.where}</div>
      <div class="spot-detail-grid">
        <div><div class="k">Current ${b ? 'bid' : 'floor'}</div><div class="v big">${money(currentPrice(s.id))}</div></div>
        <div><div class="k">Held by</div><div class="v">${b ? b.company : 'Open'}</div></div>
        <div><div class="k">Size</div><div class="v"><span class="size-pill ${s.size.toLowerCase()}">${s.size}</span></div></div>
        <div><div class="k">Vinyl</div><div class="v">${s.cm}<br><span class="small">${s.in}</span></div></div>
      </div>
      <div class="spot-detail-actions">
        <button class="btn btn-dark btn-sm" type="button" data-bid="${s.id}">Bid ${money(minBid(s.id))}+</button>
        <button class="btn btn-ghost btn-sm" type="button" data-view-of="${s.id}">Best angle</button>
      </div>`;
    detail.querySelector('[data-bid]').addEventListener('click', () => openBid(s.id));
    detail.querySelector('[data-view-of]').addEventListener('click', () => setView(s.view));
  }

  /* ---------- Table + stats ---------- */
  const tbody = document.querySelector('#auction-table tbody');
  function renderTable() {
    tbody.innerHTML = '';
    for (const s of SPOTS) {
      const b = topBid(s.id);
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><div class="t-name">${s.name}</div><div class="t-sub">${s.where}</div></td>
        <td><span class="size-pill ${s.size.toLowerCase()}">${s.size}</span><div class="t-sub" style="margin-top:6px">${s.cm} · ${s.in}</div></td>
        <td>${b ? `<div class="holder">${b.logo ? `<img src="${b.logo}" alt="">` : ''}<span>${b.company}</span></div>` : '<span class="holder"><span class="dash">—</span></span>'}</td>
        <td><div class="t-price">${money(currentPrice(s.id))}<small>${b ? '1 bid' : '0 bids · floor'}</small></div></td>
        <td style="text-align:right"><button class="btn btn-dark btn-sm" type="button">Bid</button></td>`;
      tr.querySelector('button').addEventListener('click', () => openBid(s.id));
      tr.querySelector('.t-name').style.cursor = 'pointer';
      tr.querySelector('.t-name').addEventListener('click', () => { selectSpot(s.id, true); document.getElementById('car').scrollIntoView({ behavior: 'smooth' }); });
      tbody.appendChild(tr);
    }
  }
  function renderStats() {
    const held = SPOTS.filter(s => bids[s.id]);
    const raised = held.reduce((a, s) => a + bids[s.id].amount, 0);
    document.getElementById('stat-raised').textContent = money(raised);
    document.getElementById('stat-raised-label').textContent = `raised · ${held.length} of ${SPOTS.length} spots with bids`;
    document.getElementById('stat-bar').style.width = (held.length / SPOTS.length * 100) + '%';
    const t = document.getElementById('ticker');
    if (!held.length) t.innerHTML = '<span>Auction is open. No bids yet, floors are live.</span>';
    else {
      const latest = held.map(s => ({ s, b: bids[s.id] })).sort((a, b) => b.b.at - a.b.at)[0];
      t.innerHTML = `<span><strong>${latest.b.company}</strong> holds the ${latest.s.name.toLowerCase()} at ${money(latest.b.amount)}. ${SPOTS.length - held.length} spots still open at floor.</span>`;
    }
  }
  function tickCountdown() {
    const ms = CLOSES_AT - Date.now();
    const el = document.getElementById('countdown');
    if (ms <= 0) { el.textContent = 'Closed'; return; }
    const d = Math.floor(ms / 864e5), h = Math.floor(ms % 864e5 / 36e5), m = Math.floor(ms % 36e5 / 6e4);
    el.textContent = `${d}d ${h}h ${m}m`;
  }
  tickCountdown(); setInterval(tickCountdown, 30000);

  /* ---------- Logo preview ---------- */
  function readLogo(file, cb) {
    if (!file) return;
    const fr = new FileReader();
    fr.onload = () => {
      if (file.type === 'image/svg+xml') return cb(fr.result);
      // Downscale rasters so localStorage stays small and rendering stays quick
      const im = new Image();
      im.onload = () => {
        const max = 900, k = Math.min(1, max / Math.max(im.width, im.height));
        const c = document.createElement('canvas'); c.width = Math.round(im.width * k); c.height = Math.round(im.height * k);
        c.getContext('2d').drawImage(im, 0, 0, c.width, c.height);
        cb(c.toDataURL('image/png'));
      };
      im.src = fr.result;
    };
    fr.readAsDataURL(file);
  }
  document.getElementById('logo-input').addEventListener('change', e => {
    readLogo(e.target.files[0], url => { state.previewLogo = url; state.previewText = ''; document.getElementById('logo-text').value = ''; renderFrame(studioFrame); renderFrame(heroFrame); });
  });
  document.getElementById('logo-text').addEventListener('input', e => {
    state.previewText = e.target.value.trim(); state.previewLogo = null; renderFrame(studioFrame); renderFrame(heroFrame);
  });
  document.getElementById('logo-clear').addEventListener('click', () => {
    state.previewLogo = null; state.previewText = ''; document.getElementById('logo-text').value = ''; document.getElementById('logo-input').value = '';
    renderFrame(studioFrame); renderFrame(heroFrame);
  });

  /* ---------- Bidding ---------- */
  const modal = document.getElementById('bid-modal');
  const bidForm = document.getElementById('bid-form');
  let bidSpot = null;
  function openBid(id) {
    bidSpot = id;
    const s = spotById[id]; const b = topBid(id);
    document.getElementById('bid-title').textContent = s.name;
    document.getElementById('bid-sub').textContent = `${s.size} · ${s.cm}. ${b ? `${b.company} holds it at ${money(b.amount)}. Minimum raise is ${money(MIN_RAISE)}.` : `Floor is ${money(s.floor)}.`}`;
    const amt = document.getElementById('bid-amount');
    amt.min = minBid(id); amt.value = minBid(id);
    modal.hidden = false;
    setTimeout(() => amt.focus(), 50);
  }
  function closeBid() { modal.hidden = true; bidForm.reset(); }
  document.getElementById('bid-close').addEventListener('click', closeBid);
  modal.addEventListener('click', e => { if (e.target === modal) closeBid(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && !modal.hidden) closeBid(); });
  bidForm.addEventListener('submit', e => {
    e.preventDefault();
    const fd = new FormData(bidForm);
    const amount = Number(fd.get('amount'));
    if (amount < minBid(bidSpot)) { alert(`Minimum bid for this spot is ${money(minBid(bidSpot))}.`); return; }
    const commit = logo => {
      bids[bidSpot] = { amount, company: String(fd.get('company')).trim(), name: String(fd.get('name')).trim(), email: String(fd.get('email')).trim(), logo: logo || null, at: Date.now() };
      store.save(bids);
      closeBid();
      selectSpot(bidSpot, true);
      renderAll();
    };
    const file = document.getElementById('bid-logo').files[0];
    if (file) readLogo(file, commit); else commit(null);
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

  /* ---------- Calibration mode (?calib=1): drag corners, copy JSON from the box ---------- */
  const calib = new URLSearchParams(location.search).has('calib');
  let calibOut;
  function renderCalibHandles(svg, view) {
    const ns = 'http://www.w3.org/2000/svg';
    for (const [id, q] of Object.entries(view.quads)) {
      q.forEach((p, i) => {
        const c = document.createElementNS(ns, 'circle');
        c.setAttribute('class', 'calib-handle'); c.setAttribute('r', 9);
        c.setAttribute('cx', p[0]); c.setAttribute('cy', p[1]);
        c.addEventListener('pointerdown', ev => {
          ev.stopPropagation(); c.setPointerCapture(ev.pointerId);
          const move = mv => {
            const r = svg.getBoundingClientRect();
            p[0] = Math.round((mv.clientX - r.left) / r.width * IMG_W);
            p[1] = Math.round((mv.clientY - r.top) / r.height * IMG_H);
            renderFrame(studioFrame); dumpCalib();
          };
          c.addEventListener('pointermove', move);
          c.addEventListener('pointerup', () => c.removeEventListener('pointermove', move), { once: true });
        });
        svg.appendChild(c);
      });
    }
  }
  function dumpCalib() {
    const v = viewById[state.view];
    calibOut.value = `'${v.id}': ` + JSON.stringify(v.quads).replace(/\],\[\[/g, '],\n  [[');
  }
  if (calib) {
    document.body.classList.add('calib');
    calibOut = document.createElement('textarea'); calibOut.id = 'calib-out'; document.body.appendChild(calibOut);
    state.showOpen = true;
  }
  window.__bmt = { VIEWS, state, renderFrame, studioFrame, setView, selectSpot };

  /* ---------- Go ---------- */
  // Deep links: ?view=rear34&spot=trunk&text=ACME (handy for sharing a specific angle)
  const qs = new URLSearchParams(location.search);
  if (qs.get('view') && viewById[qs.get('view')]) state.view = qs.get('view');
  if (qs.get('text')) { state.previewText = qs.get('text').slice(0, 24); document.getElementById('logo-text').value = state.previewText; }
  if (qs.get('spot') && spotById[qs.get('spot')]) state.selected = qs.get('spot');
  if (qs.has('shot')) document.body.classList.add('shot');
  renderAll();
  window.addEventListener('load', () => { fitOverlay(heroFrame); fitOverlay(studioFrame); });
})();
