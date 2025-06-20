import TaskBrowser from './task_browser.js';

var TB = new TaskBrowser();
var igcUpload = new IGCUpload(TB);

TB.init(igcUpload);
if (!TB.isDownloadPage) {
    igcUpload.init();
}

setupEventListeners();

let lastTopIGCKey = null;
let homeTabWasLoaded = false;

// Add resizer functionality
let isResizing = false;
const resizer = document.getElementById('resizer');
const mapContainer = document.getElementById('map');
const taskDetailContainer = document.getElementById('taskDetailContainer');

if (!TB.isDownloadPage) {
    resizer.addEventListener('mousedown', (e) => {
        isResizing = true;
        document.addEventListener('mousemove', resize);
        document.addEventListener('mouseup', stopResize);
    });
}

function resize(e) {
    if (isResizing) {
        const containerWidth = mapContainer.offsetWidth + taskDetailContainer.offsetWidth;
        const newMapWidth = e.clientX / containerWidth * 100;
        const newTaskDetailWidth = 100 - newMapWidth;

        mapContainer.style.width = `${newMapWidth}%`;
        taskDetailContainer.style.width = `${newTaskDetailWidth}%`;

        TB.taskDetailsContainerWidth = taskDetailContainer.style.width;

        TB.resizeMap(); // Ensure map is resized
        TB.saveMapUserSettings(); // Save the splitter position
    }
}

function stopResize() {
    isResizing = false;
    document.removeEventListener('mousemove', resize);
    document.removeEventListener('mouseup', stopResize);
}

// Call resizeMap initially to ensure correct sizing on load
TB.resizeMap();

function forceReload() {
    const url = window.location.origin + window.location.pathname + '?reload=' + new Date().getTime();
    window.location.href = url;
}

function forceDownload(url, filename) {
    fetch(url)
        .then(response => {
            if (!response.ok) {
                throw new Error("Network response was not ok");
            }
            return response.blob();
        })
        .then(blob => {
            const blobUrl = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.style.display = 'none';
            a.href = blobUrl;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(blobUrl);
        })
        .catch(err => console.error('Download error:', err));
}

function switchToMapAndSelectTask(entrySeqID, doNotExpand = false, sectionsToExpand = []) {
    TB.switchTab('mapTab');
    TB.tbm.selectTaskFromURL(entrySeqID, doNotExpand, sectionsToExpand);
}

function loadAccountInfo() {
    TB.getUserConnectionInfo().then(info => {
        const accountContent = document.getElementById('account-content');
        accountContent.innerHTML = ''; // clear first

        if (!info.loggedIn) {
            accountContent.innerHTML = `
        <p>You are not logged in.</p>
        <button class="button-style" onclick="window.location.href='php/login.php'">
          Login with Discord
        </button>
      `;
            return;
        }

        const { displayName, avatar, pilotName = '', compId = '' } = info.user;

        // Header
        const header = document.createElement('div');
        header.innerHTML = `<h3>Welcome, ${displayName}!</h3>`;
        accountContent.appendChild(header);

        // Profile section
        createSectionSkeleton("Profile", "user-profile-section", "user-profile-content", accountContent);
        const profilePane = document.getElementById('user-profile-content');
        profilePane.innerHTML = `
      <p><img src="${avatar}" alt="Avatar" style="border-radius:50%;width:80px;height:80px;"></p>
      <p><em>To update your Discord avatar, please logout and then log back in.</em></p>
      <div class="user-info-form">
        <label for="pilotName">Pilot Name</label><br>
        <input type="text" id="pilotName" value="${pilotName}" placeholder="Your pilot name"><br><br>
        <label for="compId">Competition ID</label><br>
        <input type="text" id="compId" value="${compId}" placeholder="Your competition ID"><br><br>
        <button class="button-style" id="updateUserInfo">Save & Check matching unassigned IGC</button>
        <span id="update-status" style="margin-left:8px;font-style:italic;color:green;"></span>
      </div>
      <div id="match-results" style="margin-top:1em;"></div>
    `;

        // Handle Save click
        document.getElementById('updateUserInfo').onclick = () => {
            const p = document.getElementById('pilotName').value.trim();
            const c = document.getElementById('compId').value.trim();
            if (!p || !c) return alert('Both fields are required.');

            fetch('php/updateUserInfo.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ pilotName: p, compId: c })
            })
                .then(r => r.json())
                .then(({ success, matches = [], message }) => {
                    const statusEl = document.getElementById('update-status');
                    if (!success) {
                        return alert('Error: ' + message);
                    }
                    statusEl.textContent = 'Profile updated!';
                    setTimeout(() => { statusEl.textContent = ''; }, 3000);

                    // render matches table (or clear if none)
                    renderMatchTable(matches);
                })
                .catch(err => {
                    console.error(err);
                    alert('Update failed');
                });
        };

        // IGC submissions...
        createSectionSkeleton("IGC Submissions", "igc-submissions", "igc-submissions-content", accountContent);
        refreshIGCSubmissionsContent();

        // Logout
        const logout = document.createElement('button');
        logout.className = 'button-style';
        logout.textContent = 'Logout';
        logout.onclick = () => window.location.href = 'php/logout.php';
        accountContent.appendChild(logout);
    });
}

