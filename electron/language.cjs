'use strict';
const { app } = require('electron');
const i18n = require('../app/i18n.js');
// Main 的對話框與錯誤訊息跟 Renderer 用同一個語言。app.getLocale() 會反映 --lang 參數，所以放在最前面。
function apply(settings) {
    i18n.setLanguage(i18n.resolve(settings?.interface?.language, [app.getLocale(), ...app.getPreferredSystemLanguages()]));
}
module.exports = { apply };
