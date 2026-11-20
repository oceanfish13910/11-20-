import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import type { Bookmark, MapCoords } from '../core/models';
import { AppStore } from '../core/app-store';
import { INTERVIEWEE_TITLES, LOCATION_ZONES, TNFSH_ANCHOR } from '../core/constants';
import { resolveActiveBookmarkImage } from '../core/gas';
import {
  compressImageFile,
  createSampleTainanArchitectureDataUrl,
  generateAllPhotoFilters,
} from '../core/image-filters';
import { VISUAL_MODES } from '../core/visual-modes';
import { IconComponent } from '../shared/icon';
import { TaiwanMemoryMapComponent } from '../shared/taiwan-memory-map';
import { BookmarkSideAComponent, BookmarkSideBComponent } from '../shared/bookmark-sides';

/** 學生創作表單（尚未送出的書籤，沒有 id 與 createdAt） */
type StudentForm = Omit<Bookmark, 'id' | 'createdAt' | 'imageDataUrl'> & { imageDataUrl?: string };

/** 可選的班級（與原版下拉選單相同） */
const CLASS_OPTIONS = ['205', '209', '213', '216'];
const CLASS_PREFIX = /^(205|209|213|216)-/;
const CLASS_PREFIX_OPTIONAL = /^(205|209|213|216)?-/;

const QUICK_LANDMARKS = [
  '竹園岡・紅磚門',
  '府城・孔廟',
  '五條港・神農街',
  '安平・王城與鹽田',
  '溪北・鹽水月津港',
];

function defaultForm(): StudentForm {
  return {
    studentInfo: '高二3班 林宇軒',
    locationZone: '竹園岡與東區',
    customZoneName: '',
    landmarkLabel: '竹園岡・紅磚門',
    mapCoords: { x: 43.2, y: 72.8 },
    sideAText: '晨光穿過竹園岡鳳凰木梢，紅磚校門見證無數少年奔跑身影，百五年風華正寫進我們的青春。',
    visualMode: 'blank-sketch',
    dotGrid: true,
    originalImage: '',
    woodcutImage: '',
    oilPaintingImage: '',
    watercolorImage: '',
    mosaicImage: '',
    interviewee: '伯父',
    sideBText:
      '伯父三十年前也是南一中校友，他笑著回憶當年大家總愛在勝利路買完熱騰騰的豆漿與燒餅，再趕在鐘響前衝進紅磚門。紅樓走廊上的微風、黑板上的粉筆灰，以及社團課後在鳳凰樹下暢談理想的午後，至今仍是家族聚會最愛聊的青春往事。他常說竹園岡教會他的不只是課本知識，更是面對挑戰時沉著堅毅的骨氣；當年師長在講臺上的諄諄教誨與同窗並肩奮鬥的情誼，早已化為一生受用無窮的力量。這份跨越三十載的處世家風，也深深勉勵我在百年名校裡踏實築夢，把南一中人的熱情與擔當代代傳承下去。',
  };
}

function blankForm(): StudentForm {
  return {
    studentInfo: '',
    locationZone: '臺南・府城舊城區',
    customZoneName: '',
    landmarkLabel: '府城・孔廟',
    mapCoords: { x: 42.1, y: 72.8 },
    sideAText: '',
    visualMode: 'blank-sketch',
    dotGrid: true,
    originalImage: '',
    woodcutImage: '',
    oilPaintingImage: '',
    watercolorImage: '',
    mosaicImage: '',
    interviewee: '',
    sideBText: '',
  };
}

/** 學生創作投稿工作坊 */
@Component({
  selector: 'app-student-workshop',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    IconComponent,
    TaiwanMemoryMapComponent,
    BookmarkSideAComponent,
    BookmarkSideBComponent,
  ],
  templateUrl: './student-workshop.html',
  host: { '(document:mousedown)': 'onDocumentMouseDown($event)' },
})
export class StudentWorkshopComponent {
  protected readonly store = inject(AppStore);