// Renders (or clears) the match-results div
function renderMatchTable(matches) {
    const container = document.getElementById('match-results');
    container.innerHTML = ''; // clear old

    if (!matches.length) return;

    // Section heading
    const heading = document.createElement('h4');
    heading.textContent = 'Matching IGC Records';
    container.appendChild(heading);

    // Table placeholder
    container.innerHTML += `
    <table id="matchRecordsTable"
           class="display igcRecordsTable"
           style="width:100%; margin-top:8px;">
    </table>
  `;

    // Build DataTable
    const dt = $('#matchRecordsTable').DataTable({
        data: matches,
        autoWidth: false,
        scrollX: true,
        scrollCollapse: true,
        paging: false,
        ordering: true,
        info: true,
        dom: '"top"rt<"bottom"lip><"clear">',
        columns: [
            {
                data: 'igcKey',
                title: '<input type="checkbox" id="match-select-all">',
                orderable: false,
                width: '30px',
                className: 'dt-center',
                render: (d, t) => t === 'display'
                    ? `<input type="checkbox" class="match-chk" value="${d}">`
                    : d
            },
            {
                data: null,
                title: 'Task',
                render: (row, t) => t === 'display'
                    ? `(${row.entrySeqId}) ${row.title}`
                    : row.entrySeqId
            },
            { data: 'pilot', title: 'Pilot' },
            { data: 'gliderType', title: 'Glider' },
            { data: 'gliderId', title: 'Glider ID' },
            { data: 'competitionId', title: 'Comp ID' },
            { data: 'competitionClass', title: 'Comp Class' },
            { data: 'igcKey', title: 'File' }
        ],
        initComplete() {
            const api = this.api();
            api.columns.adjust();

            // wire up select-all
            $('#match-select-all').on('click', function () {
                const checked = this.checked;
                $('.match-chk').prop('checked', checked);
            });

            // add Claim button below
            const claimBtn = $(
                '<button class="button-style" style="margin:8px 0;">Claim all selected</button>'
            ).on('click', () => {
                const selected = $('.match-chk:checked')
                    .map((i, el) => el.value)
                    .get();
                if (!selected.length) {
                    return alert('No records selected.');
                }
                fetch('php/claimIgcRecords.php', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ igcKeys: selected })
                })
                    .then(r => r.json())
                    .then(resp => {
                        if (resp.success) {
                            alert(`Claimed ${selected.length} record(s).`);
                            loadAccountInfo(); // refresh everything
                        } else {
                            alert('Error: ' + resp.message);
                        }
                    })
                    .catch(() => alert('Claim failed'));
            });

            // insert button just below the table
            $(api.table().container()).after(claimBtn);
        }
    });
}

function createSectionSkeleton(title, sectionId, contentId, parentContainer) {
    const sectionContainer = document.createElement('div');
    sectionContainer.id = sectionId;
    parentContainer.appendChild(sectionContainer);
    // TB.generateCollapsibleSection builds the collapsible UI with a placeholder.
    TB.generateCollapsibleSection(title, `<div id="${contentId}">Loading...</div>`, sectionContainer);
}

