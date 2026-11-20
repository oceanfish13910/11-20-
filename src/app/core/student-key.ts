import type { Bookmark } from './models';
import { sortBookmarksByNearestNeighbor } from './pdf';

/** 四個班級（與學生頁下拉選單、Apps Script 分頁一致） */
export const CLASS_CODES = ['205', '209', '213', '216'] as const;

/** 「205-05王小明」→「205」；沒有班級代碼回傳空字串（與 Code.gs 的 classOf_ 相同） */
export function classOf(studentInfo: string | undefined): string {
  const m = String(studentInfo || '')
    .replace(/\s+/g, '')
    .match(/^(\d{3})-/);
  return m ? m[1] : '';
}

/**
 * 同一位學生的識別：班級＋姓名（忽略座號與空白），例如「205|王小明」。
 * 與 Code.gs 的 studentKey_ 規則相同，用來判斷「同一位學生送了兩次」。
 */
export function studentKey(studentInfo: string | undefined): string {
  const s = String(studentInfo || '').replace(/\s+/g, '');
  const m = s.match(/^(\d{3})-(.*)$/);
  if (m) {
    const name = m[2].replace(/^\d+/, '');
    return `${m[1]}|${name || m[2]}`;
  }
  return s;
}

/** 同一位學生只保留 createdAt 最新的一筆 */
export function keepLatestPerStudent(list: Bookmark[]): Bookmark[] {
  const latest = new Map<string, Bookmark>();
  for (const bm of list) {
    const key = studentKey(bm.studentInfo) || bm.id;
    const prev = latest.get(key);
    if (!prev || (bm.createdAt || 0) >= (prev.createdAt || 0)) latest.set(key, bm);
  }
  return Array.from(latest.values());
}

/** 依地理位置排序（由竹園岡・臺南一中出發，最鄰近者優先） */
export function geoSorted(list: Bookmark[]): Bookmark[] {
  return sortBookmarksByNearestNeighbor(list);
}
