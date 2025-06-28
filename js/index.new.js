// js/index.new.js
import Banner from './banner.js';
//import Splitter from './splitter.js';
//import TabManager from './tabs/manager.js';

// Core singletons
const TB = new TaskBrowser();
const igcUpload = new IGCUpload(TB);

document.addEventListener('DOMContentLoaded', () => {
    // 1) Initialize your little cross-cutting bits
    Banner.init();                 // pull in your banner.json marquee
    //Splitter.init({ TB });         // wire up the resizer drag logic

    // 2) Bootstrap the tab-based UI
    //TabManager.init({ TB, igcUpload });

    // 3) Map needs an initial resize
    if (typeof TB.resizeMap === 'function') TB.resizeMap();
});
