// js/index.js

// A tiny loader—switch between old and new via ?useNew=1
(function () {
    const useNew = location.search.includes("useNew=1");
    const version = "2506.20.1";        // keep your cache-bust tag here
    const file = useNew
        ? `js/index.new.js?v=${version}`
        : `js/index.old.js?v=${version}`;

    const s = document.createElement("script");
    s.src = file;
    document.head.appendChild(s);
    console.log(`🧩 bootstrapping ${useNew ? "INDEX.NEW" : "INDEX.OLD"}`);
})();
