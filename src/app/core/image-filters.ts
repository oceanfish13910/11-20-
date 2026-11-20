/* 由原 index.html 移植的純函式（保持原演算法不變） */

export interface PhotoFilterSet {
  original: string;
  woodcut: string;
  oilPainting: string;
  watercolor: string;
  mosaic: string;
}

// ============================================================================
// 3. Typography & Pure-Pixel Canvas Photo Filters
//    直排文字轉換、相片無失真壓縮與 5 種純像素藝術濾鏡演算引擎
// ============================================================================
export function formatVerticalChineseText(text: string | undefined | null): string {
  if (!text) return '';
  return text
    .replace(/「/g, '﹁')
    .replace(/」/g, '﹂')
    .replace(/『/g, '﹃')
    .replace(/』/g, '﹄')
    .replace(/（/g, '︵')
    .replace(/）/g, '︶')
    .replace(/\(/g, '︵')
    .replace(/\)/g, '︶');
}

export function splitIntoVerticalColumns(
  text: string | undefined | null,
  maxCharsPerCol = 10,
  maxCols = 5,
): string[][] {
  const formatted = formatVerticalChineseText((text || '').trim());
  if (!formatted) return [];
  const chars = Array.from(formatted).slice(0, maxCharsPerCol * maxCols);
  const columns = [];
  for (let i = 0; i < chars.length; i += maxCharsPerCol) {
    columns.push(chars.slice(i, i + maxCharsPerCol));
  }
  return columns;
}

export function compressImageFile(file: File, maxDimension = 640, quality = 0.88): Promise<string> {
  return new Promise((resolve, reject) => {
    const processLoadedImage = (img: HTMLImageElement) => {
      try {
        let { width, height } = img;
        if (!width || !height) {
          reject(new Error('無法讀取圖片尺寸'));
          return;
        }
        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          } else {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d')!;
        ctx.fillStyle = '#FAF8F5';
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      } catch (err) {
        reject(err);
      }
    };

    const loadWithFileReaderFallback = () => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const fallbackImg = new window.Image();
        fallbackImg.onload = () => processLoadedImage(fallbackImg);
        fallbackImg.onerror = (err) => reject(err);
        fallbackImg.src = String(event.target?.result || '');
      };
      reader.onerror = (err) => reject(err);
      reader.readAsDataURL(file);
    };

    if (typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function') {
      const objectUrl = URL.createObjectURL(file);
      const img = new window.Image();
      img.onload = () => {
        URL.revokeObjectURL(objectUrl);
        processLoadedImage(img);
      };
      img.onerror = () => {
        URL.revokeObjectURL(objectUrl);
        loadWithFileReaderFallback();
      };
      img.src = objectUrl;
    } else {
      loadWithFileReaderFallback();
    }
  });
}

export function createSampleTainanArchitectureDataUrl() {
  const w = 640;
  const h = 440;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;

  const sky = ctx.createLinearGradient(0, 0, 0, 310);
  sky.addColorStop(0, '#C7DCE8');
  sky.addColorStop(0.6, '#EAE4D5');
  sky.addColorStop(1, '#F5E7CE');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, h);

  ctx.fillStyle = 'rgba(255, 244, 214, 0.85)';
  ctx.beginPath();
  ctx.arc(515, 86, 40, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#5B3A29';
  ctx.beginPath();
  ctx.moveTo(155, 118);
  ctx.quadraticCurveTo(320, 132, 485, 118);
  ctx.quadraticCurveTo(512, 92, 526, 78);
  ctx.quadraticCurveTo(494, 112, 468, 134);
  ctx.lineTo(172, 134);
  ctx.quadraticCurveTo(146, 112, 114, 78);
  ctx.quadraticCurveTo(128, 92, 155, 118);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = '#C59B27';
  ctx.fillRect(285, 110, 70, 8);
  ctx.beginPath();
  ctx.arc(320, 108, 9, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#A63A2B';
  ctx.fillRect(88, 134, 464, 218);

  ctx.strokeStyle = 'rgba(62, 20, 16, 0.25)';
  ctx.lineWidth = 1;
  for (let y = 142; y < 350; y += 10) {
    ctx.beginPath();
    ctx.moveTo(88, y);
    ctx.lineTo(552, y);
    ctx.stroke();
  }

  ctx.fillStyle = '#DDD3C2';
  ctx.fillRect(80, 128, 480, 12);
  ctx.fillRect(84, 146, 472, 6);

  [175, 320, 465].forEach((cx) => {
    ctx.fillStyle = '#261E1B';
    ctx.beginPath();
    ctx.arc(cx, 246, 44, Math.PI, 0);
    ctx.lineTo(cx + 44, 352);
    ctx.lineTo(cx - 44, 352);
    ctx.closePath();
    ctx.fill();

    const glow = ctx.createRadialGradient(cx, 252, 4, cx, 252, 34);
    glow.addColorStop(0, 'rgba(255, 205, 112, 0.92)');
    glow.addColorStop(1, 'rgba(255, 180, 80, 0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(cx, 252, 34, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#C93B2B';
    ctx.beginPath();
    ctx.ellipse(cx, 236, 9, 12, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#C59B27';
    ctx.fillRect(cx - 5, 223, 10, 3);
    ctx.fillRect(cx - 5, 247, 10, 3);

    ctx.strokeStyle = '#EFE6D5';
    ctx.lineWidth = 4.5;
    ctx.beginPath();
    ctx.arc(cx, 246, 46, Math.PI, 0);
    ctx.stroke();
  });

  ctx.fillStyle = '#385437';
  [
    [76, 124, 54],
    [122, 102, 48],
    [48, 166, 44],
    [98, 154, 38],
  ].forEach(([bx, by, br]) => {
    ctx.beginPath();
    ctx.arc(bx, by, br, 0, Math.PI * 2);
    ctx.fill();
  });

  ctx.strokeStyle = '#4B3D2E';
  ctx.lineWidth = 1.6;
  [62, 74, 88, 104].forEach((rx, idx) => {
    ctx.beginPath();
    ctx.moveTo(rx, 158);
    ctx.quadraticCurveTo(rx + (idx % 2 === 0 ? 4 : -4), 215, rx, 265 + idx * 8);
    ctx.stroke();
  });

  ctx.fillStyle = '#C7BDB0';
  ctx.fillRect(0, 352, w, 88);
  ctx.strokeStyle = '#857B70';
  ctx.lineWidth = 1.5;
  for (let y = 368; y < h; y += 18) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
    ctx.stroke();
    const offset = ((y / 18) % 2) * 32;
    for (let x = offset; x < w; x += 64) {
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x, y + 18);
      ctx.stroke();
    }
  }

  return canvas.toDataURL('image/jpeg', 0.9);
}

export function separableBoxBlurRgba(
  srcData: Uint8ClampedArray,
  w: number,
  h: number,
  radius: number,
) {
  const temp = new Uint8ClampedArray(srcData.length);
  const dst = new Uint8ClampedArray(srcData.length);
  const windowSize = radius * 2 + 1;

  for (let y = 0; y < h; y++) {
    const rowOffset = y * w * 4;
    let rSum = 0;
    let gSum = 0;
    let bSum = 0;

    for (let k = -radius; k <= radius; k++) {
      const cx = Math.min(w - 1, Math.max(0, k));
      const idx = rowOffset + cx * 4;
      rSum += srcData[idx];
      gSum += srcData[idx + 1];
      bSum += srcData[idx + 2];
    }

    for (let x = 0; x < w; x++) {
      const outIdx = rowOffset + x * 4;
      temp[outIdx] = Math.round(rSum / windowSize);
      temp[outIdx + 1] = Math.round(gSum / windowSize);
      temp[outIdx + 2] = Math.round(bSum / windowSize);
      temp[outIdx + 3] = 255;

      const removeX = Math.min(w - 1, Math.max(0, x - radius));
      const addX = Math.min(w - 1, Math.max(0, x + radius + 1));
      const remIdx = rowOffset + removeX * 4;
      const addIdx = rowOffset + addX * 4;
      rSum += srcData[addIdx] - srcData[remIdx];
      gSum += srcData[addIdx + 1] - srcData[remIdx + 1];
      bSum += srcData[addIdx + 2] - srcData[remIdx + 2];
    }
  }

  for (let x = 0; x < w; x++) {
    let rSum = 0;
    let gSum = 0;
    let bSum = 0;

    for (let k = -radius; k <= radius; k++) {
      const cy = Math.min(h - 1, Math.max(0, k));
      const idx = (cy * w + x) * 4;
      rSum += temp[idx];
      gSum += temp[idx + 1];
      bSum += temp[idx + 2];
    }

    for (let y = 0; y < h; y++) {
      const outIdx = (y * w + x) * 4;
      dst[outIdx] = Math.round(rSum / windowSize);
      dst[outIdx + 1] = Math.round(gSum / windowSize);
      dst[outIdx + 2] = Math.round(bSum / windowSize);
      dst[outIdx + 3] = 255;

      const removeY = Math.min(h - 1, Math.max(0, y - radius));
      const addY = Math.min(h - 1, Math.max(0, y + radius + 1));
      const remIdx = (removeY * w + x) * 4;
      const addIdx = (addY * w + x) * 4;
      rSum += temp[addIdx] - temp[remIdx];
      gSum += temp[addIdx + 1] - temp[remIdx + 1];
      bSum += temp[addIdx + 2] - temp[remIdx + 2];
    }
  }

  return dst;
}

export function generateAllPhotoFilters(sourceDataUrl: string): Promise<PhotoFilterSet> {
  return new Promise((resolve) => {
    const img = new window.Image();
    img.onload = () => {
      const w = img.width;
      const h = img.height;

      const baseCanvas = document.createElement('canvas');
      baseCanvas.width = w;
      baseCanvas.height = h;
      const baseCtx = baseCanvas.getContext('2d')!;
      baseCtx.fillStyle = '#FAF8F5';
      baseCtx.fillRect(0, 0, w, h);
      baseCtx.drawImage(img, 0, 0, w, h);
      const src = baseCtx.getImageData(0, 0, w, h).data;

      // 1. 照片原圖 ('original')
      const origCanvas = document.createElement('canvas');
      origCanvas.width = w;
      origCanvas.height = h;
      const origCtx = origCanvas.getContext('2d')!;
      const origImgData = origCtx.createImageData(w, h);
      const od = origImgData.data;
      for (let i = 0; i < src.length; i += 4) {
        od[i] = Math.min(255, Math.max(0, Math.round((src[i] - 128) * 1.04 + 131)));
        od[i + 1] = Math.min(255, Math.max(0, Math.round((src[i + 1] - 128) * 1.04 + 129)));
        od[i + 2] = Math.min(255, Math.max(0, Math.round((src[i + 2] - 128) * 1.03 + 123)));
        od[i + 3] = 255;
      }
      origCtx.putImageData(origImgData, 0, 0);
      const originalDataUrl = origCanvas.toDataURL('image/jpeg', 0.88);

      // 2. 復古木刻版畫 ('woodcut') — Sobel 邊緣偵測 + 木刻斜線排線
      const lum = new Float32Array(w * h);
      for (let i = 0, p = 0; i < src.length; i += 4, p++) {
        lum[p] = 0.299 * src[i] + 0.587 * src[i + 1] + 0.114 * src[i + 2];
      }

      const smoothLum = new Float32Array(w * h);
      for (let y = 0; y < h; y++) {
        const ym1 = Math.max(0, y - 1);
        const yp1 = Math.min(h - 1, y + 1);
        for (let x = 0; x < w; x++) {
          const xm1 = Math.max(0, x - 1);
          const xp1 = Math.min(w - 1, x + 1);
          const sum =
            lum[ym1 * w + xm1] +
            2 * lum[ym1 * w + x] +
            lum[ym1 * w + xp1] +
            2 * lum[y * w + xm1] +
            4 * lum[y * w + x] +
            2 * lum[y * w + xp1] +
            lum[yp1 * w + xm1] +
            2 * lum[yp1 * w + x] +
            lum[yp1 * w + xp1];
          smoothLum[y * w + x] = sum / 16;
        }
      }

      const woodcutCanvas = document.createElement('canvas');
      woodcutCanvas.width = w;
      woodcutCanvas.height = h;
      const woodcutCtx = woodcutCanvas.getContext('2d')!;
      const woodcutImgData = woodcutCtx.createImageData(w, h);
      const wcd = woodcutImgData.data;

      for (let y = 0; y < h; y++) {
        const ym1 = Math.max(0, y - 1);
        const yp1 = Math.min(h - 1, y + 1);
        for (let x = 0; x < w; x++) {
          const xm1 = Math.max(0, x - 1);
          const xp1 = Math.min(w - 1, x + 1);
          const p = y * w + x;
          const idx = p * 4;

          const gx =
            -smoothLum[ym1 * w + xm1] +
            smoothLum[ym1 * w + xp1] -
            2 * smoothLum[y * w + xm1] +
            2 * smoothLum[y * w + xp1] -
            smoothLum[yp1 * w + xm1] +
            smoothLum[yp1 * w + xp1];
          const gy =
            -smoothLum[ym1 * w + xm1] -
            2 * smoothLum[ym1 * w + x] -
            smoothLum[ym1 * w + xp1] +
            smoothLum[yp1 * w + xm1] +
            2 * smoothLum[yp1 * w + x] +
            smoothLum[yp1 * w + xp1];
          const edgeMag = Math.hypot(gx, gy);

          const v = smoothLum[p];
          const hatchWave = Math.sin((x + y * 0.85) * 0.95);
          const woodGrain = (((x * 13 + y * 29) % 17) - 8) * 0.9;

          if (edgeMag > 68 || v < 62) {
            wcd[idx] = 38;
            wcd[idx + 1] = 34;
            wcd[idx + 2] = 30;
          } else if (v < 118) {
            if (hatchWave > 0.25) {
              wcd[idx] = 44;
              wcd[idx + 1] = 39;
              wcd[idx + 2] = 34;
            } else {
              wcd[idx] = 246;
              wcd[idx + 1] = 241;
              wcd[idx + 2] = 232;
            }
          } else if (v < 168) {
            if (edgeMag > 36 || hatchWave > 0.68) {
              wcd[idx] = 148;
              wcd[idx + 1] = 62;
              wcd[idx + 2] = 48;
            } else {
              wcd[idx] = Math.min(255, Math.max(0, 248 + woodGrain));
              wcd[idx + 1] = Math.min(255, Math.max(0, 244 + woodGrain));
              wcd[idx + 2] = Math.min(255, Math.max(0, 236 + woodGrain));
            }
          } else {
            wcd[idx] = Math.min(255, Math.max(0, 250 + woodGrain));
            wcd[idx + 1] = Math.min(255, Math.max(0, 247 + woodGrain));
            wcd[idx + 2] = Math.min(255, Math.max(0, 241 + woodGrain));
          }
          wcd[idx + 3] = 255;
        }
      }
      woodcutCtx.putImageData(woodcutImgData, 0, 0);
      const woodcutDataUrl = woodcutCanvas.toDataURL('image/jpeg', 0.88);

      // 3. 印象厚塗油畫 ('oil-painting') — Kuwahara 四象限最小變異數筆觸
      const oilCanvas = document.createElement('canvas');
      oilCanvas.width = w;
      oilCanvas.height = h;
      const oilCtx = oilCanvas.getContext('2d')!;
      const oilImgData = oilCtx.createImageData(w, h);
      const opd = oilImgData.data;

      const brushR = Math.max(2, Math.round(Math.min(w, h) / 140));
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          let bestVar = Infinity;
          let bestR = 0;
          let bestG = 0;
          let bestB = 0;

          const quadrants = [
            [-brushR, 0, -brushR, 0],
            [0, brushR, -brushR, 0],
            [-brushR, 0, 0, brushR],
            [0, brushR, 0, brushR],
          ];

          for (let q = 0; q < 4; q++) {
            const [dx0, dx1, dy0, dy1] = quadrants[q];
            let rSum = 0;
            let gSum = 0;
            let bSum = 0;
            let lumSum = 0;
            let lumSqSum = 0;
            let cnt = 0;

            for (let dy = dy0; dy <= dy1; dy++) {
              const sy = Math.min(h - 1, Math.max(0, y + dy));
              for (let dx = dx0; dx <= dx1; dx++) {
                const sx = Math.min(w - 1, Math.max(0, x + dx));
                const sIdx = (sy * w + sx) * 4;
                const r = src[sIdx];
                const g = src[sIdx + 1];
                const b = src[sIdx + 2];
                const l = 0.299 * r + 0.587 * g + 0.114 * b;
                rSum += r;
                gSum += g;
                bSum += b;
                lumSum += l;
                lumSqSum += l * l;
                cnt++;
              }
            }

            const meanLum = lumSum / cnt;
            const variance = lumSqSum / cnt - meanLum * meanLum;
            if (variance < bestVar) {
              bestVar = variance;
              bestR = rSum / cnt;
              bestG = gSum / cnt;
              bestB = bSum / cnt;
            }
          }

          const avg = (bestR + bestG + bestB) / 3;
          const satBoost = 1.24;
          const impastoStroke =
            Math.sin(x * 0.55 - y * 0.45) * 7 + (x % 3 === 0 && y % 3 === 0 ? 4 : -2);

          const outIdx = (y * w + x) * 4;
          opd[outIdx] = Math.min(
            255,
            Math.max(0, Math.round(avg + (bestR - avg) * satBoost + impastoStroke + 4)),
          );
          opd[outIdx + 1] = Math.min(
            255,
            Math.max(0, Math.round(avg + (bestG - avg) * satBoost + impastoStroke + 1)),
          );
          opd[outIdx + 2] = Math.min(
            255,
            Math.max(0, Math.round(avg + (bestB - avg) * satBoost + impastoStroke - 4)),
          );
          opd[outIdx + 3] = 255;
        }
      }
      oilCtx.putImageData(oilImgData, 0, 0);
      const oilPaintingDataUrl = oilCanvas.toDataURL('image/jpeg', 0.88);

      // 4. 溫潤水彩暈染 ('watercolor') — 可分離盒式模糊 + 色階量化 + 棉紙暈邊
      const wcCanvas = document.createElement('canvas');
      wcCanvas.width = w;
      wcCanvas.height = h;
      const wcCtx = wcCanvas.getContext('2d')!;
      const blurredRgba = separableBoxBlurRgba(src, w, h, 3);
      const wcImgData = wcCtx.createImageData(w, h);
      const wd = wcImgData.data;

      const levels = 9;
      const step = 255 / levels;
      for (let i = 0, p = 0; i < blurredRgba.length; i += 4, p++) {
        const x = p % w;
        const y = Math.floor(p / w);
        const grain = (((x * 17 + y * 31) % 13) - 6) * 1.4;

        const br = blurredRgba[i];
        const bg = blurredRgba[i + 1];
        const bb = blurredRgba[i + 2];
        const mean = (br + bg + bb) / 3;
        const sr = mean + (br - mean) * 1.25;
        const sg = mean + (bg - mean) * 1.25;
        const sb = mean + (bb - mean) * 1.25;

        const qr = Math.min(255, Math.max(0, Math.round(sr / step) * step + grain));
        const qg = Math.min(255, Math.max(0, Math.round(sg / step) * step + grain));
        const qb = Math.min(255, Math.max(0, Math.round(sb / step) * step + grain));

        wd[i] = Math.round(qr * 0.82 + 250 * 0.18);
        wd[i + 1] = Math.round(qg * 0.82 + 248 * 0.18);
        wd[i + 2] = Math.round(qb * 0.8 + 245 * 0.2);
        wd[i + 3] = 255;
      }
      wcCtx.putImageData(wcImgData, 0, 0);

      const vig = wcCtx.createRadialGradient(
        w / 2,
        h / 2,
        Math.min(w, h) * 0.34,
        w / 2,
        h / 2,
        Math.max(w, h) * 0.68,
      );
      vig.addColorStop(0, 'rgba(250, 248, 245, 0)');
      vig.addColorStop(1, 'rgba(250, 248, 245, 0.55)');
      wcCtx.fillStyle = vig;
      wcCtx.fillRect(0, 0, w, h);
      const watercolorDataUrl = wcCanvas.toDataURL('image/jpeg', 0.88);

      // 5. 復古馬賽克拼貼 ('mosaic') — 磁磚均值拼貼 + 灰縫高光
      const mosaicCanvas = document.createElement('canvas');
      mosaicCanvas.width = w;
      mosaicCanvas.height = h;
      const mosaicCtx = mosaicCanvas.getContext('2d')!;
      mosaicCtx.fillStyle = '#EAE2D3';
      mosaicCtx.fillRect(0, 0, w, h);

      const tileSize = Math.max(8, Math.round(Math.min(w, h) / 40));
      const grout = 1.3;
      for (let ty = 0; ty < h; ty += tileSize) {
        for (let tx = 0; tx < w; tx += tileSize) {
          let rSum = 0,
            gSum = 0,
            bSum = 0,
            count = 0;
          const maxY = Math.min(h, ty + tileSize);
          const maxX = Math.min(w, tx + tileSize);
          for (let py = ty; py < maxY; py += 2) {
            for (let px = tx; px < maxX; px += 2) {
              const idx = (py * w + px) * 4;
              rSum += src[idx];
              gSum += src[idx + 1];
              bSum += src[idx + 2];
              count++;
            }
          }
          if (count > 0) {
            const rAvg = Math.round(rSum / count);
            const gAvg = Math.round(gSum / count);
            const bAvg = Math.round(bSum / count);
            mosaicCtx.fillStyle = `rgb(${rAvg}, ${gAvg}, ${bAvg})`;
            mosaicCtx.fillRect(
              tx + grout * 0.5,
              ty + grout * 0.5,
              Math.max(1, tileSize - grout),
              Math.max(1, tileSize - grout),
            );
            mosaicCtx.fillStyle = 'rgba(255, 252, 245, 0.14)';
            mosaicCtx.fillRect(
              tx + grout * 0.5,
              ty + grout * 0.5,
              Math.max(1, tileSize - grout),
              1.5,
            );
          }
        }
      }
      const mosaicDataUrl = mosaicCanvas.toDataURL('image/jpeg', 0.88);

      resolve({
        original: originalDataUrl,
        woodcut: woodcutDataUrl,
        oilPainting: oilPaintingDataUrl,
        watercolor: watercolorDataUrl,
        mosaic: mosaicDataUrl,
      });
    };
    img.onerror = () =>
      resolve({
        original: sourceDataUrl,
        woodcut: sourceDataUrl,
        oilPainting: sourceDataUrl,
        watercolor: sourceDataUrl,
        mosaic: sourceDataUrl,
      });
    img.src = sourceDataUrl;
  });
}
