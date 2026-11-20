import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import type { Bookmark } from '../core/models';
import { BookmarkSideAComponent, BookmarkSideBComponent } from './bookmark-sides';

/** A4 橫式四連排拼版（背面自動鏡像為 4→3→2→1） */
@Component({
  selector: 'app-a4-imposition-sheet',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [BookmarkSideAComponent, BookmarkSideBComponent],
  host: { style: 'display: contents' },
  template: `
    <div
      style="width: 297mm; height: 210mm; background-color: #faf8f5"
      class="relative flex flex-row items-stretch overflow-hidden box-border"
      [class]="isPrintRender() ? 'print-a4-page' : 'shadow-2xl border border-[#C7BCB0]'"
    >
      @for (bm of arranged(); track $index) {
        <div
          style="width: 74.25mm; height: 210mm"
          class="relative shrink-0 box-border overflow-hidden"
        >
          @if (bm) {
            @if (side() === 'front') {
              <app-bookmark-side-a [bookmark]="bm" mode="print" />
            } @else {
              <app-bookmark-side-b [bookmark]="bm" mode="print" />
            }
          } @else {
            <div
              class="w-full h-full flex flex-col items-center justify-center bg-[#FAF8F5] text-[#C7BEB0] font-serif select-none border border-dashed border-[#D8D0C5]"
            >
              <span class="text-xs tracking-widest"
                >第 {{ side() === 'back' ? 4 - $index : $index + 1 }} 格留白</span
              >
              <span class="text-[10px] mt-1">（未配置書籤）</span>
            </div>
          }

          @if (showCropMarks()) {
            @if ($index > 0) {
              <div
                class="absolute top-0 bottom-0 left-0 pointer-events-none z-30"
                style="border-left: 0.4pt dashed rgba(166, 58, 43, 0.55)"
              ></div>
            }
            <div
              class="absolute top-0 left-0 w-2.5 h-2.5 border-t border-l border-[#262623]/70 pointer-events-none z-30"
              aria-hidden="true"
            ></div>
            <div
              class="absolute top-0 right-0 w-2.5 h-2.5 border-t border-r border-[#262623]/70 pointer-events-none z-30"
              aria-hidden="true"
            ></div>
            <div
              class="absolute bottom-0 left-0 w-2.5 h-2.5 border-b border-l border-[#262623]/70 pointer-events-none z-30"
              aria-hidden="true"
            ></div>
            <div
              class="absolute bottom-0 right-0 w-2.5 h-2.5 border-b border-r border-[#262623]/70 pointer-events-none z-30"
              aria-hidden="true"
            ></div>
          }
        </div>
      }
    </div>
  `,
})
export class A4ImpositionSheetComponent {
  readonly slots = input.required<(Bookmark | null | undefined)[]>();
  readonly side = input<'front' | 'back'>('front');
  readonly showCropMarks = input(true);
  readonly isPrintRender = input(false);

  protected readonly arranged = computed(() => {
    const s = this.slots();
    const n = [0, 1, 2, 3].map((i) => s[i] || null);
    return this.side() === 'back' ? [n[3], n[2], n[1], n[0]] : n;
  });
}
