export default class IGCUpload {
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

            // top AXXX / HF lines
            for (let i = 0; i < lines.length; i++) {
                const line = lines[i].trim();
                if (line.startsWith("C")) break;
                if (line.startsWith("AXXX")) {
                    const aObj = this.parseALine(line);
                    this.nb21Version = aObj.nb21Version;
                    this.sim = aObj.sim;
                } else if (line.startsWith("HF")) {
                    const hf = this.parseHFLine(line);
                    if (hf) {
                        switch (hf.key) {
                            case "HFPLTPILOTINCHARGE": this.pilot = hf.value; break;
                            case "HFGIDGLIDERID": this.gliderID = hf.value; break;
                            case "HFCIDCOMPETITIONID": this.competitionID = hf.value; break;
                            case "HFCCLCOMPETITIONCLASS": this.competitionClass = hf.value; break;
                            case "HFGTYGLIDERTYPE": this.gliderType = hf.value; break;
                        }
                    }
                }
            }

            // Must come from the NB21 logger
            if (!this.nb21Version) {
                alert("Only IGC files generated by NB21 Logger are currently accepted.");
                return;
            }

            // normalize glider type
            if (this.gliderType) {
                const norm = B21_GLIDERS.find_glider_type(this.gliderType);
                if (norm) this.gliderType = norm;
            }

            // collect C‐records
            for (const line of lines) {
                if (!line.startsWith("C")) continue;
                if (!headerData) {
                    headerData = this.parseHeader(line);
                    if (headerData) continue;
                }
                const wp = this.parseWaypoint(line);
                if (wp) waypoints.push(wp);
            }

            // 2) LocalDate via LDAT
            let localDateRaw = "", bCount = 0;
            for (const l of lines) {
                if (l.startsWith("B")) {
                    bCount++;
                    if ((bCount === 1 && localDateRaw) || bCount === 2) break;
                    continue;
                }
                const m = l.match(/LDAT\s+\d{8}\s+(\d{8})/);
                if (m) localDateRaw = m[1];
            }
            let localDate = "";
            if (localDateRaw) {
                localDate = `${localDateRaw.slice(0, 4)}-${localDateRaw.slice(4, 6)}-${localDateRaw.slice(6, 8)}`;
            }

            // 3) BeginTimeUTC from first B‐record
            const beginTimeUTC = this.parseBRecord(lines);

            // ——————————————————————————————————————————————
            // If C‐header present → normal path
            // ——————————————————————————————————————————————
            if (headerData) {
                // build display + key
                const formattedDate = this.formatUTCDate(headerData.utcDate);
                const formattedUTCTime = this.formatTime(headerData.utcTime);
                const combinedUTCDisplay = `${formattedDate} ${formattedUTCTime}`;
                const keyRecordDateTime = this.formatKeyDateTime(headerData.utcDate, headerData.utcTime);

                // localTime fallback
                let localTime = headerData.localTime;
                if (localTime === "000000") {
                    const ltim = lines.find(l => /\bLTIM\b/.test(l));
                    const mm = ltim && ltim.match(/LTIM\s+\d{6}\s+(\d{6})/);
                    if (mm) localTime = mm[1];
                }

                // package waypoints + igcData
                const wpArray = waypoints.map(wp => ({
                    id: wp.originalId,
                    coord: `${wp.latitude},${wp.longitude}`
                }));

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
                    CombinedUTCDisplay: combinedUTCDisplay,
                    gliderID: this.gliderID,
                    competitionID: this.competitionID,
                    competitionClass: this.competitionClass,
                    NB21Version: this.nb21Version,
                    Sim: this.sim
                };

                this.igcData = igcData;

                // build formData + send
                const formData = new FormData();
                for (let k in igcData) formData.append(k, igcData[k]);
                formData.append("igcFile", file);

