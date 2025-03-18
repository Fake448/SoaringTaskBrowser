const dropZone = document.getElementById('dropZone');
const fileInput = document.getElementById('igcFileInput');
const selectFileButton = document.getElementById('selectFileButton');
const outputDiv = document.getElementById('output');

// Trigger file input when the button is clicked
selectFileButton.addEventListener('click', () => {
    fileInput.click();
});

// Handle file selection via file input
fileInput.addEventListener('change', (event) => {
    const file = event.target.files[0];
    if (file) {
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
        processIGCFile(file);
    }
});

// Parse the header line from the IGC file
// Expected format:
// C[UTC Date (6)] [UTC Time (6)] [Local Time (6)] [Flight ID (4)] [# Waypoints (2)] [Task Title]
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

// Parse a waypoint line from the IGC file
// Expected format for waypoints (after header):
// C[latitude (7 digits + N/S)] [longitude (9 digits + E/W)] [Waypoint ID string]
function parseWaypoint(line) {
    const wpRegex = /^C(\d{7}[NS])(\d{9}[EW])(.*)$/;
    const match = line.match(wpRegex);
    if (!match) return null;
    return {
        latitude: match[1],
        longitude: match[2],
        id: match[3].trim()
    };
}

// Format a DDMMYY string as a readable date
function formatUTCDate(ddmmyy) {
    const day = ddmmyy.substring(0, 2);
    const month = ddmmyy.substring(2, 4);
    const year = ddmmyy.substring(4, 6);
    const date = new Date(`20${year}-${month}-${day}`);
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

// Format a time string HHMMSS as HH:MM:SS
function formatTime(hhmmss) {
    const hh = hhmmss.substring(0, 2);
    const mm = hhmmss.substring(2, 4);
    const ss = hhmmss.substring(4, 6);
    return `${hh}:${mm}:${ss}`;
}

// Process the IGC file once uploaded
function processIGCFile(file) {
    const reader = new FileReader();
    reader.onload = function (e) {
        const text = e.target.result;
        const lines = text.split(/\r?\n/);

        let headerData = null;
        const waypoints = [];

        // Process each line starting with "C"
        for (const line of lines) {
            if (line.startsWith("C")) {
                // If headerData is not yet set, try to parse the header
                if (!headerData) {
                    headerData = parseHeader(line);
                    if (headerData) continue; // Header found; skip to next line
                }
                // Otherwise, parse as a waypoint
                const wp = parseWaypoint(line);
                if (wp) {
                    waypoints.push(wp);
                }
            }
        }

        // If headerData was parsed, display the information
        if (headerData) {
            const formattedDate = formatUTCDate(headerData.utcDate);
            const formattedUTCTime = formatTime(headerData.utcTime);
            const formattedLocalTime = formatTime(headerData.localTime);

            let outputHTML = `<h2>IGC File Information</h2>`;
            outputHTML += `<p><strong>UTC Date of IGC record:</strong> ${formattedDate}</p>`;
            outputHTML += `<p><strong>UTC Time of IGC record:</strong> ${formattedUTCTime}</p>`;
            outputHTML += `<p><strong>Local Time of Recording Start (Takeoff):</strong> ${formattedLocalTime}</p>`;
            outputHTML += `<p><strong>Flight ID:</strong> ${headerData.flightId}</p>`;
            outputHTML += `<p><strong>Number of Waypoints:</strong> ${headerData.numWaypoints}</p>`;
            outputHTML += `<h3>Waypoints:</h3>`;
            outputHTML += `<ul>`;
            waypoints.forEach(wp => {
                outputHTML += `<li><strong>ID:</strong> ${wp.id} | <strong>Coordinates:</strong> ${wp.latitude} ${wp.longitude}</li>`;
            });
            outputHTML += `</ul>`;
            outputDiv.innerHTML = outputHTML;
        } else {
            outputDiv.innerHTML = `<p style="color: red;">Could not parse header from IGC file.</p>`;
        }
    };
    reader.readAsText(file);
}
