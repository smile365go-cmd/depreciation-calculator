'use strict';

/* =========================================================
 * 1. 자산 분류 기준 (법인세법 시행령 §26, 시행규칙 별표3·5·6)
 * ========================================================= */
const CATS = {
  bldgA:    { name: '건물(철근콘크리트·철골·석조 등)', life: 40, range: true, methods: ['정액법'], basis: '별표5 구분4' },
  bldgB:    { name: '건물(연와·블록·목조·조립식 등)', life: 20, range: true, methods: ['정액법'], basis: '별표5 구분3' },
  struct:   { name: '구축물', life: 20, range: true, methods: ['정액법'], basis: '별표5 구분3 (철근콘크리트조 등은 40년)' },
  interior: { name: '시설장치(인테리어 등)', life: 5, range: true, methods: ['정률법', '정액법'], basis: '별표5 구분1 준용 (실무 확인)' },
  machine:  { name: '기계장치', life: 8, lifeOpts: range(3, 25), methods: ['정률법', '정액법'], basis: '별표6 업종별 기준내용연수' },
  vehicle:  { name: '차량운반구', life: 5, range: true, methods: ['정률법', '정액법'], basis: '별표5 구분1' },
  car:      { name: '업무용승용차', life: 5, lifeOpts: [5], methods: ['정액법'], basis: '법인세법 §27의2 (정액법 5년 강제)' },
  ship:     { name: '선박·항공기', life: 12, range: true, methods: ['정률법', '정액법'], basis: '별표5 구분2' },
  tool:     { name: '공구·기구', life: 5, range: true, methods: ['정률법', '정액법'], basis: '별표5 구분1' },
  fixture:  { name: '비품', life: 5, range: true, methods: ['정률법', '정액법'], basis: '별표5 구분1' },
  software: { name: '소프트웨어', life: 5, lifeOpts: [5], methods: ['정액법'], basis: '무형자산 정액법 (실무상 5년)' },
  goodwill: { name: '영업권·상표권·디자인권·실용신안권', life: 5, lifeOpts: [5], methods: ['정액법'], basis: '별표3' },
  patent:   { name: '특허권', life: 7, lifeOpts: [7], methods: ['정액법'], basis: '별표3' },
  devcost:  { name: '개발비', life: 5, lifeOpts: range(1, 20), methods: ['정액법'], basis: '시행령 §26①6 (신고 없으면 5년)' },
  land:     { name: '토지 (상각 안 함)', life: 0, lifeOpts: [0], methods: ['-'], basis: '비상각자산', none: true },
};

/* 자산명 키워드 → 분류 (위에서부터 먼저 맞는 것을 적용) */
const RULES = [
  { cat: 'land', kw: ['토지', '대지', '부지', '임야', '농지'] },
  { cat: 'devcost', kw: ['개발비'], flag: '개발비는 사용 가능한 날부터 상각합니다. 신고한 내용연수(20년 이내)가 있으면 바꾸세요.' },
  { cat: 'software', kw: ['소프트웨어', '프로그램', 'ERP', 'SOFTWARE', '라이선스', '라이센스', '홈페이지', '웹사이트', '시스템구축', '솔루션'] },
  { cat: 'patent', kw: ['특허'] },
  { cat: 'goodwill', kw: ['영업권', '상표권', '디자인권', '실용신안', '상표'] },
  { cat: 'interior', kw: ['인테리어', '시설장치', '칸막이', '내장공사', '실내공사'], flag: '임차건물 인테리어 기준입니다. 자가 건물의 자본적지출이면 건물로 바꾸세요.' },
  { cat: 'fixture', kw: ['컴퓨터', 'PC', '노트북', '모니터', '프린터', '복합기', '복사기', '스캐너', '서버', '태블릿', '아이패드', '휴대폰', '핸드폰', '스마트폰', '전화기', '팩스', '책상', '의자', '테이블', '소파', '캐비닛', '캐비넷', '서랍', '책장', '금고', '에어컨', '냉난방기', '온풍기', '냉장고', '정수기', 'TV', '텔레비전', '프로젝터', '카메라', 'CCTV', '비품', '가구', '공기청정기', '세탁기', '전자레인지', '커피머신', '블라인드', '파티션', '공유기', 'UPS', '집기'] },
  { cat: 'tool', kw: ['공구', '금형', '측정기', '계측기', '지그', '용접기', '저울', '시험기', '검사기', '기구'] },
  { cat: 'machine', kw: ['기계', '설비', '생산라인', 'CNC', '선반', '밀링', '프레스', '사출', '컨베이어', '보일러', '발전기', '로봇', '가공기', '성형기', '절단기', '포장기', '펌프', '압축기', '크레인', '태양광', '집진기', '건조기', '오븐', '믹서'],
    flag: '기계장치는 업종별로 내용연수가 다릅니다(별표6). 업종에 맞게 내용연수를 확인하세요.' },
  { cat: 'vehicle', kw: ['카니발', '스타리아', '스타렉스', '포터', '봉고', '트럭', '화물', '탑차', '덤프', '버스', '승합', '지게차', '굴삭기', '굴착기', '오토바이', '이륜', '스쿠터', '트랙터', '트레일러', '윙바디', '카고', '레미콘'],
    flag: '화물차·9인승 이상 승합차·지게차 등은 업무용승용차 규정이 적용되지 않습니다. 8인승 이하 승용이면 업무용승용차로 바꾸세요.' },
  { cat: 'car', kw: ['승용', '쏘나타', '소나타', '그랜저', '그랜져', '제네시스', 'G70', 'G80', 'G90', 'GV60', 'GV70', 'GV80', '아반떼', '모닝', '스파크', '말리부', 'K3', 'K5', 'K7', 'K8', 'K9', '쏘렌토', '소렌토', '스포티지', '싼타페', '산타페', '투싼', '팰리세이드', '코나', '셀토스', '니로', '아이오닉', 'EV3', 'EV6', 'EV9', '벤츠', 'BMW', '아우디', '렉서스', '테슬라', '볼보', '포르쉐', '캐딜락', '랜드로버', '레인지로버', '토레스', '렉스턴', '티볼리', 'QM6', 'SM6', '그랑콜레오스'],
    flag: '2016년 이후 취득분은 정액법 5년, 감가상각비 연 800만원 한도가 적용됩니다.' },
  { cat: 'vehicle', kw: ['차량', '자동차', '운반구'], flag: '차종을 확인하세요. 8인승 이하 승용이면 업무용승용차로 바꾸세요.' },
  { cat: 'ship', kw: ['선박', '어선', '요트', '보트', '항공기', '비행기', '헬기', '헬리콥터'] },
  { cat: 'struct', kw: ['구축물', '담장', '울타리', '펜스', '포장공사', '아스팔트', '주차장', '옹벽', '배수로', '도로', '교량', '저수조', '철탑', '굴뚝', '정화조', '저장탱크', '탱크'],
    flag: '철근콘크리트조·철골조 구축물이면 40년(건물 철근콘크리트 분류)으로 바꾸세요.' },
  { cat: 'bldgB', kw: ['블록', '벽돌', '연와', '목조', '조립식', '판넬', '패널', '샌드위치', '컨테이너', '비닐하우스', '하우스', '가설', '토벽'] },
  { cat: 'bldgA', kw: ['철근', '콘크리트', '철골', '석조'] },
  { cat: 'bldgA', kw: ['건물', '빌딩', '아파트', '오피스텔', '상가', '사옥', '공장', '창고', '사무실', '점포', '주택', '빌라', '호실', '부속설비', '건축'],
    flag: '건물 구조를 확인하세요. 연와·블록·목조·조립식 등이면 20년으로 바꾸세요.' },
];