  protected readonly zones = LOCATION_ZONES;
  protected readonly visualModes = VISUAL_MODES;
  protected readonly intervieweeTitles = INTERVIEWEE_TITLES;
  protected readonly quickLandmarks = QUICK_LANDMARKS;
  protected readonly classOptions = CLASS_OPTIONS;

  protected readonly form = signal<StudentForm>(defaultForm());
  protected readonly isZoneDropdownOpen = signal(false);
  protected readonly mapZoomStage = signal<string>('fucheng');
  protected readonly previewSide = signal<'A' | 'B'>('B');
  protected readonly uprightAssistB = signal(true);
  protected readonly isSubmitting = signal(false);
  protected readonly isProcessingFilters = signal(false);
  protected readonly submittedEntry = signal<
    (Bookmark & { cloudSynced: boolean; noUrl: boolean; error?: string }) | null
  >(null);
  protected readonly isRetrying = signal(false);

  private readonly zoneDropdown = viewChild<ElementRef<HTMLElement>>('zoneDropdown');

  protected readonly selectedZone = computed(
    () => LOCATION_ZONES.find((z) => z.name === this.form().locationZone) || LOCATION_ZONES[0],
  );
  protected readonly sideACount = computed(() => Array.from(this.form().sideAText || '').length);
  protected readonly sideBCount = computed(() => Array.from(this.form().sideBText || '').length);
  /** 預覽用：把表單包成完整書籤物件 */
  protected readonly previewBookmark = computed<Bookmark>(() => ({
    ...this.form(),
    id: 'preview',
    createdAt: 0,
    imageDataUrl: this.form().imageDataUrl || '',
  }));
  protected readonly selectedClass = computed(() => {
    const info = this.form().studentInfo || '';
    return CLASS_PREFIX.test(info) ? info.slice(0, 3) : '';
  });
  protected readonly nameWithoutClass = computed(() =>
    (this.form().studentInfo || '').replace(CLASS_PREFIX_OPTIONAL, ''),
  );
  protected readonly activeLabel = computed(
    () => this.form().landmarkLabel || this.form().customZoneName || this.form().locationZone,
  );
  protected readonly currentModeLabel = computed(
    () => VISUAL_MODES.find((m) => m.id === this.form().visualMode)?.label || '照片原圖',
  );
  protected readonly photoThumbs = computed(() => {
    const f = this.form();
    return [
      { id: 'original', label: '照片原圖', src: f.originalImage },
      { id: 'woodcut', label: '復古木刻版畫', src: f.woodcutImage },
      { id: 'oil-painting', label: '印象厚塗油畫', src: f.oilPaintingImage },
      { id: 'watercolor', label: '溫潤水彩暈染', src: f.watercolorImage },
      { id: 'mosaic', label: '復古馬賽克拼貼', src: f.mosaicImage },
    ];
  });

  /** 地圖「更新地圖」：同步最新雲端足跡並對焦目前分區尺度 */
  protected readonly refreshMap = async () => {
    const url = this.store.gasUrl();
    if (url && url.trim()) {
      await this.store.pullFromGoogleSheets(url, true);
    }
    const stage = this.selectedZone()?.targetStage;
    if (stage) this.mapZoomStage.set(stage);
    this.store.showToast('已更新記憶足跡地圖並重新對焦目前座標！');
  };

  protected patch(changes: Partial<StudentForm>): void {
    this.form.update((prev) => ({ ...prev, ...changes }));
  }

  protected val(event: Event): string {
    return (event.target as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement).value;
  }

  protected onDocumentMouseDown(event: MouseEvent): void {
    const el = this.zoneDropdown()?.nativeElement;
    if (el && !el.contains(event.target as Node)) {
      this.isZoneDropdownOpen.set(false);
    }
  }

