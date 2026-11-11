(function () {
    'use strict';
    // Beta：Desktop App 在 Windows 上使用 Mica 背景時，介面改用半透明的層次，讓背景材質透出來。
    const material = window.waveCanvas?.shell?.material;
    if (material) document.documentElement.dataset.material = material;
}());
