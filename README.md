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

## 部署到 GitHub Pages（分享給學生和老師使用）

網站部署在 GitHub Pages，任何人用瀏覽器打開網址就能使用：

- 網站首頁：<https://oceanfish13910.github.io/11-20-/>
- 學生投稿頁：<https://oceanfish13910.github.io/11-20-/?mode=student>
- 教師後台：<https://oceanfish13910.github.io/11-20-/?mode=teacher>（驗證碼預設 `105`）

### 第一次部署

1. 確認 `src/environments/environment.ts` 的 `gasUrl` 已填入 Apps Script 的 `/exec` 網址。
2. 在專案資料夾執行：

   ```powershell
   ng build --base-href /11-20-/
   npx angular-cli-ghpages --dir=dist/CLAE/browser
   ```

   - `--base-href /11-20-/` 必須和 repo 名稱一致（前後都要有 `/`），少了會變成一片空白。
   - 第一次執行時，如果詢問是否安裝 `angular-cli-ghpages`，輸入 `y`。
3. 到 GitHub repo 的 **Settings → Pages**：
   - **Source**：Deploy from a branch
   - **Branch**：`gh-pages`，資料夾 `/ (root)`，按 **Save**
4. 等 1～2 分鐘，打開上面的網址確認。

> 必要條件：repo 必須是 **Public**（免費帳號只有公開 repo 能用 GitHub Pages）。

## 日後修改網頁的流程

GitHub 上有兩個分支，用途不同：

| 分支 | 內容 | 怎麼更新 |
| --- | --- | --- |
| `main` | 原始碼（給人看、給人改） | `git push` |
| `gh-pages` | 建置後的網站（給瀏覽器跑） | `npx angular-cli-ghpages` |

**只 push 到 `main` 不會更新網站**；只部署到 `gh-pages` 則原始碼沒有備份。所以每次修改都要做完下面兩件事。

### 1. 修改並在本機測試

```powershell
cd C:\Users\user\Desktop\project\105\CLAE
npm start
```

打開 <http://localhost:4200> 確認修改沒問題，測完在終端機按 `Ctrl + C` 停止。

### 2. 把原始碼 push 到 GitHub（`main` 分支）

```powershell
git status                       # 看看改了哪些檔案
git add -A
git commit -m "簡短說明這次改了什麼"
git pull origin main --no-rebase # 先同步遠端，避免 push 被拒絕
git push origin main
```

### 3. 重新建置並部署網站（`gh-pages` 分支）

```powershell
ng build --base-href /11-20-/
npx angular-cli-ghpages --dir=dist/CLAE/browser
```

### 4. 確認上線

1. 等 1～2 分鐘後打開網站。
2. 按 `Ctrl + F5` 強制重新整理，避免看到瀏覽器快取的舊版。
3. 可到 repo 的 **Actions** 分頁看「pages build and deployment」是否顯示綠色勾勾。

### 只改了 Apps Script（`apps-script/Code.gs`）時

網站不用重新建置，但 Google 那邊要更新：

1. 把新的 `Code.gs` 貼到試算表的 Apps Script 編輯器並儲存。
2. 「部署」→「管理部署作業」→ 鉛筆圖示 → 版本選「**新版本**」→ 部署。
   **不要**按「新增部署作業」，否則 `/exec` 網址會改變，網站就連不到了。
3. 原始碼仍照「步驟 2」push 到 `main` 備份。

### 換了 Apps Script 網址時

1. 修改 `src/environments/environment.ts` 的 `gasUrl`。
2. 依序做完上面的步驟 2、3。
3. 曾開過網站的電腦，瀏覽器可能記住舊網址：到教師後台「3. Google 試算表與協作平台連動設定」貼上新網址並儲存，或清除該網站的瀏覽資料。

## 常見問題

| 狀況 | 原因與解法 |
| --- | --- |
| `git push` 出現 `rejected (non-fast-forward)` | 遠端有你本機沒有的 commit。先 `git pull origin main --no-rebase`，有衝突就解決後再 commit、push。 |
| pull 時跳出編輯器 | 在輸入合併訊息。Vim 輸入 `:wq` 按 Enter；記事本直接存檔關閉。 |
| 網站一片空白 | 通常是 build 時忘了加 `--base-href /11-20-/`，重新建置並部署即可。 |
| 網站還是舊版 | 等 1～2 分鐘，再按 `Ctrl + F5`；並確認步驟 3 有執行（只 push 不會更新網站）。 |
| 學生送出了，試算表卻沒有資料 | 確認 `gasUrl` 已填、Apps Script 存取權是「所有人」、更新時選的是「新版本」。 |
| `ng` 不是內部或外部命令 | 改用 `npx ng build --base-href /11-20-/`。 |
| 執行 `npm start` 或 build 時說找不到套件 | 先執行 `npm install`。 |

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