  protected onClassChange(newCls: string): void {
    const rest = (this.form().studentInfo || '').replace(CLASS_PREFIX_OPTIONAL, '');
    this.patch({ studentInfo: newCls ? `${newCls}-${rest}` : rest ? `-${rest}` : '' });
  }

  protected onNameChange(newRest: string): void {
    const m = (this.form().studentInfo || '').match(CLASS_PREFIX);
    const cls = m ? m[1] : '';
    this.patch({ studentInfo: cls ? `${cls}-${newRest}` : newRest ? `-${newRest}` : '' });
  }

  protected onZoneChange(newZoneName: string): void {
    const zone = LOCATION_ZONES.find((z) => z.name === newZoneName);
    this.form.update((prev) => ({
      ...prev,
      locationZone: newZoneName,
      mapCoords: zone ? { ...zone.coords } : prev.mapCoords,
      landmarkLabel: zone && !zone.isCustom ? `${zone.shortName}・` : prev.landmarkLabel,
    }));
    if (zone?.targetStage) this.mapZoomStage.set(zone.targetStage);
    this.isZoneDropdownOpen.set(false);
  }

  protected onSelectCoords(coords: MapCoords): void {
    this.patch({ mapCoords: coords });
    this.store.showToast(`已更新專屬圖釘座標 (X: ${coords.x}, Y: ${coords.y})`);
  }

  protected onVisualModeClick(id: string): void {
    this.previewSide.set('A');
    this.patch({ visualMode: id });
    if (id !== 'blank-sketch' && !this.form().originalImage) {
      this.store.showToast('請點擊上方「上傳地點相片」或「載入範例照片測試濾鏡」檢視效果！');
    }
  }

  private applyVariants(v: {
    original: string;
    woodcut: string;
    oilPainting: string;
    watercolor: string;
    mosaic: string;
  }): void {
    this.patch({
      visualMode: 'original',
      originalImage: v.original,
      woodcutImage: v.woodcut,
      oilPaintingImage: v.oilPainting,
      watercolorImage: v.watercolor,
      mosaicImage: v.mosaic,
    });
    this.previewSide.set('A');
  }

  protected async onImageUpload(event: Event): Promise<void> {
    const target = event.target as HTMLInputElement;
    const file = target.files?.[0];
    if (!file) return;
    this.isProcessingFilters.set(true);
    try {
      const compressed = await compressImageFile(file, 640, 0.88);
      this.applyVariants(await generateAllPhotoFilters(compressed));
      this.store.showToast('已切換至「照片原圖」正面預覽，並同步生成 5 種相片藝術質感縮圖！');
    } catch {
      this.store.showToast('照片讀取失敗，請改選其他圖片檔案。', 'error');
    } finally {
      this.isProcessingFilters.set(false);
      target.value = '';
    }
  }

  protected async onLoadDemoPhoto(): Promise<void> {
    this.isProcessingFilters.set(true);
    try {
      this.applyVariants(await generateAllPhotoFilters(createSampleTainanArchitectureDataUrl()));
      this.store.showToast(
        '已載入府城紅磚廟埕範例照（照片原圖），點擊下方縮圖可切換 5 種相片質感！',
      );
    } finally {
      this.isProcessingFilters.set(false);
    }
  }

  protected onResetToBlank(): void {
    this.form.set(blankForm());
    this.mapZoomStage.set('fucheng');
    this.previewSide.set('A');
    this.submittedEntry.set(null);
    this.store.showToast('已清空表單，可開始創作全新記憶書籤。');
  }

