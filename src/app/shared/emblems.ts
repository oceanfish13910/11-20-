import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { TNFSH_ANCHOR } from '../core/constants';

/** 南一中校徽（紅磚拱門） */
@Component({
  selector: 'app-school-crest',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { style: 'display: contents' },
  template: `
    <svg viewBox="0 0 64 64" [attr.class]="cls()" fill="none" aria-hidden="true">
      <circle cx="32" cy="32" r="30" fill="#A63A2B" stroke="#D8D0C5" stroke-width="2" />
      <circle
        cx="32"
        cy="32"
        r="25"
        stroke="#FAF8F5"
        stroke-opacity="0.45"
        stroke-width="1"
        stroke-dasharray="2 2"
      />
      <path
        d="M18 46V28C18 20.268 24.268 14 32 14C39.732 14 46 20.268 46 28V46"
        stroke="#FAF8F5"
        stroke-width="2.2"
      />
      <path
        d="M23 46V30C23 25.029 27.029 21 32 21C36.971 21 41 25.029 41 30V46"
        stroke="#E5C89B"
        stroke-width="1.5"
      />
      <line x1="32" y1="24" x2="32" y2="46" stroke="#FAF8F5" stroke-width="2" />
      <path
        d="M32 31C28 29 26 27 25 25"
        stroke="#E5C89B"
        stroke-width="1.5"
        stroke-linecap="round"
      />
      <path
        d="M32 36C36 34 38 32 39 30"
        stroke="#E5C89B"
        stroke-width="1.5"
        stroke-linecap="round"
      />
      <rect x="15" y="45" width="34" height="3" rx="1" fill="#FAF8F5" />
    </svg>
  `,
})
export class SchoolCrestComponent {
  readonly cls = input('w-11 h-11');
}

/** 臺灣小地圖定位圖示 */
@Component({
  selector: 'app-taiwan-mini-pin',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { style: 'display: contents' },
  template: `
    <svg
      viewBox="24 4 56 92"
      [style.width]="width()"
      [style.height]="height()"
      class="shrink-0"
      fill="none"
      aria-label="臺灣位置小圖示"
    >
      <path
        d="M66 8 L73 12 L76 19 L72 28 L68 45 L63 65 L58 83 L55 94 L51 95 L46 84 L38 75 L34 67 L35 56 L39 45 L45 33 L55 19 L61 11 Z"
        fill="#FAF8F5"
        stroke="#A63A2B"
        stroke-width="3.2"
        stroke-linejoin="round"
      />
      <circle cx="28" cy="64" r="1.8" fill="#A63A2B" fill-opacity="0.6" />
      <circle [attr.cx]="cx()" [attr.cy]="cy()" r="5.5" fill="#A63A2B" fill-opacity="0.28" />
      <circle [attr.cx]="cx()" [attr.cy]="cy()" r="3.2" fill="#A63A2B" />
    </svg>
  `,
})
export class TaiwanMiniPinComponent {
  readonly coords = input<{ x: number; y: number } | null | undefined>(TNFSH_ANCHOR);
  readonly width = input('18px');
  readonly height = input('28px');
  protected readonly cx = computed(() => this.coords()?.x ?? TNFSH_ANCHOR.x);
  protected readonly cy = computed(() => this.coords()?.y ?? TNFSH_ANCHOR.y);
}