                this.taskBrowser.tbm.showLoadingSpinner("Processing IGC file...");
                this.prepareIGCOnServer(formData, text);
                return;
            }

            // ——————————————————————————————————————————————
            // NO C-header → fallback via HFDTE + manual-match
            // ——————————————————————————————————————————————

            // 0) Must have a task loaded
            const task = this.taskBrowser.currentTask;
            if (!task || !task.EntrySeqID) {
                alert("IGC missing C-header and no task selected → cannot match automatically.");
                return;
            }

            // 1) Ensure the map is centred on that task & details panel open
            this.taskBrowser.tbm.zoomToTask(task.EntrySeqID);
            this.taskBrowser.TaskDetailsPanelVisible = true;
            this.taskBrowser.showTaskDetailsPanel();

            // 2) pull date from HFDTE
            const hfdteLine = lines.find(l => l.startsWith("HFDTE"));
            let fallbackDate = null;
            if (hfdteLine) {
                const m = hfdteLine.match(/^HFDTE(\d{2})(\d{2})(\d{2})$/);
                if (m) {
                    const [, dd, mo, yy] = m;
                    fallbackDate = new Date(Date.UTC(
                        2000 + parseInt(yy, 10),
                        parseInt(mo, 10) - 1,
                        parseInt(dd, 10)
                    ));
                }
            }
            if (!fallbackDate) {
                alert("IGC missing C-header and invalid HFDTE → cannot determine UTC date.");
                return;
            }

            // 3) pull time from first B-record
            const B0 = lines.find(l => l.startsWith("B"));
            if (B0) {
                fallbackDate.setUTCHours(
                    parseInt(B0.substr(1, 2), 10),
                    parseInt(B0.substr(3, 2), 10),
                    parseInt(B0.substr(5, 2), 10)
                );
            }

            // localTime fallback
            let localTime = "";
            const ltim = lines.find(l => /\bLTIM\b/.test(l));
            const mm = ltim && ltim.match(/LTIM\s+\d{6}\s+(\d{6})/);
            if (mm) localTime = mm[1];

            // 4) build key + display
            const pad = n => String(n).padStart(2, "0");
            const Y = fallbackDate.getUTCFullYear();
            const keyRecordDateTime = [
                String(Y).slice(2),
                pad(fallbackDate.getUTCMonth() + 1),
                pad(fallbackDate.getUTCDate()),
                pad(fallbackDate.getUTCHours()),
                pad(fallbackDate.getUTCMinutes()),
                pad(fallbackDate.getUTCSeconds())
            ].join("");
            const combinedUTCDisplay =
                `${Y}-${pad(fallbackDate.getUTCMonth() + 1)}-${pad(fallbackDate.getUTCDate())}` +
                ` ${pad(fallbackDate.getUTCHours())}:${pad(fallbackDate.getUTCMinutes())}Z`;

            // 5) Draw the IGC track temporarily to compute coverage
            const tempKey = `manual_${Date.now()}`;
            this.taskBrowser.tbm.processIGCRecordDisplay(
                task.EntrySeqID,
                tempKey,
                true,    // show immediately
                text     // full IGC so it can parse trackpoints
            );

            const bounds = this.taskBrowser.tbm.map.getBounds();
            const latlngs = this.taskBrowser.tbm.igcTrackCache[tempKey].getLatLngs();
            const inside = latlngs.filter(p => bounds.contains(p)).length;
            const pct = inside / latlngs.length;

            // 6) if under 50%, abort (and remove track)
            if (pct < 0.5) {
                // remove the temp track
                const layer = this.taskBrowser.tbm.igcTrackCache[tempKey];
                if (layer) {
                    this.taskBrowser.tbm.map.removeLayer(layer);
                    delete this.taskBrowser.tbm.igcTrackCache[tempKey];
                }
                this.taskBrowser.tbm.hideLoadingSpinner();
                // Delay the alert so the map update and panel have time to render
                setTimeout(() => {
                    alert("IGC track does not sufficiently overlap the selected task → aborting.");
                }, 300);
                return;
            }

            // 7–9) delay the confirm + payload so the map & panel can finish rendering
            setTimeout(() => {
                // 7) ask user to confirm
                if (!confirm(
                    "This IGC lacks a C-header, but its track overlaps the loaded task.\n" +
                    "Match it to this task?"
                )) {
                    // user said No → remove the temp track
                    const layer = this.taskBrowser.tbm.igcTrackCache[tempKey];
                    if (layer) {
                        this.taskBrowser.tbm.map.removeLayer(layer);
                        delete this.taskBrowser.tbm.igcTrackCache[tempKey];
                    }
                    this.taskBrowser.tbm.hideLoadingSpinner();
                    return;
                }

                // 8) build the forced payload
                const wpArray = waypoints.map(wp => ({
                    id: wp.originalId,
                    coord: `${wp.latitude},${wp.longitude}`
                }));
                const igcData = {
                    igcTitle: task.taskTitle,
                    igcWaypoints: JSON.stringify(wpArray),
                    pilot: this.pilot,
                    gliderType: this.gliderType,
                    IGCRecordDateTimeUTC: keyRecordDateTime,
                    EntrySeqID: task.EntrySeqID,  // forced
                    LocalTime: localTime,
                    LocalDate: localDate,
                    BeginTimeUTC: beginTimeUTC,
                    CombinedUTCDisplay: combinedUTCDisplay,
                    gliderID: this.gliderID,
                    competitionID: this.competitionID,
                    competitionClass: this.competitionClass,
                    NB21Version: this.nb21Version,
                    Sim: this.sim
                };
                this.igcData = igcData;

                // 9) clean up the temp track, then send via your helper
                const layer = this.taskBrowser.tbm.igcTrackCache[tempKey];
                if (layer) {
                    this.taskBrowser.tbm.map.removeLayer(layer);
                    delete this.taskBrowser.tbm.igcTrackCache[tempKey];
                }
                const formData = new FormData();
                for (let k in igcData) formData.append(k, igcData[k]);
                formData.append("igcFile", file);
                this.taskBrowser.tbm.showLoadingSpinner("Matching IGC to task…");
                this.prepareIGCOnServer(formData, text);

            }, 300);
        };

        reader.readAsText(file);
    }

    prepareIGCOnServer(formData, IGCAsText) {
        const tbm = this.taskBrowser.tbm;
        const tb = this.taskBrowser;
        tbm.showLoadingSpinner("Processing IGC file...");

        fetch('php/SearchTaskByIGC.php', {
            method: 'POST',
            credentials: 'include',
            body: formData
        })
            .then(res => res.json())
            .then(data => {
                tbm.hideLoadingSpinner();

                if (data.status === 'not_found') {
                    alert("Task not found in the database.");
                    return;
                }
                if (data.status === 'duplicate') {
                    alert("IGC file already exists in the database.");
                    return;
                }
                if (data.status === 'found') {
                    // make sure we actually got Browserless results
                    if (!(data.browserless && data.browserless.parsedResults)) {
                        alert("An error occurred while processing the IGC file for results.");
                        return;
                    }

                    // 1) stash the EntrySeqID & build IGCKey
                    this.igcData.EntrySeqID = data.EntrySeqID;
                    this.igcData.WSGUserID = data.WSGUserID;
                    const key = [
                        this.igcData.EntrySeqID,
                        this.igcData.competitionID,
                        this.igcData.gliderType,
                        this.igcData.IGCRecordDateTimeUTC
                    ].join('_');
                    this.igcData.IGCKey = key;

                    // 2) build the little resultsLine string
                    const r = data.browserless.parsedResults;
                    let resultsLine = "";
                    resultsLine += r.IGCValid ? "🔒" : "❗";
                    resultsLine += r.TaskCompleted ? "🏁" : "❌";
                    resultsLine += this.localDateTimeMatch(
                        this.igcData.LocalDate,
                        this.igcData.LocalTime,
                        data.SimDateTime
                    ) ? "⌚" : "❌";
                    resultsLine += r.Penalties ? "👮" : "✅";

                    // if still empty something went wrong
                    if (!resultsLine) {
                        alert("An error occurred while processing the IGC file for results.");
                        return;
                    }

                    const metrics = [];
                    if (r.Duration) metrics.push(r.Duration);
                    if (r.Distance) metrics.push(`${r.Distance} km`);
                    if (r.Speed) metrics.push(`${r.Speed} km/h`);
                    if (metrics.length) resultsLine += " – " + metrics.join(", ");

                    if (r.TPVersion) resultsLine += ` (${r.TPVersion})`;

                    // ─────────────────────────────────────────────
                    //  new: build a WSG User line based on data.WSGUserID
                    // ─────────────────────────────────────────────
                    let wsgLine = '';
                    const returnedUid = data.WSGUserID;
                    if (returnedUid === tb.user.id) {
                        wsgLine = `<strong>WSG User:</strong> You (${tb.user.displayName})</br>`;
                    }
                    else if (returnedUid !== 0) {
                        wsgLine = `<strong>WSG User:</strong> Not you, but match found</br>`;
                    }
                    else {
                        wsgLine = `<strong>WSG User:</strong> Is it yours? ` +
                            `<label><input type="radio" name="wsgUserConfirm" value="yes"> Yes</label> ` +
                            `<label><input type="radio" name="wsgUserConfirm" value="no" checked> No</label>` +
                            `<span style="color:white;font-weight:bold;animation:blink 1s steps(2,start) infinite;"> ← Attention</span></br>`;
                    }

                    // 3) render the HTML exactly as before
                    const html = [
                        `<h3>IGC Submission – Task Found!</h3>`,
                        `<strong>UTC of IGC record:</strong> ${this.igcData.CombinedUTCDisplay}</br>`,
                        `<strong>UTC Begin Time:</strong> ${this.formatTime(this.igcData.BeginTimeUTC)}</br>`,
                        `<strong>Local Time of Recording:</strong> ${this.igcData.LocalDate} ${this.formatTime(this.igcData.LocalTime)}</br>`,
                        `<strong>Pilot:</strong> ${this.igcData.pilot}</br>`,
                        `<strong>Comp. ID:</strong> ${this.igcData.competitionID}</br>`,
                        wsgLine,
                        `<strong>Comp. Class:</strong> ${this.igcData.competitionClass}</br>`,
                        `<strong>Glider Type:</strong> ${this.igcData.gliderType}</br>`,
                        `<strong>Results:</strong> ${resultsLine}</br>`,
                        `<strong>Comment:</strong> <input type="text" id="igcCommentField" placeholder="Enter your comment here"></br>`,
                        `<a href="#" onclick="TB.IGCUpload.sendIGCToOnlinePlanner();">Open this IGC file on the B21 Task Planner</a></br>`,
                        `<button id="submitIGCBtn" class="button-style">Submit</button>`,
                        ` <button id="cancelIGCBtn" class="button-style">Cancel</button>`,
                        `<span style="color:white;font-weight:bold;animation:blink 1s steps(2,start) infinite;"> ← Select to continue</span>`,
                        `</br><hr>`
                    ].join("");

                    this.taskBrowser.igcMatchData = html;

                    // 4) select & draw
                    tbm.deselectTask();
                    tbm.selectTaskFromURL(data.EntrySeqID, false, ["Leader Board"]);
                    tbm.processIGCRecordDisplay(data.EntrySeqID, this.igcData.IGCKey, true, IGCAsText);
                    return;
                }

                // any other case
                if (data.error) {
                    alert("Error from server: " + data.error);
                } else {
                    alert("Unexpected server response.");
                }
            })
            .catch(err => {
                tbm.hideLoadingSpinner();
                console.error("Error:", err);
                alert("Error contacting the server: " + err);
            });
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

        // Determine final WSGUserID:
        let finalUid = igcData.WSGUserID;      // from the search step
        if (finalUid === 0) {
            // if “No match” case, see if user clicked “Yes”
            const choice = document.querySelector('input[name="wsgUserConfirm"]:checked');
            if (choice && choice.value === 'yes') {
                finalUid = this.taskBrowser.user.id;
            }
        }
        formData.append('WSGUserID', finalUid);

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
