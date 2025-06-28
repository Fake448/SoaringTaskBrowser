// js/index.new.js
import Banner from './banner.js';
import Splitter from './splitter.js';
//import TabManager from './tabs/manager.js';

// Core singletons
const TB = new TaskBrowser();
const igcUpload = new IGCUpload(TB);

Banner.init();                 // pull in your banner.json marquee
Splitter.init({ TB });         // wire up the resizer drag logic
//TabManager.init({ TB, igcUpload });

if (typeof TB.resizeMap === 'function') TB.resizeMap();

