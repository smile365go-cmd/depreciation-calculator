'use strict';
/* =========================================================
 * 엑셀(.xlsx) 파일 작성기 — 외부 라이브러리 없이 동작
 * ========================================================= */

/* 셀 서식 번호 (styles.xml 의 cellXfs 순서와 같음) */
const XS = {
  normal: 0, title: 1, sub: 2, head: 3, text: 4, center: 5, date: 6, money: 7, moneyBlue: 8, rate: 9,
  note: 10, totLabel: 11, totMoney: 12, totEmpty: 13, small: 14, year: 15, month: 16, bold: 17,
  hlCenter: 18, hlMonth: 19, hlMoney: 20, hlMoneyBold: 21, hlRate: 22, hlText: 23, moneyBold: 24,
};

const STYLES_XML = (() => {
  // 색상: DESIGN-claude.md 토큰 (ink 141413, muted 6C6A64, surface-dark 181715, on-dark FAF9F5,
  //        primary-active A9583E, surface-card EFE9DE, surface-cream-strong E8E0D2, hairline E6DFD8)
  const font = (o = {}) => `<font>${o.b ? '<b/>' : ''}<sz val="${o.sz || 10}"/><color rgb="FF${o.color || '3D3D3A'}"/><name val="맑은 고딕"/><family val="3"/><charset val="129"/></font>`;
  const fonts = [
    font(), font({ sz: 16, color: '141413' }), font({ color: '6C6A64' }), font({ b: 1, color: 'FAF9F5' }),
    font({ b: 1, color: 'A9583E' }), font({ color: '8A5A12' }), font({ b: 1, color: '141413' }), font({ sz: 9, color: '8E8B82' }),
  ];
  const solid = c => `<fill><patternFill patternType="solid"><fgColor rgb="FF${c}"/><bgColor indexed="64"/></patternFill></fill>`;
  const fills = ['<fill><patternFill patternType="none"/></fill>', '<fill><patternFill patternType="gray125"/></fill>',
    solid('181715'), solid('EFE9DE'), solid('E8E0D2')];
  const side = n => `<${n} style="thin"><color rgb="FFE6DFD8"/></${n}>`;
  const borders = ['<border><left/><right/><top/><bottom/><diagonal/></border>',
    `<border>${side('left')}${side('right')}${side('top')}${side('bottom')}<diagonal/></border>`];
  // [fontId, fillId, borderId, numFmtId, alignment]
  const C = 'horizontal="center" vertical="center"';
  const xfs = [
    [0, 0, 0, 0], [1, 0, 0, 0], [2, 0, 0, 0], [3, 2, 1, 0, `${C} wrapText="1"`], [0, 0, 1, 0, 'vertical="top"'],
    [0, 0, 1, 0, C], [0, 0, 1, 164, C], [0, 0, 1, 165], [4, 0, 1, 165], [0, 0, 1, 166, C],
    [5, 0, 1, 0, 'vertical="top" wrapText="1"'], [6, 3, 1, 0, C], [6, 3, 1, 165], [0, 3, 1, 0], [7, 0, 0, 0],
    [0, 0, 1, 167, C], [0, 0, 1, 168, C], [6, 0, 0, 0],
    [0, 4, 1, 0, C], [0, 4, 1, 168, C], [0, 4, 1, 165], [6, 4, 1, 165], [0, 4, 1, 166, C], [0, 4, 1, 0], [6, 0, 1, 165],
  ];
  const fmts = [[164, 'yyyy-mm-dd'], [165, '#,##0;-#,##0;"-"'], [166, '0.000'], [167, '0"년"'], [168, '0"개월"']];
  return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
    `<numFmts count="${fmts.length}">${fmts.map(([i, f]) => `<numFmt numFmtId="${i}" formatCode="${xmlEsc(f)}"/>`).join('')}</numFmts>` +
    `<fonts count="${fonts.length}">${fonts.join('')}</fonts>` +
    `<fills count="${fills.length}">${fills.join('')}</fills>` +
    `<borders count="${borders.length}">${borders.join('')}</borders>` +
    '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
    `<cellXfs count="${xfs.length}">` + xfs.map(([fo, fi, bo, nf, al]) =>
      `<xf numFmtId="${nf}" fontId="${fo}" fillId="${fi}" borderId="${bo}" xfId="0" applyNumberFormat="1" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1">${al ? `<alignment ${al}/>` : ''}</xf>`).join('') +
    '</cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>';
})();

