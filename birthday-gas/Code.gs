/**
 * Google Apps Script backend for birthday.html.
 * Script properties:
 *   BIRTHDAY_SHEET_ID = spreadsheet ID (or reuse SHEET_ID)
 * The web app supports JSONP reads and form-encoded writes for GitHub Pages.
 */
function doGet(e) {
  var params = (e && e.parameter) || {};
  var callback = String(params.callback || '');
  var result;
  try {
    if (params.action !== 'list') throw new Error('Unsupported action');
    result = { ok: true, data: readBirthdays_() };
  } catch (error) {
    console.error(error);
    result = { ok: false, error: '생일 목록을 불러오지 못했습니다.' };
  }
  var json = JSON.stringify(result);
  if (callback && /^[A-Za-z_$][\w$]{0,80}$/.test(callback)) {
    return ContentService.createTextOutput(callback + '(' + json.replace(/</g, '\\u003c') + ');')
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return ContentService.createTextOutput(json).setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  try {
    var params = (e && e.parameter) || {};
    if (params.action !== 'add') throw new Error('Unsupported action');
    var name = cleanText_(params.name, 20);
    var memo = cleanText_(params.memo || '', 30);
    var month = Number(params.month);
    var day = Number(params.day);
    if (!name) throw new Error('이름을 입력해 주세요.');
    if (!Number.isInteger(month) || month < 1 || month > 12 || !Number.isInteger(day) || day < 1 || day > new Date(2000, month, 0).getDate()) {
      throw new Error('올바른 월·일을 입력해 주세요.');
    }

    var lock = LockService.getScriptLock();
    lock.waitLock(10000);
    try {
      var sheet = getBirthdaySheet_();
      sheet.appendRow([new Date(), name, memo, month, day]);
    } finally {
      lock.releaseLock();
    }
    return jsonOutput_({ ok: true });
  } catch (error) {
    console.error(error);
    return jsonOutput_({ ok: false, error: '생일을 저장하지 못했습니다.' });
  }
}

function readBirthdays_() {
  var sheet = getBirthdaySheet_();
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];
  return sheet.getRange(2, 1, lastRow - 1, 5).getValues().map(function(row) {
    return { name: String(row[1] || ''), memo: String(row[2] || ''), month: Number(row[3]), day: Number(row[4]) };
  }).filter(function(item) { return item.name && item.month && item.day; });
}

function getBirthdaySheet_() {
  var props = PropertiesService.getScriptProperties();
  var spreadsheetId = props.getProperty('BIRTHDAY_SHEET_ID') || props.getProperty('SHEET_ID');
  if (!spreadsheetId) throw new Error('Set BIRTHDAY_SHEET_ID (or SHEET_ID) in Script Properties.');
  var spreadsheet = SpreadsheetApp.openById(spreadsheetId);
  var sheet = spreadsheet.getSheetByName('생일') || spreadsheet.insertSheet('생일');
  if (sheet.getLastRow() === 0) sheet.appendRow(['접수 시각', '이름', '소속·메모', '월', '일']);
  return sheet;
}

function cleanText_(value, maxLength) {
  return String(value || '').replace(/[\u0000-\u001F\u007F]/g, ' ').trim().slice(0, maxLength);
}

function jsonOutput_(value) {
  return ContentService.createTextOutput(JSON.stringify(value)).setMimeType(ContentService.MimeType.JSON);
}
