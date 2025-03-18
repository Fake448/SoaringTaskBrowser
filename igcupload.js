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

// Parse the header (first C record) from the IGC file
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

// Parse a waypoint line using IGC format
// Example: 
// C7056649N00839140WENJA;5;Jan Mayensfield
// C7056370N00843548W*Start+1286x2000
function parseWaypoint(line) {
    // Regex breakdown:
    // ^C
    // (\d{2})   : Latitude degrees
    // (\d{2})   : Latitude minutes
    // (\d{3})   : Latitude thousandths of minutes
    // ([NS])    : Latitude hemisphere
    // (\d{3})   : Longitude degrees
    // (\d{2})   : Longitude minutes
    // (\d{3})   : Longitude thousandths of minutes
    // ([EW])    : Longitude hemisphere
    // (.*)$     : Remainder as the waypoint name and extra text
    const wpRegex = /^C(\d{2})(\d{2})(\d{3})([NS])(\d{3})(\d{2})(\d{3})([EW])(.*)$/;
    const match = line.match(wpRegex);
    if (!match) return null;
    const latDeg = match[1];
    const latMin = match[2];
    const latThousandths = match[3];
    const latHem = match[4];
    const lonDeg = match[5];
    const lonMin = match[6];
    const lonThousandths = match[7];
    const lonHem = match[8];
    const remainder = match[9].trim(); // waypoint id and any extra info
    return {
        latitude: formatCoordinate(latDeg, latMin, latThousandths, latHem),
        longitude: formatCoordinate(lonDeg, lonMin, lonThousandths, lonHem),
        rawText: remainder
    };
}

// Format coordinate from IGC parts to a human-readable string (e.g., N70° 56' 38.92")
function formatCoordinate(deg, min, thousandths, hemisphere) {
    const degrees = parseInt(deg, 10);
    const minutes = parseInt(min, 10);
    const thousandthsNum = parseInt(thousandths, 10);
    // Convert thousandths of a minute to seconds
    const seconds = (thousandthsNum / 1000) * 60;
    const secondsFormatted = seconds.toFixed(2);
    return `${hemisphere}${degrees}° ${minutes}' ${secondsFormatted}"`;
}

// Format a DDMMYY string as a readable date (using UTC to avoid timezone shifts)
function formatUTCDate(ddmmyy) {
    const day = parseInt(ddmmyy.substring(0, 2), 10);
    const month = parseInt(ddmmyy.substring(2, 4), 10);
    const year = parseInt(ddmmyy.substring(4, 6), 10) + 2000;
    const utcDate = new Date(Date.UTC(year, month - 1, day));
    const options = { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' };
    return utcDate.toLocaleDateString('en-US', options);
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

        // Process lines beginning with "C"
        for (const line of lines) {
            if (line.startsWith("C")) {
                if (!headerData) {
                    headerData = parseHeader(line);
                    if (headerData) continue; // header parsed; move to next line
                }
                const wp = parseWaypoint(line);
                if (wp) {
                    waypoints.push(wp);
                }
            }
        }

        if (headerData) {
            const formattedDate = formatUTCDate(headerData.utcDate);
            const formattedUTCTime = formatTime(headerData.utcTime);
            const formattedLocalTime = formatTime(headerData.localTime);

            let outputHTML = `<h2>Task: ${headerData.taskTitle}</h2>`;
            outputHTML += `<p><strong>UTC Date of IGC record:</strong> ${formattedDate}</p>`;
            outputHTML += `<p><strong>UTC Time of IGC record:</strong> ${formattedUTCTime}</p>`;
            outputHTML += `<p><strong>Local Time of Recording Start (Takeoff):</strong> ${formattedLocalTime}</p>`;
            outputHTML += `<p><strong>Flight ID:</strong> ${headerData.flightId}</p>`;
            outputHTML += `<p><strong>Number of Waypoints:</strong> ${headerData.numWaypoints}</p>`;
            outputHTML += `<h3>Waypoints:</h3>`;
            outputHTML += `<ul>`;
            waypoints.forEach(wp => {
                outputHTML += `<li><strong>${wp.rawText}:</strong> ${wp.latitude}, ${wp.longitude}</li>`;
            });
            outputHTML += `</ul>`;
            outputDiv.innerHTML = outputHTML;
        } else {
            outputDiv.innerHTML = `<p style="color: red;">Could not parse header from IGC file.</p>`;
        }
    };
    reader.readAsText(file);
}
