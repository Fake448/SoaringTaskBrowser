"use strict"

class TaskBrowser {
    constructor() {
        let tb = this;
        let shouldHandlePopState = true;
        let fromURL = false;
        tb.isDownloadPage = false;
        tb.discordPostHelperTaskBrowserPath = "";
        tb.discordTasksChannel = "";
        tb.wsgRoot = "";
        tb.isUserConnected = false;
    }

    init(igcUpload) {
        let tb = this;

        // Store the reference to the TaskBrowser instance.
        tb.IGCUpload = igcUpload;

        // Automatically detect the mode based on the current path
        const currentPath = window.location.pathname;
        tb.isDownloadPage = currentPath.includes("download.html");
        if (window.location.origin.includes("wesimglide.org")) {
            tb.discordPostHelperTaskBrowserPath = "https://siglr.com/DiscordPostHelper/TaskBrowser/";
            tb.discordTasksChannel = "discord://discord.com/channels/1022705603489042472/1155511739799060552/";
            tb.wsgRoot = "https://wesimglide.org/";
        }
        else {
            tb.discordPostHelperTaskBrowserPath = "https://siglr.com/DiscordPostHelperTest/TaskBrowser/";
            tb.discordTasksChannel = "discord://discord.com/channels/1022705603489042472/1067288937527246868/";
            tb.wsgRoot = "https://soaring.siglr.com/";
        }

        if (tb.isDownloadPage) {
            // Light initialization for download purposes
            console.log("Initializing TaskBrowser in light mode for download page.");
            tb.userSettings = tb.loadUserSettings();
            return;
        }

        tb.countryCodes = {};

        tb.md = window.markdownit({
            html: false,
            breaks: true,
            linkify: true,
            typographer: true
        });
        tb.tbm = new TaskBrowserMap(tb);
        tb.taskDetailsContainerWidth = 0;
        tb.initCountryCodes();
        tb.searchPanelAlreadySetup = false;

        // Mapping of country names in your app to the corresponding names used by the flag service
        tb.countryNameMapping = {
            'Czech Republic': 'Czechia',
            'Virgin Islands - U.S.': 'United States Virgin Islands',
            'Virgin Islands - British': 'British Virgin Islands'
        };
        tb.initCountryCodes();
        tb.userSettings = tb.loadUserSettings();
        tb.userMapSettings = tb.loadMapUserSettings();
        tb.TaskDetailsPanelVisible = false;
        tb.SearchFiltersPanelVisible = false;
        tb.hideTaskDetailsPanel();
        tb.hideSearchFiltersPanel();
        tb.getUserConnectionInfo();

    }

    // Function to initialize the search and filters panel with default content and events
    setupSearchFiltersPanel() {
        let tb = this;
        if (!tb.searchPanelAlreadySetup) {
            const searchFiltersContainer = document.getElementById('searchAndFilters');
            tb.addPanelTitle(searchFiltersContainer);
            tb.addTaskCountControls(searchFiltersContainer);
            tb.addDateRangePicker(searchFiltersContainer);
            tb.addSoaringTypeFilter(searchFiltersContainer);
            tb.addDurationFilter(searchFiltersContainer);
            tb.addApplyButton(searchFiltersContainer);
            tb.searchPanelAlreadySetup = true;
        }
    }

    // Function to add a horizontal line with consistent styling
    addHorizontalLine(container) {
        const hr = document.createElement('hr');
        hr.style.marginTop = '5px';
        hr.style.marginBottom = '5px';
        container.appendChild(hr);
    }

    // Function to add panel title
    addPanelTitle(container) {
        container.innerHTML += `
            <p style="text-align: center; font-weight: bold; margin-top: 10px; margin-bottom: 10px;">Search and Filter Tasks</p>
        `;
    }

    formatCountdown(minutesToEvent) {
        if (minutesToEvent <= 0) {
            return "000:00:00:00";
        }

        const totalSeconds = Math.floor(minutesToEvent * 60);
        const days = Math.floor(totalSeconds / (3600 * 24)).toString().padStart(3, '0');
        const hours = Math.floor((totalSeconds % (3600 * 24)) / 3600).toString().padStart(2, '0');
        const minutes = Math.floor((totalSeconds % 3600) / 60).toString().padStart(2, '0');
        const seconds = (totalSeconds % 60).toString().padStart(2, '0');

        return `${days}:${hours}:${minutes}:${seconds}`;
    };

    // Function to add task count slider and input controls as a collapsible section
    addTaskCountControls(container) {
        let tb = this;

        // HTML content for Task Count Controls
        const content = `
            <div style="display: flex; align-items: center; justify-content: space-between;">
                <label>Max Tasks to Fetch:</label>
                <button id="maxButton" class="button-style" style="font-size: 12px; padding: 2px 6px;">Max</button>
            </div>
            <div style="display: flex; align-items: center; margin-bottom: 10px;">
                <input type="range" id="taskCountSlider" min="1" max="${tb.tbm.totalTasksInDB}" value="${tb.tbm.taskCount}" style="flex: 1; margin-right: 10px;">
                <input type="number" id="taskCountInput" min="1" max="${tb.tbm.totalTasksInDB}" value="${tb.tbm.taskCount}" style="width: 60px; text-align: right;">
            </div>
        `;

        // Define the reset callback for this section
        const resetCallback = () => {
            tb.resetTaskCount();
        };

        // Generate the collapsible section with the Task Count Controls content
        tb.generateCollapsibleSection("Max Tasks", content, container, "maxTasksSection", null, resetCallback);
        tb.expandCollapsibleSection('maxTasksSection');

        // After generating the collapsible section, add event listeners for slider, input, and Max button
        const maxButton = container.querySelector('#maxButton');
        const taskCountSlider = container.querySelector('#taskCountSlider');
        const taskCountInput = container.querySelector('#taskCountInput');

        // Set max value on Max button click
        maxButton.addEventListener('click', () => {
            taskCountSlider.value = tb.tbm.totalTasksInDB;
            taskCountInput.value = tb.tbm.totalTasksInDB;
        });

        // Sync slider and input
        taskCountSlider.addEventListener('input', (event) => {
            taskCountInput.value = event.target.value;
        });

        taskCountInput.addEventListener('input', (event) => {
            let value = parseInt(event.target.value);
            if (isNaN(value) || value < 1) value = 1;
            if (value > tb.tbm.totalTasksInDB) value = tb.tbm.totalTasksInDB;
            taskCountSlider.value = value;
            taskCountInput.value = value;
        });
    }

    expandAllCollapsibleSections() {
        // Get the taskDetailContainer element
        const taskDetailContainer = document.getElementById("taskDetailContainer");

        if (taskDetailContainer) {
            // Find all elements with the "collapsible" class inside taskDetailContainer
            const collapsibleSections = taskDetailContainer.querySelectorAll(".collapsible");

            // Iterate over each collapsible section and expand them
            collapsibleSections.forEach(section => {
                // Remove the "collapsed" class to expand
                section.classList.remove("collapsed");

                // Optionally ensure it's visible (depends on implementation)
                section.style.display = "block";
            });

        } else {
            console.error("taskDetailContainer not found.");
        }
    }

    // Function to add date range picker with quick select dropdown as a collapsible section
    addDateRangePicker(container) {
        let tb = this;

        // HTML content for the Date Range Picker
        const content = `
            <label>Between:</label></br>
            <div style="display: flex; align-items: center;">
                <input type="date" id="startDate" min="${tb.tbm.oldestDate}" max="${tb.tbm.newestDate}" value="${tb.tbm.oldestDate}" style="width: 120px; margin-right: 10px;" disabled>
                <span>and</span>
                <input type="date" id="endDate" min="${tb.tbm.oldestDate}" max="${tb.tbm.newestDate}" value="${tb.tbm.newestDate}" style="width: 120px; margin-left: 10px;" disabled>
            </div>
            <div style="margin-top: 10px;">
                <select id="dateRangeSelect" style="width: 100%; margin-top: 5px;">
                    <option value="any">Any date (all)</option>
                    <option value="custom">Custom dates</option>
                    <option value="2weeks">Last 2 weeks</option>
                    <option value="1month">Last month</option>
                    <option value="3months">Last 3 months</option>
                    <option value="6months">Last 6 months</option>
                    <option value="1year">Last year</option>
                </select>
            </div>
        `;

        // Define the reset callback for this section
        const resetCallback = () => {
            tb.resetDateRange();
        };

        // Generate the collapsible section with the Date Range Picker content and reset callback
        tb.generateCollapsibleSection("Last Update", content, container, "lastUpdateSection", null, resetCallback);

        // After generating the collapsible section, add event listeners to handle dropdown selection logic
        const startDateInput = container.querySelector('#startDate');
        const endDateInput = container.querySelector('#endDate');
        const dateRangeSelect = container.querySelector('#dateRangeSelect');

        // Adjust dates based on quick select dropdown
        dateRangeSelect.addEventListener('change', (event) => {
            const today = new Date();
            let startDate, endDate;

            if (event.target.value === 'custom') {
                // Unlock date inputs for custom selection
                startDateInput.disabled = false;
                endDateInput.disabled = false;
            } else {
                // Lock date inputs and set them based on the selected range
                startDateInput.disabled = true;
                endDateInput.disabled = true;

                switch (event.target.value) {
                    case '2weeks':
                        startDate = new Date(today);
                        startDate.setDate(today.getDate() - 14); // Subtracts 14 days
                        endDate = today;
                        break;
                    case '1month':
                        startDate = new Date(today);
                        startDate.setMonth(today.getMonth() - 1);
                        endDate = today;
                        break;
                    case '3months':
                        startDate = new Date(today);
                        startDate.setMonth(today.getMonth() - 3);
                        endDate = today;
                        break;
                    case '6months':
                        startDate = new Date(today);
                        startDate.setMonth(today.getMonth() - 6);
                        endDate = today;
                        break;
                    case '1year':
                        startDate = new Date(today);
                        startDate.setFullYear(today.getFullYear() - 1);
                        endDate = today;
                        break;
                    case 'any':
                    default:
                        startDate = new Date(tb.tbm.oldestDate);
                        endDate = new Date(tb.tbm.newestDate);
                        break;
                }

                // Enforce min and max date constraints
                startDate = startDate < new Date(tb.tbm.oldestDate) ? new Date(tb.tbm.oldestDate) : startDate;
                endDate = endDate > new Date(tb.tbm.newestDate) ? new Date(tb.tbm.newestDate) : endDate;

                // Update date inputs with constrained values
                startDateInput.value = startDate.toISOString().split('T')[0];
                endDateInput.value = endDate.toISOString().split('T')[0];
            }
        });
    }

    // Function to add soaring type filters using generateCollapsibleSection
    addSoaringTypeFilter(container) {
        let tb = this;
        const content = `
            <div style="display: flex; flex-direction: column; margin-top: 5px;">
                <div>
                    <input type="checkbox" id="soaringRidge" name="soaringType" value="Ridge" checked>
                    <label for="soaringRidge">Ridge</label>
                </div>
                <div>
                    <input type="checkbox" id="soaringThermals" name="soaringType" value="Thermals" checked>
                    <label for="soaringThermals">Thermals</label>
                </div>
                <div>
                    <input type="checkbox" id="soaringWaves" name="soaringType" value="Waves" checked>
                    <label for="soaringWaves">Waves</label>
                </div>
                <div>
                    <input type="checkbox" id="soaringDynamic" name="soaringType" value="Dynamic" checked>
                    <label for="soaringDynamic">Dynamic</label>
                </div>
            </div>
            <div style="margin-top: 10px;">
                <label for="soaringTypeFilter">Filter Type:</label>
                <select id="soaringTypeFilter" style="width: 100%; margin-top: 5px;">
                    <option value="any">Any selected (OR)</option>
                    <option value="all">All selected (AND)</option>
                    <option value="only">Only selected</option>
                    <option value="exclude">Exclude selected</option>
                </select>
            </div>
        `;

        // Define the reset callback for this section
        const resetCallback = () => {
            tb.resetSoaringType();
        };

        // Call generateCollapsibleSection to create the collapsible section with the reset callback
        tb.generateCollapsibleSection("Soaring Type", content, container, "soaringTypeSection", null, resetCallback);
    }

    // Function to add duration filter inputs as a collapsible section
    addDurationFilter(container) {
        let tb = this;

        const content = `
        <div style="display: flex; flex-direction: column; margin-top: 5px;">
            <label for="durationMin">Duration (minutes):</label>
            <div style="display: flex; align-items: center;">
                <input type="number" id="durationMin" min="0" placeholder="Min" style="width: 60px; margin-right: 10px;">
                <span>to</span>
                <input type="number" id="durationMax" min="0" placeholder="Max" style="width: 60px; margin-left: 10px;">
            </div>
            <div style="margin-top: 10px;">
                <input type="checkbox" id="includeNoDuration" checked>
                <label for="includeNoDuration">Include tasks with no duration</label>
            </div>
        </div>
    `;

        // Define the reset callback for the Duration section
        const resetCallback = () => {
            tb.resetDuration();
        };

        // Generate the collapsible section with the Duration content and reset callback
        tb.generateCollapsibleSection("Task Duration", content, container, "taskDurationSection", null, resetCallback);
    }

