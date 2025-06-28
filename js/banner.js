// js/banner.js

export default {
    init() {
        const jsonUrl = 'otherdata/banner.json';

        fetch(jsonUrl)
            .then(res => {
                if (!res.ok) throw new Error('banner.json not found');
                return res.json();
            })
            .then(cfg => {
                // nothing to show?
                if (!cfg.text || !cfg.text.trim()) return;

                // find the tab‐bar and insert our banner right below it
                const tabs = document.getElementById('tabButtons');
                const banner = document.createElement('div');
                banner.id = 'scrollingBanner';
                banner.style.backgroundColor = cfg.backgroundColor || '#222';
                banner.style.color = cfg.textColor || '#ddd';

                // the actual text
                const content = document.createElement('div');
                content.className = 'banner-content';
                content.textContent = cfg.text;

                // close “×” button
                const closeBtn = document.createElement('span');
                closeBtn.className = 'close-banner';
                closeBtn.innerHTML = '&times;';
                closeBtn.title = 'Dismiss';
                closeBtn.addEventListener('click', () => banner.remove());

                banner.appendChild(content);
                banner.appendChild(closeBtn);
                tabs.parentNode.insertBefore(banner, tabs.nextSibling);

                // once painted, decide whether to center or scroll
                setTimeout(() => {
                    const fits = content.scrollWidth <= banner.clientWidth;
                    if (fits) {
                        content.classList.add('centered');
                    } else {
                        // overflow → animate
                        const dur = cfg.animationDuration
                            || (cfg.duration ? `${cfg.duration}s` : null);
                        if (dur) content.style.animationDuration = dur;
                        content.classList.add('scrolling');
                    }
                }, 0);
            })
            .catch(err => {
                console.debug('Banner not loaded:', err);
            });
    }
};
