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
 * 資料整理規則：
 * - 分班：依「班級與座號／姓名」開頭的班級代碼寫入「205班」「209班」「213班」「216班」分頁；
 *   沒有班級代碼的資料寫入「未分班」。四個班級分頁會自動建立。
 * - 去重複：同一班、同一姓名（不看座號與空白）只保留最後送出的一筆。
 * - 排序：每個分頁都依地理位置排序（由竹園岡・臺南一中出發，最鄰近者優先）。
 * - 舊版「書籤投稿資料」分頁的資料，會在下一次有人送出時自動搬到各班分頁。
 * - 試算表上方選單「書籤工具 → 重新整理」可手動重跑一次分班、去重複與排序。
 *
 * 穩定性：
 * - 同時寫入時以 LockService 排隊，拿不到鎖會回報 busy，網頁端會自動重試
 * - 圖片超過儲存格上限時存成空白，不會存成截斷的壞圖
 */

var BACKEND_VERSION = 3;
var CLASS_CODES = ['205', '209', '213', '216'];
var UNASSIGNED_SHEET_NAME = '未分班';
var LEGACY_SHEET_NAME = '書籤投稿資料';
var CLASS_SHEET_PATTERN = /^\\d{3}班$/;
var ANCHOR = { x: 43.2, y: 72.8 };
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
var COL = { id: 0, createdAt: 1, studentInfo: 2, mapX: 6, mapY: 7 };

// ---------------------------------------------------------------------------
// 規則：班級、學生識別、地理排序
// ---------------------------------------------------------------------------

/** 「205-05王小明」→「205」；沒有班級代碼回傳空字串 */
function classOf_(studentInfo) {
  var m = String(studentInfo || '').replace(/\\s+/g, '').match(/^(\\d{3})-/);
  return m ? m[1] : '';
}

function sheetNameFor_(studentInfo) {
  var c = classOf_(studentInfo);
  return c ? c + '班' : UNASSIGNED_SHEET_NAME;
}

/** 同一位學生的識別：班級＋姓名（忽略座號與空白），例如「205|王小明」 */
function studentKey_(studentInfo) {
  var s = String(studentInfo || '').replace(/\\s+/g, '');
  var m = s.match(/^(\\d{3})-(.*)$/);
  if (m) {
    var name = m[2].replace(/^\\d+/, '');
    return m[1] + '|' + (name || m[2]);
  }
  return s;
}

/** 由竹園岡出發，每次挑最近的下一個地點（與網頁 A4 拼版的排序相同） */
function geoSortRows_(rows) {
  var remaining = rows.slice();
  var ordered = [];
  var cx = ANCHOR.x;
  var cy = ANCHOR.y;
  while (remaining.length) {
    var best = 0;
    var bestDist = Infinity;
    for (var i = 0; i < remaining.length; i++) {
      var x = Number(remaining[i][COL.mapX]) || ANCHOR.x;
      var y = Number(remaining[i][COL.mapY]) || ANCHOR.y;
      var d = Math.sqrt((x - cx) * (x - cx) + (y - cy) * (y - cy));
      if (d < bestDist) {
        bestDist = d;
        best = i;
      }
    }
    var picked = remaining.splice(best, 1)[0];
    ordered.push(picked);
    cx = Number(picked[COL.mapX]) || ANCHOR.x;
    cy = Number(picked[COL.mapY]) || ANCHOR.y;
  }
  return ordered;
}

// ---------------------------------------------------------------------------
// 分頁讀寫
// ---------------------------------------------------------------------------

function getOrCreateSheet_(name) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(name);
  if (!sheet) {
    try {
      sheet = ss.insertSheet(name);
    } catch (err) {
      // 同時有兩個請求建立同一分頁時，另一個可能已先建立
      sheet = ss.getSheetByName(name);
      if (!sheet) throw err;
    }
  }
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(HEADERS);
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function ensureClassSheets_() {
  for (var i = 0; i < CLASS_CODES.length; i++) {
    getOrCreateSheet_(CLASS_CODES[i] + '班');
  }
}

/** 所有存放投稿的分頁：各班級分頁、未分班、舊版總表 */
function getDataSheets_() {
  var sheets = SpreadsheetApp.getActiveSpreadsheet().getSheets();
  var result = [];
  for (var i = 0; i < sheets.length; i++) {
    var name = sheets[i].getName();
    if (CLASS_SHEET_PATTERN.test(name) || name === UNASSIGNED_SHEET_NAME || name === LEGACY_SHEET_NAME) {
      result.push(sheets[i]);
    }
  }
  return result;
}

function readRows_(sheet) {
  var lastRow = sheet.getLastRow();
  if (lastRow <= 1) return [];
  var values = sheet.getRange(2, 1, lastRow - 1, HEADERS.length).getValues();
  var rows = [];
  for (var i = 0; i < values.length; i++) {
    if (values[i][COL.id] || values[i][COL.studentInfo]) rows.push(values[i]);
  }
  return rows;
}

/** 以 rows 覆寫分頁的資料區（保留標題列） */
function writeRows_(sheet, rows) {
  var lastRow = sheet.getLastRow();
  if (lastRow > 1) {
    sheet.getRange(2, 1, lastRow - 1, HEADERS.length).clearContent();
  }
  if (rows.length) {
    sheet.getRange(2, 1, rows.length, HEADERS.length).setValues(rows);
  }
}

/** 儲存格上限 50,000 字元；超過時寧可留白，也不要截斷成無法顯示的壞圖 */
function imageForCell_(dataUrl) {
  var s = String(dataUrl || '');
  return s.length <= 49000 ? s : '';
}

function bookmarkToRow_(bm) {
  return [
    String(bm.id || ('gs-' + new Date().getTime())),
    Number(bm.createdAt) || new Date().getTime(),
    String(bm.studentInfo || ''),
    String(bm.locationZone || ''),
    String(bm.customZoneName || ''),
    String(bm.landmarkLabel || ''),
    bm.mapCoords && bm.mapCoords.x ? Number(bm.mapCoords.x) : ANCHOR.x,
    bm.mapCoords && bm.mapCoords.y ? Number(bm.mapCoords.y) : ANCHOR.y,
    String(bm.sideAText || ''),
    String(bm.visualMode || 'blank-sketch'),
    Boolean(bm.dotGrid),
    String(bm.interviewee || ''),
    String(bm.sideBText || ''),
    imageForCell_(bm.imageDataUrl)
  ];
}

function rowToBookmark_(r) {
  return {
    id: String(r[0]),
    createdAt: Number(r[1]) || 0,
    studentInfo: String(r[2] || ''),
    locationZone: String(r[3] || '臺南・府城舊城區'),
    customZoneName: String(r[4] || ''),
    landmarkLabel: String(r[5] || ''),
    mapCoords: {
      x: Number(r[6]) || ANCHOR.x,
      y: Number(r[7]) || ANCHOR.y
    },
    sideAText: String(r[8] || ''),
    visualMode: String(r[9] || 'blank-sketch'),
    dotGrid: r[10] === true || String(r[10]).toLowerCase() === 'true',
    interviewee: String(r[11] || ''),
    sideBText: String(r[12] || ''),
    imageDataUrl: String(r[13] || '')
  };
}

// ---------------------------------------------------------------------------
// 寫入、刪除、整理
// ---------------------------------------------------------------------------

/**
 * 新增或更新一筆作品：
 * - 先移除同 id 或同一位學生（班級＋姓名）的舊資料，只保留 createdAt 最新的一筆
 * - 寫入所屬班級分頁並依地理位置排序
 */
function upsertBookmark_(bm) {
  var incoming = bookmarkToRow_(bm);
  var id = String(incoming[COL.id]);
  var key = studentKey_(incoming[COL.studentInfo]);
  var targetName = sheetNameFor_(incoming[COL.studentInfo]);

  // 先檢查是否有同一位學生「更新」的資料（例如舊的補送晚到），有的話保留較新的那筆
  var sheets = getDataSheets_();
  var perSheet = [];
  for (var s = 0; s < sheets.length; s++) {
    var rows = readRows_(sheets[s]);
    perSheet.push({ sheet: sheets[s], rows: rows });
    for (var i = 0; i < rows.length; i++) {
      var r = rows[i];
      if (
        String(r[COL.id]) !== id &&
        studentKey_(r[COL.studentInfo]) === key &&
        Number(r[COL.createdAt]) > Number(incoming[COL.createdAt])
      ) {
        return 'stale';
      }
    }
  }

  var target = getOrCreateSheet_(targetName);
  var targetRows = null;
  for (var p = 0; p < perSheet.length; p++) {
    var item = perSheet[p];
    var kept = [];
    for (var j = 0; j < item.rows.length; j++) {
      var row = item.rows[j];
      var same = String(row[COL.id]) === id || studentKey_(row[COL.studentInfo]) === key;
      if (!same) kept.push(row);
    }
    if (item.sheet.getName() === targetName) {
      targetRows = kept;
    } else if (kept.length !== item.rows.length) {
      writeRows_(item.sheet, kept);
    }
  }
  if (!targetRows) targetRows = readRows_(target);
  targetRows.push(incoming);
  writeRows_(target, geoSortRows_(targetRows));
  return 'saved';
}

function deleteBookmark_(id) {
  var sheets = getDataSheets_();
  for (var s = 0; s < sheets.length; s++) {
    var rows = readRows_(sheets[s]);
    var kept = rows.filter(function (r) {
      return String(r[COL.id]) !== String(id);
    });
    if (kept.length !== rows.length) writeRows_(sheets[s], kept);
  }
}

/** 全部重新整理：分班、去重複（保留最新）、各分頁依地理位置排序 */
function reorganize_() {
  ensureClassSheets_();
  var sheets = getDataSheets_();
  var latestByKey = {};
  var order = [];
  for (var s = 0; s < sheets.length; s++) {
    var rows = readRows_(sheets[s]);
    for (var i = 0; i < rows.length; i++) {
      var r = rows[i];
      var key = studentKey_(r[COL.studentInfo]) || String(r[COL.id]);
      var prev = latestByKey[key];
      if (!prev) order.push(key);
      if (!prev || Number(r[COL.createdAt]) >= Number(prev[COL.createdAt])) latestByKey[key] = r;
    }
  }
  var grouped = {};
  for (var k = 0; k < order.length; k++) {
    var row = latestByKey[order[k]];
    var name = sheetNameFor_(row[COL.studentInfo]);
    (grouped[name] = grouped[name] || []).push(row);
  }
  for (var n in grouped) getOrCreateSheet_(n);
  var all = getDataSheets_();
  for (var a = 0; a < all.length; a++) {
    var sheetName = all[a].getName();
    writeRows_(all[a], geoSortRows_(grouped[sheetName] || []));
  }
}

function hasLegacyData_() {
  var legacy = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(LEGACY_SHEET_NAME);
  return Boolean(legacy && legacy.getLastRow() > 1);
}

// ---------------------------------------------------------------------------
// 網頁應用程式進入點
// ---------------------------------------------------------------------------

function jsonOut_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function doGet(e) {
  try {
    var sheets = getDataSheets_();
    var latestByKey = {};
    var rows = [];
    for (var s = 0; s < sheets.length; s++) {
      var sheetRows = readRows_(sheets[s]);
      for (var i = 0; i < sheetRows.length; i++) {
        var r = sheetRows[i];
        var key = studentKey_(r[COL.studentInfo]) || String(r[COL.id]);
        var prev = latestByKey[key];
        if (!prev || Number(r[COL.createdAt]) >= Number(prev[COL.createdAt])) latestByKey[key] = r;
      }
    }
    for (var k in latestByKey) rows.push(latestByKey[k]);
    var bookmarks = geoSortRows_(rows).map(rowToBookmark_);
    return jsonOut_({ status: 'ok', version: BACKEND_VERSION, bookmarks: bookmarks });
  } catch (err) {
    return jsonOut_({ status: 'error', version: BACKEND_VERSION, message: String(err) });
  }
}

function doPost(e) {
  var lock = LockService.getScriptLock();
  // 全班同時送出時要排隊；拿不到鎖就回報忙碌，讓網頁自動重試，避免同時寫入造成資料遺失
  if (!lock.tryLock(30000)) {
    return jsonOut_({ status: 'error', version: BACKEND_VERSION, message: 'busy' });
  }
  try {
    var raw = e && e.postData && e.postData.contents ? e.postData.contents : '{}';
    var payload = JSON.parse(raw);
    var action = payload.action || 'upsert';
    var result = 'ok';

    // 舊版總表還有資料時，先一次搬到各班分頁
    if (hasLegacyData_()) reorganize_();

    if (action === 'delete' && payload.id) {
      deleteBookmark_(payload.id);
    } else if (action === 'syncAll' && Array.isArray(payload.bookmarks)) {
      for (var j = 0; j < payload.bookmarks.length; j++) {
        upsertBookmark_(payload.bookmarks[j]);
      }
    } else if (action === 'reorganize') {
      reorganize_();
    } else if (payload.bookmark) {
      result = upsertBookmark_(payload.bookmark);
    }

    SpreadsheetApp.flush();
    return jsonOut_({ status: 'ok', version: BACKEND_VERSION, action: action, result: result });
  } catch (err) {
    return jsonOut_({ status: 'error', version: BACKEND_VERSION, message: String(err) });
  } finally {
    lock.releaseLock();
  }
}

// ---------------------------------------------------------------------------
// 試算表選單（老師可手動整理）
// ---------------------------------------------------------------------------

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('書籤工具')
    .addItem('重新整理：分班、去重複、依地理排序', 'reorganizeAll')
    .addToUi();
}

function reorganizeAll() {
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    reorganize_();
    SpreadsheetApp.flush();
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
