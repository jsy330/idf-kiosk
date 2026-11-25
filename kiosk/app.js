/* IDF 키오스크 — 빌드 과정 없는 정적 웹앱 */
(function () {
  'use strict';

  const IDLE_MS = 90 * 1000;              // 90초 동안 터치가 없으면 홈으로
  const CSV_URL = 'data/equipment.csv';
  const LS_CSV = 'idf-equipment-csv';
  const LS_THEME = 'idf-theme';
  const STATUS_LABEL = { available: '사용 가능', 'in-use': '사용 중', maintenance: '점검 중' };

  const state = { items: [], filter: {}, gameStop: null };
  const $ = (s, el = document) => el.querySelector(s);
  const view = $('#view');

  /* ───────── 유틸 ───────── */
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  // CSV의 "/images/..." 경로를 어느 주소에서든 열리도록 상대경로로
  const asset = (p) => (p ? String(p).trim().replace(/^\.?\//, '') : '');
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

  // 따옴표·줄바꿈을 지원하는 CSV 파서
  function parseCSV(text) {
    text = text.replace(/^﻿/, '');
    const rows = []; let row = []; let field = ''; let q = false;
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (q) {
        if (c === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else q = false; }
        else field += c;
      } else if (c === '"') q = true;
      else if (c === ',') { row.push(field); field = ''; }
      else if (c === '\n' || c === '\r') {
        if (c === '\r' && text[i + 1] === '\n') i++;
        row.push(field); rows.push(row); row = []; field = '';
      } else field += c;
    }
    if (field || row.length) { row.push(field); rows.push(row); }
    const ok = rows.filter((r) => r.some((v) => v.trim() !== ''));
    if (!ok.length) return [];
    const head = ok[0].map((h) => h.trim().toLowerCase());
    return ok.slice(1).map((r) => Object.fromEntries(head.map((h, i) => [h, r[i] ?? ''])));
  }

  function toItems(csvText) {
    const norm = (v) => String(v ?? '').replace(/\r\n?/g, '\n').replace(/\\n/g, '\n').replace(/\t/g, ' ').trim();
    return parseCSV(csvText).map((r, i) => {
      const st = norm(r.status).toLowerCase();
      return {
        id: norm(r.id) || String(100000 + i),
        name: norm(r.name),
        category: norm(r.category).toLowerCase() === 'tool' ? 'tool' : 'machine',
        location: norm(r.location),
        zone: norm(r.zone),
        status: st === 'in-use' ? 'in-use' : st === 'maintenance' ? 'maintenance' : 'available',
        description: norm(r.description),
        manual: norm(r.manual),
        safety: norm(r.safety),
        emoji: norm(r.emoji),
        imageUrl: norm(r.imageurl),
        locationImageUrl: norm(r.locationimageurl),
      };
    }).filter((x) => x.name);
  }

  async function loadData() {
    const local = localStorage.getItem(LS_CSV);
    if (local && toItems(local).length) { state.items = toItems(local); return; }
    try {
      const res = await fetch(CSV_URL, { cache: 'no-cache' });
      if (res.ok) state.items = toItems(await res.text());
    } catch (e) { /* 오프라인이면 서비스워커 캐시가 응답 */ }
  }

  /* ───────── 아이콘 ───────── */
  const ICON = {
    arrow: '<svg viewBox="0 0 24 24"><path d="M7 17 17 7M9 7h8v8"/></svg>',
    back: '<svg viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7"/></svg>',
    pin: '<svg viewBox="0 0 24 24"><path d="M12 21s7-6.2 7-11.5A7 7 0 0 0 5 9.5C5 14.8 12 21 12 21Z"/><circle cx="12" cy="9.5" r="2.5"/></svg>',
    info: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/></svg>',
    list: '<svg viewBox="0 0 24 24"><path d="M9 6h11M9 12h11M9 18h11M4 6h.01M4 12h.01M4 18h.01"/></svg>',
    cal: '<svg viewBox="0 0 24 24"><rect x="3.5" y="5" width="17" height="15" rx="2.5"/><path d="M3.5 10h17M8 3v4M16 3v4"/></svg>',
    clock: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/></svg>',
    warn: '<svg viewBox="0 0 24 24"><path d="M12 3 2 20h20L12 3Z"/><path d="M12 10v4M12 17h.01"/></svg>',
    game: '<svg viewBox="0 0 24 24"><rect x="2.5" y="7" width="19" height="11" rx="5.5"/><path d="M7 10.5v4M5 12.5h4"/><circle cx="15.5" cy="11.5" r=".6" fill="currentColor"/><circle cx="17.5" cy="13.8" r=".6" fill="currentColor"/></svg>',
    cookie: '<svg viewBox="0 0 24 24"><path d="M3 14.5C3 9.5 7 5.5 12 5.5s9 4 9 9c0 1.6-1.6 2.6-3 1.9l-3.2-1.6a6 6 0 0 0-5.6 0L6 16.4c-1.4.7-3-.3-3-1.9Z"/><path d="M12 5.5c-1 3-1 6 0 9"/><path d="M13.5 15.5l2.5 4"/></svg>',
  };

  /* ───────── 홈 ───────── */
  function counts(cat) {
    const list = state.items.filter((x) => x.category === cat);
    return { total: list.length };
  }

  function renderHome() {
    const m = counts('machine'), t = counts('tool');
    const tile = (route, title, sub, iconHtml, extra = '') => `
      <button class="menu-tile pressable ${extra}" data-go="${route}">
        <span class="arrow">${ICON.arrow}</span>
        <span class="tile-icon">${iconHtml}</span>
        <span><h2>${title}</h2><p>${sub}</p></span>
      </button>`;
    const mask = (name) => `<i style="--icon:url('images/menu_black/${name}.png')"></i>`;
    view.innerHTML = `
      <div class="home">
        <section class="hero">
          <div class="eyebrow">IDEA DREAM FACTORY</div>
          <h1>IDF에 오신 것을 환영합니다.</h1>
          <p>여러분의 아이디어를 함께 실현해드립니다. 원하시는 메뉴를 터치해주세요.</p>
          <div class="hero-stats">
            <span class="stat">장비 <b>${m.total}</b>대</span>
            <span class="stat">공구 <b>${t.total}</b>종</span>
          </div>
        </section>
        <div class="menu-grid">
          ${tile('tool', '공구 안내', '사용 가능한 공구 정보를 제공합니다.', mask('tool'))}
          ${tile('machine', '장비 안내', '주요 장비의 위치와 사용법을 안내합니다.', mask('machine'))}
          ${tile('map', '시설 안내', 'IDF 공간 위치를 안내합니다.', mask('map'))}
          ${tile('game', '잠깐 쉬어가기', '터치 한 번으로 즐기는 미니 게임', ICON.game, 'accent')}
          ${tile('fortune', '오늘의 포춘쿠키', '쿠키를 깨고 오늘의 행운을 확인해보세요.', ICON.cookie, 'wide')}
        </div>
      </div>`;
  }

  /* ───────── 시설 안내 ───────── */
  function renderMap() {
    const tabs = [['전체', 'images/IDF_map.png'], ['공구 A구역', 'images/map/A.png'], ['공구 B구역', 'images/map/B.png'], ['공구 C구역', 'images/map/C.png']];
    const cur = state.filter.map ?? 0;
    view.innerHTML = `
      <div>
        <div class="page-head"><h1>시설 안내</h1></div>
        <div class="chips">${tabs.map((t, i) => `<button class="chip" data-map="${i}" aria-pressed="${i === cur}">${t[0]}</button>`).join('')}</div>
        <div class="map-card">
          <div class="map-frame"><img src="${tabs[cur][1]}" alt="${tabs[cur][0]} 지도" /></div>
          <p class="map-caption">학생회관 205호 · 출입구는 지도 아래쪽에 있습니다.</p>
        </div>
      </div>`;
  }

  /* ───────── 목록 ───────── */
  const areaLabel = (loc) => (/^[A-Z]$/i.test(loc) ? `${loc.toUpperCase()}구역` : loc);
  const whereText = (x) => [areaLabel(x.location), x.zone && x.zone !== x.location && x.zone !== '장비구역' ? x.zone : ''].filter(Boolean).join(' · ');
  const plate = (x, lazy, big) => `<div class="plate">${x.imageUrl
    ? `<img src="${esc(asset(x.imageUrl))}" alt="" ${lazy ? 'loading="lazy"' : ''} />`
    : `<span class="emoji"${big ? ' style="font-size:5rem"' : ''}>${esc(x.emoji || '📦')}</span>`}</div>`;

  function renderList(cat) {
    const title = cat === 'tool' ? '공구 안내' : '장비 안내';
    const all = state.items.filter((x) => x.category === cat);
    const areas = [...new Set(all.map((x) => x.location).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'ko', { numeric: true }));
    const f = state.filter[cat] ?? '';
    const list = f ? all.filter((x) => x.location === f) : all;
    view.dataset.cat = cat;
    view.innerHTML = `
      <div>
        <div class="page-head"><h1>${title}</h1><span class="count">${list.length}개</span></div>
        ${areas.length > 1 ? `<div class="chips">
          <button class="chip" data-area="" aria-pressed="${!f}">전체</button>
          ${areas.map((a) => `<button class="chip" data-area="${esc(a)}" aria-pressed="${a === f}">${esc(areaLabel(a))}</button>`).join('')}
        </div>` : ''}
        ${list.length ? `<div class="item-grid">${list.map((x) => `
          <button class="item-card pressable" data-item="${esc(x.id)}">
            ${plate(x, true)}
            <div class="meta">
              <h3>${esc(x.name)}</h3>
              ${whereText(x) ? `<div class="where">${esc(whereText(x))}</div>` : ''}
              ${x.status !== 'available' ? `<span class="status ${x.status}">${STATUS_LABEL[x.status]}</span>` : ''}
            </div>
          </button>`).join('')}</div>`
          : `<div class="empty"><strong>목록이 비어 있습니다</strong>data/equipment.csv 파일을 확인해주세요.</div>`}
      </div>`;
  }

  /* ───────── 상세 ───────── */
  const toLines = (text) => String(text || '').split('\n')
    .map((l) => l.trim().replace(/^([–—\-•·*]|\d+[.)])\s*/, '').trim()).filter(Boolean);
  // 예약·교육·대행 같은 "이용 방법" 문장은 안전 수칙과 따로 모아서 보여줌
  const isGuide = (l) => /예약|교육 신청|대행|방문|담당자|이용 가능|최대\s*\d+\s*시간/.test(l);

  function renderDetail(cat, id) {
    const x = state.items.find((i) => i.id === id && i.category === cat);
    if (!x) return go(cat);
    const desc = toLines(x.description), safe = toLines(x.safety), steps = toLines(x.manual);
    const intro = desc.filter((l) => !isGuide(l));
    const guide = [...desc.filter(isGuide), ...safe.filter(isGuide)];
    const safety = safe.filter((l) => !isGuide(l));
    const all = desc.concat(safe).join(' ');
    const hours = /최대\s*(\d+)\s*시간/.exec(all);
    const tags = [
      whereText(x) && `<span class="tag">${ICON.pin}${esc(whereText(x))}</span>`,
      /대행/.test(all) ? `<span class="tag reserve">${ICON.cal}대행 출력 · 방문 예약</span>`
        : /예약/.test(all) ? `<span class="tag reserve">${ICON.cal}예약 필요</span>` : '',
      hours ? `<span class="tag reserve">${ICON.clock}최대 ${hours[1]}시간</span>` : '',
    ].filter(Boolean).join('');
    const locImg = asset(x.locationImageUrl);
    const kind = cat === 'tool' ? '공구' : '장비';

    view.innerHTML = `
      <div>
        <button class="back-btn pressable" data-go="${cat}">${ICON.back}<span>${kind} 목록</span></button>
        <section class="detail-hero">
          ${plate(x, false, true)}
          <div>
            <span class="status lg ${x.status}">${STATUS_LABEL[x.status]}</span>
            <h1>${esc(x.name)}</h1>
            <div class="tags">${tags}</div>
          </div>
        </section>
        <div class="sections">
          ${intro.length ? `
          <section class="section">
            <h2 class="section-title"><span class="badge loc">${ICON.info}</span>${kind} 소개</h2>
            <ul class="points">${intro.map((l) => `<li><span>${esc(l)}</span></li>`).join('')}</ul>
          </section>` : ''}
          ${steps.length ? `
          <section class="section">
            <h2 class="section-title"><span class="badge how">${ICON.list}</span>사용 방법</h2>
            <ul class="points">${steps.map((l) => `<li><span>${esc(l)}</span></li>`).join('')}</ul>
          </section>` : ''}
          ${guide.length ? `
          <section class="section">
            <h2 class="section-title"><span class="badge guide">${ICON.cal}</span>이용 안내</h2>
            <div class="guide-box">${guide.map((l) => `<p><span>${esc(l)}</span></p>`).join('')}</div>
          </section>` : ''}
          ${safety.length ? `
          <section class="section">
            <h2 class="section-title"><span class="badge safe">${ICON.warn}</span>안전 수칙</h2>
            <ul class="bullets">${safety.map((l) => `<li><span>${esc(l)}</span></li>`).join('')}</ul>
          </section>` : ''}
          ${x.location || locImg ? `
          <section class="section">
            <h2 class="section-title"><span class="badge loc">${ICON.pin}</span>위치</h2>
            <div class="loc-row">
              <div class="loc-text"><strong>${esc(areaLabel(x.location))}</strong>${x.zone && x.zone !== x.location ? `<span>${esc(x.zone)}</span>` : ''}</div>
              ${locImg ? `<div class="loc-map"><img src="${esc(locImg)}" alt="위치 지도" data-fallback="images/IDF_map.png" /></div>` : ''}
            </div>
          </section>` : ''}
        </div>
      </div>`;
    // 위치 그림이 없으면 전체 시설 지도로 대신 표시
    const li = $('.loc-map img', view);
    if (li) li.addEventListener('error', () => {
      if (li.dataset.fallback) { li.src = li.dataset.fallback; delete li.dataset.fallback; } else li.parentElement.remove();
    });
  }

  /* ───────── 미니 게임 ───────── */
  function renderGame() {
    view.innerHTML = `
      <div class="game-wrap">
        <div class="page-head"><h1>잠깐 쉬어가기</h1></div>
        <div class="game-hud">
          <span class="stat">점수 <b id="g-score">0</b></span>
          <span class="stat">최고 기록 <b id="g-best">0</b></span>
        </div>
        <div class="game-card" id="game-card"><canvas id="game-canvas"></canvas></div>
        <p class="game-help">화면을 터치하면 점프! 날아오는 드론과 부품을 피하세요.</p>
      </div>`;
    state.gameStop = window.IDFGame.mount($('#game-card'), $('#g-score'), $('#g-best'));
  }

  /* ───────── 포춘쿠키 ───────── */
  const FORTUNES = [
    '오늘 떠올린 아이디어, 메모해 두세요. 언젠가 작품이 됩니다.',
    '첫 출력이 실패해도 괜찮아요. 두 번째가 진짜입니다.',
    '생각보다 일이 술술 풀리는 하루가 될 거예요.',
    '오늘은 도움을 청하면 좋은 사람을 만나게 됩니다.',
    '작은 시제품 하나가 큰 기회를 불러옵니다.',
    '측정은 두 번, 자르기는 한 번. 오늘은 그게 행운의 비결이에요.',
    '팀원에게 건넨 칭찬 한마디가 프로젝트를 살립니다.',
    '막혔던 문제의 답이 의외의 곳에서 나타납니다.',
    '오늘 만든 것이 누군가에게 큰 영감이 됩니다.',
    '서두르지 않으면 더 멋진 결과가 나옵니다.',
    '새로운 장비에 도전하기 딱 좋은 날이에요.',
    '실패한 출력물에도 배울 점이 숨어 있어요.',
    '오늘의 당신은 생각보다 훨씬 손재주가 좋습니다.',
    '기다리던 좋은 소식이 곧 찾아옵니다.',
    '쉬어가는 것도 실력입니다. 물 한 잔 마시고 다시 시작해요.',
    '정리정돈을 하면 행운이 따라옵니다. 공구는 제자리에!',
    '오늘 시작한 일은 끝까지 해낼 수 있어요.',
    '당신의 아이디어를 응원하는 사람이 가까이 있습니다.',
    '처음 해보는 일에서 숨은 재능을 발견하게 됩니다.',
    '오늘은 계획대로 착착 진행되는 날이에요.',
    '모든 대작은 엉성한 스케치에서 시작됐어요.',
    '작업이 끝나면 꼭 스스로를 칭찬해 주세요.',
    '예상치 못한 실수가 최고의 디자인이 될지도 몰라요.',
    '꾸준함이 오늘 빛을 발합니다.',
    '좋은 결과를 위해 한 번 더 확인하세요. 행운이 함께합니다.',
  ];
  const COLORS = [['초록', '#2c8a4b'], ['하늘', '#7fc4ef'], ['노랑', '#f2c94c'], ['주황', '#f08a3c'], ['보라', '#9b7be0'], ['분홍', '#f29bb7'], ['남색', '#2f4a8a'], ['민트', '#6fd3b8'], ['빨강', '#e05545'], ['하양', '#ffffff']];

  const cookieSvg = `
    <svg viewBox="0 0 300 200" aria-hidden="true">
      <ellipse cx="150" cy="184" rx="118" ry="9" fill="rgb(0 0 0 / .08)"/>
      <path d="M141 112h22l6 50h-34Z" fill="#fffdf6" stroke="#e6dcc4" stroke-width="1.5"/>
      <g class="half l">
        <path d="M150 28C85 28 30 82 20 152c40 14 85-6 130-34Z" fill="#ebb75a"/>
        <path d="M20 152c40 14 85-6 130-34-22 32-72 56-130 34Z" fill="#c98a2c"/>
        <path d="M150 28c-26 30-30 64 0 90Z" fill="#d89d3e"/>
        <path d="M52 100c12-26 34-46 62-56" stroke="#f7d896" stroke-width="7" stroke-linecap="round" fill="none"/>
      </g>
      <g class="half r">
        <path d="M150 28c65 0 120 54 130 124-40 14-85-6-130-34Z" fill="#e8b153"/>
        <path d="M280 152c-40 14-85-6-130-34 22 32 72 56 130 34Z" fill="#b97c22"/>
        <path d="M150 28c26 30 30 64 0 90Z" fill="#c98f34"/>
      </g>
    </svg>`;

  function renderFortune() {
    view.innerHTML = `
      <div>
        <div class="page-head"><h1>오늘의 포춘쿠키</h1></div>
        <section class="fortune" id="fortune">
          <button class="cookie-btn idle" id="cookie" aria-label="포춘쿠키 깨기">${cookieSvg}</button>
          <p class="fortune-hint" id="fortune-hint">쿠키를 터치해서 깨보세요!</p>
        </section>
      </div>`;
  }

  function crackCookie() {
    const btn = $('#cookie');
    if (!btn || btn.classList.contains('open')) return;
    btn.classList.remove('idle'); btn.classList.add('open');
    const pool = state.items.length ? state.items : [{ name: '레이저 커터' }];
    const color = pick(COLORS);
    const num = 1 + Math.floor(Math.random() * 99);
    setTimeout(() => {
      const box = $('#fortune');
      if (!box) return;
      $('#fortune-hint').remove();
      btn.style.display = 'none';
      box.insertAdjacentHTML('beforeend', `
        <div class="slip">
          <div class="label">TODAY'S FORTUNE</div>
          <p class="msg">${esc(pick(FORTUNES))}</p>
        </div>
        <div class="lucky">
          <div><small>행운의 장비</small><b>${esc(pick(pool).name)}</b></div>
          <div><small>행운의 숫자</small><b>${num}</b></div>
          <div><small>행운의 색</small><b><span class="dot" style="background:${color[1]}"></span>${color[0]}</b></div>
        </div>
        <button class="again" data-go="fortune-again">한 번 더 뽑기</button>`);
    }, 450);
  }

  /* ───────── 라우팅 (#/machine/3 형태) ───────── */
  function go(route) { location.hash = '#/' + route; }
  function render() {
    if (state.gameStop) { state.gameStop(); state.gameStop = null; }
    const [page, id] = location.hash.replace(/^#\/?/, '').split('/');
    $('#home-btn').hidden = !page;
    if (page === 'map') renderMap();
    else if (page === 'machine' || page === 'tool') id ? renderDetail(page, decodeURIComponent(id)) : renderList(page);
    else if (page === 'game') renderGame();
    else if (page === 'fortune') renderFortune();
    else renderHome();
    view.classList.toggle('is-home', !page);
    view.scrollTop = 0;
  }

  view.addEventListener('click', (e) => {
    if (e.target.closest('#cookie')) return crackCookie();
    const t = e.target.closest('[data-go],[data-item],[data-area],[data-map]');
    if (!t) return;
    if (t.dataset.go === 'fortune-again') renderFortune();
    else if (t.dataset.go) go(t.dataset.go);
    else if (t.dataset.item) go(`${view.dataset.cat}/${encodeURIComponent(t.dataset.item)}`);
    else if (t.dataset.area !== undefined) { state.filter[view.dataset.cat] = t.dataset.area; renderList(view.dataset.cat); }
    else if (t.dataset.map !== undefined) { state.filter.map = Number(t.dataset.map); renderMap(); }
  });
  $('#home-btn').addEventListener('click', () => go(''));
  window.addEventListener('hashchange', render);

  /* ───────── 테마 ───────── */
  $('#theme-btn').addEventListener('click', () => {
    const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    localStorage.setItem(LS_THEME, next);
    document.querySelector('meta[name=theme-color]').content = next === 'dark' ? '#0f1110' : '#f2f2ee';
    window.dispatchEvent(new Event('themechange'));
  });

  /* ───────── 시계 ───────── */
  // 라즈베리파이 시간대 설정과 상관없이 항상 한국 시간으로 표시
  const fmtTime = new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
  const fmtDate = new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', month: 'long', day: 'numeric', weekday: 'short' });
  function tick() {
    const d = new Date();
    $('#clock-time').textContent = fmtTime.format(d);
    const p = Object.fromEntries(fmtDate.formatToParts(d).map((x) => [x.type, x.value]));
    $('#clock-date').textContent = `${p.month} ${p.day}일 (${p.weekday})`;
  }
  tick(); setInterval(tick, 10 * 1000);

  /* ───────── 자동 홈 복귀 ───────── */
  let idle;
  function resetIdle() {
    clearTimeout(idle);
    idle = setTimeout(() => {
      state.filter = {};
      if ($('#admin').open) $('#admin').close();
      if (location.hash && location.hash !== '#/') go('');
    }, IDLE_MS);
  }
  ['pointerdown', 'keydown'].forEach((ev) => window.addEventListener(ev, resetIdle, { passive: true }));
  resetIdle();

  /* ───────── 관리자 (로고 3초 길게 누르기) ───────── */
  let press;
  const brand = $('#brand');
  brand.addEventListener('pointerdown', () => {
    press = setTimeout(() => {
      press = null;
      $('#admin-status').textContent = localStorage.getItem(LS_CSV) ? '현재 이 기기에 저장된 CSV를 사용 중입니다.' : '현재 배포된 data/equipment.csv를 사용 중입니다.';
      $('#admin').showModal();
    }, 3000);
  });
  ['pointerup', 'pointerleave', 'pointercancel'].forEach((ev) => brand.addEventListener(ev, () => {
    if (press) { clearTimeout(press); press = null; if (ev === 'pointerup') go(''); }
  }));
  $('#admin-csv').addEventListener('change', async (e) => {
    const file = e.target.files?.[0]; if (!file) return;
    const text = await file.text();
    const items = toItems(text);
    e.target.value = '';
    if (!items.length) { $('#admin-status').textContent = 'CSV에서 항목을 찾지 못했습니다. 헤더(id, name, category …)를 확인해주세요.'; return; }
    localStorage.setItem(LS_CSV, text);
    state.items = items;
    $('#admin-status').textContent = `${items.length}개 항목을 불러와 이 기기에 저장했습니다.`;
    render();
  });
  $('#admin-reset').addEventListener('click', () => { localStorage.removeItem(LS_CSV); location.reload(); });
  $('#admin-reload').addEventListener('click', () => location.reload());

  /* ───────── 화면 크기 확인 (주소 뒤에 ?size) ───────── */
  if (new URLSearchParams(location.search).has('size')) {
    const box = document.createElement('div');
    box.style.cssText = 'position:fixed;left:50%;bottom:12px;transform:translateX(-50%);z-index:99;background:#000;color:#fff;font:700 22px/1.4 monospace;padding:10px 16px;border-radius:12px;pointer-events:none';
    const show = () => { box.textContent = `화면 ${innerWidth}×${innerHeight} · 배율 ${devicePixelRatio} · 모니터 ${screen.width}×${screen.height}`; };
    show(); addEventListener('resize', show); document.body.appendChild(box);
  }

  /* ───────── 시작 ───────── */
  document.addEventListener('contextmenu', (e) => e.preventDefault());
  render();
  loadData().then(render);

  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
})();
