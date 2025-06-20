export default class User {

   constructor(tb) {
      this.TB = tb;
      this.tbm = tb.tbm
   }

   loadUserSettings() {
      const settings = this.getJsonCookie('userSettings', 300);

      // Default settings
      const defaultSettings = {
         uiTheme: 'dark',
         timeFormat: 'usa',
         altitude: 'imperial',
         distance: 'imperial',
         gateMeasurement: 'imperial',
         windSpeed: 'knots',
         pressure: 'inHg',
         temperature: 'fahrenheit',
         DPHXlocalPort: 54513,
         TrackerlocalPort: 55055,
         coverImageOpacity: 25,
      };

      // Merge default settings with saved settings
      const mergedSettings = { ...defaultSettings, ...settings };

      if (!this.isDownloadPage) {
         // Set the radio buttons based on the settings
         this.ApplyingSettings = true;
         document.querySelector(`input[name="uiTheme"][value="${mergedSettings.uiTheme}"]`).checked = true;
         document.querySelector(`input[name="timeFormat"][value="${mergedSettings.timeFormat}"]`).checked = true;
         document.querySelector(`input[name="altitude"][value="${mergedSettings.altitude}"]`).checked = true;
         document.querySelector(`input[name="distance"][value="${mergedSettings.distance}"]`).checked = true;
         document.querySelector(`input[name="gateMeasurement"][value="${mergedSettings.gateMeasurement}"]`).checked = true;
         document.querySelector(`input[name="windSpeed"][value="${mergedSettings.windSpeed}"]`).checked = true;
         document.querySelector(`input[name="pressure"][value="${mergedSettings.pressure}"]`).checked = true;
         document.querySelector(`input[name="temperature"][value="${mergedSettings.temperature}"]`).checked = true;

         const opacitySlider = document.getElementById("coverImageOpacity");
         const opacityValue = document.getElementById("coverImageOpacityValue");

         opacitySlider.value = mergedSettings.coverImageOpacity;
         opacityValue.innerText = `${mergedSettings.coverImageOpacity}%`;

         const DPHXlocalPortInput = document.getElementById('DPHXlocalPort');
         if (DPHXlocalPortInput) {
            DPHXlocalPortInput.value = mergedSettings.DPHXlocalPort;
         }
         const TrackerlocalPortInput = document.getElementById('TrackerlocalPort');
         if (TrackerlocalPortInput) {
            TrackerlocalPortInput.value = mergedSettings.TrackerlocalPort;
         }
         this.ApplyingSettings = false;

         // Add event listener so that changes trigger a save
         if (DPHXlocalPortInput) {
            DPHXlocalPortInput.addEventListener('change', () => {
               this.saveUserSettings();  // We’ll validate & then save
            });
         }
         if (TrackerlocalPortInput) {
            TrackerlocalPortInput.addEventListener('change', () => {
               this.saveUserSettings();  // We’ll validate & then save
            });
         }

         opacitySlider.addEventListener("input", function () {
            opacityValue.innerText = `${this.value}%`; // Update the displayed percentage
            this.saveUserSettings(); // Save the new setting
         });

         // Attach change event listeners to save settings when any radio button is changed
         document.querySelectorAll('#settingsForm input[type="radio"]').forEach(input => {
            input.addEventListener('change', () => {
               this.saveUserSettings();
            });
         });

      }

      return mergedSettings;
   }

   saveUserSettings() {
      if (!this.ApplyingSettings) {
         // Ensure userSettings is always defined with defaults
         const defaultSettings = {
            DPHXlocalPort: 54513,
            TrackerlocalPort: 55055
         };
         this.userSettings = this.userSettings || defaultSettings;

         const settings = {
            uiTheme: document.querySelector('input[name="uiTheme"]:checked').value,
            timeFormat: document.querySelector('input[name="timeFormat"]:checked').value,
            altitude: document.querySelector('input[name="altitude"]:checked').value,
            distance: document.querySelector('input[name="distance"]:checked').value,
            gateMeasurement: document.querySelector('input[name="gateMeasurement"]:checked').value,
            windSpeed: document.querySelector('input[name="windSpeed"]:checked').value,
            pressure: document.querySelector('input[name="pressure"]:checked').value,
            temperature: document.querySelector('input[name="temperature"]:checked').value,
            coverImageOpacity: document.getElementById("coverImageOpacity").value,
         };

         // Validate and assign ports
         settings.DPHXlocalPort = this.TB.validatePort(
            'DPHXlocalPort',
            this.userSettings.DPHXlocalPort || 54513
         );
         settings.TrackerlocalPort = this.TB.validatePort(
            'TrackerlocalPort',
            this.userSettings.TrackerlocalPort || 55055
         );

         // Save settings to cookies and update the local state
         this.setJsonCookie('userSettings', settings, 300);
         this.userSettings = settings;
      }
   }

   getUserConnectionInfo() {
      return fetch('php/session_status.php')
         .then(response => {
            if (!response.ok) {
               throw new Error('Network response was not ok: ' + response.statusText);
            }
            return response.json();
         })
         .then(data => {
            // Save the connection info in your TB object.
            this.isUserConnected = data.loggedIn;
            this.user = data.loggedIn ? data.user : null;
            this.setUserAccountImage();  // Update the account image based on new session data.
            return data;
         })
         .catch(error => {
            this.isUserConnected = false;
            this.user = null;
            this.setUserAccountImage();
            return { loggedIn: false };
         });
   }

   setUserAccountImage() {
      const userImg = document.getElementById('userAccountImage');
      if (userImg) {
         if (this.isUserConnected) {
            userImg.src = "images/user_account_connected.svg";
            userImg.title = "You are currently logged in as " + this.user.displayName;
         }
         else {
            userImg.src = "images/user_account_disconnected.svg";
            userImg.title = "You are NOT currently logged in.";
         }
      }
   }

   loadAccountInfo() {
      this.getUserConnectionInfo().then(info => {
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
                  this.TB.renderMatchTable(matches);
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

   saveMapUserSettings() {
      const tb = this;
      if (!this.ApplyingSettings) {
         const settings = {
            mapLayer: this.tbm.getCurrentMapLayer(),
            showAirports: this.tbm.isLayerVisible('Airports'),
            showRailways: this.tbm.isLayerVisible('Railways'),
            windCompass: this.tbm.isLayerVisible('Wind Compass'),
            showSelectedOnly: this.tbm.isLayerVisible('Show selected only'),
            taskDetailWidth: this.taskDetailsContainerWidth
         };
         this.setJsonCookie('mapUserSettings', settings, 300);
      }
   }

   loadMapUserSettings() {
      const settings = this.getJsonCookie('mapUserSettings', 300);

      // Set default settings if not found
      const defaultSettings = {
         mapLayer: "Google Terrain",
         showAirports: true,
         showRailways: false,
         windCompass: false,
         showSelectedOnly: true,
         taskDetailWidth: '30%'
      };

      // Merge default settings with loaded settings
      const mergedSettings = { ...defaultSettings, ...settings };

      // Apply settings to the map
      this.ApplyingSettings = true;
      this.tbm.setMapLayer(mergedSettings.mapLayer);
      this.tbm.setLayerVisibility('Airports', mergedSettings.showAirports);
      this.tbm.setLayerVisibility('Railways', mergedSettings.showRailways);
      this.tbm.setLayerVisibility('Wind Compass', mergedSettings.windCompass);
      this.tbm.setLayerVisibility('Show selected only', mergedSettings.showSelectedOnly);
      this.TB.setTaskDetailWidth(mergedSettings.taskDetailWidth);
      this.ApplyingSettings = false;
   }

   setJsonCookie(name, jsonObject, days) {
      var expires = "";
      if (days) {
         var date = new Date();
         date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
         expires = "; expires=" + date.toUTCString();
      }
      var jsonString = JSON.stringify(jsonObject);
      var encodedJsonString = encodeURIComponent(jsonString);
      document.cookie = name + "=" + encodedJsonString + expires + "; path=/";
   }

   getJsonCookie(name, renewDays) {
      var nameEQ = name + "=";
      var ca = document.cookie.split(';');
      for (var i = 0; i < ca.length; i++) {
         var c = ca[i];
         while (c.charAt(0) === ' ') c = c.substring(1, c.length);
         if (c.indexOf(nameEQ) === 0) {
            var encodedJsonString = c.substring(nameEQ.length, c.length);
            var jsonString = decodeURIComponent(encodedJsonString);
            var jsonObject = JSON.parse(jsonString);

            // Renew the cookie's expiration date
            if (renewDays) {
               this.setJsonCookie(name, jsonObject, renewDays);
            }

            return jsonObject;
         }
      }
      return null;
   }

   getCookieSize(name) {
      const jsonCookie = this.getJsonCookie(name);
      if (jsonCookie) {
         const jsonString = JSON.stringify(jsonCookie);
         const encodedJsonString = encodeURIComponent(jsonString);
         return encodedJsonString.length;
      }
      return 0;
   }
}