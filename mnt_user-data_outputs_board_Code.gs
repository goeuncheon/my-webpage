/**
 * 우리 반 스마트 학급 게시판 — Code.gs
 * 파일: Code.gs, Board.html
 * 스크립트 속성: TEACHER_PASSWORD(교사 인증 암호, 예: 1234 — 꼭 설정), SPREADSHEET_ID(선택: 독립 프로젝트일 때)
 * 시트: Notice(공지) / Calendar(일정) / Reply(확인·댓글) — 시트에서 직접 행을 고쳐도 앱에 바로 반영돼요.
 */
var H = {
  Notice: ['ID', '등록일시', '제목', '내용', '필독', '작성자'],
  Calendar: ['ID', '날짜', '제목', '종류', '설명', '준비물'],
  Reply: ['공지ID', '일시', '이름', '구분', '내용']
};

function doGet() {
  return HtmlService.createHtmlOutputFromFile('Board')
    .setTitle('우리 반 스마트 학급 게시판')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

function prop_(k) { return PropertiesService.getScriptProperties().getProperty(k); }
function ss_() {
  var id = prop_('SPREADSHEET_ID');
  var ss = id ? SpreadsheetApp.openById(id) : SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) throw new Error('스프레드시트를 찾을 수 없어요. SPREADSHEET_ID를 설정해 주세요.');
  return ss;
}
function sh_(name) {
  var ss = ss_(), sh = ss.getSheetByName(name) || ss.insertSheet(name);
  if (sh.getLastRow() === 0) sh.appendRow(H[name]);
  return sh;
}
function rows_(name) {
  var sh = sh_(name), n = sh.getLastRow(), w = H[name].length;
  return n < 2 ? [] : sh.getRange(2, 1, n - 1, w).getValues();
}
function clean_(v, n) { return String(v == null ? '' : v).replace(/[\u0000-\u001F\u007F]/g, ' ').trim().slice(0, n); }
function clean2_(v, n) { return String(v == null ? '' : v).replace(/\r/g, '').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').trim().slice(0, n); }
function txt_(v) { return /^[=+@\-]/.test(v) ? "'" + v : v; }
function auth_(pw) {
  var p = prop_('TEACHER_PASSWORD');
  if (!p) throw new Error('관리자가 TEACHER_PASSWORD를 설정해야 해요.');
  if (String(pw || '') !== p) throw new Error('교사 암호가 맞지 않아요.');
}
function teacherCheck(pw) { auth_(pw); return true; }
function dstr_(v) {
  if (v instanceof Date) return Utilities.formatDate(v, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  var m = /(\d{4})\D+(\d{1,2})\D+(\d{1,2})/.exec(String(v));
  return m ? m[1] + '-' + ('0' + m[2]).slice(-2) + '-' + ('0' + m[3]).slice(-2) : '';
}
function tstr_(v) {
  return v instanceof Date ? Utilities.formatDate(v, Session.getScriptTimeZone(), 'MM/dd HH:mm') : String(v || '');
}
function idOf_(row, i) { return row[0] ? String(row[0]) : 'r' + (i + 2); }
function findRow_(name, id) {
  var rows = rows_(name);
  for (var i = 0; i < rows.length; i++) if (idOf_(rows[i], i) === String(id)) return i + 2;
  return -1;
}

// 공지·일정·확인/댓글을 한 번에 불러와요.
function getBoard() {
  var rep = {};
  rows_('Reply').forEach(function (r) {
    var k = String(r[0]); (rep[k] = rep[k] || []).push({ at: tstr_(r[1]), name: String(r[2]), kind: String(r[3]), text: String(r[4]) });
  });
  var notices = rows_('Notice').map(function (r, i) {
    var id = idOf_(r, i), rs = rep[id] || [];
    return {
      id: id, at: tstr_(r[1]), ts: r[1] instanceof Date ? r[1].getTime() : 0, title: String(r[2]), body: String(r[3]),
      must: /^(y|yes|true|필독|o|✓)$/i.test(String(r[4]).trim()), author: String(r[5] || '선생님'),
      confirms: rs.filter(function (x) { return x.kind === '확인'; }).map(function (x) { return x.name; }),
      replies: rs.filter(function (x) { return x.kind === '댓글'; })
    };
  });
  var events = rows_('Calendar').map(function (r, i) {
    return { id: idOf_(r, i), date: dstr_(r[1]), title: String(r[2]), kind: String(r[3] || '기타'), desc: String(r[4] || ''), prep: String(r[5] || '') };
  }).filter(function (e) { return e.date; });
  return { notices: notices, events: events };
}

function confirmNotice(id, name) {
  name = clean_(name, 15); id = clean_(id, 80);
  if (!name) throw new Error('이름을 먼저 입력해 주세요.');
  var lock = LockService.getScriptLock(); lock.waitLock(10000);
  try {
    var dup = rows_('Reply').some(function (r) { return String(r[0]) === id && String(r[2]) === name && String(r[3]) === '확인'; });
    if (!dup) sh_('Reply').appendRow([id, new Date(), txt_(name), '확인', '']);
    return { ok: true };
  } finally { lock.releaseLock(); }
}
function addReply(id, name, text) {
  name = clean_(name, 15); text = clean_(text, 200); id = clean_(id, 80);
  if (!name || !text) throw new Error('이름과 댓글을 입력해 주세요.');
  var lock = LockService.getScriptLock(); lock.waitLock(10000);
  try { sh_('Reply').appendRow([id, new Date(), txt_(name), '댓글', txt_(text)]); return { ok: true }; }
  finally { lock.releaseLock(); }
}

// ---- 교사 전용 ----
function addNotice(pw, title, body, must) {
  auth_(pw); title = clean_(title, 60); body = clean2_(body, 1500);
  if (!title) throw new Error('제목을 입력해 주세요.');
  sh_('Notice').appendRow([Utilities.getUuid(), new Date(), txt_(title), txt_(body), must ? 'Y' : 'N', '선생님']);
  return { ok: true };
}
function deleteNotice(pw, id) {
  auth_(pw); var r = findRow_('Notice', id);
  if (r > 0) sh_('Notice').deleteRow(r);
  return { ok: true };
}
function addEvent(pw, date, title, kind, desc, prep) {
  auth_(pw); date = dstr_(date); title = clean_(title, 60);
  if (!date || !title) throw new Error('날짜와 제목을 입력해 주세요.');
  sh_('Calendar').appendRow([Utilities.getUuid(), date, txt_(title), clean_(kind, 10) || '기타', txt_(clean2_(desc, 500)), txt_(clean_(prep, 200))]);
  return { ok: true };
}
function deleteEvent(pw, id) {
  auth_(pw); var r = findRow_('Calendar', id);
  if (r > 0) sh_('Calendar').deleteRow(r);
  return { ok: true };
}
