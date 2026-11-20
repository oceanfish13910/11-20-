import { Injectable, computed, effect, signal } from '@angular/core';
import { environment } from '../../environments/environment';
import type { Bookmark, GasResult } from './models';
import { postToGoogleAppsScript, toSheetBookmark } from './gas';
import { geoSorted, keepLatestPerStudent, studentKey } from './student-key';
import {
  GAS_URL_STORAGE_KEY,
  INITIAL_BOOKMARKS,
  LEGACY_STORAGE_KEY,
  LOCATION_ZONES,
  PASSCODE_STORAGE_KEY,
  STORAGE_KEY,
} from './constants';

export interface Toast {
  message: string;
  type: 'success' | 'error';
  id: number;
}

function readUrlParams(): { mode: string | null; gasUrl: string } {
  try {
    const sp = new URLSearchParams(window.location.search);
    return { mode: sp.get('mode'), gasUrl: sp.get('gasUrl') || '' };
  } catch {
    return { mode: null, gasUrl: '' };
  }
}

function safeGet(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSet(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch (e) {
    console.warn('localStorage write skipped:', e);
  }
}

/** 全站共用狀態：書籤資料、Google 試算表連線、Toast、教師驗證 */
@Injectable({ providedIn: 'root' })
export class AppStore {
  /** 解析網址參數（?mode=student | ?mode=teacher | ?gasUrl=...） */
  readonly urlParams = readUrlParams();
  readonly isForcedStudentMode = this.urlParams.mode === 'student';

  /** Google Apps Script 網址：網址參數 > localStorage > environment.ts */
  readonly gasUrl = signal<string>(this.initGasUrl());
  readonly isSyncingCloud = signal(false);
  readonly lastSyncTime = signal<string | null>(null);

  readonly teacherPasscode = signal<string>(
    safeGet(PASSCODE_STORAGE_KEY) ?? environment.defaultTeacherPasscode,
  );

  readonly activeView = signal<'student' | 'teacher'>(
    this.urlParams.mode === 'teacher' && !this.teacherPasscode() ? 'teacher' : 'student',
  );

  readonly bookmarks = signal<Bookmark[]>(this.initBookmarks());

  /** 試算表後端（Code.gs）回報的版本；null 表示尚未讀取 */
  readonly backendVersion = signal<number | null>(null);
  /** 目前網站需要的 Code.gs 版本（分班、去重複、地理排序） */
  readonly requiredBackendVersion = 3;

  readonly toast = signal<Toast | null>(null);

  // ---- A4 列印佇列（教師後台與全頁列印容器共用）----
  /**
   * null 代表「全部作品、依地理位置排序」（預設，之後拉進來的新作品也會自動加入）；
   * 老師手動勾選或排序後，改為明確的 id 清單。
   */
  readonly selectedPrintIds = signal<string[] | null>(null);
  readonly printPreviewSide = signal<'front' | 'back'>('front');
  readonly showCropMarks = signal(true);

  /** 依地理位置排序的全部作品 */
  readonly sortedBookmarks = computed(() => geoSorted(this.bookmarks()));

  /** 列印佇列：一律依地理位置排序，相鄰地標會排在同一張 A4 */
  readonly selectedPrintBookmarks = computed(() => {
    const ids = this.selectedPrintIds();
    if (ids === null) return this.sortedBookmarks();
    const chosen = new Set(ids);
    return this.sortedBookmarks().filter((b) => chosen.has(b.id));
  });

  /** 每 4 枚書籤自動分成 1 張 A4 橫式頁面 */
  readonly a4PrintPages = computed<Bookmark[][]>(() => {
    const list = this.selectedPrintBookmarks();
    if (list.length === 0) return [[]];
    const pages: Bookmark[][] = [];
    for (let i = 0; i < list.length; i += 4) pages.push(list.slice(i, i + 4));
    return pages;
  });

  /** 送出過但還沒確認寫進試算表的作品（cloudSynced === false） */
  readonly pendingUploads = computed(() => this.bookmarks().filter((b) => b.cloudSynced === false));
  readonly isRetryingUploads = signal(false);

  readonly stats = computed(() => {
    let tainanCount = 0;
    let outerCount = 0;
    this.bookmarks().forEach((bm) => {
      const z = LOCATION_ZONES.find((item) => item.name === bm.locationZone);
      if (z?.isTainan) tainanCount++;
      else outerCount++;
    });
    return { total: this.bookmarks().length, tainanCount, outerCount };
  });

  constructor() {
    // 書籤資料變動時寫回本機
    effect(() => safeSet(STORAGE_KEY, JSON.stringify(this.bookmarks())));

    // 上次沒送成功的作品（例如網路斷線），重新開啟網頁時自動補送
    setTimeout(() => {
      if (this.gasUrl() && this.pendingUploads().length > 0) {
        void this.retryPendingUploads(true);
      }
    }, 2000);
  }

  private initGasUrl(): string {
    if (this.urlParams.gasUrl) {
      safeSet(GAS_URL_STORAGE_KEY, this.urlParams.gasUrl);
      return this.urlParams.gasUrl;
    }
    return safeGet(GAS_URL_STORAGE_KEY) || environment.gasUrl;
  }

  private initBookmarks(): Bookmark[] {
    try {
      const saved = safeGet(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return keepLatestPerStudent(parsed);
      }
      // 第一次使用新鍵值：從舊鍵值搬過來「本站送出但還沒寫進試算表」的作品（舊版網站的資料不搬）
      const legacy = safeGet(LEGACY_STORAGE_KEY);
      if (legacy) {
        const parsed = JSON.parse(legacy);
        if (Array.isArray(parsed)) {
          const pending = parsed.filter((b: Bookmark) => b && b.cloudSynced === false);
          if (pending.length) return keepLatestPerStudent(pending);
        }
      }
    } catch (e) {
      console.warn('localStorage read skipped:', e);
    }
    // 已連動試算表時，不放範例作品，避免混進老師的列印清單
    return this.gasUrl() ? [] : INITIAL_BOOKMARKS;
  }

  /** 新增或取代作品：同一位學生（班級＋姓名）只保留這一筆，並沿用原本的 id */
  addOrReplaceByStudent(entry: Bookmark): Bookmark {
    const key = studentKey(entry.studentInfo);
    let saved = entry;
    this.bookmarks.update((prev) => {
      const existing = prev.find((b) => studentKey(b.studentInfo) === key);
      if (existing) saved = { ...entry, id: existing.id };
      return [saved, ...prev.filter((b) => studentKey(b.studentInfo) !== key && b.id !== saved.id)];
    });
    return saved;
  }

  showToast(message: string, type: 'success' | 'error' = 'success'): void {
    this.toast.set({ message, type, id: Date.now() });
    setTimeout(() => {
      this.toast.update((prev) => (prev && Date.now() - prev.id >= 3300 ? null : prev));
    }, 3500);
  }

  saveGasUrl(url: string): void {
    const trimmed = url.trim();
    this.gasUrl.set(trimmed);
    safeSet(GAS_URL_STORAGE_KEY, trimmed);
  }

  savePasscode(code: string): void {
    this.teacherPasscode.set(code);
    safeSet(PASSCODE_STORAGE_KEY, code);
  }

  private setSynced(id: string, ok: boolean): void {
    this.bookmarks.update((prev) => prev.map((b) => (b.id === id ? { ...b, cloudSynced: ok } : b)));
  }

  /** 正在上傳中的作品（同一筆不重複同時送出） */
  private readonly inFlight = new Map<string, Promise<GasResult>>();

  /** 把一筆作品寫進 Google 試算表，並記錄是否成功 */
  uploadBookmark(bm: Bookmark): Promise<GasResult> {
    const running = this.inFlight.get(bm.id);
    if (running) return running;
    const task = (async (): Promise<GasResult> => {
      const url = this.gasUrl();
      if (!url || !url.trim())
        return { ok: false, skipped: true, error: '尚未設定 Apps Script 網址' };
      const result = await postToGoogleAppsScript(url, {
        action: 'upsert',
        bookmark: await toSheetBookmark(bm),
      });
      this.setSynced(bm.id, result.ok);
      return result;
    })();
    this.inFlight.set(bm.id, task);
    void task.finally(() => this.inFlight.delete(bm.id));
    return task;
  }

  /** 逐筆補送尚未寫進試算表的作品 */
  async retryPendingUploads(silent = false): Promise<{ ok: number; failed: number }> {
    if (this.isRetryingUploads()) return { ok: 0, failed: 0 };
    this.isRetryingUploads.set(true);
    let ok = 0;
    let failed = 0;
    try {
      for (const bm of this.pendingUploads()) {
        const res = await this.uploadBookmark(bm);
        if (res.ok) ok++;
        else failed++;
      }
    } finally {
      this.isRetryingUploads.set(false);
    }
    if (!silent || ok > 0) {
      if (failed === 0 && ok > 0) this.showToast(`已補送 ${ok} 件作品到 Google 試算表！`);
      else if (failed > 0)
        this.showToast(`仍有 ${failed} 件作品無法寫入試算表，請稍後再試。`, 'error');
    }
    return { ok, failed };
  }

  /** 從 Google 試算表拉取最新投稿並與本地合併 */
  async pullFromGoogleSheets(targetUrl = this.gasUrl(), silent = false): Promise<void> {
    const cleanUrl = (targetUrl || '').trim();
    if (!cleanUrl) {
      if (!silent) this.showToast('請先輸入 Google Apps Script 網頁應用程式網址。', 'error');
      return;
    }
    this.isSyncingCloud.set(true);
    try {
      const sep = cleanUrl.includes('?') ? '&' : '?';
      const res = await fetch(`${cleanUrl}${sep}_t=${Date.now()}`, {
        method: 'GET',
        redirect: 'follow',
      });
      const data = await res.json();
      this.backendVersion.set(typeof data.version === 'number' ? data.version : 1);
      if (data.status === 'ok' && Array.isArray(data.bookmarks)) {
        this.bookmarks.update((prev) => {
          const map = new Map<string, Bookmark>();
          prev.forEach((item) => map.set(item.id, item));
          (data.bookmarks as Bookmark[]).forEach((remote) => {
            const existing = map.get(remote.id);
            map.set(remote.id, {
              ...(existing || {}),
              ...remote,
              originalImage: existing?.originalImage || remote.imageDataUrl || '',
              cloudSynced: true,
            });
          });
          // 同一位學生只留最後一筆，再依地理位置排序
          return geoSorted(keepLatestPerStudent(Array.from(map.values())));
        });
        this.lastSyncTime.set(new Date().toLocaleTimeString('zh-TW', { hour12: false }));
        if (!silent)
          this.showToast(`已成功從 Google 試算表同步 ${data.bookmarks.length} 筆投稿資料！`);
      } else if (!silent) {
        this.showToast(
          `試算表回傳異常：${data.message || '請確認部署權限設為「所有人」'}`,
          'error',
        );
      }
    } catch {
      if (!silent)
        this.showToast('無法連線至 Google Apps Script，請檢查網址是否以 /exec 結尾。', 'error');
    } finally {
      this.isSyncingCloud.set(false);
    }
  }
}
