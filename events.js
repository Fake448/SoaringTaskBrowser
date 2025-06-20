export default class Events {

   constructor(tb) {
      this.TB = tb;
   }

   displayEvents(events) {
      const eventsTabEventsList = document.getElementById('eventsList');
      const settings = this.TB.userSettings;
      const timeFormat = settings?.timeFormat || 'usa'; // Default to 12 hours if not set

      // Retrieve the saved array of open event IDs
      const savedEventIds = this.TB.user.getJsonCookie('CurrentGroupEventsOpened') || [];
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
            TB.user.setJsonCookie('CurrentGroupEventsOpened', savedEventIds, 300); // Save the updated array
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

   fetchAndDisplayEvents() {
      fetch('php/RetrieveNewsWSG.php?newsType=1')
         .then(response => response.json())
         .then(data => {
            if (data.status === 'success') {
               const events = data.data;
               this.events.displayEvents(events);
            } else {
               console.error('Error fetching events:', data.message);
            }
         })
         .catch(error => console.error('Error fetching events:', error));
   }

   createEventRow(emoji, text, iconPath = null) {
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

   buildLiftType(event) {
      const types = [];
      if (event.SoaringRidge) types.push("Ridge");
      if (event.SoaringThermals) types.push("Thermals");
      if (event.SoaringWaves) types.push("Waves");
      if (event.SoaringDynamic) types.push("Dynamic");
      return types.join(", ");
   }

   createCountdownSection(countdowns) {
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

}