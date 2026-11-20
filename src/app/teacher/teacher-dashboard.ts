import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  linkedSignal,
  signal,
} from '@angular/core';
import type { Bookmark } from '../core/models';
import { AppStore } from '../core/app-store';
import { LOCATION_ZONES } from '../core/constants';
import { CLASS_CODES, classOf } from '../core/student-key';
import {
  GOOGLE_APPS_SCRIPT_CODE,
  postToGoogleAppsScript,
  resolveActiveBookmarkImage,
  toSheetBookmark,
} from '../core/gas';
import { generateStandardA4DoubleSidedPdf, sortBookmarksByNearestNeighbor } from '../core/pdf';
import { IconComponent } from '../shared/icon';
import { A4ImpositionSheetComponent } from '../shared/a4-imposition-sheet';
import { TeacherEditModalComponent } from './teacher-edit-modal';

type TeacherTab = 'manage' | 'print' | 'google-sync';

interface PdfInfo {
  fileName: string;
  totalPages: number;
  setCount: number;
  sizeMB: string;
  blobUrl: string;
}

/** 教師後台：作品總覽、A4 雙面輸出、Google 試算表連動設定 */
@Component({
  selector: 'app-teacher-dashboard',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent, A4ImpositionSheetComponent, TeacherEditModalComponent],
  templateUrl: './teacher-dashboard.html',
})
export class TeacherDashboardComponent {
  protected readonly store = inject(AppStore);

  protected readonly zones = LOCATION_ZONES;
  protected readonly gasCode = GOOGLE_APPS_SCRIPT_CODE;

  protected readonly tab = signal<TeacherTab>('manage');

  // ---- 分頁 1：作品總覽 ----
  protected readonly searchQuery = signal('');
  protected readonly filterZone = signal('ALL');
  /** 班級篩選：'ALL'、'205'…，或 'NONE'（未分班） */
  protected readonly filterClass = signal('ALL');
  protected readonly editingBookmark = signal<Bookmark | null>(null);
  protected readonly confirmDeleteId = signal<string | null>(null);

