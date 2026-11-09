(function () {
    'use strict';
    const runtime = window.VisualizerRuntime;
    if (runtime.mode !== 'standalone') return;
    // 列的位置由 Shell 依 layer-structure 決定；這裡只處理隨排列改變的可見性與名稱。
    const policy = window.VisualizerInspectorPolicy;
    const propertyRows = Array.from(document.querySelectorAll('#settings-groups .inspector-tab [data-property]')).map(row => ({ row, key: row.dataset.property }));
    const layoutRows = Array.from(document.querySelectorAll('#settings-groups .inspector-tab [data-layout-property]')).map(row => ({ row, key: row.dataset.layoutProperty }));
    const sections = Array.from(document.querySelectorAll('#settings-groups .inspector-tab > .settings-group'));
    const squareNote = document.createElement('p'); squareNote.className = 'schema-note'; squareNote.id = 'square-layout-note';
    document.querySelector('[data-layout-property="squareSpectrumLayout"]').after(squareNote);
    const proxyVisible = { spectrumX: layout => layout === 'circle', spectrumY: layout => layout === 'circle' };
    function setLabel(selector, text) {
        const row = document.querySelector(selector), node = row?.querySelector('label');
        if (node && node.textContent !== text) node.textContent = text;
        const number = row?.querySelector('input[type=number]'); if (number) window.WaveCanvasI18nDom.attr(number, 'aria-label', '{field}數值', { field: window.WaveCanvasI18n.msg(text) });
    }
    function sync(_, standalone) {
        const layout = standalone.visualizer.layout;
        for (const { row, key } of propertyRows) row.dataset.layoutHidden = String(!policy.propertyApplies(key, layout));
        for (const { row, key } of layoutRows) {
            const active = policy.geometryApplies(key, layout) && (key !== 'coverRotationSpeed' || standalone.visualizer.coverShape === 'circle');
            row.hidden = !active; row.dataset.active = String(active);
        }
        for (const [name, applies] of Object.entries(proxyVisible)) document.querySelector('[data-position-proxy="' + name + '"]').dataset.layoutHidden = String(!applies(layout));
        setLabel('[data-property=barsrotate]', layout === 'square' ? '附加角度' : '起始角度');
        setLabel('[data-layout-property=height]', layout === 'linear' ? '高度' : '振幅高度');
        squareNote.hidden = layout !== 'square';
        squareNote.textContent = ({ symmetric: '四邊共用頻譜，每邊中心鏡像。', topBassMirror: '低頻在頂邊中央，沿兩側延伸到下邊中央。', foldedDiagonal: '低頻在右上與左下，兩組相鄰邊對角對稱。' })[standalone.visualizer.squareSpectrumLayout] || '';
        document.querySelector('#layer-center .layer-name').textContent = layout === 'linear' ? '封面' : '中心圖片';
        // 沒有任何可見列的區段整段隱藏，避免出現空標題。
        for (const section of sections) {
            const rows = Array.from(section.querySelectorAll('.setting-row:not([data-proxied]), .media-item'));
            section.hidden = !rows.some(row => !row.hidden && row.dataset.layoutHidden !== 'true');
        }
    }
    runtime.subscribe(sync);
    window.addEventListener('visualizer-settings-ui-sync', () => sync(runtime.getSettings(), runtime.getStandalone()));
}());
