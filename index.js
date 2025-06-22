import TaskBrowser from './task_browser.js';
import IGCUpload from './igcupload.js';

var TB = new TaskBrowser();
var igcUpload = new IGCUpload(TB);

TB.init(igcUpload);
window.TB = TB;
if (!TB.isDownloadPage) {
    igcUpload.init();
}

setupEventListeners();
window.loadAccountInfo = () => TB.user.loadAccountInfo();

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
                            this.user.loadAccountInfo(); // refresh everything
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
                hour12: TB.user.userSettings.timeFormat === 'usa' // Use 12-hour format if 'usa'
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