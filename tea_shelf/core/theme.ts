/** 首页配色随系统深浅模式切换，不强制外观。 */
export const teaTheme = {
  // 首页纵向滚动区域及首页导航栏的背景。
  background: { light: "#F0F5EC", dark: "#121C16" },
  // 茶品列表卡片的背景。
  card: { light: "#DCE9D4", dark: "#263C2C" },
  // 有底色工具按钮的背景；首页按钮当前默认透明，不使用此色。
  button: { light: "#2F6B45", dark: "#3C8257" },
  text: { light: "#153B25", dark: "#E2F1E5" },
  // 卡片品牌、斤价，以及茶品列表的加载和空数据提示。
  secondaryText: { light: "#45644F", dark: "#AAC5B2" },
  // 首页 NavigationStack 的 tint，供新增、返回等导航控件继承。
  accent: { light: "#2F6B45", dark: "#8AD5A4" },
  // 茶品卡片底部“评价 · 存量”整段文字。
  rating: { light: "#245B39", dark: "#8AD5A4" },
  // 首页导航栏左侧的版本号。
  version: { light: "#58705D", dark: "#91AD9A" },
  buttonText: "white",
} as const
