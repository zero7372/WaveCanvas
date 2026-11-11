'use strict';
// Beta：原生標題列按鈕的高度跟著「介面大小」偏好設定，和頂列（38 px × 縮放）對齊。
const BASE_HEIGHT = 38;
function apply(window, settings) {
    if (process.platform !== 'win32' || !window || window.isDestroyed() || typeof window.setTitleBarOverlay !== 'function') return;
    const scale = Number(settings?.interface?.uiScale) || 1;
    window.setTitleBarOverlay({ height: Math.round(BASE_HEIGHT * scale) });
}
module.exports = { apply, BASE_HEIGHT };
