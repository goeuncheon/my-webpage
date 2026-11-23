/**
 * 디지털 학급 보상상점 — Code.gs
 * 파일: Code.gs, Store.html
 * 스크립트 속성: TEACHER_PASSWORD(교사 암호 — 꼭 설정), SPREADSHEET_ID(선택: 독립 프로젝트일 때)
 * 시트(자동 생성): Students[학생ID|학생이름|비밀번호(PIN)|잔액포인트] / Items[상품ID|상품명|가격|재고|설명]
 *                  / History[일시|학생이름|구매아이템|차감포인트|승인상태|ID|학생ID]
 * PIN 분실: 교사가 Students 시트의 PIN 칸을 직접 고치면 돼요(C열은 '일반 텍스트' 서식, 4자리).
 */
var H = {
  Students: ['학생ID', '학생이름', '비밀번호(PIN)', '잔액포인트'],
  Items: ['상품ID', '상품명', '가격', '재고', '설명'],
  History: ['일시', '학생이름', '구매아이템', '차감포인트', '승인상태', 'ID', '학생ID']
};

function doGet() {
  return HtmlService.createHtmlOutputFromFile('Store')
    .setTitle('디지털 학급 보상상점')
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
  var ss = ss_(), sh = ss.getSheetByName(name), fresh = !sh;
  if (fresh) sh = ss.insertSheet(name);
  if (sh.getLastRow() === 0) {
    sh.appendRow(H[name]);
    if (name === 'Students') { // 예시 데이터 — 실제 학생으로 바꿔 쓰세요.
      sh.getRange('C:C').setNumberFormat('@');
      sh.getRange(2, 1, 3, 4).setValues([['S01', '예시학생1', '0101', 10], ['S02', '예시학생2', '0202', 5], ['S03', '예시학생3', '0303', 0]]);
    }
    if (name === 'Items') sh.getRange(2, 1, 3, 5).setValues([['I01', '자리 바꾸기권', 5, 10, '원하는 자리로 바꿔요'], ['I02', '간식 쿠폰', 8, 5, '선생님과 함께 정해요'], ['I03', '숙제 면제권', 15, 2, '숙제 1회 면제']]);
  }
  return sh;
}
function rows_(name) {
  var sh = sh_(name), n = sh.getLastRow(), w = H[name].length;
  return n < 2 ? [] : sh.getRange(2, 1, n - 1, w).getValues();
}
function pad4_(v) { return ('0000' + String(v == null ? '' : v).trim()).slice(-4); }
function clean_(v, n) { return String(v == null ? '' : v).replace(/[\u0000-\u001F\u007F]/g, ' ').trim().slice(0, n); }
function txt_(v) { return /^[=+@\-]/.test(v) ? "'" + v : v; }
function tauth_(pw) {
  var p = prop_('TEACHER_PASSWORD');
  if (!p) throw new Error('관리자가 TEACHER_PASSWORD를 설정해야 해요.');
  if (String(pw || '') !== p) throw new Error('교사 암호가 맞지 않아요.');
}
function stuAuth_(id, pin) {
  var rows = rows_('Students');
  for (var i = 0; i < rows.length; i++) {
    if (String(rows[i][0]) === String(id)) {
      if (pad4_(rows[i][2]) !== pad4_(pin)) throw new Error('PIN이 맞지 않아요.');
      return { row: i + 2, id: String(rows[i][0]), name: String(rows[i][1]), points: Number(rows[i][3]) || 0 };
    }
  }
  throw new Error('학생을 찾을 수 없어요.');
}
function fmt_(v) { return v instanceof Date ? Utilities.formatDate(v, Session.getScriptTimeZone(), 'MM/dd HH:mm') : String(v || ''); }
function hist_(sid, limit) {
  return rows_('History').filter(function (r) { return !sid || String(r[6]) === String(sid); }).reverse().slice(0, limit)
    .map(function (r) { return { at: fmt_(r[0]), name: String(r[1]), item: String(r[2]), cost: Number(r[3]) || 0, status: String(r[4]), id: String(r[5]) }; });
}

// ---- 학생 ----
function getStudentList() { // PIN은 절대 내보내지 않아요.
  return rows_('Students').map(function (r) { return { id: String(r[0]), name: String(r[1]) }; });
}
function getItems() {
  return rows_('Items').map(function (r) { return { id: String(r[0]), name: String(r[1]), price: Number(r[2]) || 0, stock: Number(r[3]) || 0, desc: String(r[4] || '') }; });
}
function login(id, pin) { var s = stuAuth_(id, pin); return { id: s.id, name: s.name, points: s.points }; }
function getMe(id, pin) { var s = stuAuth_(id, pin); return { name: s.name, points: s.points, history: hist_(s.id, 30) }; }