function xmlEsc(s) {
  return String(s).replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]))
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '');
}
function colName(n) { let s = ''; while (n > 0) { const m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); } return s; }
function excelDate(iso) {
  const p = String(iso || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return p ? (Date.UTC(+p[1], +p[2] - 1, +p[3]) - Date.UTC(1899, 11, 30)) / 86400000 : null;
}

class XSheet {
  constructor(name) {
    this.name = name; this.rows = new Map(); this.widths = []; this.hidden = new Set();
    this.merges = []; this.heights = {}; this.freeze = null; this.landscape = false;
  }
  /* v: 숫자/문자/null, f: 수식(앞의 = 없이). 수식이면 v 는 미리 계산한 값 */
  set(r, c, v, s = 0, f = null) {
    if (!this.rows.has(r)) this.rows.set(r, new Map());
    this.rows.get(r).set(c, { v, s, f });
  }
  toXml() {
    let pane = '';
    if (this.freeze) {
      const [x, y] = this.freeze;
      const active = x && y ? 'bottomRight' : y ? 'bottomLeft' : 'topRight';
      pane = `<pane${x ? ` xSplit="${x}"` : ''}${y ? ` ySplit="${y}"` : ''} topLeftCell="${colName(x + 1)}${y + 1}" activePane="${active}" state="frozen"/><selection pane="${active}"/>`;
    }
    const cols = this.widths.length ? '<cols>' + this.widths.map((w, i) =>
      `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"${this.hidden.has(i + 1) ? ' hidden="1"' : ''}/>`).join('') + '</cols>' : '';
    const rows = [...this.rows.keys()].sort((a, b) => a - b).map(r => {
      const cells = [...this.rows.get(r).entries()].sort((a, b) => a[0] - b[0]).map(([c, { v, s, f }]) => {
        const ref = colName(c) + r;
        if (f) return `<c r="${ref}" s="${s}"><f>${xmlEsc(f)}</f>${typeof v === 'number' ? `<v>${v}</v>` : ''}</c>`;
        if (typeof v === 'number' && isFinite(v)) return `<c r="${ref}" s="${s}"><v>${v}</v></c>`;
        if (v === null || v === undefined || v === '') return `<c r="${ref}" s="${s}"/>`;
        return `<c r="${ref}" s="${s}" t="inlineStr"><is><t xml:space="preserve">${xmlEsc(v)}</t></is></c>`;
      }).join('');
      const h = this.heights[r] ? ` ht="${this.heights[r]}" customHeight="1"` : '';
      return `<row r="${r}"${h}>${cells}</row>`;
    }).join('');
    const merges = this.merges.length ? `<mergeCells count="${this.merges.length}">${this.merges.map(m => `<mergeCell ref="${m}"/>`).join('')}</mergeCells>` : '';
    return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
      (this.landscape ? '<sheetPr><pageSetUpPr fitToPage="1"/></sheetPr>' : '') +
      `<sheetViews><sheetView workbookViewId="0">${pane}</sheetView></sheetViews>` +
      '<sheetFormatPr defaultRowHeight="16.5"/>' + cols + `<sheetData>${rows}</sheetData>` + merges +
      '<pageMargins left="0.4" right="0.4" top="0.5" bottom="0.5" header="0.3" footer="0.3"/>' +
      (this.landscape ? '<pageSetup paperSize="9" orientation="landscape" fitToWidth="1" fitToHeight="0"/>' : '') +
      '</worksheet>';
  }
}

function buildXlsx(sheets) {
  const NS = 'http://schemas.openxmlformats.org';
  const files = [
    ['[Content_Types].xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      `<Types xmlns="${NS}/package/2006/content-types">` +
      '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
      '<Default Extension="xml" ContentType="application/xml"/>' +
      '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
      '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' +
      sheets.map((s, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('') +
      '</Types>'],
    ['_rels/.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      `<Relationships xmlns="${NS}/package/2006/relationships"><Relationship Id="rId1" Type="${NS}/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`],
    ['xl/workbook.xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      `<workbook xmlns="${NS}/spreadsheetml/2006/main" xmlns:r="${NS}/officeDocument/2006/relationships"><bookViews><workbookView/></bookViews><sheets>` +
      sheets.map((s, i) => `<sheet name="${xmlEsc(s.name)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('') +
      '</sheets><calcPr calcId="191029" fullCalcOnLoad="1"/></workbook>'],
    ['xl/_rels/workbook.xml.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      `<Relationships xmlns="${NS}/package/2006/relationships">` +
      sheets.map((s, i) => `<Relationship Id="rId${i + 1}" Type="${NS}/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('') +
      `<Relationship Id="rId${sheets.length + 1}" Type="${NS}/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`],
    ['xl/styles.xml', STYLES_XML],
    ...sheets.map((s, i) => [`xl/worksheets/sheet${i + 1}.xml`, s.toXml()]),
  ];
  return zipStore(files.map(([name, text]) => ({ name, data: new TextEncoder().encode(text) })));
}

/* ---- ZIP (무압축) ---- */
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; }
  return t;
})();
function crc32(d) { let c = 0xFFFFFFFF; for (let i = 0; i < d.length; i++) c = CRC_TABLE[(c ^ d[i]) & 0xFF] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; }

function zipStore(files) {
  const now = new Date();
  const dosTime = (now.getHours() << 11) | (now.getMinutes() << 5) | (now.getSeconds() >> 1);
  const dosDate = ((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate();
  const parts = [], central = [];
  let offset = 0;
  for (const f of files) {
    const name = new TextEncoder().encode(f.name);
    const crc = crc32(f.data), size = f.data.length;
    const lh = new DataView(new ArrayBuffer(30));
    lh.setUint32(0, 0x04034b50, true); lh.setUint16(4, 20, true); lh.setUint16(6, 0x0800, true); lh.setUint16(8, 0, true);
    lh.setUint16(10, dosTime, true); lh.setUint16(12, dosDate, true); lh.setUint32(14, crc, true);
    lh.setUint32(18, size, true); lh.setUint32(22, size, true); lh.setUint16(26, name.length, true); lh.setUint16(28, 0, true);
    parts.push(new Uint8Array(lh.buffer), name, f.data);
    const ch = new DataView(new ArrayBuffer(46));
    ch.setUint32(0, 0x02014b50, true); ch.setUint16(4, 20, true); ch.setUint16(6, 20, true); ch.setUint16(8, 0x0800, true);
    ch.setUint16(10, 0, true); ch.setUint16(12, dosTime, true); ch.setUint16(14, dosDate, true); ch.setUint32(16, crc, true);
    ch.setUint32(20, size, true); ch.setUint32(24, size, true); ch.setUint16(28, name.length, true);
    ch.setUint32(42, offset, true);
    central.push(new Uint8Array(ch.buffer), name);
    offset += 30 + name.length + size;
  }
  const cdSize = central.reduce((s, p) => s + p.length, 0);
  const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true); end.setUint16(8, files.length, true); end.setUint16(10, files.length, true);
  end.setUint32(12, cdSize, true); end.setUint32(16, offset, true);
  return new Blob([...parts, ...central, new Uint8Array(end.buffer)], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}

/* =========================================================
 * 엑셀(.xlsx) 파일 읽기 — 외부 라이브러리 없이 동작
 * readXlsxRows(ArrayBuffer) → { sheet: 시트이름, rows: [[셀값...], ...] }
 *   셀값: 문자열 / 숫자 / 날짜는 'YYYY-MM-DD' 문자열
 * ========================================================= */
async function unzipEntries(buf) {
  const dv = new DataView(buf), u8 = new Uint8Array(buf);
  let eocd = -1;
  for (let i = buf.byteLength - 22; i >= Math.max(0, buf.byteLength - 65557); i--) {
    if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error('엑셀(.xlsx) 파일 형식이 아닙니다.');
  const count = dv.getUint16(eocd + 10, true);
  let p = dv.getUint32(eocd + 16, true);
  const out = new Map();
  for (let k = 0; k < count; k++) {
    if (dv.getUint32(p, true) !== 0x02014b50) break;
    const method = dv.getUint16(p + 10, true), csize = dv.getUint32(p + 20, true);
    const nlen = dv.getUint16(p + 28, true), elen = dv.getUint16(p + 30, true), clen = dv.getUint16(p + 32, true);
    const lho = dv.getUint32(p + 42, true);
    const name = new TextDecoder().decode(u8.subarray(p + 46, p + 46 + nlen));
    p += 46 + nlen + elen + clen;
    const start = lho + 30 + dv.getUint16(lho + 26, true) + dv.getUint16(lho + 28, true);
    out.set(name.replace(/^\//, ''), { method, data: u8.subarray(start, start + csize) });
  }
  return {
    has: n => out.has(n),
    async text(n) {
      const e = out.get(n);
      if (!e) return null;
      let bytes = e.data;
      if (e.method === 8) {
        if (typeof DecompressionStream === 'undefined') throw new Error('이 브라우저는 엑셀 불러오기를 지원하지 않습니다. 최신 크롬이나 엣지를 사용하세요.');
        const ds = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
        bytes = new Uint8Array(await new Response(ds).arrayBuffer());
      } else if (e.method !== 0) throw new Error('지원하지 않는 압축 방식입니다.');
      return new TextDecoder().decode(bytes);
    },
  };
}

function parseXml(s) { return new DOMParser().parseFromString(s, 'application/xml'); }
function tags(node, name) { return Array.from(node.getElementsByTagNameNS('*', name)); }
function kids(node, name) { return Array.from(node.childNodes).filter(n => n.localName === name); }

function isDateFormat(id, code) {
  if ((id >= 14 && id <= 22) || (id >= 45 && id <= 47) || (id >= 27 && id <= 36) || (id >= 50 && id <= 58)) return true;
  if (!code) return false;
  const c = code.replace(/"[^"]*"/g, '').replace(/\[[^\]]*\]/g, '').replace(/\\./g, '');
  return /[ymd]/i.test(c) && !/^[#0,.\s;-]*$/.test(c);
}
function excelSerialToIso(n) {
  return new Date(Date.UTC(1899, 11, 30) + Math.round(n * 86400000)).toISOString().slice(0, 10);
}

async function readXlsxRows(buf, preferSheet) {
  const z = await unzipEntries(buf);
  if (!z.has('xl/workbook.xml')) throw new Error('엑셀(.xlsx) 파일 형식이 아닙니다.');
  const wb = parseXml(await z.text('xl/workbook.xml'));
  const rels = parseXml(await z.text('xl/_rels/workbook.xml.rels') || '<r/>');
  const relMap = {};
  tags(rels, 'Relationship').forEach(r => { relMap[r.getAttribute('Id')] = r.getAttribute('Target'); });
  const sheets = tags(wb, 'sheet').map(s => {
    const rid = s.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships', 'id') || s.getAttribute('r:id');
    let t = relMap[rid] || '';
    t = t.startsWith('/') ? t.slice(1) : 'xl/' + t.replace(/^\.\//, '');
    return { name: s.getAttribute('name'), path: t };
  });
  if (!sheets.length) throw new Error('시트를 찾지 못했습니다.');
  const sheet = sheets.find(s => preferSheet && preferSheet.test(s.name)) || sheets[0];

  // 공유 문자열
  const shared = [];
  const sst = await z.text('xl/sharedStrings.xml');
  if (sst) {
    tags(parseXml(sst), 'si').forEach(si => {
      const direct = kids(si, 't');
      shared.push(direct.length ? direct.map(t => t.textContent).join('')
        : kids(si, 'r').map(r => kids(r, 't').map(t => t.textContent).join('')).join(''));
    });
  }
  // 날짜 서식 판별
  const dateStyle = [];
  const st = await z.text('xl/styles.xml');
  if (st) {
    const sx = parseXml(st);
    const custom = {};
    tags(sx, 'numFmt').forEach(f => { custom[+f.getAttribute('numFmtId')] = f.getAttribute('formatCode'); });
    const cellXfs = tags(sx, 'cellXfs')[0];
    if (cellXfs) kids(cellXfs, 'xf').forEach((xf, i) => {
      const id = +xf.getAttribute('numFmtId') || 0;
      dateStyle[i] = isDateFormat(id, custom[id]);
    });
  }

  const doc = parseXml(await z.text(sheet.path) || '<w/>');
  const rows = [];
  tags(doc, 'row').forEach(rowEl => {
    const rIdx = (+rowEl.getAttribute('r') || rows.length + 1) - 1;
    const row = [];
    let next = 0;
    kids(rowEl, 'c').forEach(c => {
      const ref = c.getAttribute('r');
      let col = next;
      if (ref) {
        const letters = ref.match(/^[A-Z]+/)[0];
        col = 0; for (const ch of letters) col = col * 26 + (ch.charCodeAt(0) - 64); col--;
      }
      next = col + 1;
      const t = c.getAttribute('t'), s = +c.getAttribute('s') || 0;
      const vEl = kids(c, 'v')[0];
      let v = vEl ? vEl.textContent : null;
      if (t === 's') v = shared[+v] ?? '';
      else if (t === 'inlineStr') v = tags(c, 't').map(x => x.textContent).join('');
      else if (t === 'str' || t === 'e') v = v ?? '';
      else if (t === 'b') v = v === '1' ? 'TRUE' : 'FALSE';
      else if (v !== null) { v = Number(v); if (dateStyle[s] && isFinite(v)) v = excelSerialToIso(v); }
      row[col] = v;
    });
    rows[rIdx] = row;
  });
  return { sheet: sheet.name, rows: Array.from(rows, r => r || []) };
}
