/* 由原 index.html 移植的純函式（保持原演算法不變） */
import type { Bookmark, PdfResult } from './models';
import { TNFSH_ANCHOR } from './constants';
import { resolveActiveBookmarkImage } from './gas';
import { splitIntoVerticalColumns } from './image-filters';

// ============================================================================
// 3.5 Standard A4 Landscape Double-Sided 200 DPI PDF Generator
//      瀏覽器本機 200 DPI 高解析光柵封裝引擎（297mm × 210mm 四連排精準輸出）
//      - 奇數頁：正面 [1][2][3][4]
//      - 偶數頁：短邊翻轉鏡像 [4][3][2][1]
//      - 零外部相依性純二進位 PDF 1.4 封裝（支援下載與新分頁預覽）
// ============================================================================
export const PDF_DPI = 200;
export const PDF_MM_TO_PX = PDF_DPI / 25.4;
export const PDF_PAGE_W_MM = 297;
export const PDF_PAGE_H_MM = 210;
export const PDF_PAGE_W_PX = Math.round(PDF_PAGE_W_MM * PDF_MM_TO_PX); // 2339 px
export const PDF_PAGE_H_PX = Math.round(PDF_PAGE_H_MM * PDF_MM_TO_PX); // 1654 px
export const PDF_PAGE_W_PT = 841.89; // 297mm in PDF points (1/72 in)
export const PDF_PAGE_H_PT = 595.28; // 210mm in PDF points (1/72 in)

// 地理位置最鄰近自動同頁拼版演算法（以「竹園岡・臺南一中」為起點）
export function sortBookmarksByNearestNeighbor(bookmarksList: Bookmark[]): Bookmark[] {
  if (!Array.isArray(bookmarksList) || bookmarksList.length <= 1) {
    return [...(bookmarksList || [])];
  }
  const remaining = [...bookmarksList];
  const ordered = [];
  let currentX = TNFSH_ANCHOR.x;
  let currentY = TNFSH_ANCHOR.y;

  while (remaining.length > 0) {
    let bestIdx = 0;
    let bestDist = Infinity;
    for (let i = 0; i < remaining.length; i++) {
      const coords = remaining[i].mapCoords || TNFSH_ANCHOR;
      const dist = Math.hypot(
        (coords.x ?? TNFSH_ANCHOR.x) - currentX,
        (coords.y ?? TNFSH_ANCHOR.y) - currentY,
      );
      if (dist < bestDist) {
        bestDist = dist;
        bestIdx = i;
      }
    }
    const [picked] = remaining.splice(bestIdx, 1);
    ordered.push(picked);
    const nextCoords = picked.mapCoords || TNFSH_ANCHOR;
    currentX = nextCoords.x ?? TNFSH_ANCHOR.x;
    currentY = nextCoords.y ?? TNFSH_ANCHOR.y;
  }
  return ordered;
}

export function loadHtmlImageAsync(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    if (!src) {
      resolve(null);
      return;
    }
    const img = new window.Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

export function wrapChineseParagraphLines(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  maxLines = 7,
): string[] {
  const clean = (text || '').replace(/\r?\n/g, ' ').trim();
  if (!clean) return [];
  const chars = Array.from(clean);
  const closingPunc = new Set([
    '，',
    '。',
    '、',
    '！',
    '？',
    '；',
    '：',
    '」',
    '』',
    '）',
    '．',
    ',',
    '.',
    '!',
    '?',
  ]);
  const lines = [];
  let currentLine = '';

  for (let i = 0; i < chars.length; i++) {
    const ch = chars[i];
    const testLine = currentLine + ch;
    const width = ctx.measureText(testLine).width;
    if (width > maxWidth && currentLine.length > 0) {
      if (closingPunc.has(ch) && lines.length < maxLines - 1) {
        lines.push(testLine);
        currentLine = '';
      } else {
        lines.push(currentLine);
        currentLine = ch;
      }
      if (lines.length >= maxLines) {
        break;
      }
    } else {
      currentLine = testLine;
    }
  }
  if (currentLine && lines.length < maxLines) {
    lines.push(currentLine);
  }
  return lines.slice(0, maxLines);
}

export function drawMiniTaiwanIconOnCanvas(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  coords: { x: number; y: number } | undefined,
) {
  ctx.save();
  ctx.translate(x, y);
  // 對應 viewBox="24 4 56 92"
  const sx = w / 56;
  const sy = h / 92;
  ctx.scale(sx, sy);
  ctx.translate(-24, -4);

  const island = new Path2D(
    'M66 8 L73 12 L76 19 L72 28 L68 45 L63 65 L58 83 L55 94 L51 95 L46 84 L38 75 L34 67 L35 56 L39 45 L45 33 L55 19 L61 11 Z',
  );
  ctx.fillStyle = '#FAF8F5';
  ctx.fill(island);
  ctx.strokeStyle = '#A63A2B';
  ctx.lineWidth = 3.2;
  ctx.lineJoin = 'round';
  ctx.stroke(island);

  // 澎湖小點
  ctx.beginPath();
  ctx.arc(28, 64, 1.8, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(166, 58, 43, 0.6)';
  ctx.fill();

  const cx = coords?.x ?? TNFSH_ANCHOR.x;
  const cy = coords?.y ?? TNFSH_ANCHOR.y;
  ctx.beginPath();
  ctx.arc(cx, cy, 5.5, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(166, 58, 43, 0.28)';
  ctx.fill();

  ctx.beginPath();
  ctx.arc(cx, cy, 3.2, 0, Math.PI * 2);
  ctx.fillStyle = '#A63A2B';
  ctx.fill();

  ctx.restore();
}

export function drawSlotCropAndGuides(
  ctx: CanvasRenderingContext2D,
  offsetX: number,
  slotW: number,
  slotH: number,
  colIdx: number,
  showCropMarks: boolean,
) {
  if (!showCropMarks) return;
  const mm = (v: number) => v * PDF_MM_TO_PX;
  ctx.save();
  if (colIdx > 0) {
    ctx.strokeStyle = 'rgba(166, 58, 43, 0.55)';
    ctx.lineWidth = 1.4;
    ctx.setLineDash([mm(1.6), mm(1.4)]);
    ctx.beginPath();
    ctx.moveTo(offsetX, 0);
    ctx.lineTo(offsetX, slotH);
    ctx.stroke();
    ctx.setLineDash([]);
  }
  const tick = mm(2.6);
  ctx.strokeStyle = 'rgba(38, 38, 35, 0.72)';
  ctx.lineWidth = 1.6;
  // 左上
  ctx.beginPath();
  ctx.moveTo(offsetX, tick);
  ctx.lineTo(offsetX, 0);
  ctx.lineTo(offsetX + tick, 0);
  ctx.stroke();
  // 右上
  ctx.beginPath();
  ctx.moveTo(offsetX + slotW - tick, 0);
  ctx.lineTo(offsetX + slotW, 0);
  ctx.lineTo(offsetX + slotW, tick);
  ctx.stroke();
  // 左下
  ctx.beginPath();
  ctx.moveTo(offsetX, slotH - tick);
  ctx.lineTo(offsetX, slotH);
  ctx.lineTo(offsetX + tick, slotH);
  ctx.stroke();
  // 右下
  ctx.beginPath();
  ctx.moveTo(offsetX + slotW - tick, slotH);
  ctx.lineTo(offsetX + slotW, slotH);
  ctx.lineTo(offsetX + slotW, slotH - tick);
  ctx.stroke();
  ctx.restore();
}

export function drawEmptySlotOnCanvas(
  ctx: CanvasRenderingContext2D,
  offsetX: number,
  slotW: number,
  slotH: number,
  logicalSlotNumber: number,
) {
  const mm = (v: number) => v * PDF_MM_TO_PX;
  ctx.save();
  ctx.fillStyle = '#FAF8F5';
  ctx.fillRect(offsetX, 0, slotW, slotH);

  ctx.strokeStyle = '#D8D0C5';
  ctx.lineWidth = 1.5;
  ctx.setLineDash([mm(2), mm(2)]);
  ctx.strokeRect(offsetX + mm(3), mm(3), slotW - mm(6), slotH - mm(6));
  ctx.setLineDash([]);

  ctx.fillStyle = '#C7BEB0';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `600 ${mm(3.2)}px "Noto Serif TC", serif`;
  ctx.fillText(`第 ${logicalSlotNumber} 格留白`, offsetX + slotW / 2, slotH / 2 - mm(2.5));
  ctx.font = `400 ${mm(2.4)}px "Noto Serif TC", serif`;
  ctx.fillText('（未配置書籤）', offsetX + slotW / 2, slotH / 2 + mm(2.8));
  ctx.restore();
}

export function drawBookmarkSideAOnCanvas(
  ctx: CanvasRenderingContext2D,
  bm: Bookmark,
  offsetX: number,
  slotW: number,
  slotH: number,
  loadedImg: HTMLImageElement | null,
) {
  const mm = (v: number) => v * PDF_MM_TO_PX;
  ctx.save();

  // 底色
  ctx.fillStyle = '#FAF8F5';
  ctx.fillRect(offsetX, 0, slotW, slotH);

  // 雙層外框（2.6mm 外墨線、3.5mm 內磚紅線）
  ctx.strokeStyle = 'rgba(38, 38, 35, 0.45)';
  ctx.lineWidth = 1.6;
  ctx.strokeRect(offsetX + mm(2.6), mm(2.6), slotW - mm(5.2), slotH - mm(5.2));

  ctx.strokeStyle = '#A63A2B';
  ctx.lineWidth = 2.0;
  ctx.strokeRect(offsetX + mm(3.5), mm(3.5), slotW - mm(7.0), slotH - mm(7.0));

  const padX = mm(5.0);
  const padY = mm(5.5);
  const innerX = offsetX + padX;
  const innerW = slotW - padX * 2;

  // 頁首標題區
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillStyle = '#A63A2B';
  ctx.font = `700 ${mm(3.0)}px "Noto Serif TC", serif`;
  ctx.fillText('一頁府城・百年書籤', innerX, padY);

  ctx.fillStyle = '#7A6F66';
  ctx.font = `400 ${mm(1.9)}px "Noto Serif TC", serif`;
  ctx.fillText('溯源・宿緣・塑垣', innerX, padY + mm(3.8));

  // 右上印章「南一中105」
  ctx.font = `700 ${mm(2.2)}px "Noto Serif TC", serif`;
  const stampText = '南一中105';
  const stampTextW = ctx.measureText(stampText).width;
  const stampW = stampTextW + mm(2.8);
  const stampH = mm(4.2);
  const stampX = innerX + innerW - stampW;
  const stampY = padY + mm(0.6);
  ctx.fillStyle = 'rgba(247, 236, 234, 0.85)';
  ctx.fillRect(stampX, stampY, stampW, stampH);
  ctx.strokeStyle = '#A63A2B';
  ctx.lineWidth = 2.0;
  ctx.strokeRect(stampX, stampY, stampW, stampH);
  ctx.fillStyle = '#A63A2B';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(stampText, stampX + stampW / 2, stampY + stampH / 2 + 0.5);

  // 頁首分隔線
  const headerBottomY = padY + mm(7.4);
  ctx.strokeStyle = 'rgba(166, 58, 43, 0.4)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(innerX, headerBottomY);
  ctx.lineTo(innerX + innerW, headerBottomY);
  ctx.stroke();

  // 中段直排題字區（右起左行，每行至多 10 字，最多 5 行）
  const verticalColumns = splitIntoVerticalColumns(
    bm.sideAText || '臺南是一個適合人們作夢、幹活、戀愛、結婚，悠然過活的地方。',
    10,
    5,
  );
  const punctuationSet = new Set(['、', '，', '。', '！', '？', '；', '：', '．']);
  const colW = mm(12.2);
  const charH = mm(9.2);
  const totalColsW = verticalColumns.length * colW;
  const startRightX = offsetX + slotW / 2 + totalColsW / 2;
  const colsTopY = headerBottomY + mm(2.8);

  verticalColumns.forEach((colChars, colIdx) => {
    const colLeft = startRightX - (colIdx + 1) * colW;
    ctx.strokeStyle = '#EAE2D3';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(colLeft, colsTopY);
    ctx.lineTo(colLeft, colsTopY + 10 * charH);
    if (colIdx === 0) {
      ctx.moveTo(colLeft + colW, colsTopY);
      ctx.lineTo(colLeft + colW, colsTopY + 10 * charH);
    }
    ctx.stroke();

    ctx.fillStyle = '#262623';
    ctx.font = `500 ${mm(7.0)}px "Noto Serif TC", serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    colChars.forEach((ch, charIdx) => {
      const isPunc = punctuationSet.has(ch);
      const cx = colLeft + colW / 2 + (isPunc ? mm(2.2) : 0);
      const cy = colsTopY + charIdx * charH + charH / 2 - (isPunc ? mm(1.1) : 0);
      ctx.fillText(ch, cx, cy);
    });
  });

  // 底部元件由下往上精準定位
  const footerLineY = slotH - padY - mm(5.6);
  const badgeH = mm(8.4);
  const badgeY = footerLineY - mm(2.0) - badgeH;
  const frameH = mm(52.0);
  const frameY = badgeY - mm(2.4) - frameH;

  // 風景畫框（52mm 高度）
  ctx.fillStyle = '#FAF8F5';
  ctx.fillRect(innerX, frameY, innerW, frameH);

  if (loadedImg) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(innerX, frameY, innerW, frameH);
    ctx.clip();
    const imgRatio = loadedImg.width / loadedImg.height;
    const boxRatio = innerW / frameH;
    let dw = innerW;
    let dh = frameH;
    let dx = innerX;
    let dy = frameY;
    if (imgRatio > boxRatio) {
      dw = frameH * imgRatio;
      dx = innerX - (dw - innerW) / 2;
    } else {
      dh = innerW / imgRatio;
      dy = frameY - (dh - frameH) / 2;
    }
    ctx.drawImage(loadedImg, dx, dy, dw, dh);
    ctx.restore();
  } else {
    if (bm.dotGrid) {
      const dotStep = mm(3.2);
      ctx.fillStyle = '#B8ADA2';
      for (let gy = frameY + dotStep; gy < frameY + frameH - mm(1); gy += dotStep) {
        for (let gx = innerX + dotStep; gx < innerX + innerW - mm(1); gx += dotStep) {
          ctx.beginPath();
          ctx.arc(gx, gy, 1.3, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
    // 四角對位角標
    const bLen = mm(2.2);
    const bInset = mm(1.6);
    ctx.strokeStyle = 'rgba(166, 58, 43, 0.55)';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(innerX + bInset, frameY + bInset + bLen);
    ctx.lineTo(innerX + bInset, frameY + bInset);
    ctx.lineTo(innerX + bInset + bLen, frameY + bInset);
    ctx.moveTo(innerX + innerW - bInset - bLen, frameY + bInset);
    ctx.lineTo(innerX + innerW - bInset, frameY + bInset);
    ctx.lineTo(innerX + innerW - bInset, frameY + bInset + bLen);
    ctx.moveTo(innerX + bInset, frameY + frameH - bInset - bLen);
    ctx.lineTo(innerX + bInset, frameY + frameH - bInset);
    ctx.lineTo(innerX + bInset + bLen, frameY + frameH - bInset);
    ctx.moveTo(innerX + innerW - bInset - bLen, frameY + frameH - bInset);
    ctx.lineTo(innerX + innerW - bInset, frameY + frameH - bInset);
    ctx.lineTo(innerX + innerW - bInset, frameY + frameH - bInset - bLen);
    ctx.stroke();

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#B8ADA2';
    ctx.font = `500 ${mm(2.8)}px "Noto Serif TC", serif`;
    ctx.fillText('手繪記憶留白區', innerX + innerW / 2, frameY + frameH / 2 - mm(2.0));
    ctx.fillStyle = '#C9BFB4';
    ctx.font = `400 ${mm(2.1)}px "Noto Serif TC", serif`;
    ctx.fillText('（印出後親手繪製）', innerX + innerW / 2, frameY + frameH / 2 + mm(2.2));
  }

  ctx.strokeStyle = 'rgba(166, 58, 43, 0.75)';
  ctx.lineWidth = 1.6;
  ctx.strokeRect(innerX, frameY, innerW, frameH);

  // 地標與迷你臺灣座標圖釘徽章
  const landmarkStr = `〔 ${bm.landmarkLabel || '府城・記憶地標'} 〕`;
  ctx.font = `600 ${mm(2.6)}px "Noto Serif TC", serif`;
  const iconW = mm(4.6);
  const iconH = mm(7.1);
  const txtW = Math.min(innerW - iconW - mm(7), ctx.measureText(landmarkStr).width);
  const pillW = iconW + mm(1.6) + txtW + mm(4.8);
  const pillX = offsetX + (slotW - pillW) / 2;

  ctx.fillStyle = '#F4F0E8';
  ctx.fillRect(pillX, badgeY, pillW, badgeH);
  ctx.strokeStyle = 'rgba(166, 58, 43, 0.65)';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(pillX, badgeY, pillW, badgeH);

  drawMiniTaiwanIconOnCanvas(
    ctx,
    pillX + mm(2.2),
    badgeY + (badgeH - iconH) / 2,
    iconW,
    iconH,
    bm.mapCoords,
  );

  ctx.fillStyle = '#A63A2B';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(landmarkStr, pillX + mm(2.2) + iconW + mm(1.4), badgeY + badgeH / 2 + 0.5, txtW);

  // 頁尾創作者署名與印章
  ctx.strokeStyle = '#D8D0C5';
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.moveTo(innerX, footerLineY);
  ctx.lineTo(innerX + innerW, footerLineY);
  ctx.stroke();

  const footerTextY = footerLineY + mm(3.2);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#8A7F76';
  ctx.font = `400 ${mm(2.0)}px "Noto Serif TC", serif`;
  ctx.fillText('TNFSH 105th', innerX, footerTextY);

  const sealSize = mm(4.0);
  const sealX = innerX + innerW - sealSize;
  const sealY = footerTextY - sealSize / 2;
  ctx.strokeStyle = '#A63A2B';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(sealX, sealY, sealSize, sealSize);
  ctx.fillStyle = '#A63A2B';
  ctx.textAlign = 'center';
  ctx.font = `700 ${mm(1.8)}px "Noto Serif TC", serif`;
  ctx.fillText('印', sealX + sealSize / 2, sealY + sealSize / 2 + 0.5);

  ctx.textAlign = 'right';
  ctx.fillStyle = '#262623';
  ctx.font = `500 ${mm(2.7)}px "Noto Serif TC", serif`;
  ctx.fillText(`${bm.studentInfo || '南一中學子'} 誌`, sealX - mm(1.5), footerTextY);

  ctx.restore();
}

export function drawBookmarkSideBOnCanvas(
  ctx: CanvasRenderingContext2D,
  bm: Bookmark,
  offsetX: number,
  slotW: number,
  slotH: number,
) {
  const mm = (v: number) => v * PDF_MM_TO_PX;
  ctx.save();

  // 先填滿垂直書籤底色
  ctx.fillStyle = '#FAF8F5';
  ctx.fillRect(offsetX, 0, slotW, slotH);

  // 旋轉 -90 度進入 210mm × 74.25mm 橫向尺素信箋座標系
  ctx.translate(offsetX + slotW / 2, slotH / 2);
  ctx.rotate(-Math.PI / 2);

  const W = mm(210);
  const H = mm(74.25);
  const x0 = -W / 2;
  const y0 = -H / 2;

  ctx.fillStyle = '#FAF8F5';
  ctx.fillRect(x0, y0, W, H);

  // 雙層外框（3.2mm 外墨線、4.1mm 內紅線）
  ctx.strokeStyle = 'rgba(38, 38, 35, 0.4)';
  ctx.lineWidth = 1.6;
  ctx.strokeRect(x0 + mm(3.2), y0 + mm(3.2), W - mm(6.4), H - mm(6.4));

  ctx.strokeStyle = '#9E3B33';
  ctx.lineWidth = 2.0;
  ctx.strokeRect(x0 + mm(4.1), y0 + mm(4.1), W - mm(8.2), H - mm(8.2));

  // 內文區：左右各 5.5mm（內文寬 199mm），上下各 5.5mm（內文高 63.25mm）
  const pad = mm(5.5);
  const cx = x0 + pad;
  const cw = W - pad * 2; // 199mm
  let curY = y0 + pad;

  // 1. 頁首區 (7.20mm)
  const headerH = mm(7.2);
  ctx.fillStyle = '#9E3B33';
  ctx.fillRect(cx, curY + (headerH - mm(3.8)) / 2, mm(1.1), mm(3.8));

  const dynamicHeaderTitle =
    bm.interviewee && bm.interviewee.trim()
      ? `家族尺素・訪【${bm.interviewee.trim()}】紀事`
      : '家族尺素・記憶訪談紀事';

  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#9E3B33';
  ctx.font = `700 ${mm(3.5)}px "Noto Serif TC", serif`;
  ctx.fillText(dynamicHeaderTitle, cx + mm(2.6), curY + headerH / 2);

  ctx.textAlign = 'right';
  ctx.fillStyle = '#5C524B';
  ctx.font = `400 ${mm(2.5)}px "Noto Serif TC", serif`;
  ctx.fillText(
    `地標：${bm.landmarkLabel || '府城記憶'}  ｜  竹園岡・一〇五週年紀念`,
    cx + cw,
    curY + headerH / 2,
  );

  ctx.strokeStyle = 'rgba(158, 59, 51, 0.45)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(cx, curY + headerH);
  ctx.lineTo(cx + cw, curY + headerH);
  ctx.stroke();

  curY += headerH;

  // 2. 第一段留白：頁首下 2.0mm
  curY += mm(2.0);

  // 3. 訪談記事區：38.50mm（7 行 × 5.50mm 行高，4.45mm 約 12.6pt 黃金微調字級）
  const storyH = mm(38.5);
  const lineH = mm(5.5);
  ctx.fillStyle = '#262623';
  ctx.font = `400 ${mm(4.45)}px "Noto Serif TC", serif`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';

  const storyText = Array.from(
    (bm.sideBText || '（請記錄與家人長輩訪談的在地記憶故事，上限 300 字）').trim(),
  )
    .slice(0, 300)
    .join('');

  const wrappedLines = wrapChineseParagraphLines(ctx, storyText, cw, 7);
  wrappedLines.forEach((line, idx) => {
    ctx.fillText(line, cx, curY + idx * lineH + lineH / 2);
  });

  curY += storyH;

  // 4. 第二段留白：記事下 2.0mm
  curY += mm(2.0);

  // 5. 下方手寫區：11.55mm（左側 21mm「家人寄語：」3.8mm 字級＋2.6mm 底部內距；右側 178mm 單條虛線貼齊底緣）
  const handH = mm(11.55);
  const labelW = mm(21.0);
  const lineW = mm(178.0); // 21 + 178 = 199mm 內文寬
  const handBottomY = curY + handH;

  ctx.fillStyle = '#A63A2B';
  ctx.font = `700 ${mm(3.8)}px "Noto Serif TC", serif`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'bottom';
  ctx.fillText('家人寄語：', cx, handBottomY - mm(2.6));

  ctx.strokeStyle = 'rgba(166, 58, 43, 0.65)';
  ctx.lineWidth = 1.6;
  ctx.setLineDash([mm(1.5), mm(1.2)]);
  ctx.beginPath();
  ctx.moveTo(cx + labelW, handBottomY);
  ctx.lineTo(cx + labelW + lineW, handBottomY);
  ctx.stroke();
  ctx.setLineDash([]);

  // 6. 第三段留白：虛線下 2.0mm（curY + handH + 2.0mm 精準抵達底部內邊界）
  ctx.restore();
}

export function assembleMultiPagePdfBlob(
  jpegPages: Uint8Array<ArrayBuffer>[],
  imgWidthPx: number,
  imgHeightPx: number,
): Blob {
  const encoder = new TextEncoder();
  const chunks: BlobPart[] = [];
  let currentOffset = 0;

  const pushBytes = (bytes: Uint8Array<ArrayBuffer>) => {
    chunks.push(bytes);
    currentOffset += bytes.length;
  };
  const pushStr = (str: string) => {
    pushBytes(encoder.encode(str));
  };

  // PDF 1.4 檔頭與二進位標記
  pushBytes(
    new Uint8Array([
      0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34, 0x0a, 0x25, 0xe2, 0xe3, 0xcf, 0xd3, 0x0a,
    ]),
  );

  const pageCount = jpegPages.length;
  const totalObjects = 2 + pageCount * 3;
  const objOffsets = new Array(totalObjects + 1).fill(0);

  // 1: Catalog
  objOffsets[1] = currentOffset;
  pushStr('1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n');

  // 2: Pages
  const kidsRefs = [];
  for (let i = 0; i < pageCount; i++) {
    kidsRefs.push(`${3 + i * 3} 0 R`);
  }
  objOffsets[2] = currentOffset;
  pushStr(
    `2 0 obj\n<< /Type /Pages /Kids [${kidsRefs.join(' ')}] /Count ${pageCount} >>\nendobj\n`,
  );

  // 各頁 Page / Content Stream / 200 DPI JPEG XObject
  for (let i = 0; i < pageCount; i++) {
    const pageObjId = 3 + i * 3;
    const contentObjId = 4 + i * 3;
    const imgObjId = 5 + i * 3;
    const jpegBytes = jpegPages[i];

    objOffsets[pageObjId] = currentOffset;
    pushStr(
      `${pageObjId} 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PDF_PAGE_W_PT} ${PDF_PAGE_H_PT}] /Resources << /XObject << /Im${i} ${imgObjId} 0 R >> >> /Contents ${contentObjId} 0 R >>\nendobj\n`,
    );

    const streamCmd = `q ${PDF_PAGE_W_PT} 0 0 ${PDF_PAGE_H_PT} 0 0 cm /Im${i} Do Q\n`;
    const streamCmdBytes = encoder.encode(streamCmd);
    objOffsets[contentObjId] = currentOffset;
    pushStr(`${contentObjId} 0 obj\n<< /Length ${streamCmdBytes.length} >>\nstream\n`);
    pushBytes(streamCmdBytes);
    pushStr('endstream\nendobj\n');

    objOffsets[imgObjId] = currentOffset;
    pushStr(
      `${imgObjId} 0 obj\n<< /Type /XObject /Subtype /Image /Width ${imgWidthPx} /Height ${imgHeightPx} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpegBytes.length} >>\nstream\n`,
    );
    pushBytes(jpegBytes);
    pushStr('\nendstream\nendobj\n');
  }

  // 交叉參照表 (xref)
  const xrefOffset = currentOffset;
  pushStr(`xref\n0 ${totalObjects + 1}\n`);
  pushStr('0000000000 65535 f \n');
  for (let id = 1; id <= totalObjects; id++) {
    pushStr(`${String(objOffsets[id]).padStart(10, '0')} 00000 n \n`);
  }

  pushStr(`trailer\n<< /Size ${totalObjects + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`);

  return new Blob(chunks, { type: 'application/pdf' });
}

export function dataUrlToUint8Array(dataUrl: string): Uint8Array<ArrayBuffer> {
  const base64 = dataUrl.split(',')[1] || '';
  const binaryStr = window.atob(base64);
  const len = binaryStr.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryStr.charCodeAt(i);
  }
  return bytes;
}

export async function generateStandardA4DoubleSidedPdf(
  pagesList: (Bookmark | null)[][],
  showCropMarks = true,
): Promise<PdfResult> {
  if (typeof document !== 'undefined' && document.fonts && document.fonts.ready) {
    try {
      await document.fonts.ready;
    } catch {}
  }

  // 預先載入所有書籤的風景圖片
  const imageCache = new Map();
  for (const slots of pagesList) {
    for (const bm of slots) {
      if (bm && !imageCache.has(bm.id)) {
        const activeSrc = resolveActiveBookmarkImage(bm);
        const loaded = activeSrc ? await loadHtmlImageAsync(activeSrc) : null;
        imageCache.set(bm.id, loaded);
      }
    }
  }

  const canvas = document.createElement('canvas');
  canvas.width = PDF_PAGE_W_PX;
  canvas.height = PDF_PAGE_H_PX;
  const ctx = canvas.getContext('2d')!;
  const slotW = PDF_PAGE_W_PX / 4;
  const slotH = PDF_PAGE_H_PX;

  const jpegPages = [];

  for (let setIdx = 0; setIdx < pagesList.length; setIdx++) {
    const rawSlots = pagesList[setIdx];
    const normalized = [0, 1, 2, 3].map((i) => rawSlots[i] || null);

    // 奇數頁：正面 [1][2][3][4]
    ctx.fillStyle = '#FAF8F5';
    ctx.fillRect(0, 0, PDF_PAGE_W_PX, PDF_PAGE_H_PX);
    for (let colIdx = 0; colIdx < 4; colIdx++) {
      const bm = normalized[colIdx];
      const offsetX = colIdx * slotW;
      if (bm) {
        drawBookmarkSideAOnCanvas(ctx, bm, offsetX, slotW, slotH, imageCache.get(bm.id) || null);
      } else {
        drawEmptySlotOnCanvas(ctx, offsetX, slotW, slotH, colIdx + 1);
      }
      drawSlotCropAndGuides(ctx, offsetX, slotW, slotH, colIdx, showCropMarks);
    }
    const frontDataUrl = canvas.toDataURL('image/jpeg', 0.9);
    jpegPages.push(dataUrlToUint8Array(frontDataUrl));

    // 偶數頁：短邊翻轉鏡像 [4][3][2][1]
    const mirrored = [normalized[3], normalized[2], normalized[1], normalized[0]];
    ctx.fillStyle = '#FAF8F5';
    ctx.fillRect(0, 0, PDF_PAGE_W_PX, PDF_PAGE_H_PX);
    for (let colIdx = 0; colIdx < 4; colIdx++) {
      const bm = mirrored[colIdx];
      const offsetX = colIdx * slotW;
      const logicalSlotNumber = 4 - colIdx;
      if (bm) {
        drawBookmarkSideBOnCanvas(ctx, bm, offsetX, slotW, slotH);
      } else {
        drawEmptySlotOnCanvas(ctx, offsetX, slotW, slotH, logicalSlotNumber);
      }
      drawSlotCropAndGuides(ctx, offsetX, slotW, slotH, colIdx, showCropMarks);
    }
    const backDataUrl = canvas.toDataURL('image/jpeg', 0.9);
    jpegPages.push(dataUrlToUint8Array(backDataUrl));
  }

  const pdfBlob = assembleMultiPagePdfBlob(jpegPages, PDF_PAGE_W_PX, PDF_PAGE_H_PX);
  const setCount = pagesList.length;
  const totalPages = jpegPages.length;
  const sizeMB = (pdfBlob.size / (1024 * 1024)).toFixed(2);
  const fileName = `南一中105_一頁府城記憶書籤_A4雙面四連排_${setCount}組.pdf`;

  return {
    blob: pdfBlob,
    totalPages,
    setCount,
    sizeMB,
    fileName,
  };
}