function classify(name) {
  const n = String(name || '').toUpperCase().replace(/\s+/g, '');
  if (!n) return { cat: 'fixture', flag: '' };
  for (const r of RULES) {
    if (r.kw.some(k => n.includes(k.toUpperCase()))) return { cat: r.cat, flag: r.flag || '' };
  }
  return { cat: 'fixture', flag: '자산명으로 분류를 판단하지 못해 비품으로 두었습니다. 분류를 직접 선택하세요.' };
}

/* =========================================================
 * 2. 상각률 (시행규칙 별표4 산식)
 * ========================================================= */
function range(a, b) { const r = []; for (let i = a; i <= b; i++) r.push(i); return r; }
function rateSL(n) { return n > 0 ? Math.floor(1000 / n + 1e-9) / 1000 : 0; }
function rateDB(n) { return n > 0 ? Math.ceil((1 - Math.pow(0.05, 1 / n)) * 1000 - 1e-9) / 1000 : 0; }
function rateOf(method, life) { return method === '정액법' ? rateSL(life) : method === '정률법' ? rateDB(life) : 0; }

function lifeOptions(cat) {
  const c = CATS[cat];
  if (c.lifeOpts) return c.lifeOpts;
  if (c.range) return range(Math.round(c.life * 0.75), Math.round(c.life * 1.25));
  return [c.life];
}

/* =========================================================
 * 3. 상태 / 저장
 * ========================================================= */
const STORE_KEY = 'depreciation-calc-v1';
let state = {
  company: '',
  year: new Date().getFullYear(),
  startMonth: 1,
  assets: [],
};
let seq = 1;
const openRows = new Set();

function save() {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch (e) { /* 저장 불가 환경 무시 */ }
}
function load() {
  try {
    const s = JSON.parse(localStorage.getItem(STORE_KEY) || 'null');
    if (s && Array.isArray(s.assets)) {
      state = Object.assign(state, s);
      state.assets.forEach(a => { a.id = seq++; if (!CATS[a.cat]) a.cat = 'fixture'; });
    }
  } catch (e) { /* 무시 */ }
}

function newAsset(name = '', date = '', cost = '', prev = '') {
  const a = { id: seq++, name, date, cost, prev, manual: false, cat: 'fixture', method: '정률법', life: 5, flag: '' };
  applyClassification(a);
  return a;
}
function applyClassification(a) {
  const r = classify(a.name);
  a.cat = r.cat;
  a.flag = r.flag;
  applyCatDefaults(a);
}
function applyCatDefaults(a) {
  const c = CATS[a.cat];
  a.method = c.methods[0];
  a.life = c.life;
}

/* =========================================================
 * 4. 사업연도 / 날짜
 * ========================================================= */
