/* 由原 index.html 移植的純函式（保持原演算法不變） */
import type { Bookmark, GasResult } from './models';

// ============================================================================
// 2. Google Apps Script (Code.gs) Template & Cloud Sync Utilities
//    提供完整一鍵複製的 Google Apps Script 程式碼與試算表前後端雙向同步函式
// ============================================================================
export const GOOGLE_APPS_SCRIPT_CODE = `/**
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
}`;

// 取得書籤當前選用濾鏡的圖片 DataURL
export function resolveActiveBookmarkImage(bm: Bookmark | null | undefined): string {
  if (!bm) return '';
  const vm = bm.visualMode || 'blank-sketch';
  if (vm === 'blank-sketch') return '';
  if (vm === 'original') return bm.originalImage || bm.imageDataUrl || '';
  if (vm === 'woodcut' || vm === 'pen-sketch') {
    return bm.woodcutImage || bm.sketchImage || bm.imageDataUrl || bm.originalImage || '';
  }
  if (vm === 'oil-painting') {
    return bm.oilPaintingImage || bm.imageDataUrl || bm.originalImage || '';
  }
  if (vm === 'watercolor') return bm.watercolorImage || bm.imageDataUrl || bm.originalImage || '';
  if (vm === 'mosaic') return bm.mosaicImage || bm.imageDataUrl || bm.originalImage || '';
  return bm.imageDataUrl || '';
}

// 壓縮單張 DataURL 以確保不超過 Google 試算表單一儲存格 50,000 字元上限
export function shrinkDataUrlForGoogleSheets(
  dataUrl: string | undefined,
  maxDim = 440,
  quality = 0.76,
): Promise<string> {
  return new Promise((resolve) => {
    if (!dataUrl || dataUrl.length < 44000) {
      resolve(dataUrl || '');
      return;
    }
    const img = new window.Image();
    img.onload = () => {
      let { width, height } = img;
      if (width > maxDim || height > maxDim) {
        if (width > height) {
          height = Math.round((height * maxDim) / width);
          width = maxDim;
        } else {
          width = Math.round((width * maxDim) / height);
          height = maxDim;
        }
      }
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d')!;
      ctx.fillStyle = '#FAF8F5';
      ctx.fillRect(0, 0, width, height);
      ctx.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.onerror = () => resolve('');
    img.src = dataUrl;
  });
}

export async function postToGoogleAppsScript(gasUrl: string, payload: unknown): Promise<GasResult> {
  if (!gasUrl || !gasUrl.trim()) return { ok: false, skipped: true };
  const cleanUrl = gasUrl.trim();
  const bodyStr = JSON.stringify(payload);
  try {
    const res = await fetch(cleanUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: bodyStr,
      redirect: 'follow',
    });
    const text = await res.text();
    try {
      const json = JSON.parse(text);
      return { ok: json.status === 'ok', data: json };
    } catch {
      return { ok: res.ok };
    }
  } catch {
    // 備援：若受跨網域瀏覽器策略限制，改以 no-cors 送出確保資料寫入試算表
    try {
      await fetch(cleanUrl, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: bodyStr,
      });
      return { ok: true, opaque: true };
    } catch (err2) {
      return { ok: false, error: String(err2) };
    }
  }
}
