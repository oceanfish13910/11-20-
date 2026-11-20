import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import type { Bookmark, MapCoords } from '../core/models';
import { LOCATION_ZONES, TNFSH_ANCHOR } from '../core/constants';
import { IconComponent } from './icon';

export type ZoomStage = 'taiwan' | 'tainan' | 'fucheng';

type DispersedBookmark = Bookmark & { displayCoords: { x: number; y: number } };

interface Arc {
  id: string;
  d: string;
}

const CAMERA_PRESETS: Record<ZoomStage, { zoom: number; cx: number; cy: number; label: string }> = {
  taiwan: { zoom: 1.0, cx: 50.0, cy: 50.0, label: '全臺總覽' },
  tainan: { zoom: 4.1, cx: 42.8, cy: 70.0, label: '聚焦臺南' },
  fucheng: { zoom: 9.2, cx: 41.8, cy: 72.7, label: '府城微距' },
};

const TAINAN_LABELS = [
  { x: 41.2, y: 64.2, text: '溪北新營鹽水' },
  { x: 47.2, y: 70.1, text: '山線新化玉井' },
  { x: 39.2, y: 71.3, text: '安平與台江' },
  { x: 41.6, y: 73.8, text: '府城舊城' },
  { x: 44.3, y: 73.4, text: '竹園岡南一中' },
];

/** 三段式（全臺／臺南／府城）記憶足跡互動地圖 */
@Component({
  selector: 'app-taiwan-memory-map',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent],
  templateUrl: './taiwan-memory-map.html',
})
export class TaiwanMemoryMapComponent {
  readonly bookmarks = input<Bookmark[]>([]);
  readonly activeCoords = input<MapCoords | null | undefined>(TNFSH_ANCHOR);
  readonly activeLabel = input('');
  readonly zoneDefaultCoords = input<{ x: number; y: number } | null | undefined>(null);
  readonly zoomStage = input<ZoomStage | string>('taiwan');
  readonly interactive = input(true);
  readonly compact = input(false);
  /** 由父層提供的非同步更新函式（例如從試算表重新拉取） */
  readonly refreshMap = input<(() => Promise<void> | void) | null>(null);

  readonly zoomStageChange = output<ZoomStage>();
  readonly selectCoords = output<{ x: number; y: number }>();

  protected readonly anchor = TNFSH_ANCHOR;
  protected readonly islandPath =
    'M66 8 L73 12 L76 19 L72 28 L68 45 L63 65 L58 83 L55 94 L51 95 L46 84 L38 75 L34 67 L35 56 L39 45 L45 33 L55 19 L61 11 Z';
  protected readonly tainanLabels = TAINAN_LABELS;
  protected readonly stages: { id: ZoomStage; label: string }[] = [
    { id: 'taiwan', label: '全臺總覽' },
    { id: 'tainan', label: '聚焦臺南' },
    { id: 'fucheng', label: '府城微距' },
  ];

  protected readonly selectedPin = signal<DispersedBookmark | null>(null);
  protected readonly isRefreshing = signal(false);
  /** 每次更新地圖遞增，用來重新建立 SVG（等同原版的 key 重掛載） */
  protected readonly refreshSeed = signal(0);

  protected readonly cam = computed(
    () => CAMERA_PRESETS[this.zoomStage() as ZoomStage] || CAMERA_PRESETS.taiwan,
  );
  protected readonly tx = computed(() => 50 - this.cam().cx * this.cam().zoom);
  protected readonly ty = computed(() => 50 - this.cam().cy * this.cam().zoom);
  protected readonly pinScale = computed(() => 1 / Math.pow(this.cam().zoom, 0.78));
  protected readonly strokeScale = computed(() => 1 / this.cam().zoom);
  protected readonly groupTransform = computed(
    () => `translate(${this.tx()}px, ${this.ty()}px) scale(${this.cam().zoom})`,
  );

  protected readonly pipRect = computed(() => {
    const zoom = this.cam().zoom;
    return {
      x: Math.max(0, (0 - this.tx()) / zoom),
      y: Math.max(0, (0 - this.ty()) / zoom),
      w: Math.max(6, Math.min(100, 100 / zoom)),
      h: Math.max(6, Math.min(100, 100 / zoom)),
    };
  });

  protected readonly isCoordsCustomized = computed(() => {
    const def = this.zoneDefaultCoords();
    const act = this.activeCoords();
    return Boolean(
      def && act && (Math.abs(def.x - act.x) > 0.05 || Math.abs(def.y - act.y) > 0.05),
    );
  });