function parseDate(s) {
  const m = String(s || '').trim().match(/^(\d{4})[-./]?\s*(\d{1,2})[-./]?\s*(\d{1,2})/);
  if (!m) return null;
  const y = +m[1], mo = +m[2], d = +m[3];
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  return { y, m: mo, d };
}
function toIsoDate(s) {
  const p = parseDate(s);
  return p ? `${p.y}-${String(p.m).padStart(2, '0')}-${String(p.d).padStart(2, '0')}` : '';
}
function fyOf(p) { return p.m >= state.startMonth ? p.y : p.y - 1; }
function fyRangeText(fy) {
  const S = state.startMonth;
  const endY = S === 1 ? fy : fy + 1;
  const endM = S === 1 ? 12 : S - 1;
  const endD = new Date(endY, endM, 0).getDate();
  return `${fy}.${pad(S)}.01 ~ ${endY}.${pad(endM)}.${endD}`;
}
function pad(n) { return String(n).padStart(2, '0'); }
/* 취득한 사업연도의 사용 월수 (1개월 미만은 1개월) */
function firstYearMonths(p) {
  const fy = fyOf(p);
  const startIdx = fy * 12 + (state.startMonth - 1);
  const acqIdx = p.y * 12 + (p.m - 1);
  return 12 - (acqIdx - startIdx);
}

/* =========================================================
 * 5. 감가상각 계산
 * ========================================================= */
function toNum(v) {
  const n = Number(String(v ?? '').replace(/[^\d.-]/g, ''));
  return isFinite(n) ? n : 0;
}

function computeSchedule(a) {
  const c = CATS[a.cat];
  const cost = Math.floor(toNum(a.cost));
  const p = parseDate(a.date);
  const res = { rows: [], valid: false, rate: 0, memo: 0, fy0: null, cost };
  if (!p || cost <= 0 || c.none) { res.fy0 = p ? fyOf(p) : null; return res; }

  const method = a.method, life = +a.life;
  const rate = rateOf(method, life);
  const memo = Math.min(Math.floor(cost * 0.05), 1000);   // 비망가액
  const resid = cost * 0.05;                               // 정률법 잔존가액 5%
  const fy0 = fyOf(p);
  const first = firstYearMonths(p);
  Object.assign(res, { valid: true, rate, memo, fy0 });

  let accum = 0, startFy = fy0;
  const prevStr = String(a.prev ?? '').trim();
  if (prevStr !== '' && state.year > fy0) {
    startFy = state.year;
    accum = Math.min(Math.floor(toNum(prevStr)), cost - memo);
    res.fromPrev = true;
  }

  for (let fy = startFy; fy < startFy + 200; fy++) {
    const book = cost - accum;
    if (book <= memo) break;
    const months = fy === fy0 ? first : 12;
    const base = method === '정액법' ? cost : book;
    let dep = Math.floor(base * rate * months / 12);
    let note = '';
    if (method === '정률법' && book - dep <= resid) { dep = book - memo; note = '잔존가액 가산'; }
    if (book - dep < memo) dep = book - memo;
    if (book - dep === memo) note = note ? note + '·상각완료' : '상각완료';
    let over = 0;
    if (a.cat === 'car') {
      const limit = Math.floor(8000000 * months / 12);
      if (dep > limit) over = dep - limit;
    }
    res.rows.push({ fy, months, opening: accum, base, rate, dep, closing: accum + dep, book: book - dep, note, over });
    accum += dep;
  }
  res.endAccum = accum;
  return res;
}

/* 계산 사업연도 1년치 결과 */
function yearResult(a, sch) {
  const Y = state.year;
  if (!sch.valid) return null;
  if (Y < sch.fy0) return { notYet: true };
  const row = sch.rows.find(r => r.fy === Y);
  if (row) return row;
  if (sch.rows.length && Y > sch.rows[sch.rows.length - 1].fy) {
    const acc = sch.endAccum;
    return { opening: acc, dep: 0, closing: acc, book: sch.cost - acc, note: '상각완료', over: 0, done: true };
  }
  return null;
}

function notesFor(a, sch, yr) {
  const notes = [];
  const c = CATS[a.cat];
  if (c.none) notes.push('토지는 감가상각하지 않습니다');
  if (!parseDate(a.date)) notes.push('취득일을 입력하세요');
  if (toNum(a.cost) <= 0 && !c.none) notes.push('취득가액을 입력하세요');
  if (yr && yr.notYet) notes.push('계산 사업연도 이후 취득');
  if (yr && yr.note) notes.push(yr.note);
  if (yr && yr.over > 0) notes.push(`업무용승용차 800만원 한도초과 ${fmt(yr.over)}원 손금불산입`);
  const cost = toNum(a.cost);
  if (cost > 0 && cost <= 1000000 && !['land', 'bldgA', 'bldgB', 'struct'].includes(a.cat)) notes.push('100만원 이하: 즉시상각 가능(시행령 §31④)');
  if (sch.fromPrev) notes.push('전기말 누계액 기준으로 계산');
  if (a.flag && !a.manual) notes.push('확인: ' + a.flag);
  return notes;
}

/* =========================================================
 * 6. 화면 그리기
 * ========================================================= */
const $ = s => document.querySelector(s);
function fmt(n) { return Math.round(n).toLocaleString('ko-KR'); }
function esc(s) { return String(s ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch])); }
function fmtRate(r) { return r ? r.toFixed(3) : '-'; }
function fmtMoneyInput(v) { const s = String(v ?? '').trim(); return s === '' ? '' : fmt(toNum(s)); }

