import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  linkedSignal,
  output,
  signal,
} from '@angular/core';
import type { Bookmark } from '../core/models';
import { LOCATION_ZONES, TNFSH_ANCHOR } from '../core/constants';
import { resolveActiveBookmarkImage } from '../core/gas';
import { compressImageFile, generateAllPhotoFilters } from '../core/image-filters';
import { VISUAL_MODES } from '../core/visual-modes';
import { IconComponent } from '../shared/icon';
import { TaiwanMemoryMapComponent } from '../shared/taiwan-memory-map';
import { BookmarkSideAComponent, BookmarkSideBComponent } from '../shared/bookmark-sides';

/** 教師後台：單筆作品修正編輯視窗 */
@Component({
  selector: 'app-teacher-edit-modal',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    IconComponent,
    TaiwanMemoryMapComponent,
    BookmarkSideAComponent,
    BookmarkSideBComponent,
  ],
  templateUrl: './teacher-edit-modal.html',
})
export class TeacherEditModalComponent {
  readonly bookmark = input.required<Bookmark>();
  readonly allBookmarks = input<Bookmark[]>([]);
  readonly closed = output<void>();
  readonly saved = output<Bookmark>();

  protected readonly zones = LOCATION_ZONES;
  protected readonly visualModes = VISUAL_MODES;

  protected readonly form = linkedSignal<Bookmark>(() => {
    const bm = this.bookmark();
    return { ...bm, mapCoords: bm.mapCoords ? { ...bm.mapCoords } : { ...TNFSH_ANCHOR } };
  });
  protected readonly mapZoomStage = linkedSignal<string>(() => {
    const z = LOCATION_ZONES.find((item) => item.name === this.bookmark().locationZone);
    return z?.targetStage || 'tainan';
  });
  protected readonly isProcessing = signal(false);
  protected readonly previewSide = signal<'A' | 'B'>('A');

  protected readonly sideACount = computed(() => Array.from(this.form().sideAText || '').length);
  protected readonly sideBCount = computed(() => Array.from(this.form().sideBText || '').length);
  protected readonly editZoneMeta = computed(
    () => LOCATION_ZONES.find((item) => item.name === this.form().locationZone) || null,
  );

  /** 給地圖「更新地圖」按鈕使用：回到目前分區的對應尺度 */
  protected readonly refreshMap = () => {
    const stage = this.editZoneMeta()?.targetStage;
    if (stage) this.mapZoomStage.set(stage);
  };

  protected patch(changes: Partial<Bookmark>): void {
    this.form.update((p) => ({ ...p, ...changes }));
  }

  protected val(event: Event): string {
    return (event.target as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement).value;
  }

  protected onZoneSelect(zoneName: string): void {
    const z = LOCATION_ZONES.find((item) => item.name === zoneName);
    this.form.update((prev) => ({
      ...prev,
      locationZone: zoneName,
      mapCoords: z ? { ...z.coords } : prev.mapCoords,
    }));
    if (z?.targetStage) this.mapZoomStage.set(z.targetStage);
  }

  protected async onPhotoReplace(event: Event): Promise<void> {
    const target = event.target as HTMLInputElement;
    const file = target.files?.[0];
    if (!file) return;
    this.isProcessing.set(true);
    try {
      const compressed = await compressImageFile(file, 640, 0.88);
      const variants = await generateAllPhotoFilters(compressed);
      this.patch({
        visualMode: 'original',
        originalImage: variants.original,
        woodcutImage: variants.woodcut,
        oilPaintingImage: variants.oilPainting,
        watercolorImage: variants.watercolor,
        mosaicImage: variants.mosaic,
        imageDataUrl: variants.original,
      });
      this.previewSide.set('A');
    } finally {
      this.isProcessing.set(false);
      target.value = '';
    }
  }

  protected onSubmit(event: Event): void {
    event.preventDefault();
    const f = this.form();
    this.saved.emit({
      ...f,
      studentInfo: (f.studentInfo || '').trim() || '南一中學子',
      landmarkLabel: (f.landmarkLabel || '').trim() || f.locationZone,
      sideAText: (f.sideAText || '').trim(),
      interviewee: (f.interviewee || '').trim(),
      sideBText: (f.sideBText || '').trim(),
      imageDataUrl: resolveActiveBookmarkImage(f),
    });
  }
}