function buy(id, pin, itemId) {
  var lock = LockService.getScriptLock(); lock.waitLock(10000);
  try {
    var s = stuAuth_(id, pin), items = rows_('Items'), at = -1;
    for (var i = 0; i < items.length; i++) if (String(items[i][0]) === String(itemId)) { at = i; break; }
    if (at < 0) throw new Error('상품을 찾을 수 없어요.');
    var price = Number(items[at][2]) || 0, stock = Number(items[at][3]) || 0;
    if (stock < 1) throw new Error('재고가 없어요.');
    if (s.points < price) throw new Error('포인트가 부족해요.');
    sh_('Students').getRange(s.row, 4).setValue(s.points - price);
    sh_('Items').getRange(at + 2, 4).setValue(stock - 1);
    sh_('History').appendRow([new Date(), txt_(s.name), txt_(String(items[at][1])), price, '대기', Utilities.getUuid(), s.id]);
    return { ok: true, points: s.points - price };
  } finally { lock.releaseLock(); }
}

function changePin(id, oldPin, newPin) {
  if (!/^\d{4}$/.test(String(newPin))) throw new Error('새 PIN은 숫자 4자리여야 해요.');
  var s = stuAuth_(id, oldPin);
  var cell = sh_('Students').getRange(s.row, 3);
  cell.setNumberFormat('@'); cell.setValue(String(newPin));
  return { ok: true };
}

// ---- 교사 ----
function teacherCheck(pw) { tauth_(pw); return true; }
function tOverview(pw) {
  tauth_(pw);
  var students = rows_('Students').map(function (r) { return { id: String(r[0]), name: String(r[1]), points: Number(r[3]) || 0 }; });
  var all = hist_('', 200);
  return { students: students, pending: all.filter(function (h) { return h.status === '대기'; }), recent: all.slice(0, 15) };
}
function tAdjust(pw, id, delta, reason) {
  tauth_(pw); delta = parseInt(delta, 10);
  if (!delta) throw new Error('0이 아닌 숫자를 입력해 주세요.');
  var lock = LockService.getScriptLock(); lock.waitLock(10000);
  try {
    var rows = rows_('Students'), at = -1;
    for (var i = 0; i < rows.length; i++) if (String(rows[i][0]) === String(id)) { at = i; break; }
    if (at < 0) throw new Error('학생을 찾을 수 없어요.');
    var np = Math.max(0, (Number(rows[at][3]) || 0) + delta);
    sh_('Students').getRange(at + 2, 4).setValue(np);
    sh_('History').appendRow([new Date(), txt_(String(rows[at][1])), txt_(clean_(reason, 30) || (delta > 0 ? '칭찬 포인트' : '포인트 차감')), -delta, '완료', Utilities.getUuid(), String(rows[at][0])]);
    return { ok: true, points: np };
  } finally { lock.releaseLock(); }
}
function tDecide(pw, hid, approve) {
  tauth_(pw);
  var lock = LockService.getScriptLock(); lock.waitLock(10000);
  try {
    var hs = sh_('History'), rows = rows_('History'), at = -1;
    for (var i = 0; i < rows.length; i++) if (String(rows[i][5]) === String(hid) && String(rows[i][4]) === '대기') { at = i; break; }
    if (at < 0) throw new Error('이미 처리했거나 찾을 수 없는 신청이에요.');
    if (approve) { hs.getRange(at + 2, 5).setValue('승인'); return { ok: true }; }
    hs.getRange(at + 2, 5).setValue('거절'); // 거절하면 포인트와 재고를 돌려줘요.
    var cost = Number(rows[at][3]) || 0, sid = String(rows[at][6]), item = String(rows[at][2]);
    var st = rows_('Students');
    for (var j = 0; j < st.length; j++) if (String(st[j][0]) === sid) { sh_('Students').getRange(j + 2, 4).setValue((Number(st[j][3]) || 0) + cost); break; }
    var it = rows_('Items');
    for (var k = 0; k < it.length; k++) if (String(it[k][1]) === item) { sh_('Items').getRange(k + 2, 4).setValue((Number(it[k][3]) || 0) + 1); break; }
    return { ok: true };
  } finally { lock.releaseLock(); }
}