const catOptionsHtml = Object.entries(CATS).map(([k, c]) => `<option value="${k}">${esc(c.name)}</option>`).join('');

function rowHtml(a) {
  return `<tr data-id="${a.id}">
    <td><input class="f-name" value="${esc(a.name)}" placeholder="예: 업무용 노트북"></td>
    <td><input class="f-date" type="date" value="${esc(a.date)}"></td>
    <td><input class="f-cost num" inputmode="numeric" value="${esc(fmtMoneyInput(a.cost))}" placeholder="0"></td>
    <td><select class="f-cat">${catOptionsHtml}</select><div class="flag"></div></td>
    <td><select class="f-method"></select></td>
    <td><select class="f-life"></select></td>
    <td><input class="f-prev num" inputmode="numeric" value="${esc(fmtMoneyInput(a.prev))}" placeholder="(선택)"></td>
    <td><button class="del" title="삭제">✕</button></td>
  </tr>`;
}

function updateRowControls(tr, a) {
  const c = CATS[a.cat];
  tr.querySelector('.f-cat').value = a.cat;
  tr.querySelector('.f-method').innerHTML = c.methods.map(m => `<option${m === a.method ? ' selected' : ''}>${m}</option>`).join('');
  tr.querySelector('.f-method').disabled = c.methods.length < 2;
  const opts = lifeOptions(a.cat);
  if (!opts.includes(+a.life)) a.life = c.life;
  tr.querySelector('.f-life').innerHTML = opts.map(n =>
    `<option value="${n}"${n === +a.life ? ' selected' : ''}>${c.none ? '-' : n + '년'}${n === c.life && opts.length > 1 ? ' (기준)' : ''}</option>`).join('');
  tr.querySelector('.f-life').disabled = opts.length < 2;
  const badge = a.manual ? '<span class="badge manual">직접선택</span>' : (a.name ? '<span class="badge">자동</span>' : '');
  tr.querySelector('.flag').innerHTML = badge + (a.flag && !a.manual ? esc(a.flag) : '');
}

function renderInputs() {
  const body = $('#assetBody');
  body.innerHTML = state.assets.map(rowHtml).join('');
  body.querySelectorAll('tr').forEach(tr => updateRowControls(tr, findAsset(tr.dataset.id)));
  $('#emptyMsg').style.display = state.assets.length ? 'none' : '';
}

function findAsset(id) { return state.assets.find(a => a.id === +id); }

function renderResults() {
  const Y = state.year;
  $('#resultTitle').textContent = `${Y} 사업연도 감가상각비 계산내역`;
  $('#fyText').textContent = `계산 기간: ${fyRangeText(Y)}`;
  $('#printInfo').textContent = `${state.company ? state.company + ' · ' : ''}${Y} 사업연도 (${fyRangeText(Y)}) · 세법 기준`;

  const tot = { cost: 0, opening: 0, dep: 0, closing: 0, book: 0, over: 0 };
  let html = '';
  state.assets.forEach((a, i) => {
    const sch = computeSchedule(a);
    const yr = yearResult(a, sch);
    const c = CATS[a.cat];
    const cost = toNum(a.cost);
    const has = yr && !yr.notYet;
    const notes = notesFor(a, sch, yr);
    if (cost > 0 && !(yr && yr.notYet)) tot.cost += cost;
    if (has) { tot.opening += yr.opening; tot.dep += yr.dep; tot.closing += yr.closing; tot.book += yr.book; tot.over += yr.over || 0; }
    if (c.none && cost > 0 && parseDate(a.date) && Y >= fyOf(parseDate(a.date))) tot.book += cost;
    const open = openRows.has(a.id);
    html += `<tr class="main${open ? ' open' : ''}" data-id="${a.id}">
      <td class="num">${i + 1}</td>
      <td>${esc(a.name) || '<span class="muted">(이름 없음)</span>'}</td>
      <td>${esc(c.name)}</td>
      <td>${esc(a.date) || '-'}</td>
      <td class="num">${cost ? fmt(cost) : '-'}</td>
      <td>${c.none ? '-' : a.method}</td>
      <td class="num">${c.none ? '-' : a.life + '년'}</td>
      <td class="num">${c.none ? '-' : fmtRate(rateOf(a.method, a.life))}</td>
      <td class="num">${has ? fmt(yr.opening) : '-'}</td>
      <td class="num strong">${has ? fmt(yr.dep) : '-'}</td>
      <td class="num">${has ? fmt(yr.closing) : '-'}</td>
      <td class="num">${has ? fmt(yr.book) : (c.none && cost ? fmt(cost) : '-')}</td>
      <td class="note">${notes.map(esc).join('<br>')}</td>
    </tr>`;
    if (open) html += `<tr class="sched"><td colspan="13">${scheduleHtml(sch)}</td></tr>`;
  });
  $('#resultBody').innerHTML = html || `<tr><td colspan="13" class="empty">자산을 입력하면 계산 결과가 여기에 나타납니다.</td></tr>`;
  $('#resultFoot').innerHTML = state.assets.length ? `<tr>
      <td colspan="4">합계</td>
      <td class="num">${fmt(tot.cost)}</td><td></td><td></td><td></td>
      <td class="num">${fmt(tot.opening)}</td>
      <td class="num">${fmt(tot.dep)}</td>
      <td class="num">${fmt(tot.closing)}</td>
      <td class="num">${fmt(tot.book)}</td>
      <td class="note">${tot.over ? '승용차 한도초과 합계 ' + fmt(tot.over) + '원' : ''}</td>
    </tr>` : '';
}

