// js/index.new.js
import Banner from './banner.js';

// Core singletons
const TB = new TaskBrowser();
const igcUpload = new IGCUpload(TB);

Banner.init();                 // pull in your banner.json marquee

if (typeof TB.resizeMap === 'function') TB.resizeMap();

