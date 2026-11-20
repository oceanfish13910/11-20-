/**
 * 臺南一中 105 歲校慶國文科成果展｜一頁府城・百年書籤
 * Google 試算表雙向同步服務 (Code.gs)
 *
 * 部署步驟：
 * 1. 開啟任一 Google 試算表 → 上方選單「擴充功能」→「Apps Script」
 * 2. 將預設程式碼全選刪除，貼上本完整程式碼並儲存
 * 3. 點擊右上角「部署」→「新增部署」→ 類型選「網頁應用程式」
 *    - 執行身分：我 (您的 Google 帳號)
 *    - 誰可以存取：所有人 (確保學生從 Google 協作平台投稿可寫入)
 * 4. 複製產生的「網頁應用程式網址 (.../exec)」貼回教師後台即可連動！
 */

var SHEET_NAME = '書籤投稿資料';
var HEADERS = [
  'id',
  'createdAt',
  'studentInfo',
  'locationZone',
  'customZoneName',
  'landmarkLabel',
  'mapX',
  'mapY',
  'sideAText',
  'visualMode',
  'dotGrid',
  'interviewee',
  'sideBText',
  'imageDataUrl'
];

function getOrCreateSheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
    sheet.appendRow(HEADERS);
    sheet.setFrozenRows(1);
  } else if (sheet.getLastRow() === 0) {
    sheet.appendRow(HEADERS);
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function doGet(e) {
  try {
    var sheet = getOrCreateSheet_();
    var lastRow = sheet.getLastRow();
    var bookmarks = [];
    if (lastRow > 1) {
      var values = sheet.getRange(2, 1, lastRow - 1, HEADERS.length).getValues();
      for (var i = 0; i < values.length; i++) {
        var r = values[i];
        if (!r[0] && !r[2]) continue;
        bookmarks.push({
          id: String(r[0] || ('gs-' + i)),
          createdAt: Number(r[1]) || Date.now(),
          studentInfo: String(r[2] || ''),
          locationZone: String(r[3] || '臺南・府城舊城區'),
          customZoneName: String(r[4] || ''),
          landmarkLabel: String(r[5] || ''),
          mapCoords: {
            x: Number(r[6]) || 43.2,
            y: Number(r[7]) || 72.8
          },
          sideAText: String(r[8] || ''),
          visualMode: String(r[9] || 'blank-sketch'),
          dotGrid: r[10] === true || String(r[10]).toLowerCase() === 'true',
          interviewee: String(r[11] || ''),
          sideBText: String(r[12] || ''),
          imageDataUrl: String(r[13] || '')
        });
      }
    }
    return ContentService
      .createTextOutput(JSON.stringify({ status: 'ok', bookmarks: bookmarks.reverse() }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ status: 'error', message: String(err) }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function upsertBookmarkRow_(sheet, bm) {
  var lastRow = sheet.getLastRow();
  var targetRow = -1;
  if (lastRow > 1) {
    var ids = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
    for (var i = 0; i < ids.length; i++) {
      if (String(ids[i][0]) === String(bm.id)) {
        targetRow = i + 2;
        break;
      }
    }
  }
  var rowData = [
    String(bm.id || ('gs-' + new Date().getTime())),
    Number(bm.createdAt) || new Date().getTime(),
    String(bm.studentInfo || ''),
    String(bm.locationZone || ''),
    String(bm.customZoneName || ''),
    String(bm.landmarkLabel || ''),
    bm.mapCoords && bm.mapCoords.x ? Number(bm.mapCoords.x) : 43.2,
    bm.mapCoords && bm.mapCoords.y ? Number(bm.mapCoords.y) : 72.8,
    String(bm.sideAText || ''),
    String(bm.visualMode || 'blank-sketch'),
    Boolean(bm.dotGrid),
    String(bm.interviewee || ''),
    String(bm.sideBText || ''),
    String(bm.imageDataUrl || '').slice(0, 48000)
  ];
  if (targetRow > 0) {
    sheet.getRange(targetRow, 1, 1, HEADERS.length).setValues([rowData]);
  } else {
    sheet.appendRow(rowData);
  }
}

function doPost(e) {
  var lock = LockService.getScriptLock();
  lock.tryLock(10000);
  try {
    var sheet = getOrCreateSheet_();
    var raw = e && e.postData && e.postData.contents ? e.postData.contents : '{}';
    var payload = JSON.parse(raw);
    var action = payload.action || 'upsert';

    if (action === 'delete' && payload.id) {
      var lastRow = sheet.getLastRow();
      if (lastRow > 1) {
        var ids = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
        for (var i = ids.length - 1; i >= 0; i--) {
          if (String(ids[i][0]) === String(payload.id)) {
            sheet.deleteRow(i + 2);
          }
        }
      }
    } else if (action === 'syncAll' && Array.isArray(payload.bookmarks)) {
      for (var j = 0; j < payload.bookmarks.length; j++) {
        upsertBookmarkRow_(sheet, payload.bookmarks[j]);
      }
    } else if (payload.bookmark) {
      upsertBookmarkRow_(sheet, payload.bookmark);
    }

    return ContentService
      .createTextOutput(JSON.stringify({ status: 'ok', action: action }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ status: 'error', message: String(err) }))
      .setMimeType(ContentService.MimeType.JSON);
  } finally {
    lock.releaseLock();
  }
}