function scheduleHtml(sch) {
  if (!sch.valid) return '<span class="muted">취득일·취득가액을 입력하면 연도별 내역이 표시됩니다.</span>';
  const rows = sch.rows.map(r => `<tr class="${r.fy === state.year ? 'target' : ''}">
      <td>${r.fy}</td><td class="num">${r.months}개월</td>
      <td class="num">${fmt(r.opening)}</td><td class="num">${fmt(r.base)}</td><td class="num">${fmtRate(r.rate)}</td>
      <td class="num">${fmt(r.dep)}</td><td class="num">${fmt(r.closing)}</td><td class="num">${fmt(r.book)}</td>
      <td>${esc([r.note, r.over ? '한도초과 ' + fmt(r.over) : ''].filter(Boolean).join(' / '))}</td></tr>`).join('');
  return `<div class="sched-wrap"><table class="sched-table">
    <thead><tr><th>사업연도</th><th>사용월수</th><th>기초누계</th><th>상각기준액</th><th>상각률</th><th>상각비</th><th>기말누계</th><th>미상각잔액</th><th>비고</th></tr></thead>
    <tbody>${rows}</tbody></table>
    <div class="muted">비망가액(상각 후 남기는 금액): ${fmt(sch.memo)}원${sch.fromPrev ? ' · 전기말 상각누계액부터 이어서 계산' : ''}</div></div>`;
}

function renderReference() {
  $('#catRef').innerHTML = '<tr><th>분류</th><th>기준내용연수</th><th>선택 가능 범위</th><th>상각방법</th><th>근거</th></tr>' +
    Object.values(CATS).map(c => {
      const key = Object.keys(CATS).find(k => CATS[k] === c);
      const o = lifeOptions(key);
      return `<tr><td>${esc(c.name)}</td><td class="num">${c.none ? '-' : c.life + '년'}</td>
        <td>${c.none ? '-' : (o.length > 1 ? o[0] + '~' + o[o.length - 1] + '년' : '고정')}</td>
        <td>${c.methods.join(' / ')}${c.methods.length > 1 ? ' <span class="muted">(무신고 시 정률법)</span>' : ''}</td><td>${esc(c.basis)}</td></tr>`;
    }).join('');
  const ns = range(2, 60);
  const half = Math.ceil(ns.length / 3);
  const cols = [ns.slice(0, half), ns.slice(half, half * 2), ns.slice(half * 2)];
  let h = '<tr>' + cols.map(() => '<th>내용연수</th><th>정액법</th><th>정률법</th>').join('') + '</tr>';
  for (let i = 0; i < half; i++) {
    h += '<tr>' + cols.map(col => col[i] ? `<td class="num">${col[i]}년</td><td class="num">${fmtRate(rateSL(col[i]))}</td><td class="num">${fmtRate(rateDB(col[i]))}</td>` : '<td></td><td></td><td></td>').join('') + '</tr>';
  }
  $('#rateRef').innerHTML = h;
}

function refresh() { renderResults(); save(); }

/* =========================================================
 * 7. 이벤트
 * ========================================================= */
