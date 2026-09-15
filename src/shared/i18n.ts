/* =============================================================
   Lightweight bilingual (English / 简体中文) UI strings.

   Follows the browser UI language: anything starting with "zh"
   gets Chinese, everything else falls back to English. Exported
   document content (SOPs, agent instructions, trajectory) stays
   English on purpose — those are read by agents/tools.

   Usage: t("popup.start"), or t("popup.status.recording", { n: 3 }).
   {token} placeholders are replaced from the vars argument.
============================================================= */

export type Lang = "en" | "zh";

function detectLang(): Lang {
  try {
    const ui =
      (typeof chrome !== "undefined" && chrome.i18n?.getUILanguage?.()) ||
      (typeof navigator !== "undefined" ? navigator.language : "") ||
      "en";
    return ui.toLowerCase().startsWith("zh") ? "zh" : "en";
  } catch {
    return "en";
  }
}

export const lang: Lang = detectLang();

type Entry = { en: string; zh: string };

const dict = {
  // Popup
  "popup.kicker": { en: "Q-PROS · Manual Guide", zh: "Q-PROS · 操作指南" },
  "popup.title.a": { en: "Record it.", zh: "录下来。" },
  "popup.title.b": { en: "Replay it.", zh: "随时重放。" },
  "popup.status.ready": { en: "Ready when you are.", zh: "随时可以开始。" },
  "popup.status.recording": { en: "Recording · {n} steps", zh: "录制中 · {n} 步" },
  "popup.status.paused": { en: "Paused · {n} steps", zh: "已暂停 · {n} 步" },
  "popup.start": { en: "Start recording", zh: "开始录制" },
  "popup.stop": { en: "Stop recording", zh: "停止录制" },
  "popup.pause": { en: "Pause recording", zh: "暂停录制" },
  "popup.resume": { en: "Resume recording", zh: "继续录制" },
  "popup.openLast": { en: "Open last recording", zh: "打开上次录制" },
  "popup.openLibrary": { en: "Open guide library", zh: "打开指南库" },
  "popup.hint": {
    en: "No steps yet. Click somewhere on the page to confirm capture is working. If nothing arrives, reload the page and try again.",
    zh: "还没有步骤。在页面上点一下确认采集是否正常。如果仍无反应，刷新页面后重试。"
  },
  "popup.shortcut": { en: "Tip: press Alt+Shift+R to start or stop anywhere.", zh: "提示：在任意页面按 Alt+Shift+R 即可启停录制。" },
  // Onboarding (J)
  "onboard.title": { en: "Three steps to your first recording", zh: "三步完成你的第一次录制" },
  "onboard.s1": { en: "Press Start recording — the page stays in control, you just use it.", zh: "点「开始录制」——页面照常操作，你正常用就行。" },
  "onboard.s2": { en: "A REC badge appears on the page; each action flashes when it's saved.", zh: "页面上会出现 REC 角标；每个动作保存好时会闪一下提示。" },
  "onboard.s3": { en: "Open the guide library here to edit steps and export an SOP or Skill Pack.", zh: "在这里打开指南库，编辑步骤并导出 SOP 或 Skill Pack。" },
  "onboard.dismiss": { en: "Got it", zh: "知道了" },
  // Editor shell
  "editor.kicker": { en: "Q-PROS · Guide Library", zh: "Q-PROS · 指南库" },
  "editor.title": { en: "Guide library.", zh: "指南库。" },
  "editor.exportPack": { en: "Export Skill Pack", zh: "导出 Skill Pack" },
  "editor.moreFormats": { en: "More formats", zh: "更多格式" },
  "editor.export.markdown": { en: "SOP · Markdown", zh: "SOP · Markdown" },
  "editor.export.playwright": { en: "Playwright test", zh: "Playwright 测试" },
  "editor.export.devtools": { en: "DevTools Recorder", zh: "DevTools Recorder" },
  "editor.export.docx": { en: "Word document", zh: "Word 文档" },
  "editor.addManual": { en: "Add manual step", zh: "添加手动步骤" },
  "editor.export.pdf": { en: "PDF document", zh: "PDF 文档" },
  "editor.recordings": { en: "Recordings", zh: "录制记录" },
  "editor.sessionMeta": { en: "{n} steps", zh: "{n} 步" },
  "editor.storage": { en: "{n} recordings · {usage}", zh: "{n} 条记录 · {usage}" },
  "editor.clearAll": { en: "Clear all data", zh: "清空全部数据" },
  "editor.deleteRecording": { en: "Delete recording", zh: "删除该记录" },
  "editor.confirmDeleteSession": {
    en: "Delete this recording and all of its steps and screenshots?",
    zh: "删除这条录制及其所有步骤和截图？"
  },
  "editor.confirmClearAll": {
    en: "Delete ALL recordings, steps, and screenshots? This cannot be undone.",
    zh: "删除全部录制、步骤和截图？此操作无法撤销。"
  },
  // Empty states
  "empty.shelf.kicker": { en: "Empty shelf", zh: "空书架" },
  "empty.shelf.title": { en: "Nothing selected yet", zh: "还没有选中任何记录" },
  "empty.shelf.body": {
    en: "Start a recording from the popup, then return here to edit and export it.",
    zh: "先在弹窗里开始录制，然后回到这里编辑并导出。"
  },
  "empty.steps.kicker": { en: "No steps captured", zh: "没有采集到步骤" },
  "empty.steps.title": { en: "This recording is empty", zh: "这条录制是空的" },
  "empty.steps.body": {
    en: "Reopen the page, start recording, and interact with it — each click and page change lands here.",
    zh: "重新打开页面、开始录制并操作——每次点击和页面变化都会出现在这里。"
  },
  // Workflow card (A)
  "wf.kicker": { en: "Workflow", zh: "工作流" },
  "wf.namePlaceholder": { en: "Name this workflow", zh: "给这个工作流起个名字" },
  "wf.goal": { en: "Goal", zh: "目标" },
  "wf.goalPlaceholder": {
    en: "What is the end goal of this workflow? An agent reads this as the intent to accomplish.",
    zh: "这个工作流的最终目标是什么？智能体会把它当作要达成的意图。"
  },
  "wf.criteria": { en: "Success criteria", zh: "成功标准" },
  "wf.criteriaPlaceholder": {
    en: "What confirms the workflow is done? e.g. a confirmation page, an order number, a visible status change.",
    zh: "怎样算完成？例如：确认页、订单号、可见的状态变化。"
  },
  // Step card
  "step.label": { en: "Step {n} · {type}", zh: "第 {n} 步 · {type}" },
  "step.runtime": { en: "Runtime variable", zh: "运行时变量" },
  "step.sensitive": { en: "Sensitive", zh: "敏感信息" },
  "step.highRisk": { en: "High risk", zh: "高风险" },
  "step.moveUp": { en: "Move Up", zh: "上移" },
  "step.moveDown": { en: "Move Down", zh: "下移" },
  "step.delete": { en: "Delete", zh: "删除" },
  "step.url": { en: "URL", zh: "网址" },
  "step.confidence": { en: "Confidence", zh: "置信度" },
  "step.lowConf": { en: "low — verify locator", zh: "偏低 — 请核对定位器" },
  "step.dragHandle": { en: "Drag to reorder", zh: "拖动以重新排序" },
  "step.zoom": { en: "Click to enlarge", zh: "点击放大" },
  "step.noShot": { en: "No screenshot", zh: "无截图" },
  "step.note": { en: "Note", zh: "备注" },
  "step.wait": { en: "Wait", zh: "等待" },
  "step.waitSeconds": { en: "Seconds", zh: "秒数" },
  "step.notePlaceholder": { en: "Describe what happens or what to check here.", zh: "在此说明这一步发生了什么或需要确认什么。" },
  // Locator (F)
  "locator.title": { en: "Locator", zh: "定位器" },
  "locator.css": { en: "CSS selector", zh: "CSS 选择器" },
  "locator.xpath": { en: "XPath", zh: "XPath" },
  "locator.alternatives": { en: "Recorded alternatives", zh: "录制到的备选定位器" },
  // Lightbox
  "lightbox.close": { en: "Close", zh: "关闭" },
  // Deleted / restore (P)
  "deleted.toggle": { en: "Deleted ({n})", zh: "已删除（{n}）" },
  "deleted.restore": { en: "Restore", zh: "恢复" },
  // Insert manual step (N)
  "insert.title": { en: "Add a manual step", zh: "添加手动步骤" },
  "insert.note": { en: "+ Note", zh: "+ 备注" },
  "insert.wait": { en: "+ Wait", zh: "+ 等待" },
  "insert.hint": { en: "Appended at the end — drag it into place.", zh: "会添加到末尾——拖动到合适位置即可。" },
  // Overlay (content script)
  "overlay.steps": { en: "{n} steps", zh: "{n} 步" },
  "overlay.capturing": { en: "· capturing…", zh: "· 记录中…" },
  "overlay.complete": { en: "· ✓ step {n} saved", zh: "· ✓ 第 {n} 步已记录，可继续" },
  "overlay.paused": { en: "· paused", zh: "· 已暂停" },
  // Full export menu (shared sidepanel + editor)
  "editor.export.skillpack": { en: "Skill Pack (ZIP)", zh: "Skill Pack（ZIP）" },
  "editor.addStepHere": { en: "Add step here", zh: "在此添加步骤" },
  // Manual step modal
  "manual.addTitle": { en: "Add manual step", zh: "添加手动步骤" },
  "manual.insertTitle": { en: "Insert step here", zh: "在此插入步骤" },
  "manual.body": {
    en: "Add a step with your own screenshot (e.g. from Postman, desktop app, database, etc.)",
    zh: "用你自己的截图添加一个步骤（例如 Postman、桌面应用、数据库等）。"
  },
  "manual.titleLabel": { en: "Title *", zh: "标题 *" },
  "manual.titlePlaceholder": { en: "e.g. Verify API response in Postman", zh: "例如：在 Postman 中验证接口返回" },
  "manual.descLabel": { en: "Description", zh: "描述" },
  "manual.descPlaceholder": { en: "Describe what this step covers...", zh: "描述这一步覆盖的内容……" },
  "manual.shotLabel": { en: "Screenshot (optional)", zh: "截图（可选）" },
  "manual.previewAlt": { en: "Preview", zh: "预览" },
  "manual.remove": { en: "Remove", zh: "移除" },
  "manual.add": { en: "Add Step", zh: "添加步骤" },
  "manual.cancel": { en: "Cancel", zh: "取消" },
  "manual.added": { en: "Manual step added", zh: "已添加手动步骤" },
  // Lightbox nav
  "lightbox.prev": { en: "Previous screenshot", zh: "上一张截图" },
  "lightbox.next": { en: "Next screenshot", zh: "下一张截图" },
  // Sidepanel
  "sidepanel.title": { en: "Q-PROS Manual Guide", zh: "Q-PROS 操作指南" },
  "sidepanel.credit": { en: "by Q-PROS", zh: "Q-PROS 出品" },
  "sidepanel.select": { en: "Select a Recording Session", zh: "选择一条录制" },
  "sidepanel.emptyTitle": { en: "No recordings yet", zh: "还没有录制" },
  "sidepanel.emptyHint": {
    en: "Click the extension icon and start recording to create your first session",
    zh: "点击扩展图标并开始录制来创建第一条记录"
  },
  "sidepanel.status.recording": { en: "recording", zh: "录制中" },
  "sidepanel.status.idle": { en: "idle", zh: "已结束" },
  "sidepanel.back": { en: "Back to sessions", zh: "返回记录列表" },
  "sidepanel.started": { en: "Started {date}", zh: "开始于 {date}" },
  "sidepanel.generating": { en: "Generating {format}...", zh: "正在生成 {format}……" },
  "sidepanel.exported": { en: "{format} exported successfully!", zh: "{format} 导出成功！" },
  "sidepanel.exportError": { en: "Error: {msg}", zh: "出错：{msg}" },
  "sidepanel.exportFailed": { en: "Export failed", zh: "导出失败" },
  "sidepanel.loading": { en: "Loading steps...", zh: "正在加载步骤……" },
  "sidepanel.deleteStep": { en: "Delete Step", zh: "删除步骤" },
  "sidepanel.stepDeleted": { en: "Step deleted", zh: "已删除步骤" },
  "sidepanel.deleteSession": { en: "Delete Session", zh: "删除该记录" },
  "sidepanel.sessionDeleted": { en: "Session deleted", zh: "已删除记录" },
  "sidepanel.url": { en: "URL: {url}", zh: "网址：{url}" },
  "sidepanel.time": { en: "Time: {date}", zh: "时间：{date}" }
} satisfies Record<string, Entry>;

export type MessageKey = keyof typeof dict;

/* Exposed for the i18n coverage check + unit tests: every t() key used
   in src must resolve to a non-empty en + zh string. */
export const dictionary: Record<string, Entry> = dict;

export function t(key: MessageKey, vars?: Record<string, string | number>): string {
  const entry = dict[key];
  let text = entry[lang] ?? entry.en;
  if (vars) {
    for (const [name, value] of Object.entries(vars)) {
      text = text.replace(new RegExp(`\\{${name}\\}`, "g"), String(value));
    }
  }
  return text;
}
