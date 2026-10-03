(function () {
    'use strict';
    // UI applicability only; keys, schema/defaults and renderer semantics stay intact.
    const propertySections = {
        barcolortype: 'spectrum', barcolor: 'spectrum', baropacity: 'spectrum', userrainbowrotate: 'spectrum', beattolerance: 'spectrum',
        circleradius: 'specific', circlearc: 'specific', circlerotate: 'specific', barwidth: 'specific', barheight: 'specific', barsarc: 'specific', audiocount: 'specific', userspectrumrotation: 'specific',
        circlecolor: 'specific', circleopacity: 'specific', secondcircle: 'specific', secondcirclecolor: 'specific', secondcircleopacity: 'specific', secondcircleradius: 'specific',
        autologorotate: 'specific', autologorotatespeed: 'specific', autobarsrotate: 'specific', autobarsrotatespeed: 'specific', barsrotate: 'specific', barcircledistance: 'specific',
        cbassmultiplier: 'specific', bbassmultiplier: 'specific', c1bassmultiplier: 'specific', reverseright: 'specific',
        eqpositionx: 'position', eqpositiony: 'position', bassshakemultiplier: 'bass', bassshaketolerance: 'bass',
        particlestyle: 'particles', particlerainbow: 'particles', twinkling: 'particles', particlecolor: 'particles', particleopacity: 'particles', particleradius: 'particles', particlenum: 'particles', particlestyle2num: 'particles', particlenumaudio: 'particles',
        frameratepersecond: 'other'
    };
    const circleOnly = new Set(['circleradius','circlearc','circlerotate','barwidth','barheight','barsarc','audiocount','userspectrumrotation','reverseright','eqpositionx','eqpositiony']);
    const centerShapes = new Set(['circlecolor','circleopacity','secondcircle','secondcirclecolor','secondcircleopacity','secondcircleradius','autologorotate','autologorotatespeed','autobarsrotate','autobarsrotatespeed','barsrotate','barcircledistance','cbassmultiplier','bbassmultiplier','c1bassmultiplier']);
    const geometrySections = {
        layout:'layout', squareSpectrumLayout:'specific', squareSize:'specific', direction:'specific',
        orientation:'specific', width:'specific', height:'specific', anchor:'specific', mirror:'specific', reverse:'specific', amplitudeDirection:'specific',
        barCount:'specific', barWidth:'specific', gap:'specific', positionX:'position', positionY:'position', rotation:'position',
        coverShape:'cover', coverX:'cover', coverY:'cover', coverSize:'cover', coverRotationSpeed:'cover'
    };
    const squareOnly = new Set(['squareSpectrumLayout','squareSize','direction']);
    const linearOnly = new Set(['orientation','width','anchor','mirror','amplitudeDirection']);
    function propertyApplies(key, layout) {
        if (key === 'cbassmultiplier' || key === 'circleopacity') return true;
        if (circleOnly.has(key)) return layout === 'circle';
        if (centerShapes.has(key)) return layout === 'circle' || layout === 'square';
        return true;
    }
    function geometryApplies(key, layout) {
        if (key.startsWith('cover')) return layout === 'linear';
        if (key === 'layout') return true;
        if (squareOnly.has(key)) return layout === 'square';
        if (linearOnly.has(key)) return layout === 'linear';
        return layout === 'square' || layout === 'linear';
    }
    function condition(key, original, layout) {
        if (layout === 'linear' && (key === 'cbassmultiplier' || key === 'circleopacity')) return 'logoimage.value';
        if (key === 'autologorotatespeed') return 'logoimage.value && autologorotate.value';
        // Style 2 reads customParColor directly; latent Style 1 rainbow must not hide it.
        if (key === 'particlecolor') return 'particlestyle.value == 2 || particlerainbow.value == false';
        return original;
    }
    const labels = {
        barcolortype:'頻譜色彩模式', barcolor:'頻譜顏色', baropacity:'頻譜不透明度（%）', beattolerance:'隨機色節拍門檻（%）',
        circleradius:'中心圓形半徑', audiocount:'圓形頻譜柱數量',
        barheight:'頻譜振幅高度', barwidth:'圓形頻譜柱寬度', barsrotate:'頻譜起始角度（°）',
        circlerotate:'中心圓形裁切角度（°）', circlearc:'中心圓形裁切弧度', barsarc:'頻譜排列弧度',
        circlecolor:'中心形狀底色', circleopacity:'中心形狀不透明度（%）',
        secondcircle:'啟用第二層形狀', secondcirclecolor:'第二層形狀顏色', secondcircleopacity:'第二層形狀不透明度（%）', secondcircleradius:'第二層形狀外擴距離',
        barcircledistance:'中心與頻譜的間距', cbassmultiplier:'中心形狀低頻縮放', bbassmultiplier:'頻譜離中心的低頻位移', c1bassmultiplier:'第二層形狀低頻縮放',
        bassshakemultiplier:'畫布低頻震動／模糊強度', bassshaketolerance:'畫布低頻震動門檻',
        eqpositionx:'水平位置（畫布像素偏移）', eqpositiony:'垂直位置（畫布像素偏移）',
        reverseright:'圓形後半圈使用同向頻譜', userspectrumrotation:'圓形頻帶取樣偏移',
        particlestyle:'粒子樣式', particlecolor:'粒子顏色', particleopacity:'粒子不透明度（%）', particleradius:'粒子大小倍率', particlenum:'樣式一粒子數量', particlestyle2num:'樣式二粒子數量',
        autologorotate:'中心圖片自動旋轉', autologorotatespeed:'中心圖片旋轉速度', autobarsrotate:'頻譜自動旋轉', autobarsrotatespeed:'頻譜自動旋轉速度'
    };
    window.VisualizerInspectorPolicy = Object.freeze({ propertySections, geometrySections, propertyApplies, geometryApplies, condition, labels });
}());
