const dropZone = document.getElementById('dropZone');
const fileInput = document.getElementById('igcFileInput');
const selectFileButton = document.getElementById('selectFileButton');
const outputDiv = document.getElementById('output');

let igcFileGlobal = null; // Store the uploaded file globally
let matchedEntrySeqID = ""; // Will be set after a match is found

// -------------- EVENT LISTENERS --------------

// Trigger file input when the button is clicked
selectFileButton.addEventListener('click', () => {
    fileInput.click();
});

// Handle file selection via file input
fileInput.addEventListener('change', (event) => {
    const file = event.target.files[0];
    if (file) {
        igcFileGlobal = file;
        processIGCFile(file);
    }
});

// Prevent default drag/drop behaviors
['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
    dropZone.addEventListener(eventName, (e) => {
        e.preventDefault();
        e.stopPropagation();
    });
});

// Highlight drop zone when file is dragged over
['dragenter', 'dragover'].forEach(eventName => {
    dropZone.addEventListener(eventName, () => {
        dropZone.classList.add('dragover');
    });
});

// Remove highlight when file is dragged away or dropped
['dragleave', 'drop'].forEach(eventName => {
    dropZone.addEventListener(eventName, () => {
        dropZone.classList.remove('dragover');
    });
});

// Handle dropped file
dropZone.addEventListener('drop', (e) => {
    const dt = e.dataTransfer;
    const file = dt.files[0];
    if (file) {
        igcFileGlobal = file;
        processIGCFile(file);
    }
});

// -------------- PARSING FUNCTIONS --------------

function parseHeader(headerLine) {
    const headerRegex = /^C(\d{6})(\d{6})(\d{6})(\d{4})(\d{2})(.*)$/;
    const match = headerLine.match(headerRegex);
    if (!match) return null;
    return {
        utcDate: match[1],
        utcTime: match[2],
        localTime: match[3],
        flightId: match[4],
        numWaypoints: match[5],
        taskTitle: match[6].trim()
    };
}

function parseWaypoint(line) {
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
        latitude: formatCoordinate(latDeg, latMin, latThousandths, latHem),
        longitude: formatCoordinate(lonDeg, lonMin, lonThousandths, lonHem)
    };
}

function formatCoordinate(deg, min, thousandths, hemisphere) {
    const degrees = parseInt(deg, 10);
    const minutes = parseInt(min, 10);
    const thousandthsNum = parseInt(thousandths, 10);
    const seconds = (thousandthsNum / 1000) * 60;
    const secondsFormatted = seconds.toFixed(2);
    return `${hemisphere}${degrees}\u00B0 ${minutes}' ${secondsFormatted}"`;
}

