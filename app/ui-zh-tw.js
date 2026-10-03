(function () {
    'use strict';
    // Display text only: schema keys, values, ranges and preset data remain unchanged.
    const properties = {
        audiocount: '頻譜柱數量', audiocount1: '若要使用完整音訊陣列，請選擇：128、256、384、512、640、768、896。',
        autobarsrotate: '自動旋轉頻譜柱', autobarsrotatespeed: '旋轉速度', autologorotate: '自動旋轉中心圖片', autologorotatespeed: '旋轉速度',
        background: '背景', backgroundcolor: '背景顏色', backgroundimage: '背景圖片', backgroundimagef: '疊加圖片', backgroundsource: '背景類型', 
        barandcircledistance: '圓形與頻譜柱間距', barcircledistance: '圓形與頻譜柱間距', barcolor: '顏色', barcolortype: '頻譜柱色彩模式', barheight: '最大高度', baropacity: '不透明度（%）',
        bars: '頻譜柱', barsarc: '頻譜柱弧度', barsheight: '最大高度會乘上所有頻譜柱的基本高度。', barsrotate: '頻譜柱繞圓旋轉角度', barwidth: '寬度',
        bassmultiplier: '低頻效果倍率', bassshakemultiplier: '低頻震動強度', bassshaketolerance: '低頻震動門檻', bbassmultiplier: '頻譜柱低頻反應', beattolerance: '節拍門檻（%）',
        
        c1bassmultiplier: '第二圓形低頻反應', cbassmultiplier: '圓形低頻反應', center: '位置', circle: '第二圓形', circle1: '圓形', circlearc: '圓形弧度', circlecolor: '顏色', circleopacity: '不透明度（%）', circleradius: '半徑', circlerotate: '圓形旋轉角度',
        
        eqpositionx: '水平位置', eqpositiony: '垂直位置', frameratepersecond: '顯示低幀率警告（低於 35）', horizontal: '水平位置', imageoptions1: '疊加圖片縮放方式', logoimage: '中心圖片（建議方形）',
        noise: '雜訊補償', normalize: '音訊平滑', overlay: '疊加圖層', particlecolor: '顏色', particlenum: '粒子數量', particlenumaudio: '無音訊時的粒子數量', particleopacity: '不透明度（%）', particleradius: '大小倍率', particlerainbow: '彩虹色彩', particles: '粒子', particlestyle: '粒子模式', particlestyle2num: '粒子數量',
        resposive: '反應速度', reverseright: '反轉右側頻譜柱', secondcircle: '啟用第二圓形', secondcirclecolor: '顏色', secondcircleopacity: '不透明度（%）', secondcircleradius: '半徑', 
        twinkling: '粒子閃爍', 
        userrainbowrotate: '彩虹色彩偏移', userspectrumrotation: '頻譜取樣偏移', vertical: '垂直位置'
    };
    const text = {
        Audio: '音訊', Background: '背景', Circle: '圓形', 'Center / Position': '中心／位置', Bars: '頻譜柱', Particles: '粒子', Overlay: '疊加圖層', Bass: '低頻', Other: '其他',
        Color: '純色', Image: '圖片', Normal: '一般', Rainbow: '彩虹', Style1: '樣式一', Style2: '樣式二',
        Initial: '原始尺寸', Cover: '填滿並裁切', Contain: '完整顯示', seconds: '秒', minutes: '分鐘', hour: '小時', 'Short Hand': '縮寫', UserDefined: '自訂',
        Layout: '排列模式', 'Radial Circle': '放射圓形', 'Radial Square': '方形頻譜', Linear: '直線', Orientation: '排列方向', Horizontal: '水平', Vertical: '垂直',
        'Square Spectrum Layout': '方形頻譜排列', Symmetric: '對稱', 'Top Bass Mirror': '頂邊低頻鏡像', 'Folded Diagonal': '對角折疊',
        'Position X (%)': '水平位置（%）', 'Position Y (%)': '垂直位置（%）', 'Width (stage px)': '寬度（畫布像素）', 'Height (stage px)': '高度（畫布像素）', 'Rotation (°)': '旋轉角度（°）',
        'Bar count': '頻譜柱數量', 'Bar width': '頻譜柱寬度', 'Gap weight': '間距權重', Mirror: '鏡射模式', None: '不鏡射', 'Mirror Around Center': '中心鏡射', 'Dual Opposite': '雙側反向',
        'Reverse frequency direction': '反轉頻率順序', 'Square direction': '方形延伸方向', Outward: '向外', Inward: '向內', 'Amplitude direction': '振幅方向', 'Up / Right': '向上／向右', 'Down / Left': '向下／向左', 'Both sides': '雙側',
        'Position anchor': '位置錨點', Start: '起點', Center: '中央', End: '終點', 'Square size (stage px)': '方形邊長（畫布像素）',
        'Linear Cover Shape':'封面形狀', Square:'方形／矩形', 'Linear Cover X (%)':'封面水平位置（%）',
        'Linear Cover Y (%)':'封面垂直位置（%）', 'Linear Cover Size (% stage height)':'封面尺寸（% 畫布高度）',
        'Linear Cover Rotation Speed (RPM)':'封面旋轉速度（RPM）'
    };
    window.VisualizerLocale = Object.freeze({ properties, property: key => properties[key], text: value => text[value] || value });
}());
