class IGCUpload {
    constructor(taskBrowser) {
        // Store the reference to the TaskBrowser instance.
        this.taskBrowser = taskBrowser;

        this.dropZone = document.getElementById('dropZone');
        this.fileInput = document.getElementById('igcFileInput');
        this.selectFileButton = document.getElementById('selectFileButton');
        // Use the taskDetailContainer as our output container.
        this.outputDiv = document.getElementById('taskDetailContainer');

        this.igcFileGlobal = null; // Store the uploaded file globally
        this.igcData = null; // Will hold the parsed data for later submission

        // Global fields for additional data.
        this.pilot = "";
        this.gliderID = "";
        this.competitionID = "";
        this.competitionClass = "";
        this.gliderType = "";
        this.nb21Version = "";
        this.sim = "";
    }

    init() {
        // Set up event listeners
        this.selectFileButton.addEventListener('click', () => {
            this.fileInput.value = ""; // Reset the file input.
            this.fileInput.click();
        });

        this.fileInput.addEventListener('change', (event) => {
            const file = event.target.files[0];
            if (file) {
                this.igcFileGlobal = file;
                this.processIGCFile(file);
            }
        });

        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
            this.dropZone.addEventListener(eventName, (e) => {
                e.preventDefault();
                e.stopPropagation();
            });
        });

        ['dragenter', 'dragover'].forEach(eventName => {
            this.dropZone.addEventListener(eventName, () => {
                this.dropZone.classList.add('dragover');
            });
        });

        ['dragleave', 'drop'].forEach(eventName => {
            this.dropZone.addEventListener(eventName, () => {
                this.dropZone.classList.remove('dragover');
            });
        });

        this.dropZone.addEventListener('drop', (e) => {
            const dt = e.dataTransfer;
            const file = dt.files[0];
            if (file) {
                this.igcFileGlobal = file;
                this.processIGCFile(file);
            }
        });
    }

    // ---------------- PARSING FUNCTIONS ----------------

    parseHeader(headerLine) {
        const headerRegex = /^C(\d{6})(\d{6})(\d{6})(\d{4})(\d{2})(.*)$/;
        const match = headerLine.match(headerRegex);
        if (!match) return null;
        return {
            utcDate: match[1],    // DDMMYY
            utcTime: match[2],    // HHMMSS
            localTime: match[3],  // HHMMSS
            flightId: match[4],
            numWaypoints: match[5],
            taskTitle: match[6].trim()
        };
    }

    parseWaypoint(line) {
        const wpRegex = /^C(\d{2})(\d{2})(\d{3})([NS])(\d{3})(\d{2})(\d{3})([EW])(.*)$/;
        const match = line.match(wpRegex);
        if (!match) return null;
        const latDeg = match[1],
            latMin = match[2],
            latThousandths = match[3],
            latHem = match[4];
        const lonDeg = match[5],
            lonMin = match[6],
            lonThousandths = match[7],
            lonHem = match[8];
        const rawText = match[9].trim();

        let originalId = "";
        if (rawText.slice(-1) === ';') {
            originalId = rawText;
        } else {
            const parts = rawText.split(';').filter(x => x.trim() !== '');
            if (parts.length === 3) {
                originalId = parts[2].trim();
            } else if (parts.length === 2) {
                originalId = parts[1].trim();
            } else {
                originalId = rawText;
            }
        }

        return {
            originalId,
            latitude: this.formatCoordinate(latDeg, latMin, latThousandths, latHem),
            longitude: this.formatCoordinate(lonDeg, lonMin, lonThousandths, lonHem)
        };
    }

    formatCoordinate(deg, min, thousandths, hemisphere) {
        const degrees = parseInt(deg, 10);
        const minutes = parseInt(min, 10);
        const thousandthsNum = parseInt(thousandths, 10);
        const seconds = (thousandthsNum / 1000) * 60;
        const secondsFormatted = seconds.toFixed(2);
        return `${hemisphere}${degrees}\u00B0 ${minutes}' ${secondsFormatted}"`;
    }

    formatUTCDate(ddmmyy) {
        const day = parseInt(ddmmyy.substring(0, 2), 10);
        const month = parseInt(ddmmyy.substring(2, 4), 10);
        const year = parseInt(ddmmyy.substring(4, 6), 10) + 2000;
        const utcDate = new Date(Date.UTC(year, month - 1, day));
        const options = { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' };
        return utcDate.toLocaleDateString('en-US', options);
    }

    formatTime(hhmmss) {
        const hh = hhmmss.substring(0, 2);
        const mm = hhmmss.substring(2, 4);
        const ss = hhmmss.substring(4, 6);
        return `${hh}:${mm}:${ss}`;
    }

    // Convert DDMMYY and HHMMSS to YYMMDDHHMMSS for key construction
    formatKeyDateTime(ddmmyy, hhmmss) {
        if (ddmmyy.length !== 6 || hhmmss.length !== 6) return "";
        const day = ddmmyy.substring(0, 2);
        const month = ddmmyy.substring(2, 4);
        const year = ddmmyy.substring(4, 6);
        return year + month + day + hhmmss;
    }

    parseALine(line) {
        const parts = line.split(/\s+/);
        let nb21Version = "";
        let sim = "";
        if (parts.length >= 3) {
            if (parts[2].toLowerCase() === "logger") {
                if (parts.length >= 4) {
                    nb21Version = parts[3];
                }
                sim = "MSFS 2020";
            } else {
                nb21Version = parts[2];
                if (parts.length >= 4) {
                    sim = parts.slice(3).join(" ");
                } else {
                    sim = "MSFS 2020";
                }
            }
        }
        return { nb21Version, sim };
    }

    parseHFLine(line) {
        const idx = line.indexOf(':');
        if (idx < 0) return null;
        const key = line.substring(0, idx).trim();
        const value = line.substring(idx + 1).trim();
        return { key, value };
    }

    parseBRecord(lines) {
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            if (line.startsWith("B")) {
                return line.substring(1, 7);
            }
        }
        return "";
    }

    /**
     * Returns true if the IGC’s local date/time falls within ±30 minutes of
     * the task’s SimDateTime (ignoring year).
     */
    localDateTimeMatch(localDate, localTime, simDateTime) {
        const sim = simDateTime;
        if (!localDate || !localTime || !sim) return false;

        // 1) Task’s UTC DateTime
        const taskDT = new Date(sim.replace(' ', 'T') + 'Z');
        const taskYear = taskDT.getUTCFullYear();

        // 2) Pull month & day from the IGC’s LocalDate (YYYY-MM-DD)
        const [, , month, day] = localDate.match(/(\d{4})-(\d{2})-(\d{2})/);

        // 3) Build an IGC DateTime in the task’s year, in UTC
        const hh = localTime.slice(0, 2),
            mm = localTime.slice(2, 4),
            ss = localTime.slice(4, 6);
        const igcIso = `${taskYear}-${month}-${day}T${hh}:${mm}:${ss}Z`;
        const igcDT = new Date(igcIso);

        // 4) Compare abs diff ≤ 30 minutes
        return Math.abs(taskDT.getTime() - igcDT.getTime()) <= 30 * 60 * 1000;
    }

    // Main processing function.
    processIGCFile(file) {
        // Check if the user is logged in
        if (!this.taskBrowser.user) {
            alert("You must be logged in to upload IGC files. Please log in.");
            this.taskBrowser.switchTab("accountTab");
            return;
        }
        const reader = new FileReader();
        reader.onload = (e) => {
            const text = e.target.result;
            const lines = text.split(/\r?\n/);

            let headerData = null;
            const waypoints = [];

            // Reset additional fields.
            this.pilot = "";
            this.gliderID = "";
            this.competitionID = "";
            this.competitionClass = "";
            this.gliderType = "";
            this.nb21Version = "";
            this.sim = "";

            // Parse top lines (AXXX, HF...) before the first "C"
            for (let i = 0; i < lines.length; i++) {
                const line = lines[i].trim();
                if (line.startsWith("C")) break;
                if (line.startsWith("AXXX")) {
                    const aObj = this.parseALine(line);
                    this.nb21Version = aObj.nb21Version;
                    this.sim = aObj.sim;
                } else if (line.startsWith("HF")) {
                    const hfObj = this.parseHFLine(line);
                    if (hfObj) {
                        if (hfObj.key === "HFPLTPILOTINCHARGE") {
                            this.pilot = hfObj.value;
                        } else if (hfObj.key === "HFGIDGLIDERID") {
                            this.gliderID = hfObj.value;
                        } else if (hfObj.key === "HFCIDCOMPETITIONID") {
                            this.competitionID = hfObj.value;
                        } else if (hfObj.key === "HFCCLCOMPETITIONCLASS") {
                            this.competitionClass = hfObj.value;
                        } else if (hfObj.key === "HFGTYGLIDERTYPE") {
                            this.gliderType = hfObj.value;
                        }
                    }
                }
            }

            // Normalize Glider Type
            if (this.gliderType) {
                const normalized = B21_GLIDERS.find_glider_type(this.gliderType);
                if (normalized) {
                    this.gliderType = normalized;
                }
            }

            // Parse header and waypoints from C-lines.
            for (const line of lines) {
                if (line.startsWith("C")) {
                    if (!headerData) {
                        headerData = this.parseHeader(line);
                        if (headerData) continue;
                    }
                    const wp = this.parseWaypoint(line);
                    if (wp) {
                        waypoints.push(wp);
                    }
                }
            }

            let localDateRaw = "";
            let bCount = 0;
            for (const line of lines) {
                if (line.startsWith("B")) {
                    bCount++;
                    // if we've already captured a date by the first B, stop
                    if (bCount === 1 && localDateRaw) break;
                    // or once we hit the second B, stop regardless
                    if (bCount === 2) break;
                    continue;
                }
                // look for “LDAT <YYYYMMDD> <YYYYMMDD>”
                const m = line.match(/LDAT\s+\d{8}\s+(\d{8})/);
                if (m) {
                    localDateRaw = m[1];  // overwrite so the last one is kept
                }
            }

            // format “YYYYMMDD” → “YYYY‑MM‑DD”
            let localDate = "";
            if (localDateRaw) {
                const y = localDateRaw.slice(0, 4);
                const mo = localDateRaw.slice(4, 6);
                const d = localDateRaw.slice(6, 8);
                localDate = `${y}-${mo}-${d}`;
            }

            // Parse the B record for Begin Time.
            const beginTimeUTC = this.parseBRecord(lines);

            if (!headerData) {
                alert("Could not load flight plan from IGC file!");
                return;
            }

            const formattedDate = this.formatUTCDate(headerData.utcDate);
            const formattedUTCTime = this.formatTime(headerData.utcTime);
            const combinedUTCDisplay = `${formattedDate} ${formattedUTCTime}`;
            // For key construction, date/time must be in YYMMDDHHMMSS format.
            const keyRecordDateTime = this.formatKeyDateTime(headerData.utcDate, headerData.utcTime);

            // take the C‑record’s localTime…
            let localTime = headerData.localTime;
            // …unless it’s “000000”, in which case grab the second 6‑digit field from the first LTIM line
            if (localTime === '000000') {
                const ltimLine = lines.find(l => /\bLTIM\b/.test(l));
                if (ltimLine) {
                    const m = ltimLine.match(/LTIM\s+\d{6}\s+(\d{6})/);
                    if (m) localTime = m[1];
                }
            }

            // build as an array of pairs instead of an object
            const wpArray = waypoints.map(wp => ({
                id: wp.originalId,
                coord: `${wp.latitude},${wp.longitude}`
            }));

            // Prepare data to send to PHP.
            const igcData = {
                igcTitle: headerData.taskTitle,
                igcWaypoints: JSON.stringify(wpArray),
                pilot: this.pilot,
                gliderType: this.gliderType,
                IGCRecordDateTimeUTC: keyRecordDateTime,
                EntrySeqID: "",
                LocalTime: localTime,
                LocalDate: localDate,
                BeginTimeUTC: beginTimeUTC,
                gliderID: this.gliderID,
                competitionID: this.competitionID,
                competitionClass: this.competitionClass,
                NB21Version: this.nb21Version,
                Sim: this.sim
            };

            // Save igcData in the instance for later use.
            this.igcData = igcData;

            // Build FormData and append each field.
            const formData = new FormData();
            for (let key in igcData) {
                formData.append(key, igcData[key]);
            }
            // Append the IGC file.
            formData.append('igcFile', file);

            // Query the server for a matching task.
            this.taskBrowser.tbm.showLoadingSpinner("Processing IGC file...");
            fetch('php/SearchTaskByIGC.php', {
                method: 'POST',
                body: formData,
                credentials: 'include'
            })
                .then(response => response.json())
                .then(data => {
                    this.taskBrowser.tbm.hideLoadingSpinner();
                    if (data.status === 'not_found') {
                        alert("Task not found in the database.");
                    }
                    else if (data.status === 'duplicate') {
                        alert("IGC file already exists in the database.");
                    }
                    else if (data.status === 'found') {
                        igcData.EntrySeqID = data.EntrySeqID;
                        // Construct the IGCKey using the new format:
                        // EntrySeqID_CompetitionID_GliderType_IGCRecordDateTimeUTC
                        const key = `${igcData.EntrySeqID}_${igcData.competitionID}_${igcData.gliderType}_${igcData.IGCRecordDateTimeUTC}`;
                        igcData.IGCKey = key;

                        // Build the matching details HTML.
                        let resultsLine = "";
                        if (data.browserless && data.browserless.parsedResults) {
                            const r = data.browserless.parsedResults;
                            // Build the prefix using emoji for validity, task status, and penalties.
                            resultsLine += r.IGCValid ? "🔒" : "❗";
                            resultsLine += r.TaskCompleted ? "🏁" : "❌";
                            resultsLine += this.localDateTimeMatch(igcData.LocalDate, igcData.LocalTime, data.SimDateTime)
                                ? "⌚"
                                : "❌";
                            resultsLine += r.Penalties ? "👮" : "✅";

                            // Build an array for the metrics (duration, distance, speed).
                            let metrics = [];
                            if (r.Duration) {
                                metrics.push(r.Duration);
                            }
                            if (r.Distance) {
                                metrics.push(`${r.Distance} km`);
                            }
                            if (r.Speed) {
                                metrics.push(`${r.Speed} km/h`);
                            }

                            // If any metrics exist, join them with commas and add as a suffix.
                            if (metrics.length > 0) {
                                resultsLine += " - " + metrics.join(", ");
                            }

                            // Finally, append TPVersion in parentheses if present
                            if (r.TPVersion) {
                                resultsLine += ` (${r.TPVersion})`;
                            }
                        }

                        let html = `<h3>IGC Submission - Task Found!</h3>`;
                        html += `<strong>UTC of IGC record:</strong> ${combinedUTCDisplay}</br>`;
                        html += `<strong>UTC Begin Time:</strong> ${this.formatTime(beginTimeUTC)}</br>`;
                        html += `<strong>Local Time of Recording:</strong> ${localDate} ${this.formatTime(localTime)}</br>`;
                        html += `<strong>Pilot:</strong> ${this.pilot}</br>`;
                        html += `<strong>Comp. ID:</strong> ${this.competitionID}</br>`;
                        html += `<strong>Comp. Class:</strong> ${this.competitionClass}</br>`;
                        html += `<strong>Glider Type:</strong> ${this.gliderType}</br>`;
                        html += `<strong>Results:</strong> ${resultsLine}</br>`;
                        html += `<strong>Comment:</strong> <input type="text" id="igcCommentField" placeholder="Enter your comment here"></br>`;
                        html += `<a href="#" onclick="TB.IGCUpload.sendIGCToOnlinePlanner();">Open this IGC file on the B21 Task Planner</a></br>`;
                        html += `<button id="submitIGCBtn" class="button-style">Submit</button>`;
                        html += ` <button id="cancelIGCBtn" class="button-style">Cancel</button>`;
                        html += `<span style="color: white; font-weight: bold; animation: blink 1s steps(2, start) infinite;"> &larr; Select to continue</span>`;
                        html += `</br><hr>`;

                        this.taskBrowser.igcMatchData = html;

                        // Select the task on the map.
                        this.taskBrowser.tbm.deselectTask();
                        this.taskBrowser.tbm.selectTaskFromURL(data.EntrySeqID, false, ["Leader Board"]);
                        // Draw the IGC.
                        this.taskBrowser.tbm.processIGCRecordDisplay(data.EntrySeqID, igcData.IGCKey, true, text);
                    }
                    else if (data.error) {
                        this.taskBrowser.tbm.hideLoadingSpinner();
                        alert("Error from server: " + data.error);
                    }
                    else {
                        this.taskBrowser.tbm.hideLoadingSpinner();
                        alert("Unexpected server response.");
                    }
                })
                .catch(error => {
                    this.taskBrowser.tbm.hideLoadingSpinner();
                    console.error('Error:', error);
                    alert("Error contacting the server: " + error);
                });
        };
        reader.readAsText(file);
    }

    sendIGCToOnlinePlanner() {
        if (!this.igcData || !this.igcData.IGCKey) {
            alert("No IGC file has been saved for submission.");
            return;
        }
        // Create a FormData object and append required fields.
        const formData = new FormData();
        formData.append('EntrySeqID', this.igcData.EntrySeqID);
        formData.append('TaskID', this.taskBrowser.currentTask.TaskID);
        formData.append('PLNFilename', this.taskBrowser.currentTask.PLNFilename);
        formData.append('WPRFilename', this.taskBrowser.currentTask.WPRFilename);
        formData.append('tempIGCKey', this.igcData.IGCKey);

        // Call the PHP script that uses the tempIGCKey (or the IGC key list, in other mode)
        // to prepare the comp file and return the URL parts for the Online Planner.
        fetch('php/SendIGCToTaskPlanner.php', {
            method: 'POST',
            body: formData
        })
            .then(response => response.json())
            .then(result => {
                if (result.status === 'success' && result.plannerUrl) {
                    // Remove protocol (http:// or https://) if needed.
                    let plannerUrl = result.plannerUrl.replace(/^https?:\/\//, '');
                    // Build the full URL for the planner.
                    const fullPlannerUrl = `https://${plannerUrl}`;
                    const newWindow = window.open('', '_blank');  // Open immediately on user click
                    newWindow.location.href = fullPlannerUrl;  // Navigate the pre-opened window
                } else {
                    alert("Error processing IGC file for planner: " + (result.message || result.error || "Unknown error"));
                }
            })
            .catch(error => {
                console.error('Error:', error);
                alert("Error processing IGC file for planner.");
            });
    }

    submitIGCRecord() {
        // Check that we have stored igcData with a valid IGCKey.
        if (!this.igcData || !this.igcData.IGCKey) {
            alert("No saved IGC file available for submission.");
            return;
        }
        // Use the stored igcData from processIGCFile.
        const igcData = this.igcData;
        const formData = new FormData();
        const key = igcData.IGCKey;
        formData.append('IGCKey', key);
        formData.append('EntrySeqID', igcData.EntrySeqID);
        formData.append('IGCRecordDateTimeUTC', igcData.IGCRecordDateTimeUTC);
        formData.append('IGCUploadDateTimeUTC', new Date().toISOString().replace('T', ' ').substring(0, 19));
        formData.append('LocalDate', igcData.LocalDate);
        formData.append('LocalTime', igcData.LocalTime);
        formData.append('BeginTimeUTC', igcData.BeginTimeUTC);
        formData.append('Pilot', igcData.pilot);
        formData.append('GliderType', igcData.gliderType);
        formData.append('GliderID', igcData.gliderID);
        formData.append('CompetitionID', igcData.competitionID);
        formData.append('CompetitionClass', igcData.competitionClass);
        formData.append('NB21Version', igcData.NB21Version);
        formData.append('Sim', igcData.Sim);

        // No need to append the IGC file anymore.

        // Retrieve the IGC comment from the input field.
        const commentField = document.getElementById('igcCommentField');
        const igcComment = commentField ? commentField.value : "";
        formData.append('IGCComment', igcComment);

        // Append the internal user ID (WSGUserID) from the TB object.
        if (this.taskBrowser.user && this.taskBrowser.user.id) {
            formData.append('WSGUserID', this.taskBrowser.user.id);
        }

        fetch('php/SaveIGCRecord.php', {
            method: 'POST',
            body: formData
        })
            .then(response => response.json())
            .then(result => {
                if (result.status === 'success') {
                    alert("Your IGC record was saved successfully! Thank you!");
                    // Clear the match data.
                    this.taskBrowser.igcMatchData = "";
                    this.taskBrowser.enableMapInteractions();
                    this.taskBrowser.tbm.selectTaskFromURL(igcData.EntrySeqID, false, ["Leader Board"]);
                } else if (result.status === 'duplicate') {
                    alert("Duplicate IGC record exists. Cannot offer Save.");
                } else {
                    alert("Error saving IGC record: " + (result.message || result.error || "Unknown error"));
                }
            })
            .catch(error => {
                console.error('Error:', error);
                alert("Error submitting IGC record.");
            });
    }

}