function bindEvents() {
  const sm = $('#startMonth');
  sm.innerHTML = range(1, 12).map(m => `<option value="${m}">${m}월</option>`).join('');
  sm.value = state.startMonth;
  $('#year').value = state.year;
  $('#company').value = state.company;

  $('#company').addEventListener('input', e => { state.company = e.target.value; refresh(); });
  $('#year').addEventListener('input', e => { const y = +e.target.value; if (y >= 1900 && y <= 2200) { state.year = y; refresh(); } });
  sm.addEventListener('change', e => { state.startMonth = +e.target.value; refresh(); });

  const body = $('#assetBody');
  body.addEventListener('input', e => {
    const tr = e.target.closest('tr'); const a = findAsset(tr.dataset.id);
    const t = e.target;
    if (t.classList.contains('f-name')) a.name = t.value;
    else if (t.classList.contains('f-date')) a.date = t.value;
    else if (t.classList.contains('f-cost')) a.cost = t.value;
    else if (t.classList.contains('f-prev')) a.prev = t.value;
    else return;
    refresh();
  });
  body.addEventListener('change', e => {
    const tr = e.target.closest('tr'); const a = findAsset(tr.dataset.id);
    const t = e.target;
    if (t.classList.contains('f-name')) {
      if (!a.manual) { applyClassification(a); updateRowControls(tr, a); }
    } else if (t.classList.contains('f-cat')) {
      a.cat = t.value; a.manual = true; applyCatDefaults(a); updateRowControls(tr, a);
    } else if (t.classList.contains('f-method')) {
      a.method = t.value;
    } else if (t.classList.contains('f-life')) {
      a.life = +t.value;
    } else if (t.classList.contains('f-cost') || t.classList.contains('f-prev')) {
      t.value = fmtMoneyInput(t.value);
    }
    refresh();
  });
  body.addEventListener('click', e => {
    if (!e.target.classList.contains('del')) return;
    const id = +e.target.closest('tr').dataset.id;
    state.assets = state.assets.filter(a => a.id !== id);
    openRows.delete(id);
    renderInputs(); refresh();
  });

  $('#addRow').addEventListener('click', () => {
    state.assets.push(newAsset());
    renderInputs(); refresh();
    const inputs = document.querySelectorAll('#assetBody .f-name');
    inputs[inputs.length - 1].focus();
  });
  $('#clearAll').addEventListener('click', () => {
    if (!state.assets.length || !confirm('입력한 자산을 모두 삭제할까요?')) return;
    state.assets = []; openRows.clear();
    renderInputs(); refresh();
  });
  $('#loadSample').addEventListener('click', () => {
    if (state.assets.length && !confirm('지금 입력한 자산 뒤에 예시 데이터를 추가할까요?')) return;
    const Y = state.year;
    [
      ['본사 사옥 (철근콘크리트조)', `${Y - 6}-01-10`, '850000000', ''],
      ['사옥 부지 토지', `${Y - 6}-01-10`, '1200000000', ''],
      ['물류창고 (조립식 판넬)', `${Y - 3}-05-20`, '180000000', ''],
      ['CNC 가공기계', `${Y - 2}-08-03`, '95000000', ''],
      ['배송용 1톤 포터 트럭', `${Y - 1}-03-15`, '24500000', ''],
      ['대표이사 업무용 그랜저', `${Y - 1}-07-01`, '52000000', ''],
      ['사무실 인테리어 공사', `${Y}-02-11`, '38000000', ''],
      ['직원용 노트북 10대', `${Y}-04-21`, '18500000', ''],
      ['회의실 복합기', `${Y}-09-05`, '850000', ''],
      ['ERP 소프트웨어', `${Y}-06-30`, '30000000', ''],
    ].forEach(r => state.assets.push(newAsset(...r)));
    renderInputs(); refresh();
  });

  $('#resultBody').addEventListener('click', e => {
    const tr = e.target.closest('tr.main'); if (!tr) return;
    const id = +tr.dataset.id;
    openRows.has(id) ? openRows.delete(id) : openRows.add(id);
    renderResults();
  });

  const dlg = $('#pasteDlg');
  $('#openPaste').addEventListener('click', () => { $('#pasteText').value = ''; dlg.showModal(); $('#pasteText').focus(); });
  dlg.addEventListener('close', () => {
    if (dlg.returnValue !== 'ok') return;
    const added = parsePaste($('#pasteText').value);
    if (!added.length) { alert('추가할 자산을 찾지 못했습니다. “자산명 | 취득일 | 취득가액” 순서인지 확인하세요.'); return; }
    state.assets.push(...added);
    renderInputs(); refresh();
  });

  $('#exportXlsx').addEventListener('click', exportXlsx);
  $('#printBtn').addEventListener('click', () => window.print());

  // 엑셀 불러오기: 버튼 / 끌어다 놓기
  const fileInput = $('#importFile');
  $('#importBtn').addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', () => { importFile(fileInput.files[0]); fileInput.value = ''; });
  const dropZone = $('#sec-assets');
  dropZone.addEventListener('dragover', e => { e.preventDefault(); dropZone.classList.add('drop-active'); });
  dropZone.addEventListener('dragleave', e => { if (!dropZone.contains(e.relatedTarget)) dropZone.classList.remove('drop-active'); });
  dropZone.addEventListener('drop', e => {
    e.preventDefault(); dropZone.classList.remove('drop-active');
    importFile(e.dataTransfer.files[0]);
  });
}

/* ---------- 엑셀 / CSV 파일 불러오기 ---------- */
function rowsToAssets(rows) {
  const str = v => String(v ?? '').trim();
  let hdr = -1, map = { name: 0, date: 1, cost: 2, prev: 3 };
  // 제목줄 찾기 (앞쪽 15줄 안에서 '자산명'과 '취득일'이 함께 있는 줄)
  for (let i = 0; i < Math.min(rows.length, 15); i++) {
    const r = rows[i] || [];
    const idx = re => r.findIndex(v => re.test(str(v).replace(/\s/g, '')));
    const n = idx(/자산명|자산|품명|명칭|품목/);
    const d = idx(/취득일|취득년월일|취득일자|일자/);
    if (n >= 0 && d >= 0) {
      const c = idx(/취득가액|취득원가|취득금액|가액|금액/);
      hdr = i;
      map = { name: n, date: d, cost: c >= 0 ? c : d + 1, prev: idx(/누계/) };
      break;
    }
  }
  const toDate = v => {
    if (typeof v === 'number') return v > 19000000 ? toIsoDate(String(v)) : excelSerialToIso(v);
    return toIsoDate(str(v));
  };
  const toAmt = v => typeof v === 'number' ? String(Math.floor(v)) : (str(v) ? String(Math.floor(toNum(v))) : '');
  const assets = [], skipped = [];
  for (let i = hdr + 1; i < rows.length; i++) {
    const r = rows[i] || [];
    if (!r.some(v => str(v) !== '')) continue;                       // 빈 줄
    const name = str(r[map.name]);
    if (!name || /^(합계|소계|총계|계)$/.test(name.replace(/\s/g, ''))) continue;
    const date = toDate(r[map.date]);
    if (!date) { skipped.push(`${i + 1}행 "${name}"`); continue; }
    assets.push(newAsset(name, date, toAmt(r[map.cost]), map.prev >= 0 ? toAmt(r[map.prev]) : ''));
  }
  return { assets, skipped };
}

