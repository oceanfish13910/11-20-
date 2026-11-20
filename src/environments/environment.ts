/**
 * 部署設定
 *
 * gasUrl：Google Apps Script「網頁應用程式」的 /exec 網址。
 *   1. 打開要收資料的 Google 試算表 →「擴充功能」→「Apps Script」
 *   2. 貼上 apps-script/Code.gs 的內容並儲存
 *   3. 「部署」→「新增部署作業」→ 類型「網頁應用程式」
 *      執行身分：我；誰可以存取：所有人
 *   4. 把產生的 https://script.google.com/macros/s/.../exec 貼到下面，再執行 ng build
 *
 * 留空時只會存在學生自己的瀏覽器，老師收不到。
 * 也可以用網址參數 ?gasUrl=... 暫時覆蓋，或在教師後台「連動設定」修改。
 */
export const environment = {
  gasUrl: 'https://script.google.com/macros/s/AKfycbzV28v-rCbVQs4w-je8C4nr-j5TazQHk-BHn8Dh6rhCIebO8_LAAKa7eBgFFDEAI_s/exec',
  /** 教師後台預設驗證碼（只是前端擋一下，不是真正的安全機制） */
  defaultTeacherPasscode: '105',
};
