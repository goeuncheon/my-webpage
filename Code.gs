/**
 * 나의 활동성향 알아보기 — Code.gs
 * 파일: Code.gs, Survey.html, Dashboard.html
 * 스크립트 속성: CLASS_PASSWORD(학생 입장 암호, 없으면 2026), TEACHER_PASSWORD(교사용 결과 조회 — 꼭 설정),
 *               SPREADSHEET_ID(선택: 독립 프로젝트일 때)
 * 교사용 화면: 배포 URL 뒤에 ?page=dashboard
 */
var AREAS = ['탐구', '표현', '협력', '계획'];
var QN = 20; // 영역당 5문항, 문항 번호 % 4 = 영역 번호

function doGet(e) {
  var dash = e && e.parameter && e.parameter.page === 'dashboard';
  return HtmlService.createHtmlOutputFromFile(dash ? 'Dashboard' : 'Survey')
    .setTitle(dash ? '활동성향 분석 (교사용)' : '나의 활동성향 알아보기')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

function prop_(k) { return PropertiesService.getScriptProperties().getProperty(k); }
function ss_() {
  var id = prop_('SPREADSHEET_ID');
  var ss = id ? SpreadsheetApp.openById(id) : SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) throw new Error('스프레드시트를 찾을 수 없어요. SPREADSHEET_ID를 설정해 주세요.');
  return ss;
}
function sheet_() {
  var ss = ss_(), sh = ss.getSheetByName('응답') || ss.insertSheet('응답');
  if (sh.getLastRow() === 0) {
    var h = ['제출시각', '이름'].concat(AREAS, ['주성향']);
    for (var i = 1; i <= QN; i++) h.push('Q' + i);
    sh.appendRow(h);
  }
  return sh;
}
function clean_(v, n) { return String(v == null ? '' : v).replace(/[\u0000-\u001F\u007F]/g, ' ').trim().slice(0, n); }
function txt_(v) { return /^[=+@\-]/.test(v) ? "'" + v : v; }
function checkClass_(name, pw) {
  name = clean_(name, 10);
  if (!name) throw new Error('이름을 입력해 주세요.');
  if (String(pw || '') !== (prop_('CLASS_PASSWORD') || '2026')) throw new Error('암호가 맞지 않아요.');
  return name;
}
function needsTeacherPassword() { return !!prop_('TEACHER_PASSWORD'); }
function auth_(pw) {
  var p = prop_('TEACHER_PASSWORD');
  if (!p) throw new Error('관리자가 TEACHER_PASSWORD를 설정해야 해요.');
  if (String(pw || '') !== p) throw new Error('교사 비밀번호가 맞지 않아요.');
}

// 학생 로그인 확인
function login(name, pw) { return { ok: true, name: checkClass_(name, pw) }; }

// 응답 저장(같은 이름은 덮어쓰기) + 점수 계산
function submitSurvey(name, pw, answers) {
  name = checkClass_(name, pw);
  var a = (answers || []).map(Number);
  if (a.length !== QN || a.some(function (v) { return !(v >= 1 && v <= 4); }))
    throw new Error('모든 문항에 답해야 제출할 수 있어요.');
  var sc = [0, 0, 0, 0];
  a.forEach(function (v, i) { sc[i % 4] += v; });
  var mx = Math.max.apply(null, sc);
  var main = AREAS.filter(function (n, i) { return sc[i] === mx; }).join('·');
  var lock = LockService.getScriptLock(); lock.waitLock(10000);
  try {
    var sh = sheet_(), n = sh.getLastRow(), at = -1;
    if (n > 1) {
      var names = sh.getRange(2, 2, n - 1, 1).getValues();
      for (var i = 0; i < names.length; i++) if (String(names[i][0]) === name) { at = i + 2; break; }
    }
    var rec = [new Date(), txt_(name)].concat(sc, [main], a);
    if (at > 0) sh.getRange(at, 1, 1, rec.length).setValues([rec]); else sh.appendRow(rec);
    return { scores: sc, main: main };
  } finally { lock.releaseLock(); }
}

// 교사용: 전체 결과
function getResults(pw) {
  auth_(pw);
  var sh = sheet_(), n = sh.getLastRow(), tz = Session.getScriptTimeZone();
  if (n < 2) return [];
  return sh.getRange(2, 1, n - 1, 7).getValues().map(function (r) {
    return { at: Utilities.formatDate(new Date(r[0]), tz, 'MM/dd HH:mm'), name: String(r[1]), scores: [r[2], r[3], r[4], r[5]].map(Number), main: String(r[6]) };
  });
}