    // Function to add apply and reset all buttons
    addApplyButton(container) {
        let tb = this;

        // Create the Apply button
        const applyButton = document.createElement('button');
        applyButton.textContent = "Apply";
        applyButton.classList.add('button-style'); // Assuming this class exists for button styling

        // Create the Reset All button
        const resetAllButton = document.createElement('button');
        resetAllButton.textContent = "Reset All";
        resetAllButton.classList.add('button-style'); // Reuse button styling, or define a specific class if needed

        // Style the buttons to appear side by side
        const buttonContainer = document.createElement('div');
        buttonContainer.style.display = 'flex';
        buttonContainer.style.justifyContent = 'space-between';
        buttonContainer.style.width = '80%'; // Adjust width as needed
        buttonContainer.style.margin = '20px auto'; // Center the container

        // Append buttons to the container
        buttonContainer.appendChild(resetAllButton);
        buttonContainer.appendChild(applyButton);

        // Append the container to the main container
        container.appendChild(buttonContainer);

        // Apply button event
        applyButton.addEventListener('click', () => {
            tb.applyFilters();
        });

        // Reset All button event
        resetAllButton.addEventListener('click', () => {
            // Call all individual reset functions
            tb.resetTaskCount();
            tb.resetDateRange();
            tb.resetSoaringType();
            tb.resetDuration();
            tb.applyFilters();
        });
    }

    applyFilters() {
        let tb = this;
        const taskCount = document.getElementById('taskCountInput').value;
        const startDate = document.getElementById('startDate').value;
        const endDate = document.getElementById('endDate').value;

        // Gather soaring type filter selections
        const soaringTypes = {
            Ridge: document.getElementById('soaringRidge').checked,
            Thermals: document.getElementById('soaringThermals').checked,
            Waves: document.getElementById('soaringWaves').checked,
            Dynamic: document.getElementById('soaringDynamic').checked
        };

        // Get the filter type (any, all, only, exclude)
        const soaringTypeFilter = document.getElementById('soaringTypeFilter').value;

        // Get duration filter values
        const durationMin = document.getElementById('durationMin').value || 0;
        const durationMax = document.getElementById('durationMax').value || 9999;
        const includeNoDuration = document.getElementById('includeNoDuration').checked;

        console.log(`Applying filters: Task Count = ${taskCount}, Start Date = ${startDate}, End Date = ${endDate}, Soaring Types = ${JSON.stringify(soaringTypes)}, Filter Type = ${soaringTypeFilter}, Duration Min = ${durationMin}, Duration Max = ${durationMax}, Include No Duration = ${includeNoDuration}`);

        // Update the TBM instance variables
        tb.tbm.taskCount = taskCount;
        tb.tbm.startDate = startDate;
        tb.tbm.endDate = endDate;
        tb.tbm.soaringTypes = soaringTypes;
        tb.tbm.soaringTypeFilter = soaringTypeFilter;
        tb.tbm.durationMin = parseInt(durationMin, 10);
        tb.tbm.durationMax = parseInt(durationMax, 10);
        tb.tbm.includeNoDuration = includeNoDuration;

        // Call fetchTasks with updated filters
        tb.tbm.fetchTasks();
    }

    // Reset Task Count section
    resetTaskCount() {
        document.getElementById('taskCountSlider').value = 300; // Default value
        document.getElementById('taskCountInput').value = 300;
    }

    // Reset Date Range section
    resetDateRange() {
        let tb = this;

        const startDateInput = document.getElementById('startDate');
        const endDateInput = document.getElementById('endDate');
        const dateRangeSelect = document.getElementById('dateRangeSelect');

        startDateInput.value = tb.tbm.oldestDate;
        endDateInput.value = tb.tbm.newestDate;
        dateRangeSelect.value = 'any'; // Reset dropdown to default
        startDateInput.disabled = true; // Lock date inputs
        endDateInput.disabled = true;
    }

    // Reset Soaring Type section
    resetSoaringType() {
        document.getElementById('soaringRidge').checked = true;
        document.getElementById('soaringThermals').checked = true;
        document.getElementById('soaringWaves').checked = true;
        document.getElementById('soaringDynamic').checked = true;
        document.getElementById('soaringTypeFilter').value = 'any'; // Reset filter type to default
    }

    // Reset Task Duration section
    resetDuration() {
        document.getElementById('durationMin').value = ""; // or a specific default value
        document.getElementById('durationMax').value = ""; // or a specific default value
        document.getElementById('includeNoDuration').checked = true; // Check "Include no duration" by default
    }

    sortTasksGrid(columnName, direction) {
        $('#taskGridTable').DataTable().column(`${columnName}:name`).order(direction).draw();
    }

    initCountryCodes() {
        let tb = this;
        fetch('https://flagcdn.com/en/codes.json')
            .then(response => response.json())
            .then(data => {
                tb.countryCodes = data;
            })
            .catch(error => {
                console.error('Error fetching country codes:', error);
            });
    }

    getParameterByName(name, url = window.location.href) {
        name = name.replace(/[\[\]]/g, '\\$&');
        const regex = new RegExp(`[?&]${name}(=([^&#]*)|&|#|$)`);
        const results = regex.exec(url);
        if (!results) return null;
        if (!results[2]) return '';
        return decodeURIComponent(results[2].replace(/\+/g, ' '));
    }

    // Function to clear a specific parameter from the URL
    clearUrlParameter(param) {
        //const url = new URL(window.location);
        //url.searchParams.delete(param);
        //window.history.replaceState({}, document.title, url.toString());
    }

    copyTextToClipboard(text) {
        let tb = this;
        tb.shouldHandlePopState = false; // Disable popstate handling
        if (navigator.clipboard) {
            navigator.clipboard.writeText(text).then(() => {
                alert("Link copied to your clipboard!");
            }).catch(err => {
                console.error('Failed to copy text: ', err);
            });
        } else {
            // Fallback for older browsers
            const textArea = document.createElement('textarea');
            textArea.value = text;
            document.body.appendChild(textArea);
            textArea.focus();
            textArea.select();
            try {
                document.execCommand('copy');
                alert("Link copied to your clipboard!");
            } catch (err) {
                console.error('Failed to copy text: ', err);
            }
            document.body.removeChild(textArea);
        }
        //tb.shouldHandlePopState = true; // Re-enable popstate handling
    }

    resizeMap() {
        let tb = this;
        try {
            if (tb.tbm && tb.tbm.map && document.getElementById('mapTab').classList.contains('active')) {
                tb.tbm.map.invalidateSize();
            }
        } catch (err) {
            console.error('Failed to copy text: ', err);
        }
    }

    switchTab(tabId) {
        const tb = this;

        // Load content if it hasn't been loaded yet
        const tabContent = document.getElementById(tabId);
        if (!tabContent.innerHTML) {
            loadTabContent(tabId); // Assuming loadTabContent is defined in task_browser.js

            if (tabId === 'eventsTab') {
                displayEventsStaticPortion(); // Add static events info
                fetchAndDisplayEvents(); // Load dynamic events content

                // Add refresh button functionality
                const refreshButton = document.getElementById('refreshButton');
                refreshButton.addEventListener('click', () => {
                    document.getElementById('eventsList').innerHTML = ''; // Clear events list
                    fetchAndDisplayEvents(); // Reload events
                });
            }
        }

        // Switch active tab content
        const tabs = document.getElementsByClassName('tabContent');
        for (let tab of tabs) {
            tab.classList.remove('active');
            tab.style.display = 'none';
        }
        tabContent.classList.add('active');
        if (tabId === 'mapTab') {
            tabContent.style.display = 'flex'; // Use 'flex' for mapTab to keep its internal layout
        } else {
            tabContent.style.display = 'block';
        }

        // Update active tab button
        const buttons = document.getElementsByClassName('tabButton');
        for (let button of buttons) {
            button.classList.remove('active');
        }
        document.querySelector(`button[data-tab="${tabId}"]`).classList.add('active');

        // Resize the map if we're on the map tab
        if (tabId === 'mapTab' && typeof tb.resizeMap === 'function') {
            tb.resizeMap();
        }

        // Update the URL to reflect the current tab
        const url = new URL(window.location);
        url.searchParams.set('tab', tabId.replace('Tab', ''));

        // Handle task or event parameters based on the active tab
        if (tabId === 'mapTab') {
            const taskParam = url.searchParams.get('task');
            if (taskParam) {
                url.searchParams.set('task', taskParam);
            } else {
                url.searchParams.delete('task');
            }
            url.searchParams.delete('event');
        } else if (tabId === 'eventsTab') {
            const eventParam = url.searchParams.get('event');
            if (eventParam) {
                url.searchParams.set('event', eventParam);
            } else {
                url.searchParams.delete('event');
            }
            url.searchParams.delete('task');
        } else {
            url.searchParams.delete('task');
        }

        // Update the page title based on the active tab
        switch (tabId) {
            case 'homeTab':
                document.title = "WeSimGlide - Home";
                break;
            case 'eventsTab':
                document.title = "WeSimGlide - Events";
                break;
            case 'mapTab':
                document.title = "WeSimGlide - World Map";
                break;
            case 'toolsTab':
                document.title = "WeSimGlide - Tools";
                break;
            case 'settingsTab':
                document.title = "WeSimGlide - Settings";
                break;
            case 'accountTab':
                document.title = "WeSimGlide - Account";
                break;
            case 'aboutTab':
                document.title = "WeSimGlide - About";
                break;
            default:
                document.title = "WeSimGlide";
                break;
        }

        // Push the updated URL to the browser history
        window.history.pushState({}, '', url);
    }

    addCountryFlags(countries) {
        let tb = this;
        const baseUrl = 'https://flagcdn.com/h24/';
        return countries.split(',').map(country => {
            const countryName = country.trim();
            const mappedCountryName = tb.countryNameMapping[countryName] || countryName;
            const code = Object.keys(tb.countryCodes).find(key => tb.countryCodes[key].toLowerCase() === mappedCountryName.toLowerCase());
            return code ? `<img src="${baseUrl}${code}.webp" alt="${countryName}" title="${countryName}" style="margin-right: 5px;">` : countryName;
        }).join(' ');
    }

    replaceLineBreaks(text) {
        return text.replace(/\(\$\*\$\)/g, '($%$)');
    }

    removeSpacesBeforeClosingAsterisks(text) {
        const removeSpaces = (text, delimiter) => {
            const parts = text.split(delimiter);
            for (let i = 1; i < parts.length; i += 2) {
                parts[i] = parts[i].trimEnd();
            }
            return parts.join(delimiter);
        };

        text = removeSpaces(text, '**');
        text = removeSpaces(text, '__');
        text = removeSpaces(text, '*');
        text = removeSpaces(text, '_');

        return text;
    }

    restoreLineBreaks(text) {
        return text.replace(/\(\$%\$\)/g, '\n');
    }

