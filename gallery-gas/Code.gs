/**
 * Google Apps Script backend for gallery.html.
 * Configure SPREADSHEET_ID and UPLOAD_PASSWORD in Script Properties.
 * Optional: DRIVE_FOLDER_ID to store artwork in a dedicated Drive folder.
 */
function doGet() {
  return HtmlService.createHtmlOutputFromFile('Gallery')
    .setTitle('우리 반 가상 미술관')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

function getArtworks() {
  var sheet = getSheet_('작품', ['ID', '등록 시각', '제목', '작가', 'Drive 파일 ID']);
  var rows = readRows_(sheet, 5);
  return rows.map(function(row) {
    var fileId = String(row[4] || '');
    if (!fileId) return null;
    return {
      id: String(row[0]),
      title: String(row[2] || ''),
      artist: String(row[3] || ''),
      url: 'https://drive.google.com/uc?export=view&id=' + encodeURIComponent(fileId)
    };
  }).filter(function(artwork) { return artwork && artwork.id; });
}

function addArtwork(title, artist, dataUrl, password) {
  title = cleanText_(title, 30);
  artist = cleanText_(artist, 20);
  if (!title || !artist) throw new Error('작품 제목과 작가 이름을 입력해 주세요.');

  var expectedPassword = PropertiesService.getScriptProperties().getProperty('UPLOAD_PASSWORD');
  if (!expectedPassword) throw new Error('관리자가 UPLOAD_PASSWORD를 설정해야 합니다.');
  if (String(password || '') !== expectedPassword) throw new Error('업로드 비밀번호가 맞지 않아요.');

  var match = /^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/=]+)$/.exec(String(dataUrl || ''));
  if (!match) throw new Error('JPEG, PNG 또는 WebP 이미지만 올릴 수 있어요.');
  var bytes = Utilities.base64Decode(match[2]);
  if (!bytes.length || bytes.length > 1024 * 1024) throw new Error('이미지는 1MB 이하만 올릴 수 있어요.');

  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  var file = null;
  try {
    var mimeType = 'image/' + match[1];
    var blob = Utilities.newBlob(bytes, mimeType, safeFileName_(title) + '.' + match[1]);
    var folderId = PropertiesService.getScriptProperties().getProperty('DRIVE_FOLDER_ID');
    file = folderId ? DriveApp.getFolderById(folderId).createFile(blob) : DriveApp.createFile(blob);
    // Artwork is displayed to anonymous visitors, so its Drive file must be link-readable.
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

    var id = Utilities.getUuid();
    getSheet_('작품', ['ID', '등록 시각', '제목', '작가', 'Drive 파일 ID'])
      .appendRow([id, new Date(), sheetText_(title), sheetText_(artist), file.getId()]);
    return { ok: true, id: id };
  } catch (error) {
    if (file) {
      try { file.setTrashed(true); } catch (ignored) {}
    }
    throw new Error('작품을 저장하지 못했어요. Drive 공유 설정과 스크립트 권한을 확인해 주세요.');
  } finally {
    lock.releaseLock();
  }
}

function getComments(artworkId) {
  artworkId = cleanText_(artworkId, 80);
  var sheet = getSheet_('감상평', ['작품 ID', '등록 시각', '이름', '감상평']);
  return readRows_(sheet, 4).filter(function(row) {
    return String(row[0]) === artworkId;
  }).map(function(row) {
    return { author: String(row[2] || '익명'), text: String(row[3] || '') };
  });
}

function addComment(artworkId, author, text) {
  artworkId = cleanText_(artworkId, 80);
  author = cleanText_(author || '익명', 15) || '익명';
  text = cleanText_(text, 200);
  if (!artworkId || !text) throw new Error('감상평을 입력해 주세요.');

  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    var knownArtwork = getSheet_('작품', ['ID', '등록 시각', '제목', '작가', 'Drive 파일 ID']);
    var exists = readRows_(knownArtwork, 1).some(function(row) { return String(row[0]) === artworkId; });
    if (!exists) throw new Error('작품을 찾을 수 없어요. 새로고침해 주세요.');

    getSheet_('감상평', ['작품 ID', '등록 시각', '이름', '감상평'])
      .appendRow([artworkId, new Date(), sheetText_(author), sheetText_(text)]);
    return { ok: true };
  } finally {
    lock.releaseLock();
  }
}

function getSheet_(name, headers) {
  var spreadsheetId = PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID');
  if (!spreadsheetId) throw new Error('관리자가 SPREADSHEET_ID를 설정해야 합니다.');
  var spreadsheet = SpreadsheetApp.openById(spreadsheetId);
  var sheet = spreadsheet.getSheetByName(name) || spreadsheet.insertSheet(name);
  if (sheet.getLastRow() === 0) sheet.appendRow(headers);
  return sheet;
}

function readRows_(sheet, columnCount) {
  var lastRow = sheet.getLastRow();
  return lastRow < 2 ? [] : sheet.getRange(2, 1, lastRow - 1, columnCount).getValues();
}

function cleanText_(value, maxLength) {
  return String(value == null ? '' : value)
    .replace(/[\u0000-\u001F\u007F]/g, ' ')
    .trim()
    .slice(0, maxLength);
}

// Prevent user-provided text from being interpreted as a spreadsheet formula.
function sheetText_(value) {
  return /^[=+@\-]/.test(value) ? "'" + value : value;
}

function safeFileName_(value) {
  return value.replace(/[\\/:*?"<>|]/g, '_').slice(0, 60) || 'artwork';
}
