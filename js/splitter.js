// js/splitter.js

export default {
    init({ TB }) {
        this.TB = TB;
        this.isResizing = false;
        this.resizer = document.getElementById('resizer');
        this.mapContainer = document.getElementById('map');
        this.taskDetailContainer = document.getElementById('taskDetailContainer');

        // bind handlers once
        this._onMouseMove = this.onMouseMove.bind(this);
        this._onMouseUp = this.onMouseUp.bind(this);

        // when the window itself resizes, re-render the map
        window.addEventListener('resize', () => {
            if (typeof this.TB.resizeMap === 'function') {
                this.TB.resizeMap();
            }
        });

        // only enable drag‐to‐resize if we’re not on the download page
        if (!this.TB.isDownloadPage && this.resizer) {
            this.resizer.addEventListener('mousedown', () => {
                this.isResizing = true;
                document.addEventListener('mousemove', this._onMouseMove);
                document.addEventListener('mouseup', this._onMouseUp);
            });
        }

        // initial sizing
        if (typeof this.TB.resizeMap === 'function') {
            this.TB.resizeMap();
        }
    },

    onMouseMove(e) {
        if (!this.isResizing) return;

        const total = this.mapContainer.offsetWidth + this.taskDetailContainer.offsetWidth;
        const pctMap = (e.clientX / total) * 100;
        const pctDetails = 100 - pctMap;

        this.mapContainer.style.width = `${pctMap}%`;
        this.taskDetailContainer.style.width = `${pctDetails}%`;

        // persist both in TB and via its own save method
        this.TB.taskDetailsContainerWidth = this.taskDetailContainer.style.width;
        this.TB.resizeMap();
        if (typeof this.TB.saveMapUserSettings === 'function') {
            this.TB.saveMapUserSettings();
        }
    },

    onMouseUp() {
        this.isResizing = false;
        document.removeEventListener('mousemove', this._onMouseMove);
        document.removeEventListener('mouseup', this._onMouseUp);
    }
};