function refreshIGCSubmissionsContent() {
    const contentDiv = document.getElementById('igc-submissions-content');
    contentDiv.innerHTML = 'Loading...';

    fetch('php/FetchUserIGCSubmissions.php')
        .then(response => response.json())
        .then(data => {
            // Render only the <table> itself; DataTables handles the scrolling container.
            contentDiv.innerHTML = `
        <table
          id="userIGCRecordsTable"
          class="display igcRecordsTable"
          style="width: 100%;"
        ></table>
      `;

            const dt = $('#userIGCRecordsTable').DataTable({
                data: data,

                // ─── horizontal scroll setup ─────────────────────────
                autoWidth: false,
                scrollX: true,
                scrollCollapse: true,
                responsive: false,

                pageLength: 100,
                paging: false,
                order: [[0, 'desc']],
                dom: '<"top"f>rt<"bottom"lip><"clear">',

                columns: [
                    {
                        data: 'IGCRecordDateTimeUTC',
                        title: 'Created on',
                        render: (d, t) => t === 'display' ? TB.formatSimDateTime(d, true, false, true, true, true) : d
                    },
                    {
                        data: 'EntrySeqID',
                        title: 'Task',
                        render: (d, t) => t === 'display'
                            ? `<a href="#" onclick="switchToMapAndSelectTask('${d}');return false;">${d}</a>`
                            : d
                    },
                    { data: 'Pilot', title: 'Pilot' },
                    { data: 'GliderType', title: 'Glider' },
                    { data: 'CompetitionID', title: 'Ident' },
                    { data: 'CompetitionClass', title: 'Class' },
                    {
                        data: null,
                        title: 'Flags',
                        orderable: true,
                        render: (rowData, t, row) => {
                            const f =
                                (row.IGCValid ? '🔒' : '❗') +
                                (row.TaskCompleted ? '🏁' : '❌') +
                                (row.LocalDateTimeMatch ? '⌚' : '❌') +
                                (row.Penalties ? '👮' : '✅');
                            return t === 'display' ? f : f.trim();
                        }
                    },
                    {
                        data: 'Duration',
                        title: 'Time',
                        render: (d, t) => d ? d : ''
                    },
                    {
                        data: 'Distance',
                        title: 'Distance',
                        render: (d, t) => t === 'display' && d ? `${d} km` : d
                    },
                    {
                        data: 'Speed',
                        title: 'Speed',
                        render: (d, t) => t === 'display' && d ? `${d} km/h` : d
                    },
                    {
                        data: null,
                        title: 'Local time',
                        render: function (data, type, row) {
                            if (type === 'display') {
                                const ymd = row.LocalDate;       // e.g. "2025-07-29"
                                const lt = row.LocalTime;       // e.g. "224329"
                                const hh = lt.slice(0, 2),
                                    mm = lt.slice(2, 4),
                                    ss = lt.slice(4, 6);
                                const dt = `${ymd} ${hh}:${mm}:${ss}`;
                                return TB.formatSimDateTime(dt, false, false, false, true, true);
                            }
                            return data;
                        }
                    },
                    {
                        data: 'TPVersion',
                        title: 'Planner',
                        render: (d, t) => t === 'display' && d ? d.replace(/^v/, '') : d
                    },
                    { data: 'NB21Version', title: 'Logger' },
                    { data: 'Sim', title: 'Sim' },
                    {
                        data: 'Comment',
                        title: 'Comment',
                        orderable: false,
                        searchable: false,
                        render: (d, t, row) => {
                            const val = d || '';
                            return t === 'display'
                                ? `<input type="text" value="${val}"
                          class="comment-input"
                          data-entry="${row.IGCKey}"
                          data-original="${val}"
                          style="width:100%;box-sizing:border-box;">`
                                : d;
                        }
                    },
                    {
                        data: null,
                        title: 'Actions',
                        orderable: false,
                        searchable: false,
                        render: (d, t, row) => `
              <button class="igc-button-style download-igc" data-entry="${row.IGCKey}"
                onclick="forceDownload(
                  '${TB.discordPostHelperTaskBrowserPath}IGCFiles/${row.EntrySeqID}/${encodeURIComponent(row.IGCKey)}.igc',
                  '${row.IGCKey}.igc'
                );return false;"
                title="Download this IGC file">
                <img src="images/IGCDownload.svg" alt="Download" style="height:20px;vertical-align:middle;">
              </button>
              <button class="igc-button-style save-comment" data-entry="${row.IGCKey}" disabled title="Save comment">
                <img src="images/ApplyChanges.svg" alt="Save" style="height:20px;vertical-align:middle;">
              </button>
              <button class="igc-button-style delete-igc" data-entry="${row.IGCKey}" title="Delete this IGC record">🗑️</button>
            `
                    }
                ],

                columnDefs: [
                    {
                        targets: 0,                 // Created on
                        width: '140px',
                        createdCell: function (td) {
                            $(td).css({
                                'min-width': '140px',
                                'max-width': '140px',
                                'overflow': 'hidden',
                                'text-overflow': 'ellipsis',
                                'white-space': 'nowrap'
                            });
                        }
                    },
                    {
                        targets: 1,                 // Task ID
                        width: '35px',
                        createdCell: function (td) {
                            $(td).css({
                                'min-width': '35px',
                                'max-width': '35px',
                                'overflow': 'hidden',
                                'text-overflow': 'ellipsis',
                                'white-space': 'nowrap'
                            });
                        }
                    },
                    { targets: 2, width: '100px' }, // Pilot
                    { targets: 3, width: '100px' }, // Glider
                    { targets: 4, width: '40px' },  // Ident
                    { targets: 5, width: '80px' },  // Class
                    {
                        targets: 6,                 // Flags
                        width: '80px',
                        createdCell: function (td) {
                            $(td).css({
                                'min-width': '80px',
                                'max-width': '80px',
                                'overflow': 'hidden',
                                'text-overflow': 'ellipsis',
                                'white-space': 'nowrap'
                            });
                        }
                    },
                    { targets: 7, width: '65px' },  // Time
                    { targets: 8, width: '75px' },  // Distance
                    { targets: 9, width: '75px' },  // Speed
                    {
                        targets: 10,                 // Local time
                        width: '80px',
                        createdCell: function (td) {
                            $(td).css({
                                'min-width': '80px',
                                'max-width': '80px',
                            });
                        }
                    },
                    {
                        targets: 11,                 // Planner
                        width: '1px',
                        createdCell: function (td) {
                            $(td).css({
                                'min-width': '1px',
                                'max-width': '1px',
                                'overflow': 'hidden',
                                'text-overflow': 'ellipsis',
                                'white-space': 'nowrap'
                            });
                        }
                    },
                    {
                        targets: 12,                 // Logger
                        width: '1px',
                        createdCell: function (td) {
                            $(td).css({
                                'min-width': '1px',
                                'max-width': '1px',
                                'overflow': 'hidden',
                                'text-overflow': 'ellipsis',
                                'white-space': 'nowrap'
                            });
                        }
                    },
                    { targets: 13, width: '50px' }, // Sim
                    {
                        targets: 14,                 // Comments
                        width: '200px',
                        createdCell: function (td) {
                            $(td).css({
                                'min-width': '100px',
                                'max-width': '400px',
                            });
                        }
                    },
                    {
                        targets: 15,                 // Buttons
                        width: '100px',
                        createdCell: function (td) {
                            $(td).css({
                                'min-width': '1px',
                                'max-width': '100px',
                                'overflow': 'wrapper'
                            });
                        }
                    }
                ],

                searching: true,
                ordering: true,
                info: true,

                initComplete: function () {
                    const api = this.api();
                    // 1) align header & body
                    api.columns.adjust();

                    // 2) on resize, realign
                    const container = document.getElementById('igc-submissions-content');
                    if (window.ResizeObserver && container) {
                        new ResizeObserver(() => api.columns.adjust()).observe(container);
                    } else {
                        $(window).on('resize.igcSubmissions', () => api.columns.adjust());
                    }

                    // 3) fix search & refresh above scroll
                    const wrapper = $(api.table().container());
                    const filterDiv = wrapper.find('div.dataTables_filter');
                    filterDiv.css({
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'flex-start',
                        width: '100%'
                    });
                    const refreshBtn = $('<button>')
                        .attr('id', 'refreshIGCBtn')
                        .addClass('igc-button-style')
                        .css({ marginRight: 'auto', marginLeft: 0 })
                        .text('Refresh')
                        .on('click', refreshIGCSubmissionsContent);
                    filterDiv.prepend(refreshBtn);
                }
            });

            // comment input toggles Save button
            $('#userIGCRecordsTable').on('input', '.comment-input', function () {
                const orig = $(this).data('original'),
                    cur = $(this).val();
                $(this).closest('tr').find('.save-comment').prop('disabled', cur === orig);
            });

            // Save comment
            $('#userIGCRecordsTable').on('click', '.save-comment', function () {
                const entry = $(this).data('entry'),
                    newCom = $(this).closest('tr').find('.comment-input').val(),
                    button = $(this);
                fetch('php/UpdateIGCComment.php', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ IGCKey: entry, Comment: newCom })
                })
                    .then(r => r.json())
                    .then(res => {
                        if (res.status === 'success') {
                            button.closest('tr').find('.comment-input').data('original', newCom);
                            button.prop('disabled', true);
                        } else {
                            alert('Error updating comment: ' + (res.message || res.error));
                        }
                    })
                    .catch(err => {
                        console.error(err);
                        alert('Error updating comment.');
                    });
            });

            // Delete IGC record
            $('#userIGCRecordsTable').on('click', '.delete-igc', function () {
                const entry = $(this).data('entry'),
                    row = $(this).closest('tr');
                if (confirm("Delete this IGC submission? This cannot be undone.")) {
                    const params = new URLSearchParams({ IGCKey: entry });
                    fetch('php/DeleteIGCRecord.php', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                        body: params.toString()
                    })
                        .then(r => r.json())
                        .then(res => {
                            if (res.status === 'success') {
                                dt.row(row).remove().draw();
                            } else {
                                alert('Error deleting submission: ' + (res.error || res.message));
                            }
                        })
                        .catch(err => {
                            console.error(err);
                            alert('Error deleting submission.');
                        });
                }
            });
        })
        .catch(err => {
            contentDiv.innerHTML = '<p>Error loading IGC submissions.</p>';
            console.error(err);
        });
}

