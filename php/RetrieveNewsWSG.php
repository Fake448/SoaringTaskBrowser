<?php
require __DIR__ . '/CommonFunctions.php';

try {
    // Open the database connections
    $pdoNews = new PDO("sqlite:$newsDBPath");
    $pdoNews->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    
    $pdoTasks = new PDO("sqlite:$databasePath");
    $pdoTasks->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

    // Cleanup old news entries
    cleanUpNewsEntries($pdoNews);

    // Get the optional newsType parameter (default to 0 if not set or invalid)
    $newsType = isset($_GET['newsType']) ? filter_var($_GET['newsType'], FILTER_VALIDATE_INT) : 1;

    // Ensure newsType is a valid integer
    if ($newsType === false) {
        $newsType = 0;
    }

    // Prepare and execute the query to fetch all news entries with a join to Events
    $stmtNews = $pdoNews->prepare("
        SELECT 
            News.Key, Published, Title, Subtitle, Comments, Credits, EventDate, News, NewsType, EntrySeqID, URLToGo, Expiration,
            Events.EventMeetDateTime, Events.UseEventSyncFly, Events.SyncFlyDateTime, Events.UseEventLaunch, Events.EventLaunchDateTime,
            Events.UseEventStartTask, Events.EventStartTaskDateTime, Events.EventDescription, Events.GroupEventTeaserEnabled,
            Events.GroupEventTeaserMessage, Events.GroupEventTeaserImage, Events.VoiceChannel, Events.MSFSServer, Events.TrackerGroup,
            Events.EligibleAward, Events.BeginnersGuide, Events.Notam, Events.Availability, Events.Refly
        FROM News
        LEFT JOIN Events ON News.Key = Events.EventKey
        WHERE NewsType = :newsType AND Expiration > datetime('now') 
        ORDER BY NewsType DESC, EventDate ASC, Published DESC
    ");
    $stmtNews->execute([':newsType' => $newsType]);
    $newsEntries = $stmtNews->fetchAll(PDO::FETCH_ASSOC);

    // Fetch additional task details for each news entry
    foreach ($newsEntries as &$entry) {
        // Base64-encode the image if it exists
        if (isset($entry['GroupEventTeaserImage']) && !empty($entry['GroupEventTeaserImage'])) {
            $entry['GroupEventTeaserImage'] = base64_encode($entry['GroupEventTeaserImage']);
        } else {
            $entry['GroupEventTeaserImage'] = null;
        }

        // If EntrySeqID is available, set CoverImageURL using the file root path
        if (!empty($entry['EntrySeqID'])) {
            // Make sure $fileRootPath is defined earlier in your code.
            $entry['CoverImageURL'] = $fileRootPath . "TaskBrowser/Covers/" . $entry['EntrySeqID'] . ".jpg";
        } else {
            $entry['CoverImageURL'] = null;
        }

        // Convert server's current time to UTC timestamp
        $nowUTC = (new DateTime('now', new DateTimeZone('UTC')))->getTimestamp();

        // Convert Availability to UTC timestamp
        $availabilityTimestamp = !empty($entry['Availability']) 
            ? DateTime::createFromFormat('Y-m-d H:i:s', $entry['Availability'], new DateTimeZone('UTC'))->getTimestamp()
            : null;
    
        $isFutureAvailability = $availabilityTimestamp !== null && $availabilityTimestamp > $nowUTC;

        // If Availability is in the future, handle the sub-scenarios based on Refly value
        if ($isFutureAvailability) {
            if (!empty($entry['Refly']) && $entry['Refly'] == 1) {
                // Refly = 1 → Do not fetch task details
                unset($entry['TaskID'], $entry['EntrySeqID'], $entry['CoverImageURL']);
                continue; // Skip fetching task details
            }
        }

        // Fetch task details only if EntrySeqID exists
        if (!empty($entry['EntrySeqID'])) {
            $stmtTask = $pdoTasks->prepare("
                SELECT 
                    TaskID, Title as TaskTitle, SoaringRidge, SoaringThermals, SoaringWaves, SoaringDynamic, 
                    SoaringExtraInfo, DurationMin, DurationMax, DurationExtraInfo, SimDateTime, IncludeYear, 
                    SimDateTimeExtraInfo, RecommendedGliders
                FROM Tasks 
                WHERE EntrySeqID = :entrySeqID
            ");
            $stmtTask->execute([':entrySeqID' => $entry['EntrySeqID']]);
            $taskDetails = $stmtTask->fetch(PDO::FETCH_ASSOC);

            // Merge the task details into the current entry
            if ($taskDetails) {
                $entry = array_merge($entry, $taskDetails);
            } else {
                logMessage("No task details found for EntrySeqID: " . $entry['EntrySeqID']);
            }
        }

        // If Availability is in the future and Refly = 0, remove TaskID & EntrySeqID after fetching
        if ($isFutureAvailability) {
            unset($entry['TaskID'], $entry['EntrySeqID']);
        }
    }

    // Encode and return the JSON response
    $jsonOutput = json_encode(['status' => 'success', 'data' => $newsEntries]);
    if ($jsonOutput === false) {
        logMessage("JSON encoding error: " . json_last_error_msg());
        throw new Exception("Failed to encode JSON response.");
    }
    echo $jsonOutput;

} catch (Exception $e) {
    logMessage("Error: " . $e->getMessage());
    echo json_encode(['status' => 'error', 'message' => $e->getMessage()]);
    logMessage("--- End of script RetrieveNewsWSG ---");
}
?>