function parseCsv(text) {
  const rows = []; let row = [], cur = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) {
      if (ch === '"') { if (text[i + 1] === '"') { cur += '"'; i++; } else q = false; }
      else cur += ch;
    } else if (ch === '"') q = true;
    else if (ch === ',' || ch === '\t') { row.push(cur); cur = ''; }
    else if (ch === '\n') { row.push(cur); rows.push(row); row = []; cur = ''; }
    else if (ch !== '\r') cur += ch;
  }
  if (cur !== '' || row.length) { row.push(cur); rows.push(row); }
  return rows;
}

async function importFile(file) {
  if (!file) return;
  const ext = (file.name.split('.').pop() || '').toLowerCase();
  try {
    let rows, sheetInfo = '';
    if (ext === 'xlsx' || ext === 'xlsm') {
      const r = await readXlsxRows(await file.arrayBuffer(), /자산/);
      rows = r.rows; sheetInfo = ` [${r.sheet}] 시트`;
    } else if (ext === 'csv' || ext === 'txt' || ext === 'tsv') {
      const buf = await file.arrayBuffer();
      let text;
      try { text = new TextDecoder('utf-8', { fatal: true }).decode(buf); }
      catch (e) { text = new TextDecoder('euc-kr').decode(buf); }
      rows = parseCsv(text.replace(/^﻿/, ''));
    } else if (ext === 'xls') {
      throw new Error('예전 엑셀 형식(.xls)은 불러올 수 없습니다. 엑셀에서 [다른 이름으로 저장 → Excel 통합 문서(*.xlsx)]로 저장한 뒤 불러오세요.');
    } else {
      throw new Error('엑셀(.xlsx) 또는 CSV 파일만 불러올 수 있습니다.');
    }
    const { assets, skipped } = rowsToAssets(rows);
    if (!assets.length) {
      throw new Error('불러올 자산을 찾지 못했습니다. 첫 줄에 "자산명 · 취득일 · 취득가액" 제목이 있거나, A~C열이 그 순서인지 확인하세요.');
    }
    if (state.assets.length &&
        confirm(`지금 입력된 자산 ${state.assets.length}건을 지우고 새로 불러올까요?\n\n[확인] 지우고 새로 불러오기\n[취소] 기존 목록 뒤에 추가하기`)) {
      state.assets = []; openRows.clear();
    }
    state.assets.push(...assets);
    renderInputs(); refresh();
    let msg = `“${file.name}”${sheetInfo}에서 자산 ${assets.length}건을 불러왔습니다.`;
    if (skipped.length) msg += ` 취득일을 읽지 못해 건너뛴 행 ${skipped.length}건: ${skipped.slice(0, 5).join(', ')}${skipped.length > 5 ? ' 외' : ''}`;
    showImportMsg(msg, skipped.length ? 'warn' : 'ok');
  } catch (e) {
    showImportMsg(e.message || String(e), 'error');
  }
}

function showImportMsg(text, kind) {
  const el = $('#importMsg');
  el.textContent = text;
  el.className = 'import-msg ' + kind;
  el.hidden = false;
}

