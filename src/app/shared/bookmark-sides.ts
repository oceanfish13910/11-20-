import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import type { Bookmark } from '../core/models';
import { resolveActiveBookmarkImage } from '../core/gas';
import { splitIntoVerticalColumns } from '../core/image-filters';
import { TaiwanMiniPinComponent } from './emblems';

export type BookmarkMode = 'preview' | 'print' | 'mini';

const PUNCTUATION = new Set(['、', '，', '。', '！', '？', '；', '：', '．']);

/** 書籤正面：直書短文＋風景圖＋地標章 */
@Component({
  selector: 'app-bookmark-side-a',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TaiwanMiniPinComponent],
  host: { style: 'display: contents' },
  template: `
    <div
      [style.width]="v('74.25mm', '156px', '276px')"
      [style.height]="v('210mm', '441px', '780px')"
      [style.padding]="v('5.5mm 5.0mm', '11px 10px', '20px 18px')"
      style="background-color: #faf8f5"
      class="relative flex flex-col justify-between select-none text-[#262623] box-border overflow-hidden shrink-0"
    >
      <div
        class="absolute pointer-events-none border border-[#262623]/45"
        [style.inset]="v('2.6mm', '5px', '9px')"
      ></div>
      <div
        class="absolute pointer-events-none border border-[#A63A2B]"
        [style.inset]="v('3.5mm', '7px', '12.5px')"
      ></div>

      <div
        class="relative z-10 flex items-center justify-between border-b border-[#A63A2B]/40"
        [style.padding-bottom]="v('1.8mm', '3.5px', '7px')"
        [style.margin-bottom]="v('1.5mm', '3px', '6px')"
      >
        <div>
          <div
            class="font-serif font-bold tracking-widest text-[#A63A2B]"
            [style.font-size]="v('3.0mm', '7px', '12px')"
          >
            一頁府城・百年書籤
          </div>
          <div
            class="font-serif text-[#7A6F66] tracking-wider"
            [style.font-size]="v('1.9mm', '4.8px', '8px')"
          >
            溯源・宿緣・塑垣
          </div>
        </div>
        <span
          class="inline-flex items-center justify-center border-[1.5px] border-[#A63A2B] text-[#A63A2B] font-serif font-bold leading-none bg-[#F7ECEA]/70"
          [style.padding]="v('0.9mm 1.3mm', '1.5px 3px', '3px 5px')"
          [style.font-size]="v('2.2mm', '5.5px', '9px')"
          >南一中105</span
        >
      </div>

      <div
        class="relative z-10 flex-1 flex items-center justify-center overflow-hidden"
        [style.padding-top]="isPrint() ? '1.0mm' : '2px'"
        [style.padding-bottom]="isPrint() ? '1.5mm' : '4px'"
      >
        <div class="flex flex-row-reverse justify-center items-start">
          @for (colChars of columns(); track $index) {
            <div
              class="flex flex-col items-center border-l border-[#EAE2D3] first:border-r first:border-[#EAE2D3]"
              [style.width]="v('12.2mm', '25.6px', '45.3px')"
            >
              @for (ch of colChars; track $index) {
                <span
                  class="font-serif text-[#262623] font-medium flex items-center justify-center"
                  style="width: 100%; line-height: 1"
                  [style.height]="v('9.2mm', '19.3px', '34.2px')"
                  [style.font-size]="v('7.0mm', '14.5px', '26px')"
                  [style.padding-left]="isPunc(ch) ? v('3.4mm', '7px', '12.5px') : '0'"
                  [style.padding-bottom]="isPunc(ch) ? v('1.8mm', '3.5px', '6.5px') : '0'"
                  >{{ ch }}</span
                >
              }
            </div>
          }
        </div>
      </div>

      <div class="relative z-10 w-full">
        <div
          class="w-full overflow-hidden border border-[#A63A2B]/75 bg-[#FAF8F5] relative"
          [style.height]="v('52mm', '109px', '193px')"
        >
          @if (activeVisualUrl(); as src) {
            <img
              [src]="src"
              [alt]="bookmark().landmarkLabel || '記憶風景'"
              class="w-full h-full object-cover"
            />
          } @else {
            <div
              class="w-full h-full flex flex-col items-center justify-center relative bg-[#FAF8F5]"
              [style.background-image]="
                bookmark().dotGrid ? 'radial-gradient(#B8ADA2 0.9px, transparent 0.9px)' : null
              "
              [style.background-size]="
                bookmark().dotGrid ? v('3.2mm 3.2mm', '6.5px 6.5px', '12px 12px') : null
              "
            >
              <span
                class="absolute top-1.5 left-1.5 w-2 h-2 border-t border-l border-[#A63A2B]/55"
              ></span>
              <span
                class="absolute top-1.5 right-1.5 w-2 h-2 border-t border-r border-[#A63A2B]/55"
              ></span>
              <span
                class="absolute bottom-1.5 left-1.5 w-2 h-2 border-b border-l border-[#A63A2B]/55"
              ></span>
              <span
                class="absolute bottom-1.5 right-1.5 w-2 h-2 border-b border-r border-[#A63A2B]/55"
              ></span>
              <span
                class="font-serif text-[#B8ADA2] tracking-widest"
                [style.font-size]="v('2.8mm', '6.5px', '11.5px')"
                >手繪記憶留白區</span
              >
              <span
                class="font-serif text-[#C9BFB4] mt-0.5"
                [style.font-size]="v('2.1mm', '5.2px', '9.5px')"
                >（印出後親手繪製）</span
              >
            </div>
          }
        </div>

        <div class="flex items-center justify-center" [style.margin-top]="v('2.4mm', '5px', '9px')">
          <div
            class="inline-flex items-center gap-1 border border-[#A63A2B]/65 bg-[#F4F0E8] text-[#A63A2B] font-serif font-semibold rounded-xs"
            [style.padding]="v('0.8mm 2.4mm', '1.5px 4.5px', '3px 9px')"
            [style.font-size]="v('2.6mm', '6px', '11px')"
          >
            <app-taiwan-mini-pin
              [coords]="bookmark().mapCoords"
              [width]="v('4.6mm', '9.5px', '18px')"
              [height]="v('7.1mm', '15px', '28px')"
            />
            <span class="truncate max-w-[110px]"
              >〔 {{ bookmark().landmarkLabel || '府城・記憶地標' }} 〕</span
            >
          </div>
        </div>
      </div>

      <div
        class="relative z-10 flex items-end justify-between border-t border-[#D8D0C5]"
        [style.padding-top]="v('1.8mm', '3.5px', '7px')"
        [style.margin-top]="v('1.8mm', '3.5px', '7px')"
      >
        <span
          class="font-serif text-[#8A7F76] tracking-wider"
          [style.font-size]="v('2.0mm', '5px', '8.5px')"
          >TNFSH 105th</span
        >
        <div class="flex items-center gap-1">
          <span
            class="font-serif text-[#262623] font-medium tracking-wide"
            [style.font-size]="v('2.7mm', '6.5px', '11.5px')"
          >
            {{ bookmark().studentInfo || '南一中學子' }} 誌
          </span>
          <span
            class="inline-flex items-center justify-center border border-[#A63A2B] text-[#A63A2B] font-serif font-bold leading-none"
            [style.width]="v('4.0mm', '9px', '15px')"
            [style.height]="v('4.0mm', '9px', '15px')"
            [style.font-size]="v('1.8mm', '4.5px', '7.5px')"
            >印</span
          >
        </div>
      </div>
    </div>
  `,
})
export class BookmarkSideAComponent {
  readonly bookmark = input.required<Bookmark>();
  readonly mode = input<BookmarkMode>('preview');

