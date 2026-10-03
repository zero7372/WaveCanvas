(function () {
    'use strict';
    const runtime = window.VisualizerRuntime;
    if (runtime.mode !== 'standalone') return;
    const policy = window.VisualizerInspectorPolicy;
    const pane = document.querySelector('#inspector-visualizer');
    const sections = new Map();
    const legacyGroups = Array.from(pane.children);
    function section(key, label, open = false) {
        const details = document.createElement('details'); details.className = 'settings-group'; details.dataset.inspectorSection = key; details.open = open;
        const summary = document.createElement('summary'); summary.textContent = label;
        const content = document.createElement('div'); content.className = 'group-content';
        details.append(summary, content); pane.append(details); sections.set(key, { details, content });
    }
    section('layout','排列',true); section('spectrum','頻譜外觀');
    section('circle','圓形專用',true); section('square','方形專用',true); section('linear','直線專用',true);
    section('position','位置與變換'); section('bass','低頻反應'); section('particles','粒子'); section('other','其他');
    const cover = document.createElement('fieldset'); cover.dataset.linearCover = 'true';
    const coverLegend = document.createElement('legend'); coverLegend.textContent = '封面';
    const coverContent = document.createElement('div'); coverContent.className = 'group-content';
    cover.append(coverLegend,coverContent); sections.get('linear').content.append(cover);
    sections.set('cover',{details:cover,content:coverContent});
    const rows = [];
    for (const row of pane.querySelectorAll('[data-property], [data-layout-property]')) {
        const geometry = Boolean(row.dataset.layoutProperty);
        const key = geometry ? row.dataset.layoutProperty : row.dataset.property;
        const sectionKey = (geometry ? policy.geometrySections : policy.propertySections)[key];
        if (!sectionKey) continue;
        row.removeAttribute('title');
        rows.push({row,key,geometry,sectionKey});
        if (sectionKey !== 'specific') sections.get(sectionKey).content.append(row);
        else {
            const applies = geometry ? policy.geometryApplies : policy.propertyApplies;
            const layouts = ['circle','square','linear'].filter(layout=>applies(key,layout));
            const current = runtime.getStandalone().visualizer.layout;
            sections.get(layouts.includes(current)?current:layouts[0]).content.append(row);
        }
    }
    // Keep metadata wrappers as non-visible integration hooks, without legacy UI.
    for (const group of legacyGroups) group.hidden = true;
    const note = document.createElement('p'); note.className = 'schema-note';
    sections.get('layout').content.append(note);
    const squareNote = document.createElement('p'); squareNote.className = 'schema-note';
    sections.get('square').content.append(squareNote);
    let previousLayout;
    function sync(_, standalone) {
        const layout = standalone.visualizer.layout;
        for (const key of ['circle','square','linear']) sections.get(key).details.hidden = key !== layout;
        for (const field of rows) {
            const applies = field.geometry ? policy.geometryApplies : policy.propertyApplies;
            if (field.sectionKey === 'specific' && previousLayout !== layout && applies(field.key,layout)) {
                const target = layout === 'linear' && ['circleopacity','cbassmultiplier'].includes(field.key) ? 'cover' : layout;
                sections.get(target).content.append(field.row);
            }
            if (field.geometry) {
                const active = policy.geometryApplies(field.key,layout) && (field.key !== 'coverRotationSpeed' || standalone.visualizer.coverShape === 'circle');
                field.row.hidden = !active; field.row.dataset.active = String(active);
            }
        }
        // The native property UI owns condition visibility and value synchronization.
        for (const [key,{details,content}] of sections) {
            if (['circle','square','linear'].includes(key)) continue;
            details.hidden = !Array.from(content.querySelectorAll('.setting-row')).some(row=>!row.hidden);
        }
        const label = (selector,text) => {
            const node=pane.querySelector(selector+' label');if(node&&node.textContent!==text)node.textContent=text;
            const number=pane.querySelector(selector+' input[type=number]');if(number)number.setAttribute('aria-label',text+'數值');
        };
        label('[data-layout-property=rotation]','整體幾何旋轉（°）');
        label('[data-layout-property=height]',layout==='linear'?'排列高度／垂直長度（畫布像素）':'方形頻譜振幅高度（畫布像素）');
        label('[data-layout-property=width]','排列寬度／水平長度（畫布像素）');
        label('[data-property=barsrotate]',layout==='square'?'方形頻譜附加角度（°）':'圓形頻譜起始角度（°）');
        label('[data-property=circleopacity]',layout==='linear'?'封面不透明度（%）':'中心形狀不透明度（%）');
        label('[data-property=cbassmultiplier]',layout==='linear'?'封面低頻放大':'中心形狀低頻縮放');
        // Keep the artwork group below spectrum controls when switching into Linear.
        if (previousLayout !== layout && layout === 'linear') sections.get('linear').content.append(cover);
        note.textContent = layout === 'circle' ? '頻譜起始角度、中心裁切角度與頻帶取樣偏移各自獨立。'
            : layout === 'square' ? '整體旋轉與頻譜附加角度相加；自動旋轉持續累加。'
            : '水平：寬度＝長度，高度＝振幅；垂直時相反。切換排列不會重設設定。';
        squareNote.textContent = ({symmetric:'四邊共用頻譜，每邊中心鏡像。',topBassMirror:'頂邊中央低頻，左右路徑延續至下邊中央。',foldedDiagonal:'右上／左下低頻折點，兩組相鄰邊呈對角對稱。'})[standalone.visualizer.squareSpectrumLayout]
            + '64 柱＝每邊 16 條；角落留白。反轉會交換低／高頻位置。';
        previousLayout = layout;
    }
    runtime.subscribe(sync);
    window.addEventListener('visualizer-settings-ui-sync',()=>sync(runtime.getSettings(),runtime.getStandalone()));
}());