function formatUTCDate(ddmmyy) {
    const day = parseInt(ddmmyy.substring(0, 2), 10);
    const month = parseInt(ddmmyy.substring(2, 4), 10);
    const year = parseInt(ddmmyy.substring(4, 6), 10) + 2000;
    const utcDate = new Date(Date.UTC(year, month - 1, day));
    const options = { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' };
    return utcDate.toLocaleDateString('en-US', options);
}

function formatTime(hhmmss) {
    const hh = hhmmss.substring(0, 2);
    const mm = hhmmss.substring(2, 4);
    const ss = hhmmss.substring(4, 6);
    return `${hh}:${mm}:${ss}`;
}

function parseALine(line) {
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

function parseHFLine(line) {
    const idx = line.indexOf(':');
    if (idx < 0) return null;
    const key = line.substring(0, idx).trim();
    const value = line.substring(idx + 1).trim();
    return { key, value };
}

let pilot = "";
let gliderID = "";
let competitionID = "";
let competitionClass = "";
let gliderType = "";
let nb21Version = "";
let sim = "";

function parseBRecord(lines) {
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (line.startsWith("B")) {
            return line.substring(1, 7);
        }
    }
    return "";
}

// -------------- MAIN PROCESSING --------------
function processIGCFile(file) {
    const reader = new FileReader();
    reader.onload = function (e) {
        const text = e.target.result;
        const lines = text.split(/\r?\n/);

        let headerData = null;
        const waypoints = [];

        // Parse top lines (AXXX, HF...) before the first "C"
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            if (line.startsWith("C")) break;
            if (line.startsWith("AXXX")) {
                const aObj = parseALine(line);
                nb21Version = aObj.nb21Version;
                sim = aObj.sim;
            } else if (line.startsWith("HF")) {
                const hfObj = parseHFLine(line);
                if (hfObj) {
                    if (hfObj.key === "HFPLTPILOTINCHARGE") {
                        pilot = hfObj.value;
                    } else if (hfObj.key === "HFGIDGLIDERID") {
                        gliderID = hfObj.value;
                    } else if (hfObj.key === "HFCIDCOMPETITIONID") {
                        competitionID = hfObj.value;
                    } else if (hfObj.key === "HFCCLCOMPETITIONCLASS") {
                        competitionClass = hfObj.value;
                    } else if (hfObj.key === "HFGTYGLIDERTYPE") {
                        gliderType = hfObj.value;
                    }
                }
            }
        }

        // Parse header and waypoints from C-lines
        for (const line of lines) {
            if (line.startsWith("C")) {
                if (!headerData) {
                    headerData = parseHeader(line);
                    if (headerData) continue;
                }
                const wp = parseWaypoint(line);
                if (wp) waypoints.push(wp);
            }
        }

        // Parse the B record for Begin Time
        const beginTimeUTC = parseBRecord(lines);

        if (headerData) {
            const formattedDate = formatUTCDate(headerData.utcDate);
            const formattedUTCTime = formatTime(headerData.utcTime);
            const combinedUTC = `${formattedDate} ${formattedUTCTime}`;

            // Prepare data to send to PHP (including waypoints for matching)
            // IMPORTANT: Set EntrySeqID to the matched task's EntrySeqID later.
            const igcData = {
                igcTitle: headerData.taskTitle,
                igcWaypoints: {},
                pilot: pilot,
                gliderType: gliderType,
                IGCRecordDateTimeUTC: combinedUTC,
                // We'll update EntrySeqID after matching.
                EntrySeqID: "",
                LocalTime: headerData.localTime,
                BeginTimeUTC: beginTimeUTC,
                gliderID: gliderID,
                competitionID: competitionID,
                competitionClass: competitionClass,
                NB21Version: nb21Version,
                Sim: sim
            };
            waypoints.forEach(wp => {
                igcData.igcWaypoints[wp.originalId] = wp.latitude + ", " + wp.longitude;
            });

            // Build output HTML (display only requested fields)
            let outputHTML = `<h2>Task: ${headerData.taskTitle}</h2>`;
            outputHTML += `<p><strong>UTC Date & Time of IGC record:</strong> ${combinedUTC}</p>`;
            outputHTML += `<p><strong>Local Time of Recording:</strong> ${formatTime(headerData.localTime)}</p>`;
            outputHTML += `<p><strong>Begin Time (UTC) from B record:</strong> ${formatTime(beginTimeUTC)}</p>`;
            outputHTML += `<p><strong>NB21 Version:</strong> ${nb21Version}</p>`;
            outputHTML += `<p><strong>Sim:</strong> ${sim}</p>`;
            outputHTML += `<p><strong>Pilot:</strong> ${pilot}</p>`;
            outputHTML += `<p><strong>Glider ID:</strong> ${gliderID}</p>`;
            outputHTML += `<p><strong>Competition ID:</strong> ${competitionID}</p>`;
            outputHTML += `<p><strong>Competition Class:</strong> ${competitionClass}</p>`;
            outputHTML += `<p><strong>Glider Type:</strong> ${gliderType}</p>`;
            outputDiv.innerHTML = outputHTML;

            // First, send data to SearchTaskByIGC.php to match a task.
            fetch('php/SearchTaskByIGC.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(igcData)
            })
                .then(response => response.json())
                .then(data => {
                    if (data.status === 'found') {
                        // Update igcData.EntrySeqID with the matched task's EntrySeqID.
                        igcData.EntrySeqID = data.EntrySeqID;
                        outputDiv.innerHTML += `<p><strong>Match found!</strong></p>`;
                        outputDiv.innerHTML += `<p>WeSimGlide Task ID: ${data.EntrySeqID}</p>`;
                        outputDiv.innerHTML += `<p>Title: ${data.Title}</p>`;
                        // Add a "Submit" button to save the IGC record.
                        outputDiv.innerHTML += `<button class="button-style" id="submitButton">Submit</button>`;
                        document.getElementById('submitButton').addEventListener('click', () => {
                            submitIGCRecord(igcData);
                        });
                    } else if (data.status === 'duplicate') {
                        outputDiv.innerHTML += `<p style="color: red;"><strong>Duplicate IGC record exists. Not saved.</strong></p>`;
                    } else {
                        outputDiv.innerHTML += `<p><strong>No matching task found.</strong></p>`;
                    }
                })
                .catch(error => {
                    console.error('Error:', error);
                    outputDiv.innerHTML += `<p style="color: red;">Error processing the search.</p>`;
                });

        } else {
            outputDiv.innerHTML = `<p style="color: red;">Could not parse header from IGC file.</p>`;
        }
    };
    reader.readAsText(file);
}

// This function is called when the user clicks "Submit" after a match is found.
// It sends a FormData object (including the IGC file and all required parameters) to SaveIGCRecord.php.
function submitIGCRecord(igcData) {
    if (!igcFileGlobal) {
        alert("No IGC file available for submission.");
        return;
    }
    const formData = new FormData();
    // Construct the IGCKey using the format: EntrySeqID_Pilot_GliderType_IGCRecordDateTimeUTC
    const key = `${igcData.EntrySeqID}_${igcData.pilot}_${igcData.gliderType}_${igcData.IGCRecordDateTimeUTC}`;
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

    // Append the actual IGC file.
    formData.append('igcFile', igcFileGlobal);

    fetch('php/SaveIGCRecord.php', {
        method: 'POST',
        body: formData
    })
        .then(response => response.json())
        .then(result => {
            if (result.status === 'success') {
                alert("IGC record saved successfully with key: " + result.IGCKey);
            } else if (result.status === 'duplicate') {
                alert("Duplicate IGC record exists. Not saved.");
            } else {
                alert("Error saving IGC record: " + (result.message || result.error || "Unknown error"));
            }
        })
        .catch(error => {
            console.error('Error:', error);
            alert("Error submitting IGC record.");
        });
}