  protected readonly isPrint = computed(() => this.mode() === 'print');
  protected readonly columns = computed(() =>
    splitIntoVerticalColumns(
      this.bookmark().sideAText || '臺南是一個適合人們作夢、幹活、戀愛、結婚，悠然過活的地方。',
      10,
      5,
    ),
  );
  protected readonly activeVisualUrl = computed(() => resolveActiveBookmarkImage(this.bookmark()));

  /** 依顯示模式（列印／縮圖／預覽）回傳對應尺寸 */
  protected v(print: string, mini: string, preview: string): string {
    const m = this.mode();
    return m === 'print' ? print : m === 'mini' ? mini : preview;
  }

  protected isPunc(ch: string): boolean {
    return PUNCTUATION.has(ch);
  }
}

/** 書籤背面：橫式家族訪談信箋（旋轉 -90° 置入直式書籤） */
@Component({
  selector: 'app-bookmark-side-b',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { style: 'display: contents' },
  template: `
    <div
      [style.width]="o('74.25mm', '156px', '720px', '276px')"
      [style.height]="o('210mm', '441px', '255px', '780px')"
      style="position: relative; overflow: hidden; background-color: #faf8f5"
      class="select-none text-[#262623] box-border shrink-0"
    >
      <div
        class="bg-[#FAF8F5] box-border"
        [style.width]="o('210mm', '441px', '720px', '780px')"
        [style.height]="o('74.25mm', '156px', '255px', '276px')"
        [style.position]="rotated() ? 'absolute' : 'relative'"
        [style.top]="rotated() ? '50%' : null"
        [style.left]="rotated() ? '50%' : null"
        [style.transform]="rotated() ? 'translate(-50%, -50%) rotate(-90deg)' : null"
        [style.padding]="o('5.5mm', '11.5px', '19px', '20.5px')"
      >
        <div
          class="absolute pointer-events-none border border-[#262623]/40"
          [style.inset]="v('3.2mm', '5px', '9px')"
        ></div>
        <div
          class="absolute pointer-events-none border border-[#9E3B33]"
          [style.inset]="v('4.1mm', '7px', '12.5px')"
        ></div>

        <div class="relative z-10 w-full h-full flex flex-col box-border">
          <div
            [style.height]="isPrint() ? '7.20mm' : '11.38%'"
            class="flex items-center justify-between border-b border-[#9E3B33]/45 box-border shrink-0"
          >
            <div class="flex items-center gap-2">
              <span
                class="inline-block bg-[#9E3B33]"
                [style.width]="isPrint() ? '1.1mm' : '3px'"
                [style.height]="isPrint() ? '3.8mm' : '13px'"
              ></span>
              <span
                class="font-serif font-bold tracking-widest text-[#9E3B33]"
                [style.font-size]="v('3.5mm', '8px', '14px')"
              >
                {{ headerTitle() }}
              </span>
            </div>
            <div
              class="flex items-center gap-2 font-serif text-[#5C524B]"
              [style.font-size]="v('2.5mm', '6px', '10.5px')"
            >
              <span>地標：{{ bookmark().landmarkLabel || '府城記憶' }}</span>
              <span>｜</span>
              <span>竹園岡・一〇五週年紀念</span>
            </div>
          </div>

          <div [style.height]="spacer()" class="w-full shrink-0" aria-hidden="true"></div>

          <div
            [style.height]="isPrint() ? '38.50mm' : '60.87%'"
            class="flex items-start overflow-hidden box-border shrink-0"
          >
            <p
              class="w-full font-serif text-[#262623] text-justify m-0"
              [style.font-size]="o('4.45mm', '9.3px', '15.3px', '16.5px')"
              [style.line-height]="o('5.50mm', '11.5px', '18.9px', '20.4px')"
            >
              {{ bookmark().sideBText || '（請記錄與家人長輩訪談的在地記憶故事，上限 300 字）' }}
            </p>
          </div>

          <div [style.height]="spacer()" class="w-full shrink-0" aria-hidden="true"></div>

          <div
            [style.height]="isPrint() ? '11.55mm' : '18.26%'"
            class="w-full flex flex-row items-end box-border shrink-0"
          >
            <span
              [style.width]="isPrint() ? '21mm' : '10.55%'"
              [style.padding-bottom]="o('2.6mm', '5.5px', '8.9px', '9.7px')"
              class="font-serif font-bold text-[#A63A2B] whitespace-nowrap tracking-wider leading-none shrink-0"
            >
              <span [style.font-size]="o('3.8mm', '8px', '13.0px', '14.1px')">家人寄語：</span>
            </span>
            <div
              [style.width]="isPrint() ? '178mm' : '89.45%'"
              style="height: 100%"
              [style.border-bottom]="
                isPrint()
                  ? '0.6pt dashed rgba(166, 58, 43, 0.65)'
                  : '1.5px dashed rgba(166, 58, 43, 0.6)'
              "
              class="box-border shrink-0"
              aria-label="長輩親筆祝福書寫線"
            ></div>
          </div>

          <div [style.height]="spacer()" class="w-full shrink-0" aria-hidden="true"></div>
        </div>
      </div>
    </div>
  `,
})
export class BookmarkSideBComponent {
  readonly bookmark = input.required<Bookmark>();
  readonly mode = input<BookmarkMode>('preview');
  /** 預覽時改為正立橫式顯示，方便閱讀 */
  readonly uprightAssist = input(false);

  protected readonly isPrint = computed(() => this.mode() === 'print');
  protected readonly rotated = computed(() => this.mode() !== 'preview' || !this.uprightAssist());
  protected readonly spacer = computed(() => (this.isPrint() ? '2.00mm' : '3.16%'));
  protected readonly headerTitle = computed(() => {
    const who = this.bookmark().interviewee?.trim();
    return who ? `家族尺素・訪【${who}】紀事` : '家族尺素・記憶訪談紀事';
  });

  protected v(print: string, mini: string, preview: string): string {
    const m = this.mode();
    return m === 'print' ? print : m === 'mini' ? mini : preview;
  }

  /** 四種外框：列印／縮圖／正立輔助／預設預覽 */
  protected o(print: string, mini: string, upright: string, preview: string): string {
    const m = this.mode();
    if (m === 'print') return print;
    if (m === 'mini') return mini;
    return this.uprightAssist() ? upright : preview;
  }
}
