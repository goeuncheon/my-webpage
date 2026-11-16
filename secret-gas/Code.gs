/**
 * Google Apps Script backend for secret.html.
 * Configure SHEET_ID and NOTIFY_EMAIL under Project Settings > Script properties.
 */
function doGet() {
  return ContentService.createTextOutput('Secret mailbox endpoint is ready. Submit messages with POST.')
    .setMimeType(ContentService.MimeType.TEXT);
}

function doPost(e) {
  try {
    var props = PropertiesService.getScriptProperties();
    var sheetId = props.getProperty('SHEET_ID');
    if (!sheetId) throw new Error('SHEET_ID is not configured');

    var params = (e && e.parameter) || {};
    var name = cleanCell_(params.name || '익명', 20) || '익명';
    var text = cleanCell_(params.text || '', 1000);
    if (!text) throw new Error('Message is empty');

    var lock = LockService.getScriptLock();
    lock.waitLock(10000);
    try {
      var spreadsheet = SpreadsheetApp.openById(sheetId);
      var sheet = spreadsheet.getSheetByName('고민함') || spreadsheet.insertSheet('고민함');
      if (sheet.getLastRow() === 0) sheet.appendRow(['접수 시각', '이름', '고민 내용']);
      sheet.appendRow([new Date(), name, text]);
    } finally {
      lock.releaseLock();
    }

    var email = props.getProperty('NOTIFY_EMAIL');
    if (email) {
      try {
        MailApp.sendEmail({
          to: email,
          subject: '비밀 우체통에 새 고민이 도착했어요',
          body: '새로운 고민이 Google 스프레드시트에 저장되었습니다.\n\n이름: ' + name + '\n\n내용:\n' + text
        });
      } catch (mailError) {
        console.error('Saved, but notification email failed: ' + mailError);
      }
    }
    return json_({ ok: true });
  } catch (error) {
    console.error(error);
    return json_({ ok: false, error: 'Could not save this message.' });
  }
}

// Avoid spreadsheet formula injection and enforce the same limits as the form.
function cleanCell_(value, maxLength) {
  var result = String(value).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').trim().slice(0, maxLength);
  return /^[=+@\-]/.test(result) ? "'" + result : result;
}

function json_(value) {
  return ContentService.createTextOutput(JSON.stringify(value))
    .setMimeType(ContentService.MimeType.JSON);
}
