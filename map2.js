class TaskBrowserMap {
    constructor(tb) {
        this.tb = tb;

        this.runningInApp = false;
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.has('appContext')) {
            this.runningInApp = true;
            this.taskCount = 9999; // no limit when from the app
        } else {
            this.runningInApp = false;
            this.taskCount = 300; // or any sensible default value for the number of tasks
        }

        // Default values for taskCount, startDate, and endDate
        this.startDate = '2000-01-01'; // example default minimum date
        this.endDate = '2200-01-01'; // max date
        // Default values for soaring types (all selected)
        this.soaringTypes = {
            soaringRidge: true,
            soaringThermals: true,
            soaringWaves: true,
            soaringDynamic: true
        };
        // Default filter type for soaring types (e.g., "any" for OR filtering)
        this.soaringTypeFilter = 'any';

        // Default values for duration filters
        this.durationMin = 0;               // Min duration in minutes
        this.durationMax = 9999;            // Max duration in minutes
        this.includeNoDuration = true;      // Include tasks with no duration specified

        // B21 update, these are used by B21_Task / B21_WP
        this.settings = {
            altitude_units: "feet",
            wp_radius_units: "m",
            task_line_color_1: "blue",
            task_line_color_2: "none"
        }

        this.M_TO_FEET = 3.28084;
        this.defWeight = 6;
        this.hoverWeight = 7;
        this.selWeight = 0;

        //B21 update
        this.fetchBounds = null; // Keep track of the GetTasksForMap bounds
        this.api_tasks = {};     // Will hold all tasks from GetTasksForMap.php
        this.b21_task = null;    // Will hold parsed 'current' task

        //this.map = L.map('map').setView([20, 0], 2);

        // b21_airports requirements
        this.canvas_renderer = L.canvas();
        this.airport_markers = L.layerGroup(); //.addTo(planner.map);

        // Define different map layers
        this.base_maps = {
            "OpenStreetMap": L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: 'Map data © <a href="https://openstreetmap.org">OpenStreetMap</a> contributors'
            }),
            "Google Terrain": L.tileLayer('https://{s}.google.com/vt/lyrs=p&x={x}&y={y}&z={z}', {
                attribution: 'Map data © <a href="https://maps.google.com">Google</a>',
                subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
                maxZoom: 20,
                tileSize: 256,
            }),
            "TopoMap": L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
                attribution: 'Map data © <a href="https://opentopomap.org">OpenTopoMap</a>'
            }),
            "Satellite": L.tileLayer('https://{s}.google.com/vt/lyrs=s&x={x}&y={y}&z={z}', {
                attribution: 'Map data © <a href="https://maps.google.com">Google</a>',
                subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
                maxZoom: 20,
                tileSize: 256,
            })
        };

        if (!this.runningInApp) {
            this.map_layers = {
                "Airports": this.airport_markers,
                "Railways": L.tileLayer('https://{s}.tiles.openrailwaymap.org/standard/{z}/{x}/{y}.png', {
                    maxZoom: 19,
                    attribution: 'Map data: &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors | Map style: &copy; <a href="https://www.OpenRailwayMap.org">OpenRailwayMap</a> (<a href="https://creativecommons.org/licenses/by-sa/3.0/">CC-BY-SA</a>)'
                }),
                "Wind Compass": L.layerGroup(),
                "Show selected only": L.layerGroup()
            };
        } else {
            this.map_layers = {
                "Airports": this.airport_markers,
                "Railways": L.tileLayer('https://{s}.tiles.openrailwaymap.org/standard/{z}/{x}/{y}.png', {
                    maxZoom: 19,
                    attribution: 'Map data: &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors | Map style: &copy; <a href="https://www.OpenRailwayMap.org">OpenRailwayMap</a> (<a href="https://creativecommons.org/licenses/by-sa/3.0/">CC-BY-SA</a>)'
                }),
                "Wind Compass": L.layerGroup()
            };
        }

        this.map = L.map('map', {
            minZoom: 2,
            maxZoom: 16,
            worldCopyJump: true,
            layers: [this.base_maps["Google Terrain"], this.airport_markers]
        });

        this.map.setView([20, 0], 2);;

        L.control.layers(this.base_maps, this.map_layers).addTo(this.map);

        this.currentPolyline = null; // Track the currently selected polyline
        this.currentEntrySeqID = null; // Track the EntrySeqID of the selected polyline
        this.filteredEntrySeqIDs = null; // Track the filtered tasks

        // Initial task fetch
        this.filtering = false;
        this.fetchTasks();

        this.addTaskCountControl();

        // Fetch tasks when the map view changes
        this.map.on('moveend', () => {
            this.airports.draw(this.map);
            this.filterTasksByMapBounds();
        });

        this.airports = new B21_Airports(this, {
            json_url: "https://xp-soaring.github.io/tasks/b21_task_planner/airports/airports.json",
            airport_img_url: "https://xp-soaring.github.io/tasks/b21_task_planner/images/airport_00.png"
        });

        this.airports.init(this.map); // Here we ASYCHRONOUSLY load the airports JSON data (& will draw on map)

        let windCompassOptionChecked = false;
        let windCompassValidWindLayer = false;
        let showSelectedOnlyChecked = false;
        this.addCompassRoseControl();

        // Listen to layer control changes
        this.map.on('overlayadd', (eventLayer) => {
            if (eventLayer.name === 'Wind Compass') {
                this.windCompassOptionChecked = true;
                this.setWindCompassVisibility();
            } else if (eventLayer.name === 'Show selected only') {
                this.showSelectedOnlyChecked = true;
                this.showSelectedOnly();
            }
            this.tb.saveMapUserSettings();
        });

        this.map.on('overlayremove', (eventLayer) => {
            if (eventLayer.name === 'Wind Compass') {
                this.windCompassOptionChecked = false;
                this.setWindCompassVisibility();
            } else if (eventLayer.name === 'Show selected only') {
                this.showSelectedOnlyChecked = false;
                this.showSelectedOnly();
            }
            this.tb.saveMapUserSettings();
        });

        this.map.on('baselayerchange', (eventLayer) => {
            this.tb.saveMapUserSettings();
        });

        this.setWindCompassVisibility();

        // Cache properties for IGC track logs
        this.currentIGCCacheEntrySeqID = null;
        this.igcTrackCache = {};  // { igcKey: L.Polyline, ... }
        this.igcTrackNormalWeight = 2;
        this.igcTrackNormalColor = 'black';
        this.igcTrackHighlightedWeight = 4;
        this.igcTrackHighlightedColor = '#9900cc';
        this.igcTrackSelectedWeight = 4;
        this.igcTrackSelectedColor = 'red';
        this.igcParser = {
            parse: function (igcText) {
                const fixes = [];
                const lines = igcText.split(/\r?\n/);
                let startIndex = 0;

                // Find the index of the first LNB21 line that contains "TOFF"
                for (let i = 0; i < lines.length; i++) {
                    if (lines[i].startsWith("LNB21") && lines[i].indexOf("TOFF") !== -1) {
                        startIndex = i + 1; // start processing after this line
                        break; // break after the first occurrence
                    }
                }

                // Process B lines starting from the determined index
                for (let i = startIndex; i < lines.length; i++) {
                    const line = lines[i];
                    if (line.charAt(0) === 'B' && line.length >= 24) {
                        try {
                            // Latitude: 7 characters (positions 7-13) and hemisphere at position 14
                            const latStr = line.substr(7, 7); // Format: DDMMmmm
                            const latHem = line.substr(14, 1);
                            // Longitude: 8 characters (positions 15-22) and hemisphere at position 23
                            const lonStr = line.substr(15, 8); // Format: DDDMMmmm
                            const lonHem = line.substr(23, 1);

                            // Parse latitude: first 2 characters are degrees, next 5 are minutes (in thousandths)
                            const latDeg = parseInt(latStr.substr(0, 2), 10);
                            const latMin = parseInt(latStr.substr(2, 5), 10);
                            let lat = latDeg + (latMin / 60000); // 60000 = 60 * 1000
                            if (latHem === 'S') {
                                lat = -lat;
                            }

                            // Parse longitude: first 3 characters are degrees, next 5 are minutes
                            const lonDeg = parseInt(lonStr.substr(0, 3), 10);
                            const lonMin = parseInt(lonStr.substr(3, 5), 10);
                            let lon = lonDeg + (lonMin / 60000);
                            if (lonHem === 'W') {
                                lon = -lon;
                            }

                            fixes.push({ lat, lon });
                        } catch (e) {
                            console.error("Error parsing IGC B record:", line, e);
                        }
                    }
                }
                return { fixes };
            }
        };
    }

    showLoadingSpinner(message) {
        const spinnerEl = document.getElementById('loadingSpinner');
        const messageEl = document.getElementById('loadingMessage');
        messageEl.textContent = message || "Loading...";
        spinnerEl.style.display = 'block';
    }

    hideLoadingSpinner() {
        document.getElementById('loadingSpinner').style.display = 'none';
    }

    // Fetch and filter tasks based on current filter settings
    fetchTasks() {
        // Show the loading spinner
        this.showLoadingSpinner("Fetching tasks");

        console.log("fetchTasks() with filters:", this.taskCount, this.startDate, this.endDate, this.soaringTypes, this.soaringTypeFilter, this.durationMin, this.durationMax, this.includeNoDuration);

        this.clearPolylines();

        // Construct URL with query parameters
        const url = new URL(DEBUG_LOCAL ? 'GetTasksForMap.php' : 'php/GetTasksForMap.php', window.location.href);
        url.searchParams.append('taskCount', this.taskCount);
        url.searchParams.append('startDate', this.startDate);
        url.searchParams.append('endDate', this.endDate);
        // Add duration parameters to the URL
        url.searchParams.append('durationMin', this.durationMin);
        url.searchParams.append('durationMax', this.durationMax);
        url.searchParams.append('includeNoDuration', this.includeNoDuration ? '1' : '0');

        // Add soaring type filter type (any, all, only, exclude)
        url.searchParams.append('soaringTypeFilter', this.soaringTypeFilter);

        // Map soaring type names to expected PHP parameter names
        const soaringTypeKeys = {
            Ridge: 'soaringRidge',
            Thermals: 'soaringThermals',
            Waves: 'soaringWaves',
            Dynamic: 'soaringDynamic'
        };

        // Add each soaring type as a parameter based on user selection
        Object.entries(this.soaringTypes).forEach(([type, isSelected]) => {
            const key = soaringTypeKeys[type];
            if (key) {
                url.searchParams.append(key, isSelected ? '1' : '0');
            }
        });

        // Log constructed URL to verify query parameters
        // console.log("Constructed URL:", url.toString());

        fetch(url)
            .then(response => response.json())
            .then(data => {
                const { tasks, totalTasks, oldestDate, newestDate } = data;

                // Store all fetched tasks locally
                this.allTasks = tasks;

                // Update dates and total tasks from the database
                this.oldestDate = oldestDate.split(' ')[0];
                this.newestDate = newestDate.split(' ')[0];
                this.totalTasksInDB = totalTasks;

                // Set filtering flag
                this.filtering = (this.allTasks.length != this.totalTasksInDB);
                this.updateTaskCountControl(this.allTasks.length);

                // Clear and load tasks
                this.api_tasks = {};
                tasks.forEach(api_task => this.loadTask(api_task));

                this.tb.populateDataTable(tasks);

                // Apply map bounds filtering and update UI
                this.filterTasksByMapBounds();
                this.tb.setupSearchFiltersPanel();
                this.tb.sortTasksGrid("Updated", "desc");
            })
            .catch(error => {
                console.error('Error fetching tasks:', error);
            })
            .finally(() => {
                this.hideLoadingSpinner();
            });
    }

    filterTasksByMapBounds() {
        if (!this.allTasks) return; // Ensure tasks are loaded first

        // Show the loading spinner
        this.showLoadingSpinner("Fetching tasks...");

        let bounds = this.map.getBounds();
        const bufferKm = 0.5;
        const bufferLat = bufferKm / 110.574;
        const bufferLng = bufferKm / (111.320 * Math.cos(bounds.getCenter().lat * Math.PI / 180));

        // Calculate buffered bounds
        const latMin = bounds.getSouthWest().lat - bufferLat;
        const latMax = bounds.getNorthEast().lat + bufferLat;
        const lngMin = bounds.getSouthWest().lng - bufferLng;
        const lngMax = bounds.getNorthEast().lng + bufferLng;

        // Filter tasks based on bounds
        this.visibleTasks = this.allTasks.filter(task => (
            task.LatMax >= latMin &&
            task.LatMin <= latMax &&
            task.LongMax >= lngMin &&
            task.LongMin <= lngMax
        ));

        // Check if showSelectedOnly is enabled and a task is selected
        if (this.showSelectedOnlyChecked && this.currentEntrySeqID) {
            // Only show the selected task if it's within the bounds
            let selectedTask = this.api_tasks[this.currentEntrySeqID];
            if (selectedTask &&
                selectedTask.LatMax >= latMin &&
                selectedTask.LatMin <= latMax &&
                selectedTask.LongMax >= lngMin &&
                selectedTask.LongMin <= lngMax
            ) {
                selectedTask.polyline.addTo(this.map);
            }
        } else {
            // Otherwise, show all visible tasks within bounds
            this.visibleTasks.forEach(task => {
                this.api_tasks[task.EntrySeqID].polyline.addTo(this.map);
            });
        }

        // Restore the selected task style if a task is selected
        if (this.currentEntrySeqID) {
            this.selectTaskCommon(this.currentEntrySeqID, false, false);
        }

        // Hide the loading spinner
        this.hideLoadingSpinner();

    }

    //B21_update
    loadTask(api_task) {
        // Check if the task is not in the cache
        if (!this.api_tasks[api_task.EntrySeqID]) {
            this.api_tasks[api_task.EntrySeqID] = api_task; // cache the download
        }

        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(api_task.PLNXML, "text/xml");
        const waypoints = xmlDoc.getElementsByTagName("ATCWaypoint");

        const coordinates = [];
        for (let i = 0; i < waypoints.length; i++) {
            const worldPosition = waypoints[i].getElementsByTagName("WorldPosition")[0].textContent;
            const [lat, lon] = this.parseWorldPosition(worldPosition);
            coordinates.push([lat, lon]);
        }

        if (coordinates.length > 0) {
            const polyline = L.polyline(coordinates, {
                color: "#ff7800",
                weight: this.defWeight,
                opacity: 0.7,
                className: 'task-polyline'
            });

            // Bind popup to the polyline
            polyline.bindPopup(`${api_task.Title}<br>ID: ${api_task.EntrySeqID}`);

            polyline.addTo(this.map);

            this.api_tasks[api_task.EntrySeqID].bounds = polyline.getBounds(); // B21 update - add .bounds to each api_task

            this.api_tasks[api_task.EntrySeqID].polyline = polyline; // b21 update - add polyline to api_tasks entry

            polyline.on('mouseover', (e) => { this.highlightTask(tbm, api_task.EntrySeqID, e); });

            polyline.on('mouseout', () => { this.unhighlightTask(tbm, api_task.EntrySeqID); });

            polyline.on('click', function () {
                this.selectTaskFromClick(api_task.EntrySeqID);
            });
        }
    }

    highlightTask(tbm, entrySeqID, event) {
        // Only highlight if it's not the currently selected task
        if (this.currentEntrySeqID !== entrySeqID) {
            const polyline = this.api_tasks[entrySeqID].polyline;
            polyline.setStyle({ color: '#9900cc', weight: this.hoverWeight });
            polyline.bringToFront(); // Ensure it's on top

            // Only show popup if event is provided (i.e., when hovering directly on the map)
            if (event) {
                // Calculate the offset position for the popup
                const offset = L.point(10, -10); // Adjust these values as needed
                const popupPosition = this.map.layerPointToLatLng(this.map.latLngToLayerPoint(event.latlng).add(offset));

                // Open the popup at the offset position
                const popup = polyline.getPopup();
                popup.setLatLng(popupPosition).openOn(this.map);
            }
        }
    }

    unhighlightTask(tbm, entrySeqID) {
        // Only unhighlight if it's not the currently selected task
        if (this.currentEntrySeqID !== entrySeqID) {
            this.api_tasks[entrySeqID].polyline.setStyle({ color: '#ff7800', weight: this.defWeight });
            this.api_tasks[entrySeqID].polyline.closePopup(); // Close popup
        }
    }

    //B21 update
    mapExpanded(new_bounds) {
        if (this.fetchBounds == null) {
            return true;
        }
        return !this.fetchBounds.contains(new_bounds);
    }

    // B21 update - each polyline now stored in api_task object
    clearPolylines() {
        for (const entrySeqID in this.api_tasks) {
            this.map.removeLayer(this.api_tasks[entrySeqID].polyline);
        }
    }

    // B21 update - this.api_tasks[entrySeqID].polyline
    resetPolylines() {
        for (const entrySeqID in this.api_tasks) {
            let polyline = this.api_tasks[entrySeqID].polyline;
            if (polyline.options.selected) {
                polyline.setStyle({ color: '#ff7800', weight: this.defWeight });
                polyline.options.selected = false;
            }
        }
    }

    drawPolylines() {
        // Add all polylines to the map
        for (const entrySeqID in this.api_tasks) {
            let polyline = this.api_tasks[entrySeqID].polyline;
            polyline.addTo(this.map);
        }
    }

    setB21Task(api_task) {
        // Remove the previous task map_elements
        if (this.b21_task != null) {
            if (this.b21_task.entrySeqID == api_task.EntrySeqID) {
                return;
            }
            this.b21_task.reset();
        }

        this.b21_task = new B21_Task(tbm);   // B21 update here's where we parse the XML into a B21_Task
        this.b21_task.load_pln_str(api_task.PLNXML, api_task.Title);
        this.b21_task.update_waypoints();
        this.b21_task.update_waypoint_icons();

        this.b21_task.draw();
    }

    parseWorldPosition(worldPosition) {
        const regex = /([NS])(\d+)° (\d+)' ([\d.]+)",([EW])(\d+)° (\d+)' ([\d.]+)"/;
        const match = regex.exec(worldPosition);
        if (!match) return [0, 0];

        const lat = this.parseCoordinate(match[1], match[2], match[3], match[4]);
        const lon = this.parseCoordinate(match[5], match[6], match[7], match[8]);
        return [lat, lon];
    }

    parseCoordinate(direction, degrees, minutes, seconds) {
        let decimal = parseFloat(degrees) + parseFloat(minutes) / 60 + parseFloat(seconds) / 3600;
        if (direction === 'S' || direction === 'W') decimal = -decimal;
        return decimal;
    }

    manageFilteredTasks() {
        // Check if filtered tasks are active or not (filteredEntrySeqIDs is null or not)
        if (this.filteredEntrySeqIDs === null) {
            return;
        }
        // Hide all polylines first
        this.clearPolylines();

        // Show only the polylines whose EntrySeqID is in the filteredEntrySeqIDs list
        this.filteredEntrySeqIDs.forEach(entrySeqID => {
            if (this.api_tasks[entrySeqID]) {
                this.api_tasks[entrySeqID].polyline.addTo(this.map);
            }
        });
    }

    //
    // TASK SELECTION REFACTORING
    //

    // Selecting a task from the "task" parameter in the URL string
    selectTaskFromURL(entrySeqID, doNotExpand = false, sectionsToExpand = []) {
        if (doNotExpand) {
            this.tb.fromURL = false;
            this.tb.sectionsToExpandFromURL = null;
        } else {
            this.tb.fromURL = true;
            this.tb.sectionsToExpandFromURL = Array.isArray(sectionsToExpand) ? sectionsToExpand : [];
        }

        const entrySeqIDNbr = Number(entrySeqID);
        console.log("selectTaskFromURL()", entrySeqIDNbr);
        this.clearIGCTracklogs();

        // 1. Remove the task parameter from the URL
        this.tb.clearUrlParameter('task');
        this.tb.clearUrlParameter('results');

        // 2. Fetch task details and proceed only if the task is available
        this.tb.getTaskDetails(entrySeqIDNbr, true).then(isAvailable => {
            if (isAvailable) {
                // 3. Call the selectTaskCommon to perform the common actions
                this.selectTaskCommon(entrySeqIDNbr, true);
            } else {
                console.log(`Task ${entrySeqIDNbr} is unavailable or could not be retrieved.`);
            }
        }).catch(error => {
            console.error(`Error selecting task from URL: ${error}`);
        });
    }

    // Selecting a task from a true user click on the map
    selectTaskFromClick(entrySeqID, forceZoomToTask = false) {
        // Check if the igcOverlay is visible. If so, exit immediately.
        const igcOverlay = document.getElementById('igcOverlay');
        if (igcOverlay && igcOverlay.style.display === 'block') {
            return;
        }

        this.tb.fromURL = false;
        console.log("selectTaskFromClick()", entrySeqID);
        this.clearIGCTracklogs();

        // 1. Call the selectTaskCommon to perform the common actions
        this.selectTaskCommon(entrySeqID, forceZoomToTask);

        // 2a. If we're not running in the context of the DPHX app, get the task details to show on the right panel.
        // 2b. If we're running in the context of DPHX app, call the postSelectedTask function.
        if (this.runningInApp) {
            this.postSelectedTask(entrySeqID); // Notify the app
        } else {
            this.tb.selectGridTask(entrySeqID);
            this.tb.getTaskDetails(entrySeqID, false); // Display task details on the right panel
        }
    }

    // Selecting a task based on an interaction from the external DPHX app
    selectTaskFromDPHXApp(entrySeqID, forceZoomToTask = false) {
        this.tb.fromURL = false;
        const entrySeqIDNbr = Number(entrySeqID);
        console.log("selectTaskFromDPHXApp()", entrySeqIDNbr);

        // 1. Make sure the corresponding task entrySeqID is loaded in api_tasks, if not, we need to fetch it and change map bounds
        // Right now, not necessary as all tasks are being loaded right from the start

        // 2. Wait for the fetch and bounds change to be completed
        // Right now, not necessary as all tasks are being loaded right from the start

        // 3. Call the selectTaskCommon to perform the common actions
        this.selectTaskCommon(entrySeqIDNbr, forceZoomToTask);

    }

    // Common actions that need to be performed by all task selection use cases
    selectTaskCommon(entrySeqID, forceZoomToTask = false, realSelection = true) {
        if (!this.runningInApp && realSelection) {
            this.tb.TaskDetailsPanelVisible = true;
            this.tb.showTaskDetailsPanel();
        }

        // 1. The previous (if any) selected task's normal unselected polyline should be drawn (and the detailed task rendering removed)
        this.resetPolylines();

        // 2. Render the detailed task and remove the regular polyline
        this.currentEntrySeqID = entrySeqID; // Track the EntrySeqID
        if (this.api_tasks[entrySeqID] == undefined) {
            return;
        }
        let api_task = this.api_tasks[entrySeqID]; // Retrieve api_task from the cache
        this.currentPolyline = api_task.polyline; // Set the current polyline
        this.currentPolyline.setStyle({ color: '#0000ff', weight: this.selWeight }); // Set selWeight (0 actually)
        this.currentPolyline.options.selected = true; // Se the selection flag on the polyline
        this.setB21Task(api_task); // Render the B21Task

        if (realSelection) {
            // 3. Zoom in on the task if specified or if task bounds outside current map bounds
            let taskBounds = this.b21_task.get_bounds();
            let mapBounds = this.map.getBounds();
            let containsBounds = mapBounds.contains(taskBounds);

            if (forceZoomToTask || !containsBounds) {
                console.log('zooming to task', forceZoomToTask, containsBounds);
                this.zoomToTask();
            }
        }
        this.showSelectedOnly();
    }

    //
    // Buttons on the map
    //

    // Full world button function
    resetToFullWorld() {
        this.map.setView([20, 0], 2); // Set the default view with the entire world
    }

    // Function to zoom to the selected task
    zoomToTask() {
        if (this.b21_task) {
            this.map.fitBounds(this.b21_task.get_bounds());
        } else {
            alert("No task selected");
        }
    }

    //
    // Functions that send messages to the task browser app
    //

    // Function to post a selected task ID to the app
    postSelectedTask(entrySeqID) {
        if (window.chrome && window.chrome.webview) {
            window.chrome.webview.postMessage({ action: 'selectTask', entrySeqID: entrySeqID });
        }
    }

    //
    // Commands received by the task browser app
    //

    // Function to filter tasks based on a list of EntrySeqIDs
    filterTasksFromApp(entrySeqIDs) {
        console.log('filterTasksFromApp');

        // Save the list of tasks
        this.filteredEntrySeqIDs = entrySeqIDs;

        this.manageFilteredTasks();

        // Todo: Reselect active task??

    }

    // Function to clear all filters and show all tasks
    clearFilterFromApp() {
        console.log('clearFilterFromApp');

        // Clear the list of filtered tasks
        this.filteredEntrySeqIDs = null;

        this.drawPolylines();

        // Todo: Reselect active task??

    }

    getCurrentMapLayer() {
        for (let key in this.base_maps) {
            if (this.map.hasLayer(this.base_maps[key])) {
                return key;
            }
        }
        return null;
    }

    setMapLayer(layerName) {
        if (this.base_maps[layerName]) {
            this.map.eachLayer((layer) => {
                this.map.removeLayer(layer);
            });
            this.map.addLayer(this.base_maps[layerName]);
        }
    }

    isLayerVisible(layerName) {
        return this.map.hasLayer(this.map_layers[layerName]);
    }

    setLayerVisibility(layerName, isVisible) {
        if (isVisible) {
            if (!this.map.hasLayer(this.map_layers[layerName])) {
                this.map.addLayer(this.map_layers[layerName]);
            }
        } else {
            if (this.map.hasLayer(this.map_layers[layerName])) {
                this.map.removeLayer(this.map_layers[layerName]);
            }
        }
    }

    addCompassRoseControl() {
        // Capture reference to TaskBrowserMap instance
        const tbm = this;

        // Custom control for the compass rose
        L.Control.CompassRose = L.Control.extend({
            onAdd: function (map) {
                let compassContainer = L.DomUtil.create('div', 'compass-container');
                compassContainer.innerHTML = `
                    <img id="compassRose" class="compass-rose" src="images/compass_rose.png" alt="Compass Rose">
                    <img id="windArrow" class="wind-arrow" src="images/wind_arrow2.png" alt="Wind Arrow">
                    <div id="windDirection" class="wind-direction">0°</div>
                `;
                tbm.makeDraggable(compassContainer, compassContainer.querySelector('#windDirection'));
                return compassContainer;
            }
        });

        // Add the control to the map
        this.compassControl = new L.Control.CompassRose({ position: 'topleft' });
        this.map.addControl(this.compassControl);

        // Event listener for changing wind direction
        this.setWindDirection(-1);  // Initialize with 0° wind direction
    }

    setWindCompassVisibility() {
        let compassContainer = document.querySelector('.compass-container');
        if (compassContainer) {
            if (this.windCompassValidWindLayer && this.windCompassOptionChecked) {
                compassContainer.style.display = 'block';
            } else {
                compassContainer.style.display = 'none';
            }
        }
    }

    setWindDirection(degree, speed, altitude) {
        if (degree < 0) {
            this.windCompassValidWindLayer = false;
            this.setWindCompassVisibility();
            return;
        }
        else {
            this.windCompassValidWindLayer = true;
            this.setWindCompassVisibility();
        }
        let windDirectionElem = document.getElementById('windDirection');
        let windArrowElem = document.getElementById('windArrow');
        if (windDirectionElem && windArrowElem) {
            windDirectionElem.innerHTML = `${speed}<br>${altitude}`;
            windArrowElem.style.transform = `rotate(${180 + degree}deg)`;
        }
    }

    makeDraggable(element, handle) {
        let isDragging = false;
        let offsetX, offsetY;

        // Prevent map from handling drag events
        L.DomEvent.disableClickPropagation(element);
        L.DomEvent.disableScrollPropagation(element);

        L.DomEvent.on(handle, 'mousedown', function (e) {
            isDragging = true;
            offsetX = e.clientX - parseInt(window.getComputedStyle(element).left);
            offsetY = e.clientY - parseInt(window.getComputedStyle(element).top);
            element.style.transition = 'none'; // Disable transitions during drag

            L.DomEvent.stopPropagation(e); // Prevent map from handling the event
        });

        L.DomEvent.on(document, 'mousemove', function (e) {
            if (isDragging) {
                let x = e.clientX - offsetX;
                let y = e.clientY - offsetY;
                element.style.left = `${x}px`;
                element.style.top = `${y}px`;
                L.DomEvent.stopPropagation(e); // Prevent map from handling the event
            }
        });

        L.DomEvent.on(document, 'mouseup', function (e) {
            if (isDragging) {
                isDragging = false;
                element.style.transition = ''; // Re-enable transitions after drag
                L.DomEvent.stopPropagation(e); // Prevent map from handling the event
            }
        });
    }

    clearIGCTracklogs() {
        // Clear any tracklogs from the map and the cache.
        Object.keys(this.igcTrackCache).forEach(key => {
            const polyline = this.igcTrackCache[key];
            if (this.map.hasLayer(polyline)) {
                this.map.removeLayer(polyline);
            }
        });
        this.igcTrackCache = {};
        this.currentIGCCacheEntrySeqID = null;
    }

    deselectTask() {
        this.clearIGCTracklogs();

        // Reset the style of the current selected polyline.
        if (this.currentPolyline) {
            this.currentPolyline.setStyle({ color: '#ff7800', weight: this.defWeight });
            this.currentPolyline.options.selected = false;
        }
        this.currentEntrySeqID = null;
        this.currentPolyline = null;

        // Hide the detailed task rendering if needed.
        if (this.b21_task != null) {
            this.b21_task.reset();
            this.b21_task = null;
        }

        this.tb.clearTaskDetails();
        this.tb.deselectGridTask();

        // Hide the task control panel.
        const taskControlPanel = document.getElementById('taskControlPanel');
        taskControlPanel.style.display = 'none';

        this.showSelectedOnly();
    }

    showSelectedOnly() {
        if (this.showSelectedOnlyChecked && this.currentEntrySeqID) {
            for (const entrySeqID in this.api_tasks) {
                let polyline = this.api_tasks[entrySeqID].polyline;
                if (this.currentEntrySeqID !== parseInt(entrySeqID)) {
                    this.map.removeLayer(polyline);
                }
            }
        } else {
            for (const entrySeqID in this.api_tasks) {
                let polyline = this.api_tasks[entrySeqID].polyline;
                this.map.addLayer(polyline);
            }
        }
    }
    addTaskCountControl() {
        // Define the control
        this.taskCountControl = L.control({ position: 'bottomleft' });

        this.taskCountControl.onAdd = function (map) {
            // Create a div element to hold the count
            let countDiv = L.DomUtil.create('div', 'task-count-control');
            countDiv.style.padding = '5px';
            countDiv.style.backgroundColor = 'rgba(255, 255, 255, 0.8)';
            countDiv.style.borderRadius = '5px';
            countDiv.style.fontSize = '14px';
            countDiv.style.color = '#333';

            // Set initial text
            countDiv.innerHTML = "Tasks fetched: 0";
            this.taskCountDiv = countDiv; // Store reference to update it later

            return countDiv;
        };

        this.taskCountControl.addTo(this.map);
    }

    updateTaskCountControl(count) {
        if (this.taskCountControl) {
            // Display count with optional "(filters applied)" based on this.filtering
            const filterText = this.filtering ? ' (filters applied)' : '';
            this.taskCountControl._container.innerHTML = `Tasks fetched: ${count}${filterText}`;
        }
    }

    processIGCRecordDisplay(entrySeqID, igcKey, isChecked, igcText) {
        // 1) If we’ve switched tasks, clear out old layers & cache
        if (this.currentIGCCacheEntrySeqID !== entrySeqID) {
            Object.values(this.igcTrackCache).forEach(poly => {
                if (this.map.hasLayer(poly)) this.map.removeLayer(poly);
            });
            this.igcTrackCache = {};
            this.currentIGCCacheEntrySeqID = entrySeqID;
        }

        // helper to restyle a polyline based on row.selected
        function stylePolyline(poly) {
            const $row = $(
                `#igcRecordsTable tbody input[data-key="${igcKey}"]`
            ).closest('tr');
            const selected = $row.hasClass('selected');
            poly.setStyle({
                color: selected ? this.igcTrackSelectedColor : this.igcTrackNormalColor,
                weight: selected ? this.igcTrackSelectedWeight : this.igcTrackNormalWeight
            });
        }

        if (isChecked) {
            // 2a) Already cached? just add + style
            if (this.igcTrackCache[igcKey]) {
                const poly = this.igcTrackCache[igcKey];
                if (!this.map.hasLayer(poly)) this.map.addLayer(poly);
                stylePolyline(poly);

            } else {
                // 2b) Not cached → load & cache
                const processIGC = (igcContent) => {
                    const igcData = this.igcParser.parse(igcContent);
                    if (!igcData.fixes.length) {
                        console.warn(`No fixes for IGCKey ${igcKey}`);
                        return;
                    }
                    const poly = L.polyline(
                        igcData.fixes.map(fix => [fix.lat, fix.lon]),
                        {
                            color: this.igcTrackNormalColor,
                            weight: this.igcTrackNormalWeight
                        }
                    );
                    this.igcTrackCache[igcKey] = poly;
                    poly.addTo(this.map);
                    stylePolyline(poly);
                };

                if (igcText) {
                    processIGC(igcText);
                } else {
                    fetch(`php/GetIGCFile.php?IGCKey=${encodeURIComponent(igcKey)}&EntrySeqID=${encodeURIComponent(entrySeqID)}`)
                        .then(r => r.ok ? r.text() : Promise.reject(r.status))
                        .then(processIGC)
                        .catch(err => console.error(`Error loading IGC ${igcKey}:`, err));
                }
            }

        } else {
            // 3) Unchecked → remove layer
            const poly = this.igcTrackCache[igcKey];
            if (poly && this.map.hasLayer(poly)) {
                this.map.removeLayer(poly);
            }
        }
    }
}