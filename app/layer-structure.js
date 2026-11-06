(function () {
    'use strict';
    // 介面結構的唯一來源：每個圖層都依「來源或內容、外觀或文字、位置、低頻反應」排列。
    // 列的格式為 [種類, 設定鍵, 顯示名稱]，種類對應既有控制項的 data 屬性。
    const attributes = { p: 'property', g: 'layout-property', t: 'text-property', l: 'lyrics-property', b: 'background-property' };
    const icon = path => '<svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.3" aria-hidden="true">' + path + '</svg>';
    const layers = [
        { id: 'audio', name: '音訊', icon: icon('<path d="M2 6.5v3M5 4v8M8 2v12M11 5v6M14 7v2"/>'), sections: [
            { title: '來源', media: ['audio'] },
            { title: '音訊反應', rows: [['input', 'inputGain', '輸入增益'], ['p', 'resposive', '反應速度'], ['p', 'normalize', '音訊平滑'], ['p', 'noise', '雜訊補償']] },
            { title: '畫面震動', rows: [['p', 'bassshakemultiplier', '強度'], ['p', 'bassshaketolerance', '門檻']] },
            { title: '預覽', rows: [['p', 'frameratepersecond', '顯示低幀率警告']] }
        ] },
        { id: 'background', name: '背景', icon: icon('<rect x="2" y="3" width="12" height="10"/><path d="m2 11 3.5-3 3 2.5L11 8l3 3"/>'), sections: [
            { title: '來源', rows: [['p', 'backgroundsource', '類型'], ['p', 'backgroundcolor', '顏色'], ['b', 'enabled', '顯示圖片'], ['p', 'backgroundimage', '圖片'], ['b', 'mode', '動作']] },
            { title: '外觀', rows: [['b', 'opacity', '不透明度'], ['b', 'blur', '模糊'], ['b', 'backingColor', '圖片後方底色']] },
            { title: '位置', rows: [['proxy', 'backgroundX', '水平位置'], ['proxy', 'backgroundY', '垂直位置'], ['b', 'baseScale', '縮放']] },
            { title: '漂移', rows: [['b', 'driftAmount', '幅度'], ['b', 'driftSpeed', '速度']] },
            { title: '低頻反應', rows: [['b', 'bassScaleAmount', '縮放幅度'], ['b', 'bassAttack', '放大時間（毫秒）'], ['b', 'bassRelease', '回復時間（毫秒）']] },
            { title: '疊加圖片', rows: [['p', 'backgroundimagef', '圖片'], ['p', 'imageoptions1', '縮放方式'], ['p', 'horizontal', '水平位置'], ['p', 'vertical', '垂直位置']] }
        ] },
        { id: 'spectrum', name: '頻譜', icon: icon('<path d="M3 13V8M6.500 13V3M10 13V6M13.500 13V10"/>'), sections: [
            { title: '排列', rows: [['g', 'layout', '形狀'], ['g', 'squareSpectrumLayout', '頻率分布'], ['g', 'orientation', '方向'], ['g', 'direction', '延伸方向'], ['g', 'amplitudeDirection', '振幅方向'],
                ['g', 'anchor', '對齊基準'], ['g', 'mirror', '鏡射'], ['g', 'reverse', '反轉頻率順序'], ['p', 'reverseright', '後半圈同向'],
                ['p', 'audiocount', '數量'], ['g', 'barCount', '數量'], ['p', 'barwidth', '寬度'], ['g', 'barWidth', '寬度'], ['g', 'gap', '間距'],
                ['p', 'barheight', '高度'], ['g', 'height', '高度'], ['g', 'width', '長度'], ['g', 'squareSize', '方形大小'],
                ['p', 'barsarc', '排列弧度'], ['p', 'barcircledistance', '與中心的距離'], ['p', 'userspectrumrotation', '取樣偏移']] },
            { title: '外觀', rows: [['p', 'barcolortype', '色彩模式'], ['p', 'barcolor', '顏色'], ['p', 'baropacity', '不透明度'], ['p', 'userrainbowrotate', '彩虹偏移'], ['p', 'beattolerance', '節拍門檻']] },
            { title: '位置', rows: [['proxy', 'spectrumX', '水平位置'], ['proxy', 'spectrumY', '垂直位置'], ['g', 'positionX', '水平位置'], ['g', 'positionY', '垂直位置'], ['g', 'rotation', '旋轉角度'], ['p', 'barsrotate', '起始角度']] },
            { title: '自動旋轉', rows: [['p', 'autobarsrotate', '自動旋轉'], ['p', 'autobarsrotatespeed', '速度']] },
            { title: '低頻反應', rows: [['p', 'bbassmultiplier', '位移']] }
        ] },
        { id: 'center', name: '中心圖片', icon: icon('<circle cx="8" cy="8" r="5.500"/><circle cx="8" cy="8" r="1.500"/>'), sections: [
            { title: '來源', media: ['cover'] },
            { title: '外觀', rows: [['g', 'coverShape', '形狀'], ['g', 'coverSize', '大小'], ['p', 'circleradius', '大小'], ['p', 'circlecolor', '底色'], ['p', 'circleopacity', '不透明度'], ['p', 'circlearc', '裁切弧度'], ['p', 'circlerotate', '裁切角度']] },
            { title: '第二層', rows: [['p', 'secondcircle', '顯示第二層'], ['p', 'secondcirclecolor', '顏色'], ['p', 'secondcircleopacity', '不透明度'], ['p', 'secondcircleradius', '外擴距離']] },
            { title: '位置', rows: [['g', 'coverX', '水平位置'], ['g', 'coverY', '垂直位置']] },
            { title: '自動旋轉', rows: [['p', 'autologorotate', '自動旋轉'], ['p', 'autologorotatespeed', '速度'], ['g', 'coverRotationSpeed', '旋轉速度（RPM）']] },
            { title: '低頻反應', rows: [['p', 'cbassmultiplier', '縮放'], ['p', 'c1bassmultiplier', '第二層縮放']] }
        ] },
        { id: 'particles', name: '粒子', icon: icon('<circle cx="4" cy="5" r="1"/><circle cx="11" cy="3.500" r=".7"/><circle cx="8" cy="9" r="1.300"/><circle cx="3.500" cy="12" r=".7"/><circle cx="12.500" cy="11.500" r="1"/>'), sections: [
            { title: '外觀', rows: [['p', 'particlestyle', '樣式'], ['p', 'particlecolor', '顏色'], ['p', 'particleopacity', '不透明度'], ['p', 'particleradius', '大小'], ['p', 'particlerainbow', '彩虹色'], ['p', 'twinkling', '閃爍']] },
            { title: '數量', rows: [['p', 'particlenum', '數量'], ['p', 'particlestyle2num', '數量'], ['p', 'particlenumaudio', '無音訊時的數量']] }
        ] },
        { id: 'lyrics', name: '歌詞', separated: true, icon: icon('<path d="M2.500 4h11M2.500 8h11M2.500 12h7"/>'), sections: [
            { title: '來源', media: ['primary', 'secondary'], rows: [['l', 'enabled', '顯示歌詞']] },
            { title: '文字', rows: [['l', 'fontFamily', '字型'], ['l', 'fontSize', '大小'], ['l', 'fontWeight', '字重'], ['l', 'currentColor', '顏色'], ['l', 'lineSpacing', '行距']] },
            { title: '位置', rows: [['l', 'positionX', '水平位置'], ['l', 'positionY', '垂直位置'], ['l', 'textAlign', '對齊'], ['l', 'maxWidth', '最大寬度']] },
            { title: '上下句', rows: [['l', 'showPrevious', '顯示上一句'], ['l', 'showNext', '顯示下一句'], ['l', 'inactiveColor', '顏色'], ['l', 'inactiveOpacity', '不透明度'], ['l', 'inactiveBlur', '模糊']] },
            { title: '切換動畫', rows: [['l', 'transitionDuration', '時間（毫秒）'], ['l', 'transitionOvershoot', '越界幅度']] },
            { title: '時間', rows: [['l', 'globalOffsetMs', '偏移（毫秒）'], ['end', '', '']] },
            { title: '低頻反應', rows: [['l', 'glowEnabled', '背光'], ['l', 'glowColorMode', '顏色模式'], ['l', 'glowColor', '顏色'], ['l', 'glowBaseOpacity', '基本強度'], ['l', 'glowMaxOpacity', '最大強度'], ['l', 'glowBlur', '模糊'], ['l', 'glowSpread', '擴散'], ['l', 'glowBassSensitivity', '靈敏度'], ['l', 'glowAttack', '上升時間（毫秒）'], ['l', 'glowRelease', '衰減時間（毫秒）']] },
            { title: '次要歌詞', rows: [['l', 'secondaryEnabled', '顯示次要歌詞'], ['l', 'secondaryFontFamily', '字型'], ['l', 'secondaryFontSizeRatio', '大小比例'], ['l', 'secondaryFontWeight', '字重'], ['l', 'secondaryColor', '顏色'], ['l', 'secondaryOpacity', '不透明度'], ['l', 'secondaryGap', '與主要歌詞間距'], ['l', 'secondaryPosition', '位置'], ['l', 'secondaryOffsetMs', '時間校準（毫秒）'], ['l', 'mergeToleranceMs', '配對容差（毫秒）']] }
        ] },
        { id: 'song', name: '歌曲資訊', icon: icon('<path d="M3 3.500h10M8 3.500V13M5.500 13h5"/>'), sections: [
            { title: '內容', rows: [['t', 'enabled', '顯示歌曲資訊'], ['t', 'title', '曲名'], ['t', 'artist', '作者']] },
            { title: '文字', rows: [['t', 'fontFamily', '字型'], ['t', 'scale', '大小'], ['t', 'color', '顏色'], ['t', 'titleSizeRatio', '曲名比例'], ['t', 'artistSizeRatio', '作者比例'], ['t', 'lineGap', '行距']] },
            { title: '位置', rows: [['t', 'positionX', '水平位置'], ['t', 'positionY', '垂直位置'], ['t', 'alignment', '對齊']] },
            { title: '外框', rows: [['t', 'borderEnabled', '顯示外框'], ['t', 'borderColor', '顏色'], ['t', 'borderWidth', '粗細'], ['t', 'borderBlur', '模糊']] },
            { title: '低頻反應', rows: [['t', 'bassReaction', '跟著低頻跳動'], ['t', 'bassStrength', '強度']] }
        ] }
    ];
    // 像素位移在介面上換算成與其他圖層相同的百分比，底層儲存的值不變。
    const proxies = {
        backgroundX: { scope: 'background', key: 'offsetX', canvas: 1920 },
        backgroundY: { scope: 'background', key: 'offsetY', canvas: 1080 },
        spectrumX: { scope: 'properties', key: 'eqpositionx', canvas: 1920 },
        spectrumY: { scope: 'properties', key: 'eqpositiony', canvas: 1080 }
    };
    function selector(kind, key) {
        if (kind === 'input') return '#setting-inputGain';
        if (kind === 'end') return '[data-lyrics-end]';
        return '[data-' + attributes[kind] + '="' + key + '"]';
    }
    window.WaveCanvasLayerStructure = Object.freeze({ layers, proxies, selector });
}());
