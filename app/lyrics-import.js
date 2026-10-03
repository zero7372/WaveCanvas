(function () {
    'use strict';
    function format(name = '') {
        if (!name || !/\.[^./\\]+$/.test(name)) return 'lrc'; // Existing programmatic labels retain their LRC contract.
        const extension = /\.(lrc|srt)$/i.exec(name);
        if (!extension) throw new Error('請選擇 .lrc 或 .srt 歌詞檔案。');
        return extension[1].toLowerCase();
    }
    function parse(text, name = '') {
        const sourceFormat = format(name);
        if (sourceFormat === 'lrc') return { ...window.VisualizerLRC.parse(text), sourceFormat };
        const result = window.VisualizerSRT.parse(text);
        if (!result.cues.length) throw new Error('SRT 沒有有效的字幕 cue；請檢查時間與字幕文字。');
        return result;
    }
    function validateFile(file) {
        if (!/\.(lrc|srt)$/i.test(file.name)) throw new Error('請選擇 .lrc 或 .srt 歌詞檔案。');
        if (file.size > 1024 * 1024) throw new Error('歌詞檔案必須小於 1 MB。');
    }
    window.VisualizerLyricsImport = Object.freeze({ format, parse, validateFile, accept: '.lrc,.srt,text/plain,application/x-subrip' });
}());
