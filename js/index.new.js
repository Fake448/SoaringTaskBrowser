// js/index.new.js
import Banner from './banner.js';

// Core singletons
const TB = new TaskBrowser();
const igcUpload = new IGCUpload(TB);

// Expose the TaskBrowser instance globally because it is needed in the HTML
window.TB = TB;

TB.init(igcUpload);
if (!TB.isDownloadPage) {
    igcUpload.init();
}

// Initialize the banner marquee
Banner.init();

// Add event listeners for resizing
window.addEventListener('resize', TB.resizeMap);
if (typeof TB.resizeMap === 'function') TB.resizeMap();