  private buildValidatedEntry(): Bookmark | null {
    const f = this.form();
    const infoMatch = (f.studentInfo || '').match(/^(205|209|213|216)-(.+)$/);
    if (!infoMatch || !infoMatch[2].trim()) {
      this.store.showToast('請選擇「班級」並填寫「座號與姓名」後再送出。', 'error');
      return null;
    }
    if (f.locationZone === '其他／自訂地點' && !f.customZoneName.trim()) {
      this.store.showToast('選擇「其他／自訂地點」時，請填寫自訂家鄉／城市名稱。', 'error');
      return null;
    }
    if (!f.sideAText.trim()) {
      this.store.showToast('請填寫「正面題字・府城或家鄉印象」短文。', 'error');
      return null;
    }
    if (!f.sideBText.trim()) {
      this.store.showToast('請填寫「背面尺素・與家人長輩訪談的故事」（300 字以內）。', 'error');
      return null;
    }
    if (this.sideACount() > 50) {
      this.store.showToast('正面題字超過 50 字上限，請適度精簡字句。', 'error');
      return null;
    }
    if (this.sideBCount() > 300) {
      this.store.showToast('背面尺素超過 300 字上限，請適度精簡以完整呈現故事。', 'error');
      return null;
    }

    const hasPhoto = f.visualMode !== 'blank-sketch';
    const rawActiveImg = hasPhoto ? resolveActiveBookmarkImage(f as Bookmark) : '';

    return {
      id: `bm-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      studentInfo: f.studentInfo.trim(),
      locationZone: f.locationZone,
      customZoneName: f.locationZone === '其他／自訂地點' ? f.customZoneName.trim() : '',
      landmarkLabel: f.landmarkLabel.trim() || f.customZoneName.trim() || f.locationZone,
      mapCoords: f.mapCoords || TNFSH_ANCHOR,
      sideAText: f.sideAText.trim(),
      visualMode: f.visualMode,
      dotGrid: Boolean(f.dotGrid),
      originalImage: hasPhoto ? f.originalImage : '',
      woodcutImage: hasPhoto ? f.woodcutImage : '',
      oilPaintingImage: hasPhoto ? f.oilPaintingImage : '',
      watercolorImage: hasPhoto ? f.watercolorImage : '',
      mosaicImage: hasPhoto ? f.mosaicImage : '',
      imageDataUrl: rawActiveImg,
      interviewee: f.interviewee.trim(),
      sideBText: f.sideBText.trim(),
      createdAt: Date.now(),
    };
  }

  /** 寫入試算表並更新提示卡片（失敗時保留「重新傳送」按鈕） */
  private async uploadAndReport(entry: Bookmark): Promise<void> {
    const noUrl = !this.store.gasUrl().trim();
    const result = noUrl ? { ok: false, error: '' } : await this.store.uploadBookmark(entry);
    this.submittedEntry.set({ ...entry, cloudSynced: result.ok, noUrl, error: result.error });
    if (result.ok) {
      this.store.showToast(`已確認送出「${entry.studentInfo}」的記憶書籤並同步至 Google 試算表！`);
    } else if (noUrl) {
      this.store.showToast('此網站尚未設定老師的 Google 試算表，作品只存在這台電腦。', 'error');
    } else {
      this.store.showToast('作品尚未傳到老師的試算表，請按「重新傳送」再試一次。', 'error');
    }
  }

  protected async retryUpload(): Promise<void> {
    const entry = this.submittedEntry();
    if (!entry || this.isRetrying()) return;
    const current = this.store.bookmarks().find((b) => b.id === entry.id) || entry;
    this.isRetrying.set(true);
    try {
      await this.uploadAndReport(current);
    } finally {
      this.isRetrying.set(false);
    }
  }

  /** 送出：先存本機，再（若有設定 GAS 網址）寫入老師的 Google 試算表 */
  protected async onSubmit(event: Event): Promise<void> {
    event.preventDefault();
    const newEntry = this.buildValidatedEntry();
    if (!newEntry) return;

    this.isSubmitting.set(true);
    try {
      // 同一位學生（班級＋姓名）重複送出時，只保留最後一筆，並沿用原本的 id
      const finalEntry = this.store.addOrReplaceByStudent({ ...newEntry, cloudSynced: false });

      await this.uploadAndReport(finalEntry);
    } finally {
      this.isSubmitting.set(false);
    }
  }
}
