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

    // Main processing function.
    processIGCFile(file) {
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

            // Parse the B record for Begin Time.
            const beginTimeUTC = this.parseBRecord(lines);

            if (!headerData) {
                alert("Could not parse header from IGC file.");
                return;
            }

            const formattedDate = this.formatUTCDate(headerData.utcDate);
            const formattedUTCTime = this.formatTime(headerData.utcTime);
            const combinedUTCDisplay = `${formattedDate} ${formattedUTCTime}`;
            // For key construction, date/time must be in YYMMDDHHMMSS format.
            const keyRecordDateTime = this.formatKeyDateTime(headerData.utcDate, headerData.utcTime);

            // Prepare data to send to PHP.
            const igcData = {
                igcTitle: headerData.taskTitle,
                igcWaypoints: {},
                pilot: this.pilot,
                gliderType: this.gliderType,
                IGCRecordDateTimeUTC: keyRecordDateTime,  // For key purposes.
                EntrySeqID: "", // To be updated after matching.
                LocalTime: headerData.localTime,
                BeginTimeUTC: beginTimeUTC,
                gliderID: this.gliderID,
                competitionID: this.competitionID,
                competitionClass: this.competitionClass,
                NB21Version: this.nb21Version,
                Sim: this.sim
            };

            waypoints.forEach(wp => {
                igcData.igcWaypoints[wp.originalId] = `${wp.latitude}, ${wp.longitude}`;
            });

            // Query the server for a matching task.
            fetch('php/SearchTaskByIGC.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(igcData)
            })
                .then(response => response.json())
                .then(data => {
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

                        // Now build the matching details HTML and assign it to TB's igcMatchData property.
                        let html = `<h3>IGC Submission - Task Found!</h3>`;
                        html += `<strong>UTC Date & Time of IGC record:</strong> ${combinedUTCDisplay}</br>`;
                        html += `<strong>Begin Time (UTC):</strong> ${this.formatTime(beginTimeUTC)}</br>`;
                        html += `<strong>Local Time of Recording:</strong> ${this.formatTime(headerData.localTime)}</br>`;
                        html += `<strong>Pilot:</strong> ${this.pilot}</br>`;
                        html += `<strong>Comp. ID:</strong> ${this.competitionID}</br>`;
                        html += `<strong>Comp. Class:</strong> ${this.competitionClass}</br>`;
                        html += `<strong>Glider Type:</strong> ${this.gliderType}</br>`;
                        html += `<button id="submitIGCBtn" class="button-style">Submit</button>`;
                        html += ` <button id="cancelIGCBtn" class="button-style">Cancel</button>`;
                        html += `<span style="color: green; font-weight: bold; animation: blink 1s steps(2, start) infinite;"> &larr; Select to continue</span>`;
                        html += `</br><hr>`;

                        this.taskBrowser.igcMatchData = html;

                        // Select the task on the map.
                        this.taskBrowser.tbm.selectTaskFromURL(data.EntrySeqID);

                    }
                    else if (data.error) {
                        alert("Error from server: " + data.error);
                    }
                    else {
                        alert("Unexpected server response.");
                    }
                })
                .catch(error => {
                    console.error('Error:', error);
                    alert("Error contacting the server: " + error);
                });
        };
        reader.readAsText(file);
    }

    submitIGCRecord(igcData) {
        if (!this.igcFileGlobal) {
            alert("No IGC file available for submission.");
            return;
        }
        const formData = new FormData();
        const key = igcData.IGCKey;
        formData.append('IGCKey', key);
        formData.append('EntrySeqID', igcData.EntrySeqID);
        formData.append('IGCRecordDateTimeUTC', igcData.IGCRecordDateTimeUTC);
        formData.append('IGCUploadDateTimeUTC', new Date().toISOString().replace('T', ' ').substring(0, 19));
        formData.append('LocalTime', igcData.LocalTime);
        formData.append('BeginTimeUTC', igcData.BeginTimeUTC);
        formData.append('Pilot', igcData.pilot);
        formData.append('GliderType', igcData.gliderType);
        formData.append('GliderID', igcData.gliderID);
        formData.append('CompetitionID', igcData.competitionID);
        formData.append('CompetitionClass', igcData.competitionClass);
        formData.append('NB21Version', igcData.NB21Version);
        formData.append('Sim', igcData.Sim);

        formData.append('igcFile', this.igcFileGlobal);

        fetch('php/SaveIGCRecord.php', {
            method: 'POST',
            body: formData
        })
            .then(response => response.json())
            .then(result => {
                if (result.status === 'success') {
                    alert("IGC record saved successfully with key: " + result.IGCKey);
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

    deleteIGCRecord(IGCKey) {
        const formData = new FormData();
        formData.append('IGCKey', IGCKey);

        fetch('php/DeleteIGCRecord.php', {
            method: 'POST',
            body: formData
        })
            .then(response => response.json())
            .then(result => {
                if (result.status === 'success') {
                    alert("IGC record deleted successfully with key: " + result.IGCKey);
                    this.outputDiv.innerHTML += `<p style="color: green;"><strong>IGC record deleted.</strong></p>`;
                } else {
                    alert("Error deleting IGC record: " + (result.message || result.error || "Unknown error"));
                }
            })
            .catch(error => {
                console.error('Error:', error);
                alert("Error deleting IGC record.");
            });
    }
}