  protected readonly filteredBookmarks = computed(() => {
    const q = this.searchQuery().trim().toLowerCase();
    const zone = this.filterZone();
    const cls = this.filterClass();
    // 依地理位置排序（由竹園岡出發，最鄰近者優先）
    return this.store.sortedBookmarks().filter((bm) => {
      if (zone !== 'ALL' && bm.locationZone !== zone) return false;
      if (cls !== 'ALL' && (classOf(bm.studentInfo) || 'NONE') !== cls) return false;
      if (!q) return true;
      const hay = [
        bm.studentInfo,
        bm.locationZone,
        bm.customZoneName,
        bm.landmarkLabel,
        bm.interviewee,
        bm.sideAText,
        bm.sideBText,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return hay.includes(q);
    });
  });

  /** 各班作品數（班級篩選標籤用） */
  protected readonly classCounts = computed(() => {
    const list = this.store.bookmarks();
    const items: { id: string; label: string; count: number }[] = CLASS_CODES.map((c) => ({
      id: c as string,
      label: `${c} 班`,
      count: list.filter((b) => classOf(b.studentInfo) === c).length,
    }));
    const none = list.filter((b) => !classOf(b.studentInfo)).length;
    if (none > 0) items.push({ id: 'NONE', label: '未分班', count: none });
    return items;
  });

  /** 試算表後端還是舊版 Code.gs（不會分班／去重複／排序） */
  protected readonly backendOutdated = computed(() => {
    const v = this.store.backendVersion();
    return v !== null && v < this.store.requiredBackendVersion;
  });

  /** 有作品的分區與數量（篩選標籤用） */
  protected readonly zoneCounts = computed(() =>
    LOCATION_ZONES.map((z) => ({
      zone: z,
      count: this.store.bookmarks().filter((b) => b.locationZone === z.name).length,
    })).filter((item) => item.count > 0),
  );

  // ---- 分頁 2：A4 輸出 ----
  protected readonly activePrintPageIndex = signal(0);
  protected readonly isGeneratingPdf = signal(false);
  protected readonly lastPdf = signal<PdfInfo | null>(null);

  protected readonly currentPage = computed(
    () => this.store.a4PrintPages()[this.activePrintPageIndex()] || [],
  );
  /** 目前版面槽位對應提示（背面為鏡像順序） */
  protected readonly slotInfo = computed(() => {
    const order = this.store.printPreviewSide() === 'back' ? [3, 2, 1, 0] : [0, 1, 2, 3];
    return order.map((slotIdx) => ({ slotIdx, bm: this.currentPage()[slotIdx] || null }));
  });

  // ---- 分頁 3：Google 連動 ----
  protected readonly gasUrlInput = linkedSignal(() => this.store.gasUrl());
  protected readonly passcodeDraft = linkedSignal(() => this.store.teacherPasscode());

  protected readonly embedUrls = computed(() => {
    let baseUrl = 'https://your-site-domain.example.com/';
    try {
      baseUrl = `${window.location.origin}${window.location.pathname}`;
    } catch {}
    const gas = this.store.gasUrl().trim();
    const encodedGas = gas ? `&gasUrl=${encodeURIComponent(gas)}` : '';
    return {
      studentUrl: `${baseUrl}?mode=student${encodedGas}`,
      teacherUrl: `${baseUrl}?mode=teacher${encodedGas}`,
    };
  });

  constructor() {
    // 進入後台且已設定網址時，自動靜默拉取一次最新投稿
    const url = this.store.gasUrl();
    if (url) void this.store.pullFromGoogleSheets(url, true);

    // 頁數減少時把目前頁碼拉回範圍內
    effect(() => {
      const len = this.store.a4PrintPages().length;
      if (this.activePrintPageIndex() >= len) {
        this.activePrintPageIndex.set(Math.max(0, len - 1));
      }
    });

    inject(DestroyRef).onDestroy(() => {
      const info = this.lastPdf();
      if (info) URL.revokeObjectURL(info.blobUrl);
    });
  }

  protected val(event: Event): string {
    return (event.target as HTMLInputElement).value;
  }

  protected zoneMeta(bm: Bookmark) {
    return LOCATION_ZONES.find((z) => z.name === bm.locationZone);
  }

  protected thumb(bm: Bookmark): string {
    return resolveActiveBookmarkImage(bm);
  }

  protected charCount(text: string | undefined): number {
    return Array.from(text || '').length;
  }

  protected isSelected(id: string): boolean {
    const ids = this.store.selectedPrintIds();
    return ids === null || ids.includes(id);
  }

  /** 目前實際選取的 id（「全部」時展開成清單） */
  private currentSelection(): string[] {
    return this.store.selectedPrintBookmarks().map((b) => b.id);
  }

  protected toggleSelection(id: string): void {
    const prev = this.currentSelection();
    this.store.selectedPrintIds.set(
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    );
  }

  protected selectAllFiltered(): void {
    this.store.selectedPrintIds.set(this.filteredBookmarks().map((b) => b.id));
  }

  protected async onSaveEdited(updated: Bookmark): Promise<void> {
    const pending: Bookmark = { ...updated, cloudSynced: false };
    this.store.bookmarks.update((prev) => prev.map((b) => (b.id === updated.id ? pending : b)));
    this.editingBookmark.set(null);
    this.store.showToast(`已儲存「${updated.studentInfo}」的修正內容！`);
    if (this.store.gasUrl().trim()) {
      const res = await this.store.uploadBookmark(pending);
      if (!res.ok) {
        this.store.showToast(
          `「${updated.studentInfo}」的修正尚未寫入試算表，可按上方「補送未同步作品」重試。`,
          'error',
        );
      }
    }
  }

  protected async onDelete(id: string): Promise<void> {
    this.store.bookmarks.update((prev) => prev.filter((b) => b.id !== id));
    this.store.selectedPrintIds.update((prev) =>
      prev === null ? null : prev.filter((item) => item !== id),
    );
    this.confirmDeleteId.set(null);
    this.store.showToast('已刪除該筆書籤作品。');
    const url = this.store.gasUrl();
    if (url && url.trim()) {
      const res = await postToGoogleAppsScript(url, { action: 'delete', id });
      if (!res.ok) {
        this.store.showToast('試算表中的資料刪除失敗，請到 Google 試算表手動刪除該列。', 'error');
      }
    }
  }

  /** 依地理位置最鄰近自動同頁排序（由竹園岡・臺南一中出發） */
  protected sortByNearest(): void {
    const selected = this.store.selectedPrintBookmarks();
    if (selected.length <= 1) {
      this.store.showToast('目前佇列至少需要 2 枚書籤才能進行地理鄰近排序。', 'error');
      return;
    }
    this.store.selectedPrintIds.set(sortBookmarksByNearestNeighbor(selected).map((b) => b.id));
    this.activePrintPageIndex.set(0);
    this.store.showToast(
      '已從「竹園岡・臺南一中」出發完成地理位置最鄰近排序，相鄰地標將優先編排於同一張 A4！',
    );
  }

  /** 生成 200 DPI A4 橫式雙面拼版 PDF（奇數頁正面、偶數頁短邊翻轉鏡像背面） */
  protected async exportPdf(openInNewTab = false): Promise<void> {
    if (this.store.selectedPrintBookmarks().length === 0) {
      this.store.showToast('請先勾選至少 1 枚書籤再輸出 PDF。', 'error');
      return;
    }
    this.isGeneratingPdf.set(true);
    try {
      const result = await generateStandardA4DoubleSidedPdf(
        this.store.a4PrintPages(),
        this.store.showCropMarks(),
      );
      const blobUrl = URL.createObjectURL(result.blob);
      const prev = this.lastPdf();
      if (prev) URL.revokeObjectURL(prev.blobUrl);
      this.lastPdf.set({
        fileName: result.fileName,
        totalPages: result.totalPages,
        setCount: result.setCount,
        sizeMB: result.sizeMB,
        blobUrl,
      });

      if (openInNewTab) {
        const win = window.open(blobUrl, '_blank', 'noopener,noreferrer');
        if (!win) {
          this.store.showToast(
            '瀏覽器已阻擋自動彈出視窗，請點擊下方資訊列中的「開啟新分頁預覽」按鈕。',
            'error',
          );
        } else {
          this.store.showToast(
            `已開啟 200 DPI 雙面 PDF 預覽（共 ${result.setCount} 組 / ${result.totalPages} 頁 A4 橫式）！`,
          );
        }
      } else {
        const link = document.createElement('a');
        link.href = blobUrl;
        link.download = result.fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        this.store.showToast(
          `已下載「${result.fileName}」（共 ${result.totalPages} 頁 A4 雙面，${result.sizeMB} MB）！`,
        );
      }
    } catch (err) {
      console.error('PDF generation failed:', err);
      this.store.showToast('生成 200 DPI PDF 時發生錯誤，請稍後再試。', 'error');
    } finally {
      this.isGeneratingPdf.set(false);
    }
  }

  protected triggerBrowserPrint(side: 'front' | 'back'): void {
    this.store.printPreviewSide.set(side);
    setTimeout(() => window.print(), 120);
  }

  protected onSaveGasUrl(event: Event): void {
    event.preventDefault();
    const trimmed = this.gasUrlInput().trim();
    this.store.saveGasUrl(trimmed);
    this.store.showToast(
      trimmed ? '已儲存 Google Apps Script 連線網址！' : '已清除雲端連線網址（改為純本機模式）。',
    );
  }

  protected async pushAllToSheets(): Promise<void> {
    const url = this.store.gasUrl();
    if (!url || !url.trim()) {
      this.store.showToast('請先輸入並儲存 Google Apps Script 網址。', 'error');
      return;
    }
    this.store.isSyncingCloud.set(true);
    try {
      const prepared: Bookmark[] = [];
      for (const bm of this.store.bookmarks()) {
        prepared.push(await toSheetBookmark(bm));
      }
      const res = await postToGoogleAppsScript(url, { action: 'syncAll', bookmarks: prepared });
      if (res.ok) {
        const ids = new Set(prepared.map((b) => b.id));
        this.store.bookmarks.update((prev) =>
          prev.map((b) => (ids.has(b.id) ? { ...b, cloudSynced: true } : b)),
        );
        this.store.lastSyncTime.set(new Date().toLocaleTimeString('zh-TW', { hour12: false }));
        this.store.showToast(`已將目前 ${prepared.length} 筆作品全部備份推送至 Google 試算表！`);
      } else {
        this.store.showToast(
          `推送至試算表時發生錯誤：${res.error || '請檢查 Apps Script 部署權限'}`,
          'error',
        );
      }
    } finally {
      this.store.isSyncingCloud.set(false);
    }
  }

  protected savePasscode(): void {
    const val = this.passcodeDraft().trim();
    this.store.savePasscode(val);
    this.store.showToast(val ? `已更新教師後台驗證碼為「${val}」` : '已設為免驗證碼直接進入後台');
  }

  protected async copy(text: string, label: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(text);
      this.store.showToast(`已複製「${label}」至剪貼簿！`);
    } catch {
      this.store.showToast('複製失敗，請手動選取文字複製。', 'error');
    }
  }
}
