// js/index.new.js
import Banner from './banner.js';

// Core singletons
const TB = new TaskBrowser();
const igcUpload = new IGCUpload(TB);

window.TB = TB;

TB.init(igcUpload);
if (!TB.isDownloadPage) {
    igcUpload.init();
}

// Add event listeners for resizing
window.addEventListener('resize', TB.resizeMap);

Banner.init();                 // pull in your banner.json marquee

if (typeof TB.resizeMap === 'function') TB.resizeMap();