    convertToMarkdown(text, removeParagraphTag = false) {
        let tb = this;

        // Function to add target="_blank" to all href links
        function addTargetBlank(html) {
            return html.replace(/<a /g, '<a target="_blank" ');
        }

        // Function to replace http:// or https:// with discord:// for Discord links
        function convertDiscordLinks(html) {
            return html.replace(/href="https?:\/\/discord\.com/g, 'href="discord://discord.com');
        }

        text = tb.replaceLineBreaks(text);
        text = tb.removeSpacesBeforeClosingAsterisks(text);
        text = tb.restoreLineBreaks(text);

        let renderedMarkdown = tb.md.render(text);

        // Optionally remove <p> tags
        if (removeParagraphTag) {
            renderedMarkdown = renderedMarkdown.replace(/^<p>/, '').replace(/<\/p>\s*$/, '');
        }

        renderedMarkdown = addTargetBlank(renderedMarkdown);
        return convertDiscordLinks(renderedMarkdown);
    }

    addDetailLineWithoutBreak(label, value) {
        return value ? `${label} ${value}` : '';
    }

    addDetailLineWithBreak(label, value) {
        return value ? `${label} ${value} <br>` : '';
    }

    addDetailWithinBrackets(value) {
        return value ? `(${value})` : '';
    }

    formatDuration(min, max) {
        const formatTime = (time) => {
            const hours = Math.floor(time / 60);
            const minutes = time % 60;
            return `${hours}h${minutes > 0 ? minutes : ''}`;
        };

        if (min > 0 && max > 0) {
            return `${min} to ${max} minutes (${formatTime(min)} to ${formatTime(max)})`;
        } else if (min > 0) {
            return `Around ${min} minutes (${formatTime(min)})`;
        } else if (max > 0) {
            return `Around ${max} minutes (${formatTime(max)})`;
        } else {
            return 'Not specified';
        }
    }

    formatSimDateTime(simDateTime, includeYear, appendLocalInMSFS = true, convertToLocal = false, replaceAt = false, abbreviateMonth = false) {
        const timeFormat = this.userSettings.timeFormat || 'usa';
        // Use "short" for abbreviated months, "long" otherwise.
        const monthFormat = abbreviateMonth ? 'short' : 'long';
        const options = includeYear
            ? { year: 'numeric', month: monthFormat, day: 'numeric', hour: 'numeric', minute: 'numeric', hour12: timeFormat === 'usa' }
            : { month: monthFormat, day: 'numeric', hour: 'numeric', minute: 'numeric', hour12: timeFormat === 'usa' };

        let date = new Date(simDateTime);
        if (convertToLocal) {
            date = new Date(date.getTime() - (date.getTimezoneOffset() * 60000)); // Convert to local time
        }

        let formattedDate = new Intl.DateTimeFormat('en-US', options).format(date);
        if (replaceAt) {
            formattedDate = formattedDate.replace(' at ', ' ');
        }

        return appendLocalInMSFS ? formattedDate + ' local in MSFS' : formattedDate;
    }

    formatDifficultyRating(difficultyRating, difficultyExtraInfo) {
        if (difficultyRating === "0. None / Custom") {
            return difficultyExtraInfo ? difficultyExtraInfo : 'Unknown - Judge by yourself!';
        } else {
            const ratingStars = '★'.repeat(parseInt(difficultyRating)) + '☆'.repeat(5 - parseInt(difficultyRating));
            const ratingLabels = [
                'Beginner',
                'Student',
                'Experienced',
                'Professional',
                'Champion'
            ];
            const ratingText = `${ratingStars} - ${ratingLabels[parseInt(difficultyRating) - 1]}`;
            return difficultyExtraInfo ? `${ratingText} (${difficultyExtraInfo})` : ratingText;
        }
    }

    generateTaskDetailsMainSection(task) {
        let tb = this;

        // Format the last update date/time and description if present
        let lastUpdateInfo = "";
        const lastUpdateFormatted = tb.formatSimDateTime(task.LastUpdate, true, false, true);
        const lastUpdateDescription = task.LastUpdateDescription ? ` (${task.LastUpdateDescription})` : "";
        lastUpdateInfo = `Last update: ${lastUpdateFormatted}${lastUpdateDescription}`;

        // Get user settings for distance
        const distanceUnit = tb.userSettings.distance || 'imperial';
        let taskDistance = task.TaskDistance;
        let totalDistance = task.TotalDistance;
        let distanceUnitLabel = 'km';

        if (distanceUnit === 'imperial') {
            taskDistance = (task.TaskDistance * 0.621371).toFixed(0); // Convert km to miles
            totalDistance = (task.TotalDistance * 0.621371).toFixed(0); // Convert km to miles
            distanceUnitLabel = 'miles';
        }

        // If igcMatchData is present (non-empty), prepend it.
        let igcContent = "";
        if (tb.igcMatchData && tb.igcMatchData.trim() !== "") {
            igcContent = tb.igcMatchData;
        }

        // Create the task details HTML
        let taskDetailsHtml = `
            <div class="task-details markdown-content">
                ${igcContent}
                <div class="task-header">
                    <span class="task-number">#${task.EntrySeqID}</span>
                    <span class="task-flags">${this.addCountryFlags(task.Countries)}</span>
                </div>
                <h1>${task.Title}</h1>
                ${tb.addDetailLineWithoutBreak('', tb.convertToMarkdown(task.ShortDescription))}
                ${tb.addDetailLineWithBreak('🗺', task.MainAreaPOI)}
                🛫 ${task.DepartureICAO} ${task.DepartureName} ${task.DepartureExtra}<br>
                🛬 ${task.ArrivalICAO} ${task.ArrivalName} ${this.addDetailWithinBrackets(task.ArrivalExtra)}<br>
                ⌚ ${tb.formatSimDateTime(task.SimDateTime, task.IncludeYear)} ${tb.addDetailWithinBrackets(task.SimDateTimeExtraInfo)}<br>
                ↗️ ${task.SoaringRidge ? 'Ridge' : ''}${task.SoaringThermals ? ' Thermals' : ''}${task.SoaringWaves ? ' Waves' : ''}${task.SoaringDynamic ? ' Dynamic' : ''} ${tb.addDetailWithinBrackets(task.SoaringExtraInfo)}<br>
                ${task.WeatherSummary ? `⛅ ${task.WeatherSummary}<br>` : ''}
                📏 ${taskDistance} ${distanceUnitLabel} task (${totalDistance} ${distanceUnitLabel} total)<br>
                ⏳ ${tb.formatDuration(task.DurationMin, task.DurationMax)} ${tb.addDetailWithinBrackets(task.DurationExtraInfo)}<br>
                `;

        // Check and add AAT minimum time if available
        if (tb.tbm.b21_task && tb.tbm.b21_task.aat_min_time_s) {
            const aatMinTime = tb.tbm.b21_task.aat_min_time_s;
            const hours = Math.floor(aatMinTime / 3600);
            const minutes = Math.floor((aatMinTime % 3600) / 60);
            const formattedAatMinTime = `⚠️ AAT with a minimum duration of ${hours} hour${hours !== 1 ? 's' : ''} ${minutes} minute${minutes !== 1 ? 's' : ''}`;
            taskDetailsHtml += `${formattedAatMinTime}<br>`;
        }

        taskDetailsHtml += `
                ✈️ ${task.RecommendedGliders}<br>
                🎚 ${tb.formatDifficultyRating(task.DifficultyRating, task.DifficultyExtraInfo)}
                <p>${task.Credits}</p>
                ${task.RepostText ? tb.addDetailLineWithoutBreak('', tb.convertToMarkdown(task.RepostText)) : ''}
                <p>${lastUpdateInfo}</p>
            </div>`;

        return taskDetailsHtml;
    }

    generateTaskDetailsFullDescription(task) {
        let tb = this;
        // Collapsible Full Description
        if (task.LongDescription) {
            tb.generateCollapsibleSection("📖 Full Description", tb.convertToMarkdown(task.LongDescription), taskDetailContainer);
        }
    }

    generateTaskDetailsFiles(task) {
        let tb = this;

        // Collapsible Files
        let filesContent = `
            <p><strong>Option 1:</strong> Download the single package DPHX file for use with the <a href="https://flightsim.to/file/62573/msfs-soaring-task-tools-dphx-unpack-load" target="_blank">DPHX Unpack & Load tool</a></p>
            <p>
                <a href="#" onclick="TB.downloadDPHXFile('${task.TaskID}', ${task.EntrySeqID}, '${task.Title}')">
                    <img src="images/DPHXFile.png" alt="DPHX File" class="file-icon" style="width: 40px; height: 40px;">
                    ${task.Title}.dphx
                </a>
            </p>
            <p><strong>Option 2:</strong> Download individual files and install them yourself</p>
            <p>
                <a href="#" onclick="TB.downloadPLNFile()">
                    <img src="images/PLNFile.png" alt="PLN File" class="file-icon">
                    Flight plan file (PLN): ${tb.getFileNameFromPath(tb.currentTask.PLNFilename)}
                </a>
            </p>
            <p>
                <a href="#" onclick="TB.downloadWPRFile()">
                    <img src="images/WPRFile.png" alt="WPR File" class="file-icon">
                    Weather file (WPR): ${tb.getFileNameFromPath(tb.currentTask.WPRFilename)}
                </a>
            </p>
            <p>
                <a href="#" onclick="TB.openTaskInPlanner();">
                    Open these files on B21 Task Planner Online
                </a>
            </p>
            <p><strong>Option 3:</strong> Download all files (including extras) as ZIP file</strong></p>
            <p>
                <a href="#" onclick="TB.downloadZIPFile('${task.TaskID}', ${task.EntrySeqID}, '${task.Title}')">
                    <img src="images/ZIPFile.png" alt="ZIP File" class="file-icon">
                    ${task.Title}.zip
                </a>
            </p>
            <p>Current downloads (PLN or DPHX): ${task.TotDownloads}</p>`;

        tb.generateCollapsibleSection("📁 Files", filesContent, taskDetailContainer);
    }

    generateTaskDetailsExtraFiles(task) {
        let tb = this;

        // Parse ExtraFilesList JSON
        let extraFiles = [];
        try {
            extraFiles = JSON.parse(task.ExtraFilesList);
        } catch (error) {
            console.error("Invalid JSON in ExtraFilesList:", error);
            return; // Do not generate the section if JSON is invalid
        }

        // If no extra files are present, do not generate the section
        if (!Array.isArray(extraFiles) || extraFiles.length === 0) {
            return;
        }

        // Build the content for the Extra Files section
        let extraFilesContent = "<ul>";
        extraFiles.forEach((file) => {
            extraFilesContent += `
        <li>
            <a href="#" onclick="TB.downloadExtraFile('${file}')">
                ${file}
            </a>
        </li>`;
        });
        extraFilesContent += "</ul>";

        // Create the collapsible section
        tb.generateCollapsibleSection("🗄️ Extra Files", extraFilesContent, taskDetailContainer);
    }

    generateTaskDetailsRestriction(task) {
        let tb = this;
        // Get user settings for altitude
        const altitudeUnit = tb.userSettings.altitude || 'imperial';
        let restrictionsContent = '<ul>';
        tb.tbm.b21_task.waypoints.forEach((wp, index) => {
            const name = wp.name || `Waypoint ${index + 1}`;
            let restriction = '';

            const minAlt = wp.min_alt_m;
            const maxAlt = wp.max_alt_m;

            if (altitudeUnit === 'imperial') {
                if (maxAlt) {
                    restriction += `${name}: MAX ${Math.round(maxAlt * 3.28084)}'`;
                }
                if (minAlt) {
                    restriction += `${name}: MIN ${Math.round(minAlt * 3.28084)}'`;
                }
                if (maxAlt && minAlt) {
                    restriction = `${name}: Between ${Math.round(minAlt * 3.28084)}' and ${Math.round(maxAlt * 3.28084)}'`;
                }
            } else {
                if (maxAlt) {
                    restriction += `${name}: MAX ${Math.round(maxAlt)} m`;
                }
                if (minAlt) {
                    restriction += `${name}: MIN ${Math.round(minAlt)} m`;
                }
                if (maxAlt && minAlt) {
                    restriction = `${name}: Between ${Math.round(minAlt)} m and ${Math.round(maxAlt)} m`;
                }
            }

            if (restriction) {
                restrictionsContent += `<li>${restriction}</li>`;
            }
        });
        restrictionsContent += '</ul>';

        // Only generate the section if there are restrictions
        if (restrictionsContent !== '<ul></ul>') {
            tb.generateCollapsibleSection("⚠️ Altitude Restrictions", restrictionsContent, taskDetailContainer);
        }
    }

    generateTaskDetailsWeather(task) {
        let tb = this;
        const userSettings = tb.loadUserSettings(); // Load user settings for unit preferences

        // Collapsible Weather Section
        let elevMeasurement = tb.wsg_weather.isAltitudeAMGL ? "AMGL - Ground" : "AMSL - Sea";

        // MSL Pressure conversion
        let mslPressure = tb.wsg_weather.mslPressure;
        if (userSettings.pressure === 'inHg') {
            mslPressure = (mslPressure / 3386.39).toFixed(2) + ' inHg'; // Convert Pa to inHg
        } else {
            mslPressure = (mslPressure / 100).toFixed(2) + ' hPa'; // Convert Pa to hPa
        }
        // Check for non-standard value
        if (parseFloat(mslPressure) !== 29.92) {
            if (task.SuppressBaroPressureWarningSymbol === 0) { // Add warning sign if suppression is not active
                mslPressure += ' ⚠️';
            }
            // Handle BaroPressureExtraInfo cases
            if (task.BaroPressureExtraInfo !== null && task.BaroPressureExtraInfo !== "") {
                mslPressure += ` (${task.BaroPressureExtraInfo})`;
            } else if (task.BaroPressureExtraInfo === null) {
                mslPressure += ` (Non standard: Set your altimeter!)`;
            }
        }
        // MSL Temperature conversion
        let mslTemperature = tb.wsg_weather.mslTemperature;
        if (userSettings.temperature === 'fahrenheit') {
            mslTemperature = ((mslTemperature - 273.15) * 9 / 5 + 32).toFixed(1) + ' °F'; // Convert Kelvin to Fahrenheit
        } else {
            mslTemperature = (mslTemperature - 273.15).toFixed(1) + ' °C'; // Convert Kelvin to Celsius
        }

        let aerosolIndex = tb.wsg_weather.aerosolDensity;

        // Precipitations
        let precipitations = tb.wsg_weather.precipitations;
        if (precipitations > 0) {
            if (userSettings.temperature === 'fahrenheit') {
                precipitations = (precipitations / 25.4).toFixed(2) + ' inch/h'; // Convert mm/h to inch/h
            } else {
                precipitations = precipitations + ' mm/h'; // Keep mm/h
            }
        } else {
            precipitations = null; // Don't display if 0
        }

        // Snow Cover
        let snowCover = tb.wsg_weather.snowCover;
        if (snowCover > 0) {
            if (userSettings.temperature === 'fahrenheit') {
                snowCover = (snowCover * 39.3701).toFixed(2) + ' inches'; // Convert meters to inches
            } else {
                snowCover = (snowCover * 100).toFixed(2) + ' cm'; // Convert meters to cm
            }
        } else {
            snowCover = null; // Don't display if 0
        }

        // Thunderstorm Intensity
        let thunderstormIntensity = tb.wsg_weather.thunderstormIntensity;
        if (thunderstormIntensity > 0) {
            thunderstormIntensity = (thunderstormIntensity * 100).toFixed(1) + ' %'; // Convert to percentage
        } else {
            thunderstormIntensity = null; // Don't display if 0
        }

        // Generate weather content HTML
        let weatherContent = `
            <ul>
                <li>Name: ${tb.wsg_weather.name}</li>
                ${task.WeatherSummary ? `<li>Summary: ${task.WeatherSummary}</li>` : ''}
                <li>Altitudes: ${elevMeasurement}</li>
                <li>MSL Pressure: ${mslPressure}</li>
                <li>MSL Temp.: ${mslTemperature}</li>
                <li>Aerosol: ${aerosolIndex}</li>
                ${precipitations ? `<li>Precipitations: ${precipitations}</li>` : ''}
                ${snowCover ? `<li>Snow Cover: ${snowCover}</li>` : ''}
                ${thunderstormIntensity ? `<li>Lightning: ${thunderstormIntensity}</li>` : ''}
            </ul>
            <img src="${tb.discordPostHelperTaskBrowserPath}WeatherCharts/${task.EntrySeqID}.jpg" class="weather-image" onclick="TB.showImageModal(this.src)" />
        `;

        tb.generateCollapsibleSection("🌥 Weather & Chart", weatherContent, taskDetailContainer);
    }

    generateTaskDetailsWinds(task) {
        let tb = this;
        const userSettings = tb.loadUserSettings(); // Load user settings for unit preferences

        // Sort wind layers by altitude in descending order
        let sortedWindLayers = tb.wsg_weather.windLayers.slice().sort((a, b) => parseFloat(b.altitude) - parseFloat(a.altitude));

        // Create the winds content
        let windsContent = '';

        sortedWindLayers.forEach((layer, index) => {
            // Ensure altitude, speed, and direction are numbers
            let altitude = parseFloat(layer.altitude);
            let windSpeed = parseFloat(layer.speed);
            let windDirection = parseFloat(layer.angle);

            // Convert altitude based on user settings
            if (userSettings.altitude === 'imperial') {
                altitude = (altitude * 3.28084).toFixed(0) + "'"; // Convert meters to feet
            } else {
                altitude = altitude.toFixed(0) + " m"; // Keep meters
            }

            // Convert wind speed based on user settings
            if (userSettings.windSpeed === 'knots') {
                windSpeed = windSpeed.toFixed(0) + ' kts'; // Keep knots
            } else {
                windSpeed = (windSpeed * 0.514444).toFixed(1) + ' m/s'; // Convert knots to meters per second
            }

            windDirection = windDirection.toFixed(0) + '°';

            // Format wind layer details
            let windDetails = `${altitude} ${windDirection} @ ${windSpeed}`;

            // Wrap the details in a div and conditionally add a horizontal line
            windsContent += `
                <div class="wind-layer-item" data-index="${index}" style="margin: 0; padding: 5px; cursor: pointer;">
                    <div>${windDetails}</div>
                </div>
                ${index < sortedWindLayers.length - 1 ? '<hr style="margin: 5px 0;">' : ''}
            `;
        });

        let elevMeasurement = tb.wsg_weather.isAltitudeAMGL ? "AMGL" : "AMSL";

        tb.generateCollapsibleSection("🌬️ Winds " + elevMeasurement, windsContent, taskDetailContainer);

        tb.selectWindLayerInList(sortedWindLayers.length - 1, sortedWindLayers);

        // Add click event listeners to each wind layer item
        document.querySelectorAll('.wind-layer-item').forEach(item => {
            item.addEventListener('click', function () {
                const index = this.getAttribute('data-index');
                tb.selectWindLayerInList(index, sortedWindLayers);
            });
        });
    }

    selectWindLayerInList(index, sortedWindLayers) {
        let tb = this;
        // Remove 'selected' class from all wind layer items
        document.querySelectorAll('.wind-layer-item').forEach(item => item.classList.remove('selected'));

        // Add 'selected' class to the clicked wind layer item
        const selectedItem = document.querySelector(`.wind-layer-item[data-index="${index}"]`);
        if (selectedItem) {
            selectedItem.classList.add('selected');
            selectedItem.scrollIntoView({ behavior: 'smooth', block: 'center' });

            const windLayer = sortedWindLayers[index];
            let altitude = parseFloat(windLayer.altitude);
            let elevMeasurement = tb.wsg_weather.isAltitudeAMGL ? "AG" : "AS";
            // Convert altitude based on user settings
            if (tb.userSettings.altitude === 'imperial') {
                altitude = (altitude * 3.28084).toFixed(0) + "' " + elevMeasurement; // Convert meters to feet
            } else {
                altitude = altitude.toFixed(0) + " m " + elevMeasurement; // Keep meters
            }
            let windSpeed = parseFloat(windLayer.speed);
            // Convert wind speed based on user settings
            if (tb.userSettings.windSpeed === 'knots') {
                windSpeed = windSpeed.toFixed(0) + ' kts'; // Keep knots
            } else {
                windSpeed = (windSpeed * 0.514444).toFixed(1) + ' m/s'; // Convert knots to meters per second
            }
            tb.tbm.setWindDirection(parseFloat(windLayer.angle), windSpeed, altitude);
        }
    }

    generateTaskDetailsClouds(task) {
        let tb = this;
        const userSettings = tb.loadUserSettings(); // Load user settings for unit preferences

        // Sort cloud layers by bottom altitude in descending order
        let sortedCloudLayers = tb.wsg_weather.cloudLayers.slice().sort((a, b) => parseFloat(b.altitudeBot) - parseFloat(a.altitudeBot));

        // Collapsible Clouds Section
        let cloudsContent = ``;

        sortedCloudLayers.forEach((layer, index) => {
            // Ensure all fields are numbers
            let botAltitude = parseFloat(layer.altitudeBot);
            let topAltitude = parseFloat(layer.altitudeTop);
            let density = parseFloat(layer.density).toFixed(1);
            let coverage = (parseFloat(layer.coverage) * 100).toFixed(0);
            let scattering = (parseFloat(layer.scattering) * 100).toFixed(0);;

            // Convert altitude based on user settings
            if (userSettings.altitude === 'imperial') {
                botAltitude = (botAltitude * 3.28084).toFixed(0) + "'"; // Convert meters to feet
                topAltitude = (topAltitude * 3.28084).toFixed(0) + "'"; // Convert meters to feet
            } else {
                botAltitude = botAltitude.toFixed(0) + " m"; // Keep meters
                topAltitude = topAltitude.toFixed(0) + " m"; // Keep meters
            }

            // Format cloud layer details
            // From 5940' to 18883', 30% coverage, 0.997 density, 60% scattering
            let cloudDetails = `From ${botAltitude} to ${topAltitude}<br>Cov. ${coverage}% Dens. ${density} Scat. ${scattering}%`;

            // Wrap the details in a div and conditionally add a horizontal line
            cloudsContent += `
                <div class="cloud-layer-item" data-index="${index}" style="margin: 0; padding: 5px; cursor: pointer;">
                    <div>${cloudDetails}</div>
                </div>
                ${index < tb.wsg_weather.cloudLayers.length - 1 ? '<hr style="margin: 5px 0;">' : ''}
            `;
        });

        let elevMeasurement = tb.wsg_weather.isAltitudeAMGL ? "AMGL" : "AMSL";

        tb.generateCollapsibleSection("☁️ Clouds " + elevMeasurement, cloudsContent, taskDetailContainer);

        // Add click event listeners to each cloud layer item
        document.querySelectorAll('.cloud-layer-item').forEach(item => {
            item.addEventListener('click', function () {
                const index = this.getAttribute('data-index');
                tb.selectCloudLayerInList(index);
            });
        });

    }

    selectCloudLayerInList(index) {
        let tb = this;
        // Remove 'selected' class from all wind layer items
        document.querySelectorAll('.cloud-layer-item').forEach(item => item.classList.remove('selected'));

        // Add 'selected' class to the clicked wind layer item
        const selectedItem = document.querySelector(`.cloud-layer-item[data-index="${index}"]`);
        if (selectedItem) {
            selectedItem.classList.add('selected');
            selectedItem.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    }

    generateTaskDetailsWaypoints(task) {
        let tb = this;

        // Create the waypoints content
        let waypointsContent = '';

        tb.tbm.b21_task.waypoints.forEach((wp) => {
            let firstLine = wp.getFirstLine();
            let secondLine = wp.getSecondLine();
            let thirdLine = wp.getThirdLine();

            // Wrap the lines in a div and conditionally add a horizontal line
            waypointsContent += `
                <div class="waypoint-item" data-index="${wp.index}" style="margin: 0; padding: 5px; cursor: pointer;">
                    <div>${firstLine}</div>
                    <div>${secondLine}</div>
                    <div>${thirdLine}</div>
                </div>
                ${wp.index < tb.tbm.b21_task.waypoints.length - 1 ? '<hr style="margin: 5px 0;">' : ''}
            `;
        });

        tb.generateCollapsibleSection("🗺️ Waypoints", waypointsContent, taskDetailContainer);
        tb.selectWaypointInList(0);

        document.querySelectorAll('.waypoint-item').forEach(item => {
            item.addEventListener('click', function () {
                const index = this.getAttribute('data-index');
                const waypoint = tb.tbm.b21_task.waypoints[index];
                if (waypoint && waypoint.position) {
                    waypoint.wp_click(waypoint);
                } else {
                    console.warn(`Waypoint ${index} does not have a valid position.`);
                }
            });
        });
    }

    selectWaypointInList(index) {
        let tb = this;
        // Remove 'selected' class from all waypoint items
        document.querySelectorAll('.waypoint-item').forEach(item => item.classList.remove('selected'));

        // Add 'selected' class to the clicked waypoint item
        const selectedItem = document.querySelector(`.waypoint-item[data-index="${index}"]`);
        if (selectedItem) {
            selectedItem.classList.add('selected');
            selectedItem.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    }

    selectWaypointOnMap(index) {
        let tb = this;
        let waypoint = tb.tbm.b21_task.waypoints[index];
        if (waypoint) {
            tb.tbm.b21_task.set_current_wp(index);
        }
    }

    generateTaskDetailsRecommendedAddOns(task) {
        let tb = this;

        // Check if RecommendedAddOnsList is not empty
        if (task.RecommendedAddOnsList) {
            let addOns;

            try {
                // Parse the JSON structure
                addOns = JSON.parse(task.RecommendedAddOnsList);
            } catch (error) {
                console.error("Invalid JSON in RecommendedAddOnsList:", error);
                return; // Do not generate the section if JSON is invalid
            }

            // If there are no add-ons, do not generate the section
            if (!Array.isArray(addOns) || addOns.length === 0) {
                return;
            }

            // Build content for the recommended add-ons
            let content = "";
            for (let addOn of addOns) {
                // Ensure each add-on has the required fields
                if (addOn.Name && addOn.URL) {
                    // Determine the emoji based on the add-on type
                    const typeEmoji = addOn.Type === 0 || addOn.Type === "0" || addOn.Type === "Freeware" ? "🆓" : "💵";

                    // Add a list item for the add-on
                    content += `<li><a href="${addOn.URL}" target="_blank" rel="noopener noreferrer">${addOn.Name}</a> ${typeEmoji}</li>`;
                }
            }

            // If no valid add-ons were added, exit
            if (content === "") return;

            // Create the collapsible section
            tb.generateCollapsibleSection(
                "📀 Recommended Add-ons",
                `<ul>${content}</ul>`,
                taskDetailContainer
            );
        }
    }

    generateTaskDetailsIGCRecords(task) {
        let tb = this;
        if (!task.IGCRecords || task.IGCRecords.length === 0) return;

        // Build the HTML for the collapsible section
        // including an empty <tbody> for #igcRecordsTable
        let igcContent = `
            <table id="igcRecordsTable" class="display igcRecordsTable" style="width: 100%;">
                <thead>
                    <tr>
                        <th>Sel.</th>
                        <th>Created on</th>
                        <th>Pilot</th>
                        <th>Glider</th>
                        <th>Class</th>
                        <th>Sim</th>
                    </tr>
                </thead>
                <tbody></tbody>
            </table>
        `;

        // Insert as a collapsible section
        const container = document.getElementById("taskDetailContainer");
        tb.generateCollapsibleSection("📑 IGC Records", igcContent, container);

        // Now that the HTML is in the DOM, call the population function
        tb.populateIGCRecordsTable(task.IGCRecords);
    }

    populateIGCRecordsTable(igcRecords) {
        const tableId = '#igcRecordsTable';
        let tb = this;

        // If the DataTable is already initialized, just reload the data
        if ($.fn.DataTable.isDataTable(tableId)) {
            const dt = $(tableId).DataTable();
            dt.clear();
            dt.rows.add(igcRecords);
            dt.draw();
        } else {
            // Initialize DataTable if it doesn't exist
            const dt = $('#igcRecordsTable').DataTable({
                data: igcRecords,
                autoWidth: false,
                order: [[1, 'desc']],  // Order by the UTC column (index 1) descending
                columns: [
                    {
                        data: null,
                        name: 'Select',
                        orderable: false,
                        searchable: false,
                        render: function (data, type, row) {
                            return `<input type="checkbox" class="igc-select-checkbox" data-key="${row.IGCKey}">`;
                        }
                    },
                    {
                        data: 'IGCRecordDateTimeUTC',
                        title: 'Created on',
                        name: 'IGCRecordDateTimeUTC',
                        render: function (data, type, row, meta) {
                            if (type === 'display') {
                                // Format the date as before.
                                var formattedDate = TB.formatSimDateTime(data, true, false, true, true, true);
                                // Get the task EntrySeqID from the closure (assuming tb.currentTask is available).
                                var entrySeqID = tb.currentTask.EntrySeqID;
                                // Return a link that carries both EntrySeqID and IGCKey.
                                return `<a href="#" class="download-igc-link" data-entryseqid="${entrySeqID}" data-igckey="${row.IGCKey}">${formattedDate}</a>`;
                            }
                            return data;
                        }
                    },
                    { data: 'Pilot', title: 'Pilot', name: 'Pilot' },
                    { data: 'GliderType', title: 'Glider', name: 'GliderType' },
                    { data: 'CompetitionClass', title: 'Class', name: 'CompetitionClass' },
                    { data: 'Sim', title: 'Sim', name: 'Sim' }
                ],
                paging: false,
                searching: true,
                ordering: true,
                info: true,
                columnDefs: [
                    { targets: 0, width: '15px' }
                ],
                headerCallback: function (thead, data, start, end, display) {
                    $(thead).find('th').eq(0).html('<input type="checkbox" id="select-all">');
                },
                drawCallback: function (settings) {
                    // Bind "select all" functionality
                    $('#select-all').off('click').on('click', function () {
                        const checked = this.checked;
                        $('.igc-select-checkbox').prop('checked', checked);
                        $('.igc-select-checkbox').each(function () {
                            const igcKey = $(this).data('key');
                            tb.tbm.processIGCRecordDisplay(tb.currentTask.EntrySeqID, igcKey, checked);
                        });
                    });

                    // Bind individual checkbox change event
                    $('.igc-select-checkbox').off('change').on('change', function () {
                        const igcKey = $(this).data('key');
                        const isChecked = $(this).is(':checked');
                        tb.tbm.processIGCRecordDisplay(tb.currentTask.EntrySeqID, igcKey, isChecked);
                    });
                },
                initComplete: function () {
                    const tableWrapper = $(this.api().table().container());
                    const filterDiv = tableWrapper.find('div.dataTables_filter');
                    filterDiv.css({
                        display: 'flex',
                        'align-items': 'center',
                        'justify-content': 'flex-start',
                        'width': '100%'
                    });

                    const analyzeBtn = $('<button>')
                        .attr('id', 'analyzeIGCBtn')
                        .addClass('igc-button-style')
                        .css({
                            'margin-right': 'auto',
                            'margin-left': '0'
                        })
                        .text('Analyze Selected')
                        .on('click', function () {
                            const selectedKeys = [];
                            $('.igc-select-checkbox:checked').each(function () {
                                selectedKeys.push($(this).data('key'));
                            });
                            tb.sendSelectedIGCRecordsToTaskPlanner(selectedKeys);
                        });
                    filterDiv.prepend(analyzeBtn);

                    $('#igcRecordsTable tbody').on('click', '.download-igc-link', function (e) {
                        e.preventDefault();
                        // Retrieve the custom data attributes.
                        var entrySeqID = $(this).data('entryseqid');
                        var igcKey = $(this).data('igckey');
                        // Call the TaskBrowser's downloadIGCFile method.
                        tb.downloadIGCFile(entrySeqID, igcKey);
                    });

                    $('#igcRecordsTable tbody').on('mouseenter', 'tr', function () {
                        let rowData = dt.row(this).data();
                        if (rowData) {
                            let igcKey = rowData.IGCKey;
                            if (tb.tbm.igcTrackCache[igcKey] && tb.tbm.map.hasLayer(tb.tbm.igcTrackCache[igcKey])) {
                                tb.tbm.igcTrackCache[igcKey].setStyle({
                                    weight: tb.tbm.igcTrackHighlightedWeight,
                                    color: tb.tbm.igcTrackHighlightedColor
                                });
                                tb.tbm.igcTrackCache[igcKey].bringToFront();
                            }
                        }
                    });

                    $('#igcRecordsTable tbody').on('mouseleave', 'tr', function () {
                        let rowData = dt.row(this).data();
                        if (rowData) {
                            let igcKey = rowData.IGCKey;
                            if (tb.tbm.igcTrackCache[igcKey] && tb.tbm.map.hasLayer(tb.tbm.igcTrackCache[igcKey])) {
                                tb.tbm.igcTrackCache[igcKey].setStyle({
                                    weight: tb.tbm.igcTrackNormalWeight,
                                    color: tb.tbm.igcTrackNormalColor
                                });
                            }
                        }
                    });
                }
            });
        }
    }

    sendSelectedIGCRecordsToTaskPlanner(selectedKeys) {
        if (!selectedKeys || !selectedKeys.length) {
            alert("No IGC keys selected for submission.");
            return;
        }
        let tb = this;
        // Create a FormData object and append required fields.
        const formData = new FormData();
        formData.append('EntrySeqID', tb.currentTask.EntrySeqID);
        formData.append('TaskID', tb.currentTask.TaskID);
        formData.append('PLNFilename', tb.currentTask.PLNFilename);
        formData.append('WPRFilename', tb.currentTask.WPRFilename);
        // Append the IGC keys as a comma-separated string.
        formData.append('igcKeys', selectedKeys.join(','));

        // Call the PHP script that processes IGC keys and returns the planner URL.
        fetch('php/SendIGCToTaskPlanner.php', {
            method: 'POST',
            body: formData
        })
            .then(response => response.json())
            .then(result => {
                if (result.status === 'success' && result.plannerUrl) {
                    // Remove protocol if present.
                    let plannerUrl = result.plannerUrl.replace(/^https?:\/\//, '');
                    // Build the full URL for the planner.
                    const fullPlannerUrl = `https://${plannerUrl}`;
                    const newWindow = window.open('', '_blank');  // Open immediately on user click
                    newWindow.location.href = fullPlannerUrl;  // Navigate the pre-opened window
                } else {
                    alert("Error sending IGC keys for planner: " + (result.message || result.error || "Unknown error"));
                }
            })
            .catch(error => {
                console.error('Error:', error);
                alert("Error sending IGC keys for planner.");
            });
    }

    async generateTaskDetailsUserStuff(task) {
        let tb = this;

        // If user is not logged in, then exit.
        if (!tb.isUserConnected) return;

        // Prepare query parameters with the task's EntrySeqID.
        let params = new URLSearchParams({ entrySeqID: task.EntrySeqID });

        try {
            // Wait for the fetch response.
            let response = await fetch("php/FetchUserStuffForTask.php?" + params.toString(), { credentials: "include" });
            if (!response.ok) {
                throw new Error("Network response was not ok: " + response.statusText);
            }
            let data = await response.json();

            // Use an empty object if no userTask record exists.
            let ut = data.userTask || {};

            let content = "";

            // Add the new Markings section with three checkboxes.
            content += `<div class="user-markings">`;
            content += `<label>
            <input type="checkbox" id="flownCheckbox" ${ut.MarkedFlownDateUTC ? "checked" : ""} onchange="TB.handleMarkingChange('flown', this.checked)">
            Flown <span id="flownDate">${ut.MarkedFlownDateUTC ? tb.formatSimDateTime(ut.MarkedFlownDateUTC, true, false, true, true, true) : ""}</span>
        </label><br>`;
            content += `<label>
            <input type="checkbox" id="flyNextCheckbox" ${ut.MarkedFlyNextUTC ? "checked" : ""} onchange="TB.handleMarkingChange('flyNext', this.checked)">
            Fly Next <span id="flyNextDate">${ut.MarkedFlyNextUTC ? tb.formatSimDateTime(ut.MarkedFlyNextUTC, true, false, true, true, true) : ""}</span>
        </label><br>`;
            content += `<label>
            <input type="checkbox" id="favoritesCheckbox" ${ut.MarkedFavoritesUTC ? "checked" : ""} onchange="TB.handleMarkingChange('favorites', this.checked)">
            Favorites <span id="favoritesDate">${ut.MarkedFavoritesUTC ? tb.formatSimDateTime(ut.MarkedFavoritesUTC, true, false, true, true, true) : ""}</span>
        </label>`;
            content += `</div>`;

            // Display user task data (notes, tags, feedback) even if empty.
            content += `<p>Private notes: ${ut.PrivateNotes || ""}</p>`;
            content += `<p>Tags: ${ut.Tags || ""}</p>`;
            content += `<p>Public feedback: ${ut.PublicFeedback || ""}</p>`;

            // Process the IGCRecords.
            if (data.igcRecords && data.igcRecords.length > 0) {
                content += "<h3>Your IGC Records</h3>";
                content += "<ul>";
                data.igcRecords.forEach(record => {
                    content += `<li>${record.IGCRecordDateTimeUTC} - Pilot: ${record.Pilot || "N/A"}</li>`;
                });
                content += "</ul>";
            } else {
                content += "<p>No IGC records found for this task.</p>";
            }

            // Generate the collapsible section with the retrieved content.
            tb.generateCollapsibleSection(
                "My Stuff",
                content,
                taskDetailContainer,
                null, // id
                null, // highlightClass
                null, // resetCallback
                null, // countdownSection
                null, // backgroundImageUrl
                "images/user_account_connected.png" // iconImageUrl
            );
        } catch (error) {
            console.error("Error fetching user stuff:", error);
            tb.generateCollapsibleSection(
                "My Stuff",
                "<p>Error retrieving your user data.</p>",
                taskDetailContainer,
                null, // id
                null, // highlightClass
                null, // resetCallback
                null, // countdownSection
                null, // backgroundImageUrl
                "images/user_account_connected.png" // iconImageUrl
            );
        }
    }

    async showTaskDetailsStandalone(task) {
        let tb = this;
        const taskDetailContainer = document.getElementById("taskDetailContainer");
        tb.currentTask = task; // Save the current task for download use

        // Build the main section and prepend the matching details if they exist.
        taskDetailContainer.innerHTML = tb.generateTaskDetailsMainSection(task);

        // If opacity is 0, remove the background image entirely
        if (tb.userSettings.coverImageOpacity > 0) {
            document.documentElement.style.setProperty(
                "--task-cover-url",
                `url('${tb.discordPostHelperTaskBrowserPath}Covers/${task.EntrySeqID}.jpg')`
            );
        } else {
            document.documentElement.style.setProperty("--task-cover-url", "none");
        }

        // Set the opacity dynamically (0 to 1)
        document.documentElement.style.setProperty(
            "--task-cover-opacity",
            tb.userSettings.coverImageOpacity / 100 // Convert to decimal (e.g., 25 -> 0.25)
        );

        await tb.generateTaskDetailsUserStuff(task);
        tb.generateTaskDetailsFullDescription(task);
        tb.generateTaskDetailsFiles(task);
        tb.generateTaskDetailsExtraFiles(task);
        tb.generateTaskDetailsRestriction(task);
        tb.generateTaskDetailsWeather(task);
        tb.generateTaskDetailsWinds(task);
        tb.generateTaskDetailsClouds(task);
        tb.generateTaskDetailsWaypoints(task);
        tb.generateTaskDetailsRecommendedAddOns(task);
        tb.generateTaskDetailsIGCRecords(task);

        // Show the task control panel
        const taskControlPanel = document.getElementById('taskControlPanel');
        taskControlPanel.style.display = 'block';

        // Add event listener to the deselect button
        const deselectButton = document.getElementById('deselectTaskButton');
        deselectButton.onclick = function () {
            tb.tbm.deselectTask();
        };
        // Add event listener to the copy to clipboard button
        const copyButton = document.getElementById('copyTaskLinkToClipboard');
        copyButton.onclick = function () {
            tb.copyTextToClipboard(`${window.location.origin}/index.html?task=${task.EntrySeqID}`);
        };

        // Add event listener to the Discord task thread button
        const gotoDiscordThreadButton = document.getElementById('gotoDiscordThread');
        gotoDiscordThreadButton.onclick = function () {
            tb.incrementThreadAccess(task.EntrySeqID);
            window.open(`${tb.discordTasksChannel}${task.DiscordPostID}`, '_blank');
        };

        // Add event listener to the download DPHX file button
        const directDPHXDownloadButton = document.getElementById('directDPHXDownload');
        directDPHXDownloadButton.onclick = function () {
            tb.downloadDPHXFile(task.TaskID, task.EntrySeqID, task.Title);
        };

        // Add event listener to the send task to tracker button
        const sendTaskToTrackerButton = document.getElementById('sendTaskToTracker');
        sendTaskToTrackerButton.onclick = function () {
            tb.setSSCTracker("", task.EntrySeqID, `${tb.discordTasksChannel}${task.DiscordPostID}`);
        };

        // Add event listener to the toggle task details button
        const toggleTaskDetailsPanelButton = document.getElementById('toggleTaskDetailsPanel');
        toggleTaskDetailsPanelButton.onclick = function () {
            const taskDetailContainer = document.getElementById('taskDetailContainer');
            if (tb.TaskDetailsPanelVisible == false) {
                tb.TaskDetailsPanelVisible = true;
                tb.showTaskDetailsPanel();
            } else {
                tb.TaskDetailsPanelVisible = false;
                tb.hideTaskDetailsPanel();
            }
        };

        // Set up the button event listeners
        if (tb.igcMatchData && tb.igcMatchData !== "") {
            tb.disableMapInteractions();
            document.getElementById('submitIGCBtn').addEventListener('click', () => {
                tb.IGCUpload.submitIGCRecord();
            });
            document.getElementById('cancelIGCBtn').addEventListener('click', () => {
                // Clear the match data.
                tb.igcMatchData = "";
                tb.showTaskDetailsStandalone(task);
                tb.enableMapInteractions();
            });
        }

        if (tb.fromURL) {
            this.expandAllCollapsibleSections();
        }

    }

    enableMapInteractions() {
        // Allow map interactions again.
        const mapDiv = document.getElementById('map');
        if (mapDiv) {
            mapDiv.style.pointerEvents = 'auto';
        }
        // Hide the overlay.
        const overlay = document.getElementById('igcOverlay');
        if (overlay) {
            overlay.style.display = 'none';
        }
    }

    disableMapInteractions() {
        // Disable pointer events on the map to block interactions.
        let tb = this;
        tb.hideSearchFiltersPanel();
        tb.toggleTableVisibility(true);

        const mapDiv = document.getElementById('map');
        if (mapDiv) {
            mapDiv.style.pointerEvents = 'none';
        }
        // Show the transparent overlay to block clicks.
        const overlay = document.getElementById('igcOverlay');
        if (overlay) {
            overlay.style.display = 'block';
        }
    }

    // Function to show image in a modal
    showImageModal(src) {
        const modal = document.getElementById('imageModal');
        const modalImg = document.getElementById('modalImage');
        modal.style.display = "block";
        modalImg.src = src;
        document.addEventListener('keydown', TB.handleKeyDown); // Add event listener for keydown
    }

    // Function to close the image modal
    closeImageModal() {
        const modal = document.getElementById('imageModal');
        modal.style.display = "none";
        document.removeEventListener('keydown', TB.handleKeyDown); // Remove event listener for keydown
    }

    // Function to handle keydown events
    handleKeyDown(event) {
        if (event.key === 'Escape') {
            TB.closeImageModal();
        }
    }

    expandCollapsibleSection(sectionId) {
        const section = document.getElementById(sectionId);
        if (section && section.classList.contains('collapsible')) {
            section.classList.remove('collapsed');
        }
    }

    generateCollapsibleSection(
        title,
        content,
        container,
        id = null,
        highlightClass = null,
        resetCallback = null,
        countdownSection = null,
        backgroundImageUrl = null,
        iconImageUrl = null
    ) {
        let tb = this;
        const section = document.createElement('div');
        section.className = 'tool-entry collapsible collapsed';
        if (id) {
            section.id = id;
        }

        // Title element
        const titleElement = document.createElement('div');
        titleElement.className = 'title';

        // If an icon image is provided, create and prepend an image element.
        if (iconImageUrl) {
            const icon = document.createElement('img');
            icon.src = iconImageUrl;
            // Fixed size styling for the icon
            icon.style.width = '22px';
            icon.style.height = '22px';
            icon.style.marginRight = '8px';
            // Prepend the icon image to the title element.
            titleElement.appendChild(icon);
        }

        // Append title text.
        const titleText = document.createElement('span');
        titleText.innerText = title;
        titleElement.style.display = 'flex';
        titleElement.style.alignItems = 'center';
        titleElement.style.justifyContent = 'flex-start';
        titleElement.appendChild(titleText);

        if (highlightClass) {
            titleElement.classList.add(highlightClass);
        }

        // Add reset button if callback is provided
        if (resetCallback) {
            const resetButton = document.createElement('button');
            resetButton.className = 'collapsible-reset-button';
            resetButton.innerText = 'Reset';
            resetButton.addEventListener('click', (event) => {
                event.stopPropagation();
                resetCallback();
            });
            titleElement.appendChild(resetButton);
        }

        // The content wrapper
        const contentWrapper = document.createElement('div');
        contentWrapper.className = 'content-wrapper';

        // The content element
        const contentElement = document.createElement('div');
        contentElement.className = 'content';
        contentElement.innerHTML = content;

        // If there's a countdown, append it
        if (countdownSection) {
            countdownSection.className = 'countdown-section';
            countdownSection.style.marginTop = '10px';
            contentElement.appendChild(countdownSection);
        }

        // Set the background image and opacity via CSS variables, if provided
        if (backgroundImageUrl) {
            contentElement.style.setProperty('--cover-url', `url('${backgroundImageUrl}')`);
        }
        contentElement.style.setProperty('--cover-opacity', tb.userSettings.coverImageOpacity / 100);

        // Append content to wrapper, then to section
        contentWrapper.appendChild(contentElement);
        section.appendChild(titleElement);
        section.appendChild(contentWrapper);

        // Toggle on title click
        titleElement.addEventListener('click', () => {
            section.classList.toggle('collapsed');
        });

        // Finally, append the section to container
        container.appendChild(section);
    }

    // Function to increment thread access count
    incrementThreadAccess(entrySeqID) {
        fetch(`php/IncrementThreadAccessForTask.php?EntrySeqID=${entrySeqID}`)
            .then(response => response.json())
            .then(data => {
                if (data.status !== 'success') {
                    console.error('Error incrementing thread access:', data.message);
                }
            })
            .catch(err => console.error('Error incrementing thread access:', err));
    }

    incrementDownloadCount(entrySeqID) {
        // Call the PHP script to increment the download count
        fetch(`php/IncrementDownloadForTask.php?EntrySeqID=${entrySeqID}`)
            .then(response => response.json())
            .then(data => {
                if (data.status !== 'success') {
                    console.error('Error incrementing download count:', data.message);
                }
            })
            .catch(err => console.error('Error incrementing download count:', err));
    }

    incrementDownloadCountUsingTaskID(taskID) {
        // Call the PHP script to increment the download count
        fetch(`php/IncrementDownloadForTask.php?TaskID=${taskID}`)
            .then(response => response.json())
            .then(data => {
                if (data.status !== 'success') {
                    console.error('Error incrementing download count:', data.message);
                }
            })
            .catch(err => console.error('Error incrementing download count:', err));
    }

    downloadIGCFile(EntrySeqID, IGCKey) {
        let tb = this;

        // Construct the file download URL
        const url = `${tb.discordPostHelperTaskBrowserPath}IGCFiles/${EntrySeqID}/${IGCKey}.igc`;

        // Fetch the file and handle the download
        fetch(url)
            .then(response => {
                if (!response.ok) {
                    throw new Error(`Failed to fetch file. HTTP status: ${response.status}`);
                }
                return response.blob();
            })
            .then(blob => {
                // Create a temporary link and trigger the download
                const fileUrl = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.style.display = 'none';
                a.href = fileUrl;
                a.download = `${IGCKey}.igc`;
                document.body.appendChild(a);
                a.click();

                // Clean up the temporary URL and element
                window.URL.revokeObjectURL(fileUrl);
                document.body.removeChild(a);

            })
            .catch(err => {
                console.error("Error downloading IGC file:", err);
                alert("Failed to download the IGC file. Please try again later.");
            });
    }

    downloadExtraFile(filename) {
        const taskID = this.currentTask.TaskID;
        const url = `php/DownloadExtraFile.php`;

        // List of image extensions
        const imageExtensions = ['png', 'jpg', 'jpeg', 'gif', 'bmp', 'webp'];

        // Extract the file extension
        const fileExtension = filename.split('.').pop().toLowerCase();

        // Check if the file is an image
        const isImage = imageExtensions.includes(fileExtension);

        fetch(`${url}?taskID=${taskID}&filename=${encodeURIComponent(filename)}`)
            .then((response) => {
                if (!response.ok) {
                    throw new Error("Failed to download the file.");
                }
                return response.blob();
            })
            .then((blob) => {
                if (isImage) {
                    // Show image in the modal
                    const imageUrl = URL.createObjectURL(blob);
                    this.showImageModal(imageUrl);
                } else {
                    // Trigger file download for non-image files
                    const downloadUrl = URL.createObjectURL(blob);
                    const a = document.createElement("a");
                    a.href = downloadUrl;
                    a.download = filename;
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    URL.revokeObjectURL(downloadUrl);
                }
            })
            .catch((error) => {
                console.error("Error downloading the extra file:", error);
                alert("An error occurred while downloading the file.");
            });
    }

    downloadZIPFile(theTaskID, EntrySeqID, Title, source = "map") {
        let tb = this;

        // Increment download count
        tb.incrementDownloadCount(EntrySeqID);

        // Construct the file download URL
        const url = `${tb.discordPostHelperTaskBrowserPath}Tasks/${theTaskID}.dphx`;

        // Fetch the file and handle the download
        fetch(url)
            .then(response => {
                if (!response.ok) {
                    throw new Error(`Failed to fetch file. HTTP status: ${response.status}`);
                }
                return response.blob();
            })
            .then(blob => {
                // Create a temporary link and trigger the download
                const fileUrl = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.style.display = 'none';
                a.href = fileUrl;
                a.download = `${Title}.zip`; // Rename the downloaded file to a .zip file
                document.body.appendChild(a);
                a.click();

                // Clean up the temporary URL and element
                window.URL.revokeObjectURL(fileUrl);
                document.body.removeChild(a);

                // Handle Discord-specific behavior
                if (source === "discord") {
                    setTimeout(() => {
                        //alert("Download was started! Click to close.");
                        window.close();
                    }, 3000); // Allow time for the browser to display the download prompt
                }
            })
            .catch(err => {
                console.error("Error downloading ZIP file:", err);
                alert("Failed to download the ZIP file. Please try again later.");
            });
    }

    downloadDPHXFile(theTaskID, EntrySeqID, Title, source = "map") {
        let tb = this;

        // Increment download count
        tb.incrementDownloadCount(EntrySeqID);

        // Attempt to call the local web server first
        const port = tb.userSettings?.DPHXlocalPort || 54513;
        const localUrl = `http://localhost:${port}/?taskID=${theTaskID}&title=${encodeURIComponent(Title)}&source=${source}`;
        fetch(localUrl)
            .then(() => {
                console.log("Local server call successful");
                // If successful, we do NOT download the file from the server 
                alert("Download successful! The DPHX file should now be opened in your local application.");
                if (source === "discord") {
                    window.close();
                }
            })
            .catch(err => {
                // Local call failed, so we do a normal file download as fallback
                console.warn("Could not contact local app (check same port on both sides?): ", err);

                // Now do the normal file download
                const url = `${tb.discordPostHelperTaskBrowserPath}Tasks/${theTaskID}.dphx`;
                fetch(url)
                    .then(response => response.blob())
                    .then(blob => {
                        const fileUrl = window.URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.style.display = 'none';
                        a.href = fileUrl;
                        a.download = `${Title}.dphx`;
                        document.body.appendChild(a);
                        a.click();
                        window.URL.revokeObjectURL(fileUrl);
                        document.body.removeChild(a);
                        if (source === "discord") {
                            setTimeout(() => {
                                //alert("Download was started! Click to close.");
                                window.close();
                            }, 3000); // Delay to allow the browser's download prompt to appear
                        }
                    })
                    .catch(err2 => console.error("Error downloading file as fallback:", err2));
            });
    }

    downloadTextFile(content, filename, source = "map") {
        const blob = new Blob([content], { type: 'application/xml;charset=utf-8' });
        const link = document.createElement('a');
        link.href = window.URL.createObjectURL(blob);
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        if (source === "discord") {
            setTimeout(() => {
                //alert("Download was started! Click to close.");
                window.close();
            }, 3000); // Delay to allow the browser's download prompt to appear
        }
    }

    getFileNameFromPath(filePath) {
        return filePath.split('\\').pop().split('/').pop();
    }

    downloadPLNFile(task = null, source = "map") {
        let tb = this;
        const taskToUse = task || tb.currentTask;

        // Increment download count
        tb.incrementDownloadCount(taskToUse.EntrySeqID);
        const fileName = tb.getFileNameFromPath(taskToUse.PLNFilename);
        tb.downloadTextFile(taskToUse.PLNXML, fileName, source);
    }

    downloadWPRFile(task = null, source = "map") {
        let tb = this;
        const taskToUse = task || tb.currentTask;

        const fileName = tb.getFileNameFromPath(taskToUse.WPRFilename);
        tb.downloadTextFile(taskToUse.WPRXML, fileName, source);
    }

    async setSSCTracker(group, entrySeqID, URLInfo) {
        let tb = this;

        try {
            // Retrieve necessary data
            const port = tb.userSettings?.TrackerlocalPort || 55055;
            const baseUrl = `http://localhost:${port}/settask`;

            // Extract just the filename without the extension from a full path
            const extractFilename = (filePath) => {
                const fullFilename = filePath.split(/(\\|\/)/g).pop(); // Get the filename with extension
                const filenameWithoutExtension = fullFilename.split('.').slice(0, -1).join('.'); // Remove the extension
                return filenameWithoutExtension;
            };

            // Declare placeholders for task details
            let PLNFilename = "";
            let PLNContent = "";
            let WPRFilename = "";
            let WPRContent = "";

            // If EntrySeqID is not 0, fetch task details
            if (entrySeqID !== 0) {
                const taskDetails = await tb.getTaskDetails(entrySeqID);
                if (!taskDetails) {
                    console.error(`No task details found for EntrySeqID: ${entrySeqID}`);
                    return;
                }

                // Populate task details
                PLNFilename = extractFilename(taskDetails.PLNFilename) || "";
                PLNContent = taskDetails.PLNXML || "";
                WPRFilename = extractFilename(taskDetails.WPRFilename) || "";
                WPRContent = taskDetails.WPRXML || "";
            }

            // Build the payload as JSON
            const payload = {
                CMD: "SET",
                GN: group,
                TASK: PLNFilename,
                TASKDATA: PLNContent,
                WEATHER: WPRFilename,
                WEATHERDATA: WPRContent,
                TASKINFO: URLInfo
            };

            // Function to perform a single POST request
            const makeRequest = async () => {
                const response = await fetch(baseUrl, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(payload), // Send JSON payload
                });

                if (!response.ok) {
                    throw new Error(`Failed to call SSC Tracker: ${response.statusText}`);
                }
            };

            // Perform the call
            await makeRequest();
            console.log('SSC Tracker call successful.');

        } catch (error) {
            alert("Unable to set tracker. Maybe the app is not running?");
            console.error('Error setting SSC Tracker:', error);
        }
    }

    getTaskDetails(entrySeqID, forceZoomToTask = false) {
        let tb = this;

        return new Promise((resolve, reject) => {
            let fetch_promise;
            if (DEBUG_LOCAL) {
                fetch_promise = test_fetch_task_details(entrySeqID);
            } else {
                fetch_promise = fetch(`php/GetTaskDetails.php?entrySeqID=${entrySeqID}`);
            }

            fetch_promise
                .then(response => {
                    if (!response.ok) {
                        throw new Error(`Failed to fetch task details: ${response.statusText}`);
                    }
                    return response.json();
                })
                .then(task_details => {
                    // Check for errors
                    if (task_details.error) {
                        throw new Error(task_details.error);
                    }

                    // Check if the task is unavailable
                    if (task_details.status === "unavailable") {
                        // Convert "YYYY-MM-DD HH:mm:ss" to "YYYY-MM-DDTHH:mm:ssZ"
                        const isoDateString = task_details.availability.replace(' ', 'T') + 'Z';
                        const utcDate = new Date(isoDateString);
                        const localAvailabilityDate = utcDate.toLocaleString(navigator.language, {
                            month: 'long',
                            day: 'numeric',
                            hour: 'numeric',
                            minute: 'numeric',
                            hour12: TB.userSettings.timeFormat === 'usa' // Use 12-hour format if 'usa'
                        });
                        alert(`Task availability currently set to ${localAvailabilityDate}`);
                        resolve(false); // Resolve with null to indicate unavailability
                        return;
                    }
                    // Check if the task is not found
                    if (task_details.status === "not_found") {
                        alert(`Task not found!`);
                        resolve(false); // Resolve with null to indicate unavailability
                        return;
                    }

                    // Process the task details
                    tb.handleTaskDetails(task_details, forceZoomToTask);
                    resolve(task_details);
                })
                .catch(error => {
                    console.error('Error fetching task details:', error);
                    alert(`Error: ${error.message || 'An unexpected error occurred while fetching task details.'}`);
                    resolve(false);
                });
        });
    }

    handleTaskDetails(task_details, forceZoomToTask = false) {
        let tb = this;

        if (!tb.tbm.b21_task) {
            tb.tbm.setB21Task(task_details);
        }

        if (!task_details.EntrySeqID == tb.tbm.b21_task.planner.currentEntrySeqID) {
            tb.tbm.setB21Task(task_details);
        }

        tb.setWeatherInfo(task_details.WPRXML);

        // Zoom in on the task if specified or if task bounds outside current map bounds
        let taskBounds = tb.tbm.b21_task.get_bounds();
        let mapBounds = tb.tbm.map.getBounds();
        let containsBounds = mapBounds.contains(taskBounds);

        if (forceZoomToTask || !containsBounds) {
            tb.tbm.zoomToTask();
        }
        //tb.tbm.map.fitBounds(tb.tbm.b21_task.get_bounds());
        tb.showTaskDetailsStandalone(task_details);
    }

    setWeatherInfo(wpr_str) {
        let tb = this;
        tb.wsg_weather = new WSG_Weather();
        tb.wsg_weather.load_wpr_str(wpr_str);
        console.log("Weather information loaded:", tb.wsg_weather);
    }

    clearTaskDetails() {
        // Assuming taskDetailContainer is the element that holds the task details
        let tb = this;
        let taskDetailContainer = document.getElementById('taskDetailContainer');
        if (taskDetailContainer) {
            taskDetailContainer.innerHTML = ''; // Clear the task details
        }
        tb.tbm.setWindDirection(-1, 0, 0);
        tb.TaskDetailsPanelVisible = false;
        tb.hideTaskDetailsPanel();
    }

    generateToolEntry(title, description) {
        let tb = this;
        const descriptionHtml = tb.convertToMarkdown(description);

        const toolEntry = document.createElement('div');
        toolEntry.className = 'tool-entry collapsible collapsed';

        const titleElement = document.createElement('div');
        titleElement.className = 'title';
        titleElement.innerText = title;

        const contentElement = document.createElement('div');
        contentElement.className = 'content';
        contentElement.innerHTML = descriptionHtml;

        toolEntry.appendChild(titleElement);
        toolEntry.appendChild(contentElement);

        titleElement.addEventListener('click', () => {
            toolEntry.classList.toggle('collapsed');
        });

        const toolsTab = document.getElementById('toolsTab');
        toolsTab.appendChild(toolEntry);

        const links = contentElement.querySelectorAll('a');
        links.forEach(link => {
            const url = link.href;
            if (url.includes('youtube.com') || url.includes('youtu.be')) {
                tb.fetchYouTubeMetadata(url).then(metadata => {
                    if (metadata.embedHtml) {
                        const preview = document.createElement('div');
                        preview.className = 'link-preview';
                        preview.innerHTML = `
                            <div class="youtube-container">
                                ${metadata.embedHtml}
                                <div class="preview-details">
                                    ${metadata.ogTitle !== title ? `<a href="${url}" target="_blank"><h3>${metadata.ogTitle}</h3></a>` : ''}
                                    <p>${metadata.ogDescription}</p>
                                </div>
                            </div>
                        `;
                        link.insertAdjacentElement('afterend', preview);
                    }
                });
            } else {
                tb.fetchLinkMetadata(url).then(metadata => {
                    if ((metadata.ogTitle && metadata.ogTitle !== title) || metadata.ogDescription || metadata.ogImage) {
                        const preview = document.createElement('div');
                        preview.className = 'link-preview';
                        preview.innerHTML = `
                            ${metadata.ogImage ? `<img src="${metadata.ogImage}" alt="Preview Image">` : ''}
                            <div class="preview-details">
                                ${metadata.ogTitle && metadata.ogTitle !== title ? `<a href="${url}" target="_blank"><h3>${metadata.ogTitle}</h3></a>` : ''}
                                <p>${metadata.ogDescription}</p>
                            </div>
                        `;
                        link.insertAdjacentElement('afterend', preview);
                    }
                });
            }
        });
    }

    // Function to fetch metadata for YouTube links
    fetchYouTubeMetadata(url) {
        let videoId;
        if (url.includes('youtu.be')) {
            videoId = url.split('/').pop();
        } else {
            videoId = new URL(url).searchParams.get('v');
        }

        const apiUrl = `https://www.googleapis.com/youtube/v3/videos?id=${videoId}&key=AIzaSyCQD9fCWerrxjy-GQr3-w0k1d2UftSXDfo&part=snippet`;
        return fetch(apiUrl)
            .then(response => response.json())
            .then(data => {
                const snippet = data.items[0].snippet;
                const shortDescription = snippet.description.length > 400 ? snippet.description.substring(0, 400) + '...' : snippet.description;
                return {
                    ogTitle: snippet.title,
                    ogDescription: shortDescription,
                    ogImage: snippet.thumbnails.high.url,
                    embedHtml: `<iframe width="300" src="https://www.youtube.com/embed/${videoId}" frameborder="0" allowfullscreen></iframe>`
                };
            })
            .catch(error => {
                console.error('Error fetching YouTube metadata:', error);
                return {};
            });
    }

    // Function to fetch metadata for other links
    fetchLinkMetadata(url) {
        if (url.includes('discord.com') || url.includes('google.com')) {
            return Promise.resolve({});
        }
        const apiUrl = `php/FetchMetadata.php?url=${encodeURIComponent(url)}`;
        return fetch(apiUrl)
            .then(response => response.json())
            .catch(error => {
                console.error('Error fetching link metadata:', error);
                return {};
            });
    }

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
        const tb = this;
        if (!tb.ApplyingSettings) {
            const settings = {
                mapLayer: tb.tbm.getCurrentMapLayer(),
                showAirports: tb.tbm.isLayerVisible('Airports'),
                showRailways: tb.tbm.isLayerVisible('Railways'),
                windCompass: tb.tbm.isLayerVisible('Wind Compass'),
                showSelectedOnly: tb.tbm.isLayerVisible('Show selected only'),
                taskDetailWidth: tb.taskDetailsContainerWidth
            };
            tb.setJsonCookie('mapUserSettings', settings, 300);
        }
    }

    loadMapUserSettings() {
        const tb = this;
        const settings = tb.getJsonCookie('mapUserSettings', 300);

        // Set default settings if not found
        const defaultSettings = {
            mapLayer: "Google Terrain",
            showAirports: true,
            showRailways: false,
            windCompass: false,
            showSelectedOnly: true,
            taskDetailWidth: '30%'
        };

        // Merge default settings with loaded settings
        const mergedSettings = { ...defaultSettings, ...settings };

        // Apply settings to the map
        tb.ApplyingSettings = true;
        tb.tbm.setMapLayer(mergedSettings.mapLayer);
        tb.tbm.setLayerVisibility('Airports', mergedSettings.showAirports);
        tb.tbm.setLayerVisibility('Railways', mergedSettings.showRailways);
        tb.tbm.setLayerVisibility('Wind Compass', mergedSettings.windCompass);
        tb.tbm.setLayerVisibility('Show selected only', mergedSettings.showSelectedOnly);
        tb.setTaskDetailWidth(mergedSettings.taskDetailWidth);
        tb.ApplyingSettings = false;
    }

    setTaskDetailWidth(width) {
        const tb = this;
        const taskDetailContainer = document.getElementById('taskDetailContainer');
        const mapContainer = document.getElementById('map');
        tb.taskDetailsContainerWidth = width;
        taskDetailContainer.style.width = width;
        mapContainer.style.width = `${100 - parseFloat(width)}%`;
        this.resizeMap(); // Ensure the map resizes correctly
    }

    loadUserSettings() {
        const tb = this;
        const settings = tb.getJsonCookie('userSettings', 300);

        // Default settings
        const defaultSettings = {
            uiTheme: 'dark',
            timeFormat: 'usa',
            altitude: 'imperial',
            distance: 'imperial',
            gateMeasurement: 'imperial',
            windSpeed: 'knots',
            pressure: 'inHg',
            temperature: 'fahrenheit',
            DPHXlocalPort: 54513,
            TrackerlocalPort: 55055,
            coverImageOpacity: 25,
        };

        // Merge default settings with saved settings
        const mergedSettings = { ...defaultSettings, ...settings };

        if (!tb.isDownloadPage) {
            // Set the radio buttons based on the settings
            tb.ApplyingSettings = true;
            document.querySelector(`input[name="uiTheme"][value="${mergedSettings.uiTheme}"]`).checked = true;
            document.querySelector(`input[name="timeFormat"][value="${mergedSettings.timeFormat}"]`).checked = true;
            document.querySelector(`input[name="altitude"][value="${mergedSettings.altitude}"]`).checked = true;
            document.querySelector(`input[name="distance"][value="${mergedSettings.distance}"]`).checked = true;
            document.querySelector(`input[name="gateMeasurement"][value="${mergedSettings.gateMeasurement}"]`).checked = true;
            document.querySelector(`input[name="windSpeed"][value="${mergedSettings.windSpeed}"]`).checked = true;
            document.querySelector(`input[name="pressure"][value="${mergedSettings.pressure}"]`).checked = true;
            document.querySelector(`input[name="temperature"][value="${mergedSettings.temperature}"]`).checked = true;

            const opacitySlider = document.getElementById("coverImageOpacity");
            const opacityValue = document.getElementById("coverImageOpacityValue");

            opacitySlider.value = mergedSettings.coverImageOpacity;
            opacityValue.innerText = `${mergedSettings.coverImageOpacity}%`;

            const DPHXlocalPortInput = document.getElementById('DPHXlocalPort');
            if (DPHXlocalPortInput) {
                DPHXlocalPortInput.value = mergedSettings.DPHXlocalPort;
            }
            const TrackerlocalPortInput = document.getElementById('TrackerlocalPort');
            if (TrackerlocalPortInput) {
                TrackerlocalPortInput.value = mergedSettings.TrackerlocalPort;
            }
            tb.ApplyingSettings = false;

            // Add event listener so that changes trigger a save
            if (DPHXlocalPortInput) {
                DPHXlocalPortInput.addEventListener('change', () => {
                    tb.saveUserSettings();  // We’ll validate & then save
                });
            }
            if (TrackerlocalPortInput) {
                TrackerlocalPortInput.addEventListener('change', () => {
                    tb.saveUserSettings();  // We’ll validate & then save
                });
            }

            opacitySlider.addEventListener("input", function () {
                opacityValue.innerText = `${this.value}%`; // Update the displayed percentage
                tb.saveUserSettings(); // Save the new setting
            });

            // Attach change event listeners to save settings when any radio button is changed
            document.querySelectorAll('#settingsForm input[type="radio"]').forEach(input => {
                input.addEventListener('change', () => {
                    tb.saveUserSettings();
                });
            });

        }

        return mergedSettings;
    }

    saveUserSettings() {
        const tb = this;

        if (!tb.ApplyingSettings) {
            const settings = {
                uiTheme: document.querySelector('input[name="uiTheme"]:checked').value,
                timeFormat: document.querySelector('input[name="timeFormat"]:checked').value,
                altitude: document.querySelector('input[name="altitude"]:checked').value,
                distance: document.querySelector('input[name="distance"]:checked').value,
                gateMeasurement: document.querySelector('input[name="gateMeasurement"]:checked').value,
                windSpeed: document.querySelector('input[name="windSpeed"]:checked').value,
                pressure: document.querySelector('input[name="pressure"]:checked').value,
                temperature: document.querySelector('input[name="temperature"]:checked').value,
                coverImageOpacity: document.getElementById("coverImageOpacity").value,
            };

            // Validate and assign ports
            settings.DPHXlocalPort = this.validatePort(
                'DPHXlocalPort',
                tb.userSettings.DPHXlocalPort || 54513
            );
            settings.TrackerlocalPort = this.validatePort(
                'TrackerlocalPort',
                tb.userSettings.TrackerlocalPort || 55055
            );

            // Save settings to cookies and update the local state
            tb.setJsonCookie('userSettings', settings, 300);
            tb.userSettings = settings;
        }
    }

    validatePort(inputId, defaultValue) {
        const inputElement = document.getElementById(inputId);
        const errorElement = inputElement.nextElementSibling; // Assuming the error element is the next sibling
        let portValue = parseInt(inputElement.value, 10);

        // Validate the port number
        if (Number.isNaN(portValue) || portValue < 1 || portValue > 65535) {
            // Show error message
            errorElement.style.display = 'block';
            errorElement.textContent = "Invalid port. Must be 1-65535.";
            // Revert to default
            portValue = defaultValue;
            inputElement.value = portValue;
        } else {
            errorElement.style.display = 'none';
        }

        return portValue;
    }

    openTaskInPlanner() {
        let tb = this;
        const newWindow = window.open('', '_blank');  // Open immediately on user click

        fetch(`php/PrepareSendToB21OnlineTaskPlanner.php?taskID=${tb.currentTask.TaskID}`)
            .then(response => response.json())
            .then(data => {
                if (data.status === 'success') {
                    const taskFolder = data.taskFolder;
                    const plnFilename = encodeURIComponent(tb.getFileNameFromPath(tb.currentTask.PLNFilename));
                    const wprFilename = encodeURIComponent(tb.getFileNameFromPath(tb.currentTask.WPRFilename));

                    const plannerUrl = `https://xp-soaring.github.io/tasks/b21_task_planner/index.html?pln=${taskFolder}/${plnFilename}&wpr=${taskFolder}/${wprFilename}`;
                    newWindow.location.href = plannerUrl;  // Navigate the pre-opened window
                } else {
                    newWindow.close();  // Close if task fails
                    alert('Error: ' + data.message);
                }
            })
            .catch(error => {
                console.error('Error:', error);
                newWindow.close();
                alert('Failed to prepare the task.');
            });
    }

    hideTaskDetailsPanel() {
        let tb = this;
        if (tb.TaskDetailsPanelVisible == true) {
            return;
        }
        const taskDetailContainer = document.getElementById('taskDetailContainer');
        const resizer = document.getElementById('resizer');
        const map = document.getElementById('map');
        taskDetailContainer.style.display = 'none';
        resizer.style.display = 'none';
        map.style.width = '100%';
        tb.resizeMap(); // Ensure map is resized
    }

    showTaskDetailsPanel() {
        let tb = this;
        if (tb.TaskDetailsPanelVisible == false) {
            return;
        }
        const taskDetailContainer = document.getElementById('taskDetailContainer');
        const resizer = document.getElementById('resizer');
        const map = document.getElementById('map');
        taskDetailContainer.style.display = 'block';
        resizer.style.display = 'block';
        tb.setTaskDetailWidth(tb.taskDetailsContainerWidth);
        //tb.resizeMap(); // Ensure map is resized
    }

    hideSearchFiltersPanel() {
        let tb = this;
        const searchFiltersPanel = document.getElementById('searchAndFilters');
        const mapContainer = document.getElementById('mapContainer');

        searchFiltersPanel.style.display = 'none';
        mapContainer.style.flex = '1'; // Ensures the map takes the full width when the panel is hidden

        tb.SearchFiltersPanelVisible = false;
        tb.resizeMap(); // Ensure the map resizes correctly
    }

    showSearchFiltersPanel() {
        let tb = this;
        const searchFiltersPanel = document.getElementById('searchAndFilters');
        const mapContainer = document.getElementById('mapContainer');

        searchFiltersPanel.style.display = 'block';
        searchFiltersPanel.style.width = '300px'; // Fixed width

        // Adjust mapContainer to occupy the remaining space
        mapContainer.style.flex = '1';

        tb.SearchFiltersPanelVisible = true;
        tb.resizeMap(); // Ensure the map resizes correctly
    }

    toggleSearchAndFiltersPanel() {
        let tb = this;
        const searchFiltersPanel = document.getElementById('searchAndFilters');
        if (tb.SearchFiltersPanelVisible == false) {
            tb.showSearchFiltersPanel();
        } else {
            tb.hideSearchFiltersPanel();
        }
    }

    toggleTableVisibility(forceHide = false) {
        let tb = this;
        const taskGridOverlay = document.getElementById("taskGridOverlay");

        // If forceHide is true, hide the overlay and remove listeners.
        if (forceHide || taskGridOverlay.style.display !== "none" && forceHide) {
            // Hide overlay
            taskGridOverlay.style.display = "none";

            // Remove event listeners using our named functions.
            taskGridOverlay.removeEventListener("mouseenter", tb._overlayMouseEnter);
            taskGridOverlay.removeEventListener("mouseleave", tb._overlayMouseLeave);
            taskGridOverlay.removeEventListener("wheel", tb._overlayWheel);
            return;
        }

        // If the overlay is currently hidden, show it and attach event listeners.
        if (taskGridOverlay.style.display === "none" || !taskGridOverlay.style.display) {
            // Show overlay
            taskGridOverlay.style.display = "flex";

            // Populate the DataTable with current tasks
            tb.populateDataTable(tb.tbm.visibleTasks);

            // Ensure the refresh button updates the grid
            refreshGridButton.addEventListener("click", () => {
                tb.populateDataTable(tb.tbm.visibleTasks);
            });

            // Reselect the current task if one is selected
            if (tb.tbm.currentEntrySeqID) {
                tb.selectGridTask(tb.tbm.currentEntrySeqID);
            }

            // Define the event listener functions and store them for removal.
            tb._overlayMouseEnter = () => {
                tb.tbm.map.dragging.disable();
                tb.tbm.map.scrollWheelZoom.disable();
                tb.tbm.map.doubleClickZoom.disable();
            };

            tb._overlayMouseLeave = () => {
                tb.tbm.map.dragging.enable();
                tb.tbm.map.scrollWheelZoom.enable();
                tb.tbm.map.doubleClickZoom.enable();
            };

            tb._overlayWheel = (event) => {
                event.stopPropagation();
            };

            // Attach the event listeners.
            taskGridOverlay.addEventListener("mouseenter", tb._overlayMouseEnter);
            taskGridOverlay.addEventListener("mouseleave", tb._overlayMouseLeave);
            taskGridOverlay.addEventListener("wheel", tb._overlayWheel, { passive: false });
        } else {
            // If not forcing and overlay is visible, hide it.
            taskGridOverlay.style.display = "none";

            // Remove event listeners.
            taskGridOverlay.removeEventListener("mouseenter", tb._overlayMouseEnter);
            taskGridOverlay.removeEventListener("mouseleave", tb._overlayMouseLeave);
            taskGridOverlay.removeEventListener("wheel", tb._overlayWheel);
        }
    }

    processTasks(tasks) {
        return tasks.map(task => {
            // Helper function to truncate strings
            const truncate = (str, maxLength) => (str && str.length > maxLength ? str.substring(0, maxLength) + '...' : str);

            // Combine soaring types
            const soaringTypes = [];
            if (task.SoaringRidge) soaringTypes.push('Ridge');
            if (task.SoaringThermals) soaringTypes.push('Thermals');
            if (task.SoaringWaves) soaringTypes.push('Waves');
            if (task.SoaringDynamic) soaringTypes.push('Dynamic');
            task.SoaringType = soaringTypes.join(', ');

            // Truncate SoaringExtraInfo and append it
            if (task.SoaringExtraInfo) {
                task.SoaringType += ` (${truncate(task.SoaringExtraInfo, 30)})`;
            }

            // Format duration
            if (task.DurationMin && task.DurationMax) {
                task.Duration = `${task.DurationMin} to ${task.DurationMax} minutes`;
            } else if (task.DurationMin || task.DurationMax) {
                task.Duration = `${task.DurationMin || task.DurationMax} minutes`;
            } else {
                task.Duration = 'Not specified';
            }

            // Format difficulty rating
            if (task.DifficultyRating === "0. None / Custom") {
                task.Difficulty = truncate(task.DifficultyExtraInfo, 30) || 'Custom';
            } else {
                task.Difficulty = task.DifficultyRating;
                if (task.DifficultyExtraInfo) {
                    task.Difficulty += ` (${truncate(task.DifficultyExtraInfo, 30)})`;
                }
            }

            return task;
        });
    }

    // Function to deselect any selected task in the grid
    deselectGridTask() {
        $('#taskGridTable tbody tr').removeClass('selected'); // Remove the "selected" class from any selected row
    }

    // Function to select a specific task in the grid by EntrySeqID and scroll into view if necessary
    selectGridTask(entrySeqID) {
        // First, deselect any currently selected task
        this.deselectGridTask();

        // Find the row with the matching EntrySeqID
        const table = $('#taskGridTable').DataTable();
        let rowFound = false;

        table.rows().every(function () {
            const rowData = this.data();
            if (rowData.EntrySeqID === entrySeqID) {
                const rowNode = $(this.node());

                // Add 'selected' class to the matching row
                rowNode.addClass('selected');

                // Get the scroll container and row positions
                const scrollBody = $(table.settings()[0].nScrollBody);
                const rowOffset = rowNode.offset().top;
                const scrollBodyOffset = scrollBody.offset().top;

                const rowTop = rowOffset - scrollBodyOffset + scrollBody.scrollTop(); // Row’s position relative to the scroll container
                const rowBottom = rowTop + rowNode.outerHeight();
                const scrollTop = scrollBody.scrollTop();
                const scrollBottom = scrollTop + scrollBody.innerHeight();

                // Scroll if the row is outside the visible area
                if (rowTop < scrollTop) {
                    // Scroll up to the top of the row
                    scrollBody.scrollTop(rowTop);
                } else if (rowBottom > scrollBottom) {
                    // Scroll down to bring the bottom of the row into view
                    scrollBody.scrollTop(rowBottom - scrollBody.innerHeight());
                }

                rowFound = true;
                return false; // Stop searching after finding the match
            }
        });

        // Optionally log if the row was found (for debugging)
        if (!rowFound) {
            console.warn(`EntrySeqID ${entrySeqID} not found in grid.`);
        }
    }

    adjustGridHeight(rowCount) {
        const taskGridOverlay = document.getElementById("taskGridOverlay");

        // Determine dynamic height (each row approx 35px + some padding)
        let calculatedHeight = Math.min(40, (rowCount * 1.84) + 9.5) + "vh";

        // Apply height dynamically
        taskGridOverlay.style.height = calculatedHeight;
    }

    populateDataTable(tasks) {
        let tb = this;
        const processedTasks = tb.processTasks(tasks); // Process tasks as needed

        // Check if the DataTable is already initialized
        if ($.fn.DataTable.isDataTable('#taskGridTable')) {
            // Clear and reload with new data if DataTable exists
            $('#taskGridTable').DataTable().clear().rows.add(processedTasks).draw();
        } else {
            // Initialize DataTable if it doesn’t exist
            const table = $('#taskGridTable').DataTable({
                data: processedTasks,
                columns: [
                    { data: 'EntrySeqID', title: 'ID', name: 'EntrySeqID' },
                    { data: 'Title', title: 'Title', name: 'Title' },
                    { data: 'SoaringType', title: 'Soaring Type', name: 'SoaringType' },
                    { data: 'Duration', title: 'Duration', name: 'Duration' },
                    { data: 'Difficulty', title: 'Difficulty', name: 'Difficulty' },
                    {
                        data: 'LastUpdate',
                        title: 'Updated',
                        name: 'Updated',
                        render: function (data, type, row) {
                            if (data) {
                                const date = new Date(data);
                                if (!isNaN(date.getTime())) {
                                    // Format date as yyyy-MM-dd HH:mm
                                    const formattedDate = date.toISOString().slice(0, 16).replace('T', ' ');
                                    return type === 'display' || type === 'filter' ? formattedDate : date.getTime();
                                }
                            }
                            return type === 'display' ? 'N/A' : 0; // Fallback if data is missing or invalid
                        },
                        // Set ordering to use the original date for accurate sorting
                        type: 'num' // Ensures sorting by underlying timestamp value
                    }
                ],
                paging: false,           // Disable pagination
                searching: true,         // Enable search/filter
                ordering: true,          // Enable sorting
                info: true,              // Enable info display
                scrollY: 'calc(100vh - 300px)', // Adjust for your header/footer heights
                scrollCollapse: true,    // Enable scroll collapsing for tidy appearance
                scroller: true           // Smooth scrolling
            });

            // Move the search box to align with the button
            $("#taskGridHeader").append($("#taskGridTable_filter"));

            // Move the DataTables info text inside #taskGridInfo
            $("#taskGridInfo").html($("#taskGridTable_info").html());
            $("#taskGridTable_info").hide();

            // Update info dynamically when table changes
            table.on('draw', function () {
                $("#taskGridInfo").html($("#taskGridTable_info").html());
            });

            // Observe resizing of the overlay element
            const taskGridOverlay = document.getElementById('taskGridOverlay');
            const resizeObserver = new ResizeObserver(() => {
                table.columns.adjust();
                const scrollBodyWidth = $('#taskGridTable_wrapper .dataTables_scrollBody table').outerWidth();
                $('#taskGridTable_wrapper .dataTables_scrollHeadInner').width(scrollBodyWidth);
            });
            resizeObserver.observe(taskGridOverlay);

            // Sync horizontal scroll between header and body
            $('#taskGridTable_wrapper .dataTables_scrollBody').on('scroll', function () {
                const scrollLeft = $(this).scrollLeft();
                $('#taskGridTable_wrapper .dataTables_scrollHead').scrollLeft(scrollLeft);
            });

            // Add click, mouseover, and mouseout events to each row in the DataTable
            $('#taskGridTable tbody').on('click', 'tr', function () {
                const rowData = table.row(this).data();
                if (rowData && rowData.EntrySeqID) {
                    // Remove "selected" class from any other row
                    tb.deselectGridTask(); // Clear any selection before refreshing data

                    // Call the map function to select the task from the DataTable click
                    tb.tbm.selectTaskFromClick(rowData.EntrySeqID, false);

                    // Add "selected" class to the clicked row
                    $(this).addClass('selected');
                }
            }).on('mouseover', 'tr', function () {
                const rowData = table.row(this).data();
                if (rowData && rowData.EntrySeqID) {
                    tb.tbm.highlightTask(tb.tbm, rowData.EntrySeqID);
                }
            }).on('mouseout', 'tr', function () {
                const rowData = table.row(this).data();
                if (rowData && rowData.EntrySeqID) {
                    tb.tbm.unhighlightTask(tb.tbm, rowData.EntrySeqID);
                }
            });
            // 🔹 Adjust grid height dynamically when searching or updating the table
            table.on('search.dt draw.dt', function () {
                let filteredRowCount = table.rows({ filter: 'applied' }).count(); // Get only visible rows
                tb.adjustGridHeight(filteredRowCount);

                // Update info dynamically
                $("#taskGridInfo").html($("#taskGridTable_info").html());
            });
        }
        // Get row count and adjust height
        const rowCount = $('#taskGridTable tbody tr').length;
        tb.adjustGridHeight(rowCount);
    }

    getUserConnectionInfo() {
        let tb = this;
        return fetch('php/session_status.php')
            .then(response => {
                if (!response.ok) {
                    throw new Error('Network response was not ok: ' + response.statusText);
                }
                return response.json();
            })
            .then(data => {
                // Save the connection info in your TB object.
                tb.isUserConnected = data.loggedIn;
                tb.user = data.loggedIn ? data.user : null;
                tb.setUserAccountImage();  // Update the account image based on new session data.
                return data;
            })
            .catch(error => {
                tb.isUserConnected = false;
                tb.user = null;
                tb.setUserAccountImage();
                return { loggedIn: false };
            });
    }

    setUserAccountImage() {
        let tb = this;
        const userImg = document.getElementById('userAccountImage');
        if (userImg) {
            if (tb.isUserConnected) {
                userImg.src = "images/user_account_connected.png";
                userImg.title = "You are currently logged in as " + tb.user.displayName;
            }
            else {
                userImg.src = "images/user_account_disconnected.png";
                userImg.title = "You are NOT currently logged in.";
            }
        }
    }

}