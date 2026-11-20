export interface MapCoords {
  x: number;
  y: number;
  label?: string;
}

export type VisualMode =
  | 'original'
  | 'woodcut'
  | 'pen-sketch'
  | 'oil-painting'
  | 'watercolor'
  | 'mosaic'
  | 'blank-sketch'
  | string;

/** 一枚記憶書籤（學生投稿資料） */
export interface Bookmark {
  id: string;
  studentInfo: string;
  locationZone: string;
  customZoneName: string;
  landmarkLabel: string;
  mapCoords: MapCoords;
  sideAText: string;
  visualMode: VisualMode;
  dotGrid: boolean;
  originalImage?: string;
  woodcutImage?: string;
  sketchImage?: string;
  oilPaintingImage?: string;
  watercolorImage?: string;
  mosaicImage?: string;
  imageDataUrl: string;
  interviewee: string;
  sideBText: string;
  createdAt: number;
  cloudSynced?: boolean;
}

export interface LocationZone {
  id: string;
  name: string;
  shortName: string;
  isTainan: boolean;
  targetStage: 'fucheng' | 'tainan' | 'taiwan' | string;
  isCustom?: boolean;
  coords: { x: number; y: number };
  badgeBg: string;
  badgeText: string;
  badgeBorder: string;
  description: string;
}

export interface GasResult {
  ok: boolean;
  skipped?: boolean;
  opaque?: boolean;
  error?: string;
  data?: any;
}

export interface PdfResult {
  blob: Blob;
  totalPages: number;
  setCount: number;
  sizeMB: string;
  fileName: string;
}
