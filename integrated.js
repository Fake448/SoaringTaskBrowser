"use strict"

class IntegratedTB {
    
    constructor() {
        this.tbm = new TaskBrowserMap(this);
    }

    init() {
        console.log("Integrated.init()");
        this.loadMapUserSettings();
    }

    //
    // Commands received by the task browser app
    //

    // Function to select a task on the map
    selectTaskFromApp(entrySeqID, forceZoomToTask = false) {
        this.tbm.selectTaskFromDPHXApp(entrySeqID, forceZoomToTask);
    };

    // Function to filter tasks based on a list of EntrySeqIDs
    filterTasksFromApp(entrySeqIDs) {
        // Save the list of tasks
        this.tbm.filterTasksFromApp(entrySeqIDs);
    };

    // Function to clear all filters and show all tasks
    clearFilterFromApp() {
        this.tbm.clearFilterFromApp();
    };

    setJsonCookie(name, jsonObject, days) {
        var expires = "";
        if (days) {
            var date = new Date();
            date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
            expires = "; expires=" + date.toUTCString();
        }
        var jsonString = JSON.stringify(jsonObject);
        var encodedJsonString = encodeURIComponent(jsonString);
        document.cookie = name + "=" + encodedJsonString + expires + "; path=/";
    }

    getJsonCookie(name, renewDays) {
        var nameEQ = name + "=";
        var ca = document.cookie.split(';');
        for (var i = 0; i < ca.length; i++) {
            var c = ca[i];
            while (c.charAt(0) === ' ') c = c.substring(1, c.length);
            if (c.indexOf(nameEQ) === 0) {
                var encodedJsonString = c.substring(nameEQ.length, c.length);
                var jsonString = decodeURIComponent(encodedJsonString);
                var jsonObject = JSON.parse(jsonString);

                // Renew the cookie's expiration date
                if (renewDays) {
                    this.setJsonCookie(name, jsonObject, renewDays);
                }

                return jsonObject;
            }
        }
        return null;
    }

    getCookieSize(name) {
        const jsonCookie = this.getJsonCookie(name);
        if (jsonCookie) {
            const jsonString = JSON.stringify(jsonCookie);
            const encodedJsonString = encodeURIComponent(jsonString);
            return encodedJsonString.length;
        }
        return 0;
    }

    saveMapUserSettings() {
        const settings = {
            mapLayer: this.tbm.getCurrentMapLayer(),
            showAirports: this.tbm.isLayerVisible('Airports'),
            showRailways: this.tbm.isLayerVisible('Railways'),
            windCompass: this.tbm.isLayerVisible('Wind Compass')
        };
        this.setJsonCookie('mapUserSettings', settings, 300);
    }

    loadMapUserSettings() {
        const settings = this.getJsonCookie('mapUserSettings', 300);

        // Set default settings if not found
        const defaultSettings = {
            mapLayer: "Google Terrain",
            showAirports: true,
            showRailways: false,
            windCompass: false
        };
    }
}