# 一頁府城・百年書籤（Angular 版）

臺南一中 105 歲校慶國文科成果展的書籤創作投稿網站，由原本單檔 React 的 `index.html` 移植成 Angular 22 專案。功能與原版相同：學生投稿表單、照片濾鏡、三段式臺灣記憶地圖、直書書籤預覽、教師後台（審閱修正、A4 雙面四連排、200 DPI PDF）、Google 試算表同步。

## 第一次使用

```bash
npm install
npm start          # 本機開發 http://localhost:4200
npm run build      # 輸出到 dist/CLAE/browser
```

## 串接 Google 試算表（讓學生資料送到老師那邊）

1. 打開要收資料的 Google 試算表 →「擴充功能」→「Apps Script」。
2. 刪掉預設內容，貼上 `apps-script/Code.gs`，按儲存。
3. 「部署」→「新增部署作業」→ 齒輪選「網頁應用程式」。
   - 執行身分：**我**
   - 誰可以存取：**所有人**
4. 授權後複製 `https://script.google.com/macros/s/.../exec` 網址。
5. 貼到 `src/environments/environment.ts` 的 `gasUrl`，再執行 `ng build`。

第一次收到投稿時，試算表會自動建立「書籤投稿資料」工作表。

之後若修改 Apps Script，請用「管理部署作業 → 編輯 → 新版本」，網址才不會變。

### 網址優先順序

1. 網址參數 `?gasUrl=...`
2. 瀏覽器 localStorage（教師後台「連動設定」儲存的值）
3. `environment.ts` 的 `gasUrl`

已開過舊版網站的電腦，localStorage 可能還留著舊網址；到教師後台重新儲存一次即可。

## 網址參數

- `?mode=student`：學生專用頁，隱藏教師後台入口。
- `?mode=teacher`：直接跳出教師驗證碼（預設 `105`）。
- 學生頁雙擊校徽也能進入教師後台。

## 專案結構

```
src/app/
  core/       資料模型、常數、Google 同步、濾鏡、PDF 產生器、全站狀態 AppStore
  shared/     圖示、校徽、記憶地圖、書籤正反面、A4 拼版
  student/    學生創作投稿工作坊
  teacher/    教師後台與修正編輯視窗
apps-script/Code.gs   貼到 Google 試算表的後端程式
```

## 已知限制（與原版相同）

- 教師驗證碼只在前端檢查；Apps Script 端點沒有驗證，知道網址的人都能讀取或刪除資料。
- 圖片超過 48,000 字元時，後端會直接截斷，可能存成無法顯示的圖。