function displayEvents(events) {
    const eventsTabEventsList = document.getElementById('eventsList');
    const settings = TB.userSettings;
    const timeFormat = settings?.timeFormat || 'usa'; // Default to 12 hours if not set

    // Retrieve the saved array of open event IDs
    const savedEventIds = TB.getJsonCookie('CurrentGroupEventsOpened') || [];

    // Mapping of club IDs to their respective logos
    const clubLogos = {
        'DIAMTU': 'images/SoaringDiamondsClub.jpg',
        'FSCFR': 'images/GotGravel.jpg',
        'SSCSA': 'images/SSCLogo.jpg',
        'SSCWE': 'images/SSCLogo.jpg',
        'AUSTU': 'images/SSCLogo.jpg',
        'UKVGATU': 'images/UKVGALogo.jpg',
        'UKVGATH': 'images/UKVGALogo.jpg'
    };

    events.forEach(event => {
        // Check if the task has been published for that event
        let taskPublished = true;
        let taskRefly = false;
        if (event.EntrySeqID == 0) {
            taskPublished = false;
        }
        if (event.EntrySeqID == undefined && event.Refly == 1) {
            taskRefly = true;
        }

        const now = new Date(); // Define the current time

        let taskAvailable = true;
        const availabilityDate = event.Availability ? new Date(event.Availability.replace(' ', 'T') + 'Z') : null;
        if (availabilityDate && availabilityDate > now) {
            taskAvailable = false;
        }

        // Ensure the date is parsed correctly as UTC
        const publishedDate = new Date(event.Published.replace(' ', 'T') + 'Z');

        const localPublishedDate = publishedDate.toLocaleString(navigator.language, {
            month: 'long',
            day: 'numeric',
            hour: 'numeric',
            minute: 'numeric',
            hour12: TB.userSettings.timeFormat === 'usa' // Use 'usa' for 12-hour format
        });

        // Ensure the date is parsed correctly as UTC
        const eventDate = new Date(event.EventDate.replace(' ', 'T') + 'Z');

        const localEventDate = eventDate.toLocaleString(navigator.language, {
            month: 'long',
            day: 'numeric',
            hour: 'numeric',
            minute: 'numeric',
            hour12: TB.userSettings.timeFormat === 'usa' // Use 'usa' for 12-hour format
        });

        const dayOfWeek = eventDate.toLocaleDateString(navigator.language, { weekday: 'long' });

        // Extract club ID from the event key
        const clubId = event.Key.replace('E-', '').replace(/[0-9]/g, '');
        const eventClubImage = clubLogos[clubId] || '';

        let moreInfoLink = event.URLToGo;
        if (moreInfoLink && moreInfoLink.includes("discord.com")) {
            moreInfoLink = moreInfoLink.replace("https://", "discord://");
        }

        // Build table rows for the event details
        const rows = [];
        if (event.MSFSServer) {
            rows.push(createEventRow("🖧", `<strong>MSFS Server:</strong> ${event.MSFSServer}<p>`));
        }
        if (taskRefly && !taskAvailable) {
            rows.push(createEventRow("🔁", `<strong>Refly:</strong> Since this is a refly, no task info will be revealed until the availability time.<p>`));
        }
        else {
            if (taskPublished && event.SimDateTime) {
                // Use the raw SimDateTime without timezone transformation
                const simDateTime = new Date(event.SimDateTime);

                // Format the date
                const simDateFormatted = simDateTime.toLocaleString(navigator.language, {
                    month: 'long',
                    day: 'numeric',
                    ...(event.IncludeYear === 1 ? { year: 'numeric' } : {}), // Include year if IncludeYear = 1
                    hour: 'numeric',
                    minute: 'numeric',
                    hour12: TB.userSettings.timeFormat === 'usa' // Use 'usa' for 12-hour format
                });

                // Add extra information if available
                const extraInfo = event.SimDateTimeExtraInfo ? ` ${TB.addDetailWithinBrackets(event.SimDateTimeExtraInfo)}` : '';

                // Push the row with the formatted date and extra info
                rows.push(createEventRow("⌚", `<strong>Sim date/time:</strong> ${simDateFormatted}${extraInfo}<p>`));
            }
            if (event.RecommendedGliders) {
                rows.push(createEventRow("✈️", `<strong>Glider type:</strong> ${event.RecommendedGliders}<p>`));
            }
            if (event.SoaringRidge || event.SoaringThermals || event.SoaringWaves || event.SoaringDynamic) {
                rows.push(createEventRow("🪁", `<strong>Lift type:</strong> ${buildLiftType(event)} ${TB.addDetailWithinBrackets(event.SoaringExtraInfo)}<p>`));
            }
            if (event.DurationMin || event.DurationMax) {
                rows.push(createEventRow("⏳", `<strong>Duration:</strong> ${TB.formatDuration(event.DurationMin, event.DurationMax)} ${TB.addDetailWithinBrackets(event.DurationExtraInfo)}<p>`));
            }
            if (taskPublished && event.Notam) {
                rows.push(createEventRow("⚠️", `${event.Notam}<p>`));
            }
        }

        rows.push(createEventRow(
            "💼",
            `<strong>Meet/briefing time:</strong> ${localEventDate}<br>At this time we meet in the voice chat and get ready.<p>`)
        );
        if (event.VoiceChannel) {
            rows.push(createEventRow("🗣", `<strong>Voice:</strong> ${TB.convertToMarkdown(event.VoiceChannel, true)}<p>`));
        }

        if (event.UseEventSyncFly == 1) {
            const syncFlyDate = event.SyncFlyDateTime ? new Date(event.SyncFlyDateTime.replace(' ', 'T') + 'Z') : null;
            rows.push(createEventRow(
                "⏱️",
                `<strong>Synchronized Fly:</strong> ${syncFlyDate.toLocaleString(navigator.language, { hour: 'numeric', minute: 'numeric', hour12: TB.userSettings.timeFormat === 'usa' })} <br>At this time we simultaneously click the [FLY]/[Start] button to sync our weather.<br>Remember to <strong>🛑WAIT🛑</strong> on the World Map for the signal!<p>`)
            );
        }
        else {
            rows.push(createEventRow(
                "⏱️",
                `<strong>Synchronized Fly:</strong> None <br>This event DOES NOT require to synchronize weather. You can click Fly/Start at your convenience and wait at the airfield.<p>`)
            );
        }

        if (event.UseEventLaunch == 1) {
            const eventLaunchDateTime = event.EventLaunchDateTime ? new Date(event.EventLaunchDateTime.replace(' ', 'T') + 'Z') : null;
            rows.push(createEventRow(
                "🚀",
                `<strong>Launch:</strong> ${eventLaunchDateTime.toLocaleString(navigator.language, { hour: 'numeric', minute: 'numeric', hour12: TB.userSettings.timeFormat === 'usa' })} <br>At this time we can begin to launch from the airfield.<p>`)
            );
        }

        if (event.UseEventStartTask == 1) {
            const eventStartTaskDateTime = event.EventStartTaskDateTime ? new Date(event.EventStartTaskDateTime.replace(' ', 'T') + 'Z') : null;
            rows.push(createEventRow(
                "🟢",
                `<strong>Task Start:</strong> ${eventStartTaskDateTime.toLocaleString(navigator.language, { hour: 'numeric', minute: 'numeric', hour12: TB.userSettings.timeFormat === 'usa' })} <br>At this time we cross the starting line and start the task.<p>`)
            );
        }

        if (event.Credits) {
            rows.push(createEventRow(null, `<strong>Tracker Group:</strong> ${event.Credits}<p>`, "images/tracker_green.svg"));
        }

        if (event.EligibleAward && event.EligibleAward != 'None') {
            rows.push(createEventRow(
                "🏅",
                `Pilots who finish this task successfully during the event will be eligible to apply for the ${event.EligibleAward} soaring badge.<p>`)
            );
        }

        if (event.BeginnersGuide && event.BeginnersGuide != '') {
            rows.push(createEventRow(
                "‍🧑‍🎓",
                `If it's your first time flying with us, please make sure to read the following guide:<br>${TB.convertToMarkdown(event.BeginnersGuide, true)}.<p>`)
            );
        }

        // Build table HTML
        const tableHTML = `
            <table class="event-details">
                <tbody>
                    ${rows.join('')}
                </tbody>
            </table>
        `;

        taskButton = "";
        dphxButton = "";
        reviewTaskDetails = "";
        if (taskPublished && taskAvailable) {
            taskButton = `<button class="button-style" onclick="switchToMapAndSelectTask(${event.EntrySeqID})" title="View task on map">
                <img src="images/World.svg" alt="View task on map" style="height: 20px; vertical-align: middle;">
            </button>`;

            dphxButton = `<button class="button-style" onclick="TB.downloadDPHXFile('${event.TaskID}', ${event.EntrySeqID}, '${event.TaskTitle}','event')" title="Download DPHX file">
                <img src="images/DPHXFile.png" alt="DPHX File" style="height: 20px; vertical-align: middle;">
            </button>`;
            reviewTaskDetails = 'Review task details and map before briefing!';
        }

        shareButton = `<button class="button-style" onclick="TB.copyTextToClipboard('${window.location.origin}/index.html?event=${event.Key}')" title="Share event (copy link to clipboard)">
                <img src="images/ShareLink.png" alt="Share event (copy link to clipboard)" style="height: 20px; vertical-align: middle;">
        </button>`;

        trackerButton = `<button class="button-style" onclick="TB.setSSCTracker('${event.TrackerGroup}',${event.EntrySeqID},'${event.URLToGo}')" title="Set SSC-Tracker app">
            <img src="images/tracker.png" alt="Select this event and task on the tracker app" style="height: 20px; vertical-align: middle;">
        </button>`;

        // Determine highlight class
        const minutesToEvent = (eventDate - now) / 60000;
        let highlightClass = null;
        let titleSuffix = '';
        if (minutesToEvent <= 60 && minutesToEvent > 0) {
            highlightClass = 'highlightYellow';
            titleSuffix = ' (Starting soon)';
        } else if (eventDate <= now) {
            highlightClass = 'highlightGreen';
            titleSuffix = ' (In progress)';
        }

        // Determine the appropriate content for the comments/teaser message
        let eventComments;
        if (event.EntrySeqID === 0) {
            if (event.GroupEventTeaserEnabled === 1) {
                eventComments = TB.convertToMarkdown(event.GroupEventTeaserMessage);
            } else {
                eventComments = TB.convertToMarkdown(event.Comments);
            }
        } else {
            eventComments = TB.convertToMarkdown(event.Comments);
        }

        // Build the event content
        const eventContent = `
            ${eventClubImage ? `<img src="${eventClubImage}" alt="${event.Title}" title="${event.Title}" style="height: 80px; vertical-align: middle; margin-bottom: 1px;">` : ''}
            <h3>${event.Subtitle}</h3>
            <p>${eventComments}</p>
            ${tableHTML}
            ${reviewTaskDetails}
            <p><em>Don't forget to upload your IGC log after flying this task!</em></p>
            <p><a href="${moreInfoLink}" target="_blank">Go to this group event's home</a></p>
            ${taskButton}
            ${shareButton}
            ${dphxButton}
            ${trackerButton}
            <br><span style="font-size:0.8em;">Published on ${localPublishedDate}</span>
        `;

        // Add countdowns
        const countdowns = [];
        // Availability Countdown
        if (!taskAvailable) {
            countdowns.unshift({
                name: 'Available In',
                targetDateTime: event.Availability,
                onComplete: () => {
                    console.log(`Event ${event.Key} is now available. Refreshing events...`);
                    document.getElementById('eventsList').innerHTML = ''; // Clear events list
                    fetchAndDisplayEvents(); // **Refresh when countdown hits 0**
                }
            });
        }
        if (event.EventMeetDateTime) {
            countdowns.push({ name: 'Meeting', targetDateTime: event.EventMeetDateTime });
        }
        if (event.UseEventSyncFly && event.SyncFlyDateTime) {
            countdowns.push({ name: 'Sync Fly', targetDateTime: event.SyncFlyDateTime });
        }
        if (event.UseEventLaunch && event.EventLaunchDateTime) {
            countdowns.push({ name: 'Launch', targetDateTime: event.EventLaunchDateTime });
        }
        if (event.UseEventStartTask && event.EventStartTaskDateTime) {
            countdowns.push({ name: 'Task Start', targetDateTime: event.EventStartTaskDateTime });
        }
        let countdownSection = null;
        if (countdowns.length > 0) {
            countdownSection = createCountdownSection(countdowns);
        }

        TB.generateCollapsibleSection(`📆 ${dayOfWeek}, ${localEventDate} : ${event.Title}${titleSuffix}`, eventContent, eventsList, event.Key, highlightClass, null, countdownSection, event.CoverImageURL);
        // Add click listener to save the opened sections
        const eventElement = document.getElementById(event.Key);
        eventElement.addEventListener('click', () => {
            if (!eventElement.classList.contains('collapsed')) {
                if (!savedEventIds.includes(event.Key)) {
                    savedEventIds.push(event.Key); // Add the ID if not already in the array
                }
            } else {
                const index = savedEventIds.indexOf(event.Key);
                if (index > -1) {
                    savedEventIds.splice(index, 1); // Remove the ID if it's collapsed
                }
            }
            TB.setJsonCookie('CurrentGroupEventsOpened', savedEventIds, 300); // Save the updated array
        });

        // Restore the state of previously opened sections
        if (savedEventIds.includes(event.Key)) {
            eventElement.classList.remove('collapsed');
        }
        // Add this function to handle the tab switch and task selection
        window.switchToMapAndSelectTask = switchToMapAndSelectTask;

        // Check URL params for an event ID and expand it if found
        const params = new URLSearchParams(window.location.search);
        const eventIdToExpand = params.get('event');
        if (eventIdToExpand) {
            const eventElement = document.getElementById(eventIdToExpand);
            if (eventElement) {
                eventElement.classList.remove('collapsed');
                eventElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        }

    });
}

function createEventRow(emoji, text, iconPath = null) {
    const iconElement = emoji
        ? `<span>${emoji}</span>` // Use emoji if available
        : `<img src="${iconPath}" alt="Icon" style="max-width: 15px; max-height: 15px; object-fit: contain;">`; // Use iconPath if emoji is null

    return `
        <tr>
            <td style="text-align: center; width: 20px; vertical-align: top;">${iconElement}</td>
            <td style="vertical-align: top;">${text}</td>
        </tr>
    `;
}

function buildLiftType(event) {
    const types = [];
    if (event.SoaringRidge) types.push("Ridge");
    if (event.SoaringThermals) types.push("Thermals");
    if (event.SoaringWaves) types.push("Waves");
    if (event.SoaringDynamic) types.push("Dynamic");
    return types.join(", ");
}

function getUrlParams() {
    const params = new URLSearchParams(window.location.search);
    const result = {};
    for (const [key, value] of params.entries()) {
        result[key] = value;
    }
    return result;
}

function handleParams(params) {
    if (params.getFileFromDiscord && params.entrySeqID) {
        handleGetFileFromDiscord(params.getFileFromDiscord, params.entrySeqID); // Handle Discord request
        return; // Exit after processing
    }
    if (params.task) {
        TB.switchTab('mapTab');
        // if “results” is present, only expand Leader Board,
        let sections = [];
        if (params.results !== undefined) {
            sections = ['Leader Board'];
        }
        // Pass that array as the 3rd argument
        TB.tbm.selectTaskFromURL(
            params.task,
            false,          // doNotExpand = false → we do want expansion
            sections        // [] → all, ['Leader Board'] → just that one
        );

    } else if (params.event) {
        TB.switchTab('eventsTab');
        const eventId = `${params.event}`;
        const eventElement = document.getElementById(eventId);
        if (eventElement) {
            eventElement.classList.remove('collapsed');
            eventElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    } else if (params.tab) {
        switch (params.tab) {
            case 'map':
                TB.switchTab('mapTab');
                break;
            case 'events':
                TB.switchTab('eventsTab');
                break;
            case 'tools':
                TB.switchTab('toolsTab');
                break;
            case 'settings':
                TB.switchTab('settingsTab');
                break;
            case 'account':
                TB.switchTab('accountTab');
                break;
            case 'about':
                TB.switchTab('aboutTab');
                break;
            case 'home':
                TB.switchTab('homeTab');
                break;
            default:
                TB.switchTab('homeTab');
                break;
        }
    } else {
        TB.switchTab('homeTab');
    }
}

async function handleGetFileFromDiscord(fileType, entrySeqID) {
    try {
        // Fetch task details from the server
        const response = await fetch(`php/GetTaskDetailsDiscord.php?entrySeqID=${entrySeqID}`);
        const task = await response.json();

        if (task.error) {
            console.error('Error retrieving task details:', task.error);
            alert(`Error: ${task.error}. Task ID: ${entrySeqID}`);
            window.close();
            return;
        }
        // Check if the task is unavailable
        if (task.status === "unavailable") {
            const isoDateString = task.availability.replace(' ', 'T') + 'Z';
            const utcDate = new Date(isoDateString);
            const localAvailabilityDate = utcDate.toLocaleString(navigator.language, {
                month: 'long',
                day: 'numeric',
                hour: 'numeric',
                minute: 'numeric',
                hour12: TB.userSettings.timeFormat === 'usa' // Use 12-hour format if 'usa'
            });
            alert(`Task availability currently set to ${localAvailabilityDate}`);
            window.close();
            return;
        }
        // Check if the task is not found
        if (task.status === "not_found") {
            alert(`Task not found!`);
            window.close();
            return;
        }

        // Determine which file to download
        if (fileType === "dphx") {
            TB.downloadDPHXFile(task.TaskID, entrySeqID, task.Title, "discord");
        } else if (fileType === "pln") {
            TB.downloadPLNFile(task, "discord"); // Pass task object to downloadPLNFile
        } else if (fileType === "wpr") {
            TB.downloadWPRFile(task, "discord"); // Pass task object to downloadWPRFile
        } else if (fileType === "zip") {
            TB.downloadZIPFile(task.TaskID, entrySeqID, task.Title, "discord");
        } else {
            console.error(`Invalid file type requested: ${fileType}`);
            alert(`Invalid file type requested: ${fileType}.`);
            window.close();
        }
    } catch (err) {
        console.error('Error handling file request:', err);
        alert(`Failed to retrieve file. Error: ${err.message || err}. Task ID: ${entrySeqID}`);
        window.close();
    }
}

function createCountdownSection(countdowns) {
    // Create a container for the countdown section
    const countdownContainer = document.createElement('div');
    countdownContainer.className = 'countdown-section';
    countdownContainer.style.border = '1px solid gray';
    countdownContainer.style.padding = '10px';
    countdownContainer.style.margin = '10px';
    countdownContainer.style.width = '150px';
    countdownContainer.style.textAlign = 'center';

    // Loop through each countdown info to build the grid
    countdowns.forEach((countdown) => {
        const countdownRow = document.createElement('div');
        countdownRow.className = 'countdown-row';
        countdownRow.style.marginBottom = '10px';

        const nameElement = document.createElement('div');
        nameElement.innerText = countdown.name;
        nameElement.style.fontWeight = 'bold';
        nameElement.style.marginBottom = '5px';

        const timeElement = document.createElement('div');
        timeElement.className = 'countdown-time';
        timeElement.innerText = '000:00:00:00'; // Placeholder

        countdownRow.appendChild(nameElement);
        countdownRow.appendChild(timeElement);
        countdownContainer.appendChild(countdownRow);

        // Convert UTC to local time
        const targetDate = new Date(countdown.targetDateTime + 'Z');

        if (isNaN(targetDate.getTime())) {
            console.error(`Invalid targetDateTime: ${countdown.targetDateTime}`);
            timeElement.innerText = 'Invalid Date';
            return;
        }

        const interval = setInterval(() => {
            const now = new Date();
            const diff = targetDate - now;

            if (diff <= 0) {
                timeElement.innerText = '000:00:00:00';
                clearInterval(interval); // Stop the countdown when it reaches zero

                // **Trigger onComplete callback when the countdown hits zero**
                if (typeof countdown.onComplete === 'function') {
                    console.log(`Executing onComplete for ${countdown.name}`);
                    countdown.onComplete();
                }
                return;
            }

            const days = String(Math.floor(diff / (1000 * 60 * 60 * 24))).padStart(3, '0');
            const hours = String(Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))).padStart(2, '0');
            const minutes = String(Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))).padStart(2, '0');
            const seconds = String(Math.floor((diff % (1000 * 60)) / 1000)).padStart(2, '0');

            timeElement.innerText = `${days}:${hours}:${minutes}:${seconds}`;
        }, 1000);
    });

    return countdownContainer;
}

function setupEventListeners() {
    // Tab switching
    document.querySelectorAll('.tabButton').forEach(btn => {
        btn.addEventListener('click', function () {
            const tab = btn.getAttribute('data-tab');
            if (tab) TB.switchTab(tab);
        });
    });

    // Buttons
    document.getElementById('fullWorldButton')?.addEventListener('click', () => TB.tbm.resetToFullWorld());
    document.getElementById('searchFiltersButton')?.addEventListener('click', () => TB.toggleSearchAndFiltersPanel());
    document.getElementById('tableToggleButton')?.addEventListener('click', () => TB.toggleTableVisibility());
    document.getElementById('zoomButton')?.addEventListener('click', () => TB.tbm.zoomToTask());
    document.getElementById('closeImageModalBtn')?.addEventListener('click', () => TB.closeImageModal());

    // Resizing
    window.addEventListener('resize', TB.resizeMap);

    // URL parameter handling
    document.addEventListener('DOMContentLoaded', function () {
        const params = getUrlParams();
        handleParams(params);
    });

    // Handle browser back and forward buttons
    window.addEventListener('popstate', function () {
        if (TB.shouldHandlePopState) {
            const params = getUrlParams();
            handleParams(params);
        }
        TB.shouldHandlePopState = true;
    });
}