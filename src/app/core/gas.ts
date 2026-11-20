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
 * 3. 點擊右上角「部署」→「新增部署作業」→ 類型選「網頁應用程式」
 *    - 執行身分：我 (您的 Google 帳號)
 *    - 誰可以存取：所有人 (確保學生從 Google 協作平台投稿可寫入)
 * 4. 複製產生的「網頁應用程式網址 (.../exec)」貼回教師後台即可連動！
 *    （更新程式碼時請用「管理部署作業 → 編輯 → 新版本」，網址才不會改變）
 *
 * 班級分頁：
 * - 依「班級與座號／姓名」開頭的班級代碼（例如 205-05王小明）自動寫入「205班」分頁
 * - 沒有班級代碼的資料（例如範例作品）寫入「未分班」分頁
 * - 分頁不存在時會自動建立；老師修改作品的班級時，資料會自動搬到新的班級分頁
 * - 舊版「書籤投稿資料」分頁的資料仍會被讀取；該筆作品下次更新時會自動搬到班級分頁
 */

var UNASSIGNED_SHEET_NAME = '未分班';
var LEGACY_SHEET_NAME = '書籤投稿資料';
var CLASS_SHEET_PATTERN = /^\\d{3}班$/;
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

/** 依學生資訊開頭的班級代碼決定分頁名稱，例如「205-05王小明」→「205班」 */
function classSheetName_(studentInfo) {
  var m = String(studentInfo || '').trim().match(/^(\\d{3})-/);
  return m ? m[1] + '班' : UNASSIGNED_SHEET_NAME;
}

function ensureHeaders_(sheet) {
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(HEADERS);
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function getOrCreateSheet_(name) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
  }
  return ensureHeaders_(sheet);
}

/** 所有存放投稿的分頁：各班級分頁、未分班、舊版總表 */
function getDataSheets_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheets = ss.getSheets();
  var result = [];
  for (var i = 0; i < sheets.length; i++) {
    var name = sheets[i].getName();
    if (
      CLASS_SHEET_PATTERN.test(name) ||
      name === UNASSIGNED_SHEET_NAME ||
      name === LEGACY_SHEET_NAME
    ) {
      result.push(sheets[i]);
    }
  }
  return result;
}

/** 在所有投稿分頁中尋找某個 id，回傳 [{ sheet, row }] */
function findRowsById_(id) {
  var found = [];
  var sheets = getDataSheets_();
  for (var s = 0; s < sheets.length; s++) {
    var sheet = sheets[s];
    var lastRow = sheet.getLastRow();
    if (lastRow <= 1) continue;
    var ids = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
    for (var i = 0; i < ids.length; i++) {
      if (String(ids[i][0]) === String(id)) {
        found.push({ sheet: sheet, row: i + 2 });
      }
    }
  }
  return found;
}

function rowToBookmark_(r, i) {
  return {
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
  };
}

function doGet(e) {
  try {
    var sheets = getDataSheets_();
    var bookmarks = [];
    var seen = {};
    for (var s = 0; s < sheets.length; s++) {
      var sheet = sheets[s];
      var lastRow = sheet.getLastRow();
      if (lastRow <= 1) continue;
      var values = sheet.getRange(2, 1, lastRow - 1, HEADERS.length).getValues();
      for (var i = 0; i < values.length; i++) {
        var r = values[i];
        if (!r[0] && !r[2]) continue;
        var bm = rowToBookmark_(r, sheet.getName() + '-' + i);
        if (seen[bm.id]) continue;
        seen[bm.id] = true;
        bookmarks.push(bm);
      }
    }
    // 新投稿排在最前面
    bookmarks.sort(function (a, b) {
      return (b.createdAt || 0) - (a.createdAt || 0);
    });
    return ContentService
      .createTextOutput(JSON.stringify({ status: 'ok', bookmarks: bookmarks }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ status: 'error', message: String(err) }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function deleteRows_(matches) {
  // 同一分頁由下往上刪，避免列號位移
  matches.sort(function (a, b) {
    return b.row - a.row;
  });
  for (var i = 0; i < matches.length; i++) {
    matches[i].sheet.deleteRow(matches[i].row);
  }
}

function upsertBookmarkRow_(bm) {
  var id = String(bm.id || ('gs-' + new Date().getTime()));
  var targetName = classSheetName_(bm.studentInfo);
  var target = getOrCreateSheet_(targetName);

  var rowData = [
    id,
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

  var matches = findRowsById_(id);
  var inTarget = null;
  var elsewhere = [];
  for (var i = 0; i < matches.length; i++) {
    if (!inTarget && matches[i].sheet.getName() === targetName) {
      inTarget = matches[i];
    } else {
      elsewhere.push(matches[i]);
    }
  }

  if (inTarget) {
    target.getRange(inTarget.row, 1, 1, HEADERS.length).setValues([rowData]);
  } else {
    target.appendRow(rowData);
  }
  // 班級變更（或從舊版總表搬移）時，移除其他分頁中的舊資料
  if (elsewhere.length) deleteRows_(elsewhere);
}

function doPost(e) {
  var lock = LockService.getScriptLock();
  lock.tryLock(10000);
  try {
    var raw = e && e.postData && e.postData.contents ? e.postData.contents : '{}';
    var payload = JSON.parse(raw);
    var action = payload.action || 'upsert';

    if (action === 'delete' && payload.id) {
      deleteRows_(findRowsById_(payload.id));
    } else if (action === 'syncAll' && Array.isArray(payload.bookmarks)) {
      for (var j = 0; j < payload.bookmarks.length; j++) {
        upsertBookmarkRow_(payload.bookmarks[j]);
      }
    } else if (payload.bookmark) {
      upsertBookmarkRow_(payload.bookmark);
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
