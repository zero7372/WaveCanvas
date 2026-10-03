'use strict';
const test = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), vm = require('node:vm'), path = require('node:path');
function fonts(query) {
    const window = {}; if (query) window.queryLocalFonts = query;
    const sandbox = { window, document:{ createElement:() => ({ style:{} }) }, Intl };
    for (const file of ['system-fonts.js','lyrics-schema.js','song-info-schema.js']) vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../../app',file),'utf8'),sandbox);
    return window;
}
test('One metadata-only query trims, deduplicates case-insensitively, locale sorts and keeps generics', async () => {
    let calls=0; const api=fonts(async()=>{calls++;return ['  Calibri  ','calibri','思源黑體 TC','Cambria','Arial','', '  ','SYSTEM-UI'].map(family=>({family,blob(){throw Error('Do not read bytes');}}));}).VisualizerSystemFonts;
    await Promise.all([api.load(),api.load(),api.load()]);await api.load();assert.equal(calls,1);
    assert.deepEqual(Array.from(api.families).slice(0,4),['system-ui','sans-serif','serif','monospace']);
    assert.deepEqual(Array.from(api.families).slice(4),['Calibri','思源黑體 TC','Cambria','Arial'].sort(new Intl.Collator(undefined,{sensitivity:'base',numeric:true}).compare));
    assert.equal(api.getState().installedFamilyCount,4);
});
for (const mode of ['missing','denied','security','failure','empty']) test('Safe fallback without retry after '+mode,async()=>{
    let calls=0;const api=fonts(mode==='missing'?undefined:async()=>{calls++;if(mode==='empty')return [];throw Object.assign(Error(mode),{name:mode==='security'?'SecurityError':mode==='denied'?'NotAllowedError':'Error'});}).VisualizerSystemFonts;
    await api.load();await api.load();assert.equal(api.families.length,11);assert.ok(api.families.includes('Arial'));assert.equal(calls,mode==='missing'?0:1);
    assert.equal(api.normalize('Some Weird Font'),'Some Weird Font');
});
test('Installed list never validates project font strings and CSS quoting preserves safe names', async()=>{
    const api=fonts(async()=>[{family:'Arial'}]);await api.VisualizerSystemFonts.load();
    const names=['Arial','Bahnschrift','Calibri','Cambria','Consolas','Microsoft JhengHei UI','Yu Gothic UI','思源黑體 TC','family with spaces','字體 😀','A "quoted" \\ family','punctuation, ; } family'];
    for(const name of names){assert.equal(api.VisualizerLyricsSettings.normalize({fontFamily:name,secondaryFontFamily:name}).fontFamily,name);assert.equal(api.VisualizerLyricsSettings.normalize({secondaryFontFamily:name}).secondaryFontFamily,name);assert.equal(api.VisualizerSongInfoSettings.normalize({fontFamily:name}).fontFamily,name);const stack=api.VisualizerSystemFonts.fontStack(name);assert.ok(stack.startsWith('"'));assert.ok(stack.includes('"Microsoft JhengHei"'));}
    assert.ok(api.VisualizerSystemFonts.fontStack('A "quoted" \\ family').startsWith('"A \\22 quoted\\22  \\5c  family",'));
    assert.equal(api.VisualizerSystemFonts.normalize('  Calibri  '),'Calibri');assert.equal(api.VisualizerSystemFonts.normalize('calibri'),'calibri');assert.equal(api.VisualizerSongInfoSettings.defaults().fontFamily,'system-ui');
});
test('Missing current font is injected without changing its project identity on enumeration',async()=>{
    const api=fonts(async()=>[{family:'Calibri'}]).VisualizerSystemFonts;const input={listeners:{},addEventListener(name,fn){this.listeners[name]=fn;},replaceChildren(...nodes){this.nodes=nodes;},style:{}};let saved='Some Weird Font';const sync=api.bindSelect(input,()=>saved);
    assert.equal(input.value,saved);await api.load();assert.equal(input.value,saved);assert.ok(input.nodes.some(node=>node.value===saved));saved='Calibri';sync();assert.equal(input.value,'Calibri');assert.equal(input.nodes.filter(node=>node.value==='Some Weird Font').length,0);
});