function parsePaste(text) {
  const out = [];
  text.split(/\r?\n/).forEach(line => {
    if (!line.trim()) return;
    const cols = line.includes('\t') ? line.split('\t') : line.split(/,(?=(?:[^"]*"[^"]*")*[^"]*$)/);
    const c = cols.map(s => s.replace(/^"|"$/g, '').trim());
    const name = c[0];
    const date = toIsoDate(c[1]);
    if (!name || !date) return;  // 제목줄 등은 건너뜀
    out.push(newAsset(name, date, c[2] ? String(toNum(c[2])) : '', c[3] ? String(toNum(c[3])) : ''));
  });
  return out;
}

/* =========================================================
 * 8. 엑셀(.xlsx) 저장
 * ========================================================= */
function exportXlsx() {
  const Y = state.year;
  if (!state.assets.length) { alert('저장할 자산이 없습니다.'); return; }

  /* --- 시트 1: 계산내역 --- */
  const s1 = new XSheet('계산내역');
  s1.set(1, 1, `${state.company ? state.company + ' ' : ''}${Y} 사업연도 감가상각비 계산내역`, XS.title);
  s1.set(2, 1, `사업연도 ${fyRangeText(Y)} · 법인세법 기준`, XS.sub);
  ['No', '자산명', '분류', '취득일', '취득가액', '상각방법', '내용연수', '상각률', '기초\n상각누계액', '당기\n상각비',
    '기말\n상각누계액', '기말\n미상각잔액', '승용차\n한도초과\n(손금불산입)', '비고'].forEach((h, i) => s1.set(4, i + 1, h, XS.head));
  s1.heights[4] = 46;
  const r0 = 5;
  const tot = { E: 0, I: 0, J: 0, K: 0, L: 0, M: 0 };
  const scheds = [];
  state.assets.forEach((a, i) => {
    const r = r0 + i;
    const sch = computeSchedule(a), yr = yearResult(a, sch), c = CATS[a.cat];
    const has = yr && !yr.notYet;
    const cost = Math.floor(toNum(a.cost));
    const opening = has ? yr.opening : 0, dep = has ? yr.dep : 0, over = has ? (yr.over || 0) : 0;
    const closing = opening + dep, book = cost - closing;
    s1.set(r, 1, i + 1, XS.center);
    s1.set(r, 2, a.name, XS.text);
    s1.set(r, 3, c.name, XS.text);
    const ds = excelDate(a.date);
    s1.set(r, 4, ds === null ? '' : ds, XS.date);
    s1.set(r, 5, cost, XS.money);
    s1.set(r, 6, c.none ? '-' : a.method, XS.center);
    s1.set(r, 7, c.none ? '-' : +a.life, XS.year);
    s1.set(r, 8, c.none ? '-' : rateOf(a.method, a.life), XS.rate);
    s1.set(r, 9, opening, XS.money);
    s1.set(r, 10, dep, XS.moneyBlue);
    s1.set(r, 11, closing, XS.money, `I${r}+J${r}`);
    s1.set(r, 12, book, XS.money, `E${r}-K${r}`);
    s1.set(r, 13, over, XS.money);
    s1.set(r, 14, notesFor(a, sch, yr).join('\n'), XS.note);
    tot.E += cost; tot.I += opening; tot.J += dep; tot.K += closing; tot.L += book; tot.M += over;
    scheds.push({ no: i + 1, a, c, sch });
  });
  const rl = r0 + state.assets.length - 1, rt = rl + 1;
  s1.set(rt, 1, '합계', XS.totLabel);
  for (let c = 2; c <= 4; c++) s1.set(rt, c, null, XS.totLabel);
  s1.merges.push(`A${rt}:D${rt}`);
  for (let c = 5; c <= 14; c++) {
    const col = colName(c);
    if (tot[col] !== undefined) s1.set(rt, c, tot[col], XS.totMoney, `SUM(${col}${r0}:${col}${rl})`);
    else s1.set(rt, c, null, XS.totEmpty);
  }
  [
    '※ 당기 상각비·기초 상각누계액·한도초과액은 프로그램 계산값이고, 기말 누계·미상각잔액·합계는 수식입니다.',
    '※ 월할 계산(1개월 미만은 1개월), 원 단위 미만 버림, 정률법 5% 잔존가액 가산, 비망가액(5%와 1,000원 중 적은 금액) 적용.',
    '※ 기계장치(업종별 내용연수), 구축물·건물 구조, 승용차 해당 여부는 직접 확인이 필요합니다.',
  ].forEach((t, k) => s1.set(rt + 2 + k, 1, t, XS.small));
  s1.widths = [5, 30, 26, 12, 16, 9, 8, 8, 16, 15, 16, 16, 14, 48];
  s1.freeze = [2, 4];
  s1.landscape = true;

  /* --- 시트 2: 연도별 상각내역 --- */
  const s2 = new XSheet('연도별 상각내역');
  s2.set(1, 1, '자산별 연도별 상각내역', XS.title);
  s2.set(2, 1, `색칠된 행이 ${Y} 사업연도입니다.`, XS.sub);
  let r = 4;
  scheds.forEach(({ no, a, c, sch }) => {
    if (!sch.valid || !sch.rows.length) return;
    s2.set(r, 1, `${no}. ${a.name}  (${c.name}, ${a.method} ${a.life}년, 취득일 ${a.date}, 취득가액 ${fmt(sch.cost)}원, 비망가액 ${fmt(sch.memo)}원)`, XS.bold);
    s2.set(r, 11, sch.cost, XS.money);           // 숨긴 열: 미상각잔액 수식용 취득가액
    const costRef = `$K$${r}`;
    r++;
    ['사업연도', '사용월수', '기초누계', '상각기준액', '상각률', '상각비', '기말누계', '미상각잔액', '비고'].forEach((h, i) => s2.set(r, i + 1, h, XS.head));
    r++;
    sch.rows.forEach((row, k) => {
      const hl = row.fy === Y;
      s2.set(r, 1, String(row.fy), hl ? XS.hlCenter : XS.center);
      s2.set(r, 2, row.months, hl ? XS.hlMonth : XS.month);
      s2.set(r, 3, row.opening, hl ? XS.hlMoney : XS.money, k === 0 ? null : `G${r - 1}`);
      s2.set(r, 4, row.base, hl ? XS.hlMoney : XS.money);
      s2.set(r, 5, row.rate, hl ? XS.hlRate : XS.rate);
      s2.set(r, 6, row.dep, hl ? XS.hlMoneyBold : XS.moneyBold);
      s2.set(r, 7, row.closing, hl ? XS.hlMoney : XS.money, `C${r}+F${r}`);
      s2.set(r, 8, row.book, hl ? XS.hlMoney : XS.money, `${costRef}-G${r}`);
      s2.set(r, 9, [row.note, row.over ? '한도초과 ' + fmt(row.over) : ''].filter(Boolean).join(' / '), hl ? XS.hlText : XS.text);
      r++;
    });
    r++;
  });
  s2.widths = [10, 10, 16, 16, 9, 15, 16, 16, 26, 4, 4];
  s2.hidden.add(11);
  s2.freeze = [0, 3];

  const blob = buildXlsx([s1, s2]);
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `감가상각비_계산내역_${state.company ? state.company.replace(/[\\/:*?"<>|]/g, '') + '_' : ''}${Y}.xlsx`;
  document.body.appendChild(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return blob;
}

/* =========================================================
 * 시작
 * ========================================================= */
load();
bindEvents();
renderReference();
renderInputs();
renderResults();