  /** 同區重疊點位採用黃金角螺旋微幅散開 */
  protected readonly dispersed = computed<DispersedBookmark[]>(() => {
    const groups: Record<string, Bookmark[]> = {};
    this.bookmarks().forEach((bm) => {
      const coords = bm.mapCoords || TNFSH_ANCHOR;
      const key = `${Math.round(coords.x * 2)}_${Math.round(coords.y * 2)}`;
      (groups[key] ||= []).push(bm);
    });
    const result: DispersedBookmark[] = [];
    Object.values(groups).forEach((group) => {
      group.forEach((bm, idx) => {
        const base = bm.mapCoords || TNFSH_ANCHOR;
        if (idx === 0) {
          result.push({ ...bm, displayCoords: { x: base.x, y: base.y } });
        } else {
          const goldenAngle = idx * 137.508 * (Math.PI / 180);
          const spiralRadius = 0.42 * Math.sqrt(idx);
          result.push({
            ...bm,
            displayCoords: {
              x: base.x + Math.cos(goldenAngle) * spiralRadius,
              y: base.y + Math.sin(goldenAngle) * spiralRadius,
            },
          });
        }
      });
    });
    return result;
  });

  protected readonly split = computed(() => {
    const tainan: DispersedBookmark[] = [];
    const outer: DispersedBookmark[] = [];
    this.dispersed().forEach((bm) => {
      const c = bm.displayCoords;
      const zoneMeta = LOCATION_ZONES.find((z) => z.name === bm.locationZone);
      const isTainanRegion =
        Boolean(zoneMeta?.isTainan) || (c.x >= 37.5 && c.x <= 51.0 && c.y >= 62.5 && c.y <= 76.2);
      (isTainanRegion ? tainan : outer).push(bm);
    });
    return { tainan, outer };
  });

  /** 指向竹園岡的金色弧線 */
  protected readonly arcs = computed<Arc[]>(() => {
    const list = this.zoomStage() === 'taiwan' ? this.split().outer : this.dispersed();
    const arcs: Arc[] = [];
    for (const bm of list) {
      const c = bm.displayCoords;
      const dist = Math.hypot(TNFSH_ANCHOR.x - c.x, TNFSH_ANCHOR.y - c.y);
      if (dist < 0.25) continue;
      const midX = (c.x + TNFSH_ANCHOR.x) / 2 - Math.min(11, dist * 0.24);
      const midY = (c.y + TNFSH_ANCHOR.y) / 2 - Math.min(5, dist * 0.08);
      arcs.push({
        id: bm.id,
        d: `M ${c.x} ${c.y} Q ${midX} ${midY} ${TNFSH_ANCHOR.x} ${TNFSH_ANCHOR.y}`,
      });
    }
    return arcs;
  });

  protected readonly coordTagTransform = computed(() => {
    const a = this.activeCoords();
    if (!a) return '';
    const p = this.pinScale();
    const x = a.x > 66 ? a.x - 24.5 * p : a.x + 2.5 * p;
    return `translate(${x}, ${a.y - 2.4 * p})`;
  });

  protected dash(a: number, b: number, scale: number): string {
    return `${a * scale} ${b * scale}`;
  }

  protected setStage(stage: ZoomStage): void {
    this.zoomStageChange.emit(stage);
  }

  protected selectPin(bm: DispersedBookmark, event?: Event): void {
    event?.stopPropagation();
    this.selectedPin.set(bm);
  }

  protected zoomToTainan(event: Event): void {
    event.stopPropagation();
    this.zoomStageChange.emit('tainan');
  }

  protected async onRefreshClick(): Promise<void> {
    if (this.isRefreshing()) return;
    this.isRefreshing.set(true);
    this.selectedPin.set(null);
    this.refreshSeed.update((s) => s + 1);
    try {
      const fn = this.refreshMap();
      if (fn) await fn();
    } finally {
      setTimeout(() => this.isRefreshing.set(false), 520);
    }
  }

  protected onMapClick(event: MouseEvent): void {
    if (!this.interactive()) return;
    const svg = event.currentTarget as SVGSVGElement | null;
    if (!svg) return;
    const pt = svg.createSVGPoint();
    pt.x = event.clientX;
    pt.y = event.clientY;
    const ctm = svg.getScreenCTM();
    if (!ctm) return;
    const svgPt = pt.matrixTransform(ctm.inverse());
    const zoom = this.cam().zoom;
    const rawX = (svgPt.x - this.tx()) / zoom;
    const rawY = (svgPt.y - this.ty()) / zoom;
    const clampedX = Math.max(8, Math.min(92, Math.round(rawX * 10) / 10));
    const clampedY = Math.max(6, Math.min(96, Math.round(rawY * 10) / 10));
    this.selectCoords.emit({ x: clampedX, y: clampedY });
  }

  protected resetToZone(): void {
    const def = this.zoneDefaultCoords();
    if (def) this.selectCoords.emit({ ...def });
  }
}
