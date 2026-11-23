/**
 * 단체 티셔츠 사이즈 조사 — Code.gs
 * 파일: Code.gs, Survey.html, Dashboard.html
 * 스크립트 속성(선택): SPREADSHEET_ID (독립 프로젝트일 때), TEACHER_PASSWORD (대시보드 보호)
 * 대시보드 주소: 배포 URL 뒤에 ?page=dashboard
 */
var SIZES = ['XS', 'S', 'M', 'L', 'XL', '2XL'];
var MAX_NUM = 20;

function doGet(e) {
  var dash = e && e.parameter && e.parameter.page === 'dashboard';
  return HtmlService.createHtmlOutputFromFile(dash ? 'Dashboard' : 'Survey')
    .setTitle(dash ? '티셔츠 주문 현황' : '단체 티셔츠 사이즈 조사')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

function ss_() {
  var id = PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID');
  var ss = id ? SpreadsheetApp.openById(id) : SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) throw new Error('스프레드시트를 찾을 수 없어요. SPREADSHEET_ID를 설정해 주세요.');
  return ss;
}
function sheet_() {
  var ss = ss_(), sh = ss.getSheetByName('응답') || ss.insertSheet('응답');
  if (sh.getLastRow() === 0) sh.appendRow(['번호', '이름', '사이즈', '제출시각']);
  return sh;
}
function rows_() {
  var sh = sheet_(), n = sh.getLastRow();
  return n < 2 ? [] : sh.getRange(2, 1, n - 1, 4).getValues();
}
function clean_(v, n) { return String(v == null ? '' : v).replace(/[\u0000-\u001F\u007F]/g, ' ').trim().slice(0, n); }
function txt_(v) { return /^[=+@\-]/.test(v) ? "'" + v : v; }
function auth_(pw) {
  var p = PropertiesService.getScriptProperties().getProperty('TEACHER_PASSWORD');
  if (p && String(pw || '') !== p) throw new Error('교사 비밀번호가 맞지 않아요.');
}
function needsPassword() { return !!PropertiesService.getScriptProperties().getProperty('TEACHER_PASSWORD'); }
function countsOf_(rows) {
  var c = {}; SIZES.forEach(function (s) { c[s] = 0; });
  rows.forEach(function (r) { if (c[r[2]] !== undefined) c[r[2]]++; });
  return c;
}

// 이름 없이 수량만 돌려줘서 학생 화면에 안전하게 보여줘요.
function getCounts() {
  var r = rows_();
  return { sizes: SIZES, max: MAX_NUM, counts: countsOf_(r), total: r.length };
}

function submitSize(num, name, size) {
  num = parseInt(num, 10); name = clean_(name, 20);
  if (!(num >= 1 && num <= MAX_NUM)) throw new Error('번호는 1~' + MAX_NUM + ' 사이로 골라 주세요.');
  if (!name) throw new Error('이름을 입력해 주세요.');
  if (SIZES.indexOf(size) < 0) throw new Error('사이즈를 골라 주세요.');
  var lock = LockService.getScriptLock(); lock.waitLock(10000);
  try {
    var sh = sheet_(), rows = rows_(), at = -1;
    for (var i = 0; i < rows.length; i++) if (Number(rows[i][0]) === num) { at = i; break; }
    var rec = [num, txt_(name), size, new Date()];
    if (at >= 0) sh.getRange(at + 2, 1, 1, 4).setValues([rec]); else sh.appendRow(rec);
    return { ok: true, updated: at >= 0 };
  } finally { lock.releaseLock(); }
}

function getSummary(pw) {
  auth_(pw);
  var tz = Session.getScriptTimeZone(), rows = rows_();
  return {
    sizes: SIZES, max: MAX_NUM, counts: countsOf_(rows), total: rows.length,
    rows: rows.map(function (r) {
      return { num: Number(r[0]), name: String(r[1]), size: String(r[2]), at: Utilities.formatDate(new Date(r[3]), tz, 'MM/dd HH:mm') };
    }),
    exportUrl: ss_().getUrl().replace(/edit.*$/, 'export?format=xlsx')
  };
}
