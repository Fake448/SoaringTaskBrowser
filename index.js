var TB = new TaskBrowser();
var igcUpload = new IGCUpload(TB);

TB.init(igcUpload);
if (!TB.isDownloadPage) {
    igcUpload.init();
}

// Add event listeners for resizing
window.addEventListener('resize', TB.resizeMap);

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

function loadToolsFromXML() {
    return fetch('otherdata/tools.xml')
        .then(response => response.text())
        .then(data => {
            const parser = new DOMParser();
            const xmlDoc = parser.parseFromString(data, "application/xml");
            const tools = xmlDoc.getElementsByTagName('tool');
            const toolEntries = [];

            for (let i = 0; i < tools.length; i++) {
                const title = tools[i].getElementsByTagName('title')[0].textContent;
                const text = tools[i].getElementsByTagName('text')[0].textContent;
                toolEntries.push({ Title: title, Description: text });
            }

            return toolEntries;
        })
        .catch(error => {
            console.error('Error fetching tools:', error);
            return [];
        });
}

// Function to load tab content dynamically
function loadTabContent(tabId) {
    let content = '';
    switch (tabId) {
        case 'homeTab':
            content = `
                <div class="header-container">
                    <img src="images/WeSimGlide.png" alt="WeSimGlideLogo" class="header-image">
                    <h2>Our home is always a work in progress!</h2>
                </div>
                <p>Currently, you can use the tabs above to access the available features that are ready:</p>
                <ul class="all-links">
                    <li><a href="#" onclick="TB.switchTab('eventsTab')">📆 Discover group flight events happening soon</a></li>
                    <li><a href="#" onclick="TB.switchTab('mapTab')">🌐 Explore tasks on the world map</a></li>
                    <li><a href="#" onclick="TB.switchTab('toolsTab')">🛠️ View a list of useful tools and other resources for soaring in MSFS</a></li>
                    <li><a href="#" onclick="TB.switchTab('settingsTab')">⚙️ Adjust your display settings here</a></li>
                    <li>
                        <a href="#" onclick="TB.switchTab('accountTab')">
                            <img src="images/user_account_connected.png" alt="User Account" style="width: 20px; height: 20px; vertical-align: middle;">
                            Manage your account
                        </a>
                    </li>
                    <li><a href="#" onclick="TB.switchTab('aboutTab')">ℹ️ Learn a bit more about WeSimGlide.org</a></li>
                </ul>
                <p>Tell us what else you would like to see on the home page!</p>
                <a href="discord://discord.com/channels/1022705603489042472/1258192556202922107" target="_blank">
                    <button class="button-style">Go to our Discord</button>
                </a>
                <hr>
                <div class="community-section">
                    <h2>Featured Soaring Communities and Clubs</h2>
                    <div class="community-navigation left">
                        <button class="scroll-button left">&larr;</button>
                    </div>
                    <div class="community-logos-container">
                        <div class="community-logos">
                            <div class="community-item">
                                <a href="discord://discord.gg/got-gravel-793376245915189268" target="_blank">
                                    <img src="images/SoaringDiamondsClub.jpg" alt="Soaring Diamonds Club" class="community-logo">
                                </a>
                                <p class="community-name"><strong>Soaring Diamonds Club</strong></p>
                                <p class="community-clubs">Hosted on<br>GotGravel's Discord</p>
                            </div>
                            <div class="community-item">
                                <a href="discord://discord.gg/got-gravel-793376245915189268" target="_blank">
                                    <img src="images/GotGravel.jpg" alt="GotGravel" class="community-logo">
                                </a>
                                <p class="community-name"><strong>Friday Soaring Club</strong></p>
                                <p class="community-clubs">Hosted on<br>GotGravel's Discord</p>
                            </div>
                            <div class="community-item">
                                <a href="discord://discord.gg/h9H2MZyrg2" target="_blank">
                                    <img src="images/SSCLogo.jpg" alt="Sim Soaring Club" class="community-logo">
                                </a>
                                <p class="community-name"><strong>Sim Soaring Club</strong></p>
                                <p class="community-clubs">Also home of<br>AusGlide Club</p>
                            </div>
                            <div class="community-item">
                                <a href="discord://discord.gg/9PtUtaH9tz" target="_blank">
                                    <img src="images/UKVGALogo.jpg" alt="UKVGA" class="community-logo">
                                </a>
                                <p class="community-name"><strong>UK Virtual Gliding Association</strong></p>
                                <p class="community-clubs"></p>
                            </div>
                            <div class="community-item">
                                <a href="discord://discord.gg/h2GuWXJaGK" target="_blank">
                                    <img src="images/FranceMSFS.png" alt="UKVGA" class="community-logo">
                                </a>
                                <p class="community-name"><strong>MSFS ✈️20✈️24 FR</strong></p>
                                <p class="community-clubs">Home of<br>Planeur France</p>
                            </div>
                        </div>
                    </div>
                    <div class="community-navigation right">
                        <button class="scroll-button right">&rarr;</button>
                    </div>
                </div>
                `;
            break;
        case 'eventsTab':
            content = `
                <div class="header-container">
                    <img src="images/WeSimGlide.png" alt="WeSimGlideLogo" class="header-image">
                    <h2>Group Soaring Events</h2>
                </div>
                <div id="eventsGeneralInfoSection"></div>
                <button id="refreshButton" class="button-style">↻ Refresh Events</button>
                <div id="eventsList"></div>
                `;
            break;
        case 'toolsTab':
            content = `
                <div class="header-container">
                    <img src="images/WeSimGlide.png" alt="WeSimGlideLogo" class="header-image">
                    <h2>Most useful soaring tools and other references!</h2>
                </div>
                `;
            document.getElementById(tabId).innerHTML = content;
            setTimeout(() => {
                loadToolsFromXML().then(toolEntries => {
                    toolEntries.forEach(toolEntry => {
                        TB.generateToolEntry(toolEntry.Title, toolEntry.Description);
                    });

                    // Add the message and button below all the tool entries
                    const messageAndButton = `
                        <p>If you would like to suggest a new tool or reference, contact us through our support channel on Discord!</p>
                        <a href="discord://discord.com/channels/1022705603489042472/1258192556202922107" target="_blank">
                            <button class="button-style">Go to our Discord</button>
                        </a>
                        <p></p>
                    `;
                    const toolsTab = document.getElementById('toolsTab');
                    toolsTab.insertAdjacentHTML('beforeend', messageAndButton);
                });
            }, 0);
            break;
        case 'settingsTab':
            break;
        case 'accountTab':
            content = `
                <div class="header-container">
                    <img src="images/WeSimGlide.png" alt="WeSimGlideLogo" class="header-image">
                    <h2>Your User Account</h2>
                </div>
                <div id="account-content">
                    <p>Loading user info...</p>
                </div>
            `;
            break;
        case 'aboutTab':
            content = `
                <div class="header-container">
                    <img src="images/WeSimGlide.png" alt="WeSimGlideLogo" class="header-image">
                    <h2>About WeSimGlide</h2>
                </div>
                <p>Welcome to WeSimGlide.org, your go-to destination for virtual soaring in Flight Simulator. Inspired by the official WeGlide.org site for real-life soaring, WeSimGlide is dedicated to bringing the same level of community to the virtual skies.</p>
                <h3>Our Vision</h3>
                <p>WeSimGlide is part of a comprehensive solution designed to enhance your soaring experience. This project includes:</p>
                <ul class="all-links">
                    <li>A dedicated <strong>Discord server</strong> for community engagement and support. <a href="https://discord.gg/aW8YYe3HJF" target="_blank">(Discord Invite)</a></li>
                    <li>Several <strong>Windows applications</strong> tailored for soaring enthusiasts. <a href="https://flightsim.to/profile/siglr" target="_blank">(Visit FlightSim.to)</a></li>
                    <li>A detailed <strong>world map browser</strong> showcasing hundreds of soaring tasks created by talented designers from around the globe (this is where you are now).</li>
                </ul>
                <h3>Who's behind this?</h3>
                <p>While the library and tools are primarily a solo endeavor by myself, Guy (MajorDad), this project wouldn't be possible without the invaluable contributions of Ian (B21) and the input from many dedicated members of the community.</p>
                <h3>Support WeSimGlide.org</h3>
                <p>WeSimGlide is a passion project aimed at enriching the virtual soaring community. If you enjoy using these tools and would like to support further development, I welcome voluntary contributions. Your donations help us cover server costs, develop new features, and maintain the quality of our offerings.</p>
                <a href="https://www.paypal.com/paypalme/wesimglide" target="_blank">
                    <button class="button-style">Donate Now</button>
                </a>
                <p>Contributions can also take other forms:</p>
                <ul>
                    <li><strong>Community Contributions:</strong> Use our tools to create, share and download soaring tasks, provide feedback, or help others on the Discord server.</li>
                    <li><strong>Spread the Word:</strong> Share WeSimGlide.org with your friends and fellow pilots to help grow our community.</li>
                </ul>
                <p>Thank you for being a part of the WeSimGlide community. Together, we can make virtual soaring an even more incredible experience.</p>
                <h3>Affiliation</h3>
                <p>WeSimGlide.org has no affiliation whatsoever with <strong><a href="https://WeGlide.org" target="_blank">WeGlide.org</a></strong>.</p>
                <h3>Be Advised</h3>
                <p><strong>Note:</strong> WeSimGlide.org is still a work in progress. I appreciate your patience and feedback as I continue to improve and expand the feature set.</p>
                <h3>Privacy Policy</h3>
                <p>WeSimGlide.org stores basic user information (username, Discord ID, and avatar) obtained through the 'Login with Discord' feature solely to manage account functionality. We do not use this data for any other purpose.</p>`;
            break;
    }
    document.getElementById(tabId).innerHTML = content;
    if (tabId == 'homeTab') {
        addScrollEventListeners();
    }
    // If the user account tab is loaded, fetch and display user connection info
    if (tabId === 'accountTab') {
        loadAccountInfo();
    }
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

function switchToMapAndSelectTask(entrySeqID) {
    TB.switchTab('mapTab');
    TB.tbm.selectTaskFromURL(entrySeqID);
}

function loadAccountInfo() {
    TB.getUserConnectionInfo().then(info => {
        const accountContent = document.getElementById('account-content');
        if (info.loggedIn) {
            accountContent.innerHTML = `
                <h3>Welcome, ${info.user.displayName}!</h3>
                <p>Avatar:<br>
                    <img src="${info.user.avatar}" alt="Avatar" style="border-radius: 50%; width: 100px; height: 100px;">
                </p>
                <button class="button-style" onclick="window.location.href='php/logout.php'">Logout</button>
            `;

            // Create the skeleton for the IGC Submissions section.
            createSectionSkeleton("IGC Submissions", "igc-submissions", "igc-submissions-content", accountContent);
            // Load data into that section.
            refreshIGCSubmissionsContent();


        } else {
            accountContent.innerHTML = `
                <p>You are not logged in.</p>
                <button class="button-style" onclick="window.location.href='php/login.php'">Login with Discord</button>
            `;
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
                <img src="images/IGCDownload.png" alt="Download" style="height:20px;vertical-align:middle;">
              </button>
              <button class="igc-button-style save-comment" data-entry="${row.IGCKey}" disabled title="Save comment">
                <img src="images/ApplyChanges.png" alt="Save" style="height:20px;vertical-align:middle;">
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

function addScrollEventListeners() {
    const leftButton = document.querySelector('.scroll-button.left');
    const rightButton = document.querySelector('.scroll-button.right');
    const container = document.querySelector('.community-logos-container');

    if (leftButton && rightButton && container) {
        leftButton.addEventListener('click', () => {
            container.scrollBy({
                left: -256,
                behavior: 'smooth'
            });
        });

        rightButton.addEventListener('click', () => {
            container.scrollBy({
                left: 256,
                behavior: 'smooth'
            });
        });
    }
}

function fetchAndDisplayEvents() {
    fetch('php/RetrieveNewsWSG.php?newsType=1')
        .then(response => response.json())
        .then(data => {
            if (data.status === 'success') {
                const events = data.data;
                displayEvents(events);
            } else {
                console.error('Error fetching events:', data.message);
            }
        })
        .catch(error => console.error('Error fetching events:', error));
}

function displayEventsStaticPortion() {
    const eventsTabGeneralInfo = document.getElementById('eventsGeneralInfoSection');

    // Add static general information collapsible section
    TB.generateCollapsibleSection("Global Schedule & Information", `
        <div class="general-info">
            <p>Welcome to the heart of our soaring communities! In this channel, you'll discover a comprehensive weekly schedule of group flights held by the various Discord communities, meticulously organized for enthusiasts across different time zones.</p>
            <h2>What's Inside:</h2>
            <ul>
                <li>A global calendar of all known group events from various soaring club channels, updated weekly.</li>
                <li>Quick reference to help you align with events, regardless of where you are in the world.</li>
            </ul>
            <h3>Remember:</h3>
            <p>While the events are listed in UTC times, these might not always correspond to your local day. Please check the local date and time (for you) usually displayed with the original event for best accuracy. Also, note that during daylight saving time changes, there might be a period with incorrect time indications.</p>
            <p>Dive into our global schedule and choose your next group flight adventure!</p>
            <div id="tutorials"></div>
            <div id="invites"></div>
            <h2>General Weekly Schedule</h2>
            <h3>Sunday</h3>
            🕖 18:15 UTC: UKVGA Sunday <em>(Daylight saving time)</em> - <a href="discord://discord.com/channels/325227457445625856/1332655847029080097">Event Channel</a></br>
            <h3>Monday</h3>
            <p>-</p>
            <h3>Tuesday</h3>
            🕤 09:30 UTC: Ausglide Tuesday <em>(Normal time)</em> - <a href="discord://discord.com/channels/876123356385149009/1066655140733517844">Event Channel</a></br>
            🕖 18:15 UTC: UKVGA Tuesday <em>(Daylight saving time)</em> - <a href="discord://discord.com/channels/325227457445625856/1166042887084048515">Event Channel</a></br>
            🕧 23:30 UTC: Diamonds Tuesday <em>(Daylight saving time)</em> - <a href="discord://discord.com/channels/793376245915189268/1097353400015921252">Event Channel</a></br>
            <h3>Wednesday</h3>
            🕡 17:45 UTC: SSC Wednesday <em>(Daylight saving time)</em> - <a href="discord://discord.com/channels/876123356385149009/1128345453063327835">Event Channel</a></br>
            <h3>Thursday</h3>
            🕖 18:15 UTC: UKVGA Thursday <em>(Daylight saving time)</em> - <a href="discord://discord.com/channels/325227457445625856/1166042920869175357">Event Channel</a></br>
            <h3>Friday</h3>
            🕘 21:00 UTC: Friday Soaring Club - <a href="discord://discord.com/channels/793376245915189268/1097354088892596234">Event Channel</a></br>
            <h3>Saturday</h3>
            🕡 17:45 UTC: SSC Saturday <em>(Daylight saving time)</em> - <a href="discord://discord.com/channels/876123356385149009/987611111509590087">Event Channel</a></br>
        </div>
    `, eventsTabGeneralInfo);

    // Add the tutorials section within the general information section
    const tutorialsContainer = document.getElementById('tutorials');
    TB.generateCollapsibleSection("Tutorials / Knowledge base on MSFS soaring and group flights", `
        <p>Great resources that will get you up to speed on soaring in MSFS and joining group flights!</p>
        <ul>
            <li><a href="https://discord.com/channels/793376245915189268/1097520643580362753/1097520937701736529" target="_blank">GotGravel - The Beginner's Guide to Soaring Events</a></li>
            <li><a href="https://discord.com/channels/876123356385149009/1038819881396744285" target="_blank">SSC - How to join our Group Flights</a></li>
        </ul>
    `, tutorialsContainer);

    // Add the invites section within the general information section
    const invitesContainer = document.getElementById('invites');
    TB.generateCollapsibleSection("Discord Club Invites", `
        <p>To gain access to the several club events listed on the Hub, you will first need to register on their Discord server. Here are invite links to do so.</p>
        <ul>
            <li><strong>AusGlide</strong> and <strong>Sim Soaring Club</strong> (on same SSC Discord): <a href="discord://discord.gg/h9H2MZyrg2" target="_blank">https://discord.gg/h9H2MZyrg2</a></li>
            <li><strong>💎 Diamonds</strong> and <strong>Friday Soaring Club</strong> (on same GG Discord): <a href="discord://discord.gg/got-gravel-793376245915189268" target="_blank">https://discord.gg/got-gravel-793376245915189268</a></li>
            <li><strong>UK Virtual Gliding Association</strong> (UKVGA Discord): <a href="discord://discord.gg/emwraayPkR" target="_blank">https://discord.gg/9PtUtaH9tz</a></li>
            <li><strong>Planeur France FS2020</strong>: <a href="discord://discord.gg/h2GuWXJaGK" target="_blank">https://discord.gg/h2GuWXJaGK</a></li>
        </ul>
    `, invitesContainer);
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
            rows.push(createEventRow(null, `<strong>Tracker Group:</strong> ${event.Credits}<p>`, "images/tracker_green.png"));
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
                <img src="images/World.png" alt="View task on map" style="height: 20px; vertical-align: middle;">
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
        window.switchToMapAndSelectTask = function (entrySeqID) {
            TB.switchTab('mapTab'); // Switch to the map tab
            TB.tbm.selectTaskFromURL(entrySeqID); // Select the task on the map
        };

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
        // if “results” is present, only expand IGC Records,
        let sections = [];
        if (params.results !== undefined) {
            sections = ['IGC Records'];
        }
        // Pass that array as the 3rd argument
        TB.tbm.selectTaskFromURL(
            params.task,
            false,          // doNotExpand = false → we do want expansion
            sections        // [] → all, ['IGC Records'] → just that one
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