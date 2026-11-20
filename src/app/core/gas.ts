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
 *
 * 穩定性：
 * - 同時寫入時以 LockService 排隊，拿不到鎖會回報 busy，網頁端會自動重試
 * - 圖片超過儲存格上限時存成空白，不會存成截斷的壞圖
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
    try {
      sheet = ss.insertSheet(name);
    } catch (err) {
      // 同時有兩位學生第一次送出同一班時，另一個請求可能已先建立分頁
      sheet = ss.getSheetByName(name);
      if (!sheet) throw err;
    }
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

/** 儲存格上限 50,000 字元；超過時寧可留白，也不要截斷成無法顯示的壞圖 */
function imageForCell_(dataUrl) {
  var s = String(dataUrl || '');
  return s.length <= 49000 ? s : '';
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
    imageForCell_(bm.imageDataUrl)
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
  // 全班同時送出時要排隊；拿不到鎖就回報忙碌，讓網頁自動重試，避免同時寫入造成資料遺失
  if (!lock.tryLock(30000)) {
    return ContentService
      .createTextOutput(JSON.stringify({ status: 'error', message: 'busy' }))
      .setMimeType(ContentService.MimeType.JSON);
  }
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
    SpreadsheetApp.flush();
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

/** 試算表單一儲存格上限 50,000 字元；圖片控制在此長度以下，避免被截斷成壞圖 */
const SHEET_IMAGE_MAX_CHARS = 45000;

function drawToJpeg(img: HTMLImageElement, maxDim: number, quality: number): string {
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
  return canvas.toDataURL('image/jpeg', quality);
}

// 壓縮單張 DataURL，逐步降低尺寸與品質，直到不超過試算表儲存格上限
export function shrinkDataUrlForGoogleSheets(
  dataUrl: string | undefined,
  maxDim = 440,
  quality = 0.76,
): Promise<string> {
  return new Promise((resolve) => {
    if (!dataUrl || dataUrl.length < SHEET_IMAGE_MAX_CHARS) {
      resolve(dataUrl || '');
      return;
    }
    const img = new window.Image();
    img.onload = () => {
      let dim = maxDim;
      let q = quality;
      let out = drawToJpeg(img, dim, q);
      while (out.length >= SHEET_IMAGE_MAX_CHARS && dim > 120) {
        if (q > 0.5) q -= 0.08;
        else dim = Math.round(dim * 0.85);
        out = drawToJpeg(img, dim, q);
      }
      resolve(out.length < SHEET_IMAGE_MAX_CHARS ? out : '');
    };
    img.onerror = () => resolve('');
    img.src = dataUrl;
  });
}

/**
 * 整理成要寫入試算表的資料：只送 Code.gs 會用到的欄位。
 * 原本會連同 5 張濾鏡原圖一起送出（每筆約 440 KB），學校網路不穩時很容易失敗。
 */
export async function toSheetBookmark(bm: Bookmark): Promise<Bookmark> {
  const imageDataUrl = await shrinkDataUrlForGoogleSheets(
    resolveActiveBookmarkImage(bm) || bm.imageDataUrl,
  );
  return {
    id: bm.id,
    createdAt: bm.createdAt,
    studentInfo: bm.studentInfo,
    locationZone: bm.locationZone,
    customZoneName: bm.customZoneName,
    landmarkLabel: bm.landmarkLabel,
    mapCoords: bm.mapCoords,
    sideAText: bm.sideAText,
    visualMode: bm.visualMode,
    dotGrid: bm.dotGrid,
    interviewee: bm.interviewee,
    sideBText: bm.sideBText,
    imageDataUrl,
  };
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** 送出一次：只有收到 Apps Script 回傳 {status:'ok'} 才算成功 */
async function postOnce(url: string, body: string): Promise<GasResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 30000);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body,
      redirect: 'follow',
      signal: controller.signal,
    });
    const text = await res.text();
    try {
      const json = JSON.parse(text);
      return json.status === 'ok'
        ? { ok: true, data: json }
        : {
            ok: false,
            data: json,
            error:
              json.message === 'busy'
                ? '老師的試算表正忙（很多人同時送出），請稍候再按「重新傳送」'
                : String(json.message || 'Apps Script 回傳錯誤'),
          };
    } catch {
      // 回傳的不是 JSON：多半是 Google 登入頁，代表部署權限不是「所有人」
      return {
        ok: false,
        error: `Apps Script 回傳非預期內容（HTTP ${res.status}），請確認部署存取權為「所有人」`,
      };
    }
  } catch (err) {
    return { ok: false, error: String(err) };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * 寫入 Google 試算表。失敗時自動重試（寫入以 id 為準，重送不會產生重複資料）。
 * 只有確認收到 {status:'ok'} 才回傳 ok:true。
 */
export async function postToGoogleAppsScript(
  gasUrl: string,
  payload: unknown,
  retries = 3,
): Promise<GasResult> {
  if (!gasUrl || !gasUrl.trim())
    return { ok: false, skipped: true, error: '尚未設定 Apps Script 網址' };
  const cleanUrl = gasUrl.trim();
  const bodyStr = JSON.stringify(payload);
  let last: GasResult = { ok: false };
  for (let attempt = 0; attempt < retries; attempt++) {
    if (attempt > 0) await sleep(1500 * attempt + Math.random() * 1000);
    last = await postOnce(cleanUrl, bodyStr);
    if (last.ok) return last;
  }
  return last;
}
