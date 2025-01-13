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
    $newsType = isset($_GET['newsType']) ? filter_var($_GET['newsType'], FILTER_VALIDATE_INT) : 0;

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
            Events.EligibleAward, Events.BeginnersGuide
        FROM News
        LEFT JOIN Events ON News.Key = Events.EventKey
        WHERE NewsType = :newsType AND Expiration > datetime('now') 
        ORDER BY NewsType DESC, EventDate ASC, Published DESC
    ");
    $stmtNews->execute([':newsType' => $newsType]);
    $newsEntries = $stmtNews->fetchAll(PDO::FETCH_ASSOC);

    // Fetch the additional task details for each news entry
    foreach ($newsEntries as &$entry) {
        if ($entry['EntrySeqID']) {
            $stmtTask = $pdoTasks->prepare("
                SELECT 
                    SoaringRidge, SoaringThermals, SoaringWaves, SoaringDynamic, SoaringExtraInfo, DurationMin, DurationMax, DurationExtraInfo 
                FROM Tasks 
                WHERE EntrySeqID = :entrySeqID
            ");
            $stmtTask->execute([':entrySeqID' => $entry['EntrySeqID']]);
            $taskDetails = $stmtTask->fetch(PDO::FETCH_ASSOC);
            
            // Merge the task details into the news entry
            if ($taskDetails) {
                $entry = array_merge($entry, $taskDetails);
            }
        }
    }

    // Return the news entries as JSON
    echo json_encode(['status' => 'success', 'data' => $newsEntries]);

} catch (Exception $e) {
    logMessage("Error: " . $e->getMessage());
    echo json_encode(['status' => 'error', 'message' => $e->getMessage()]);
    logMessage("--- End of script RetrieveNewsWSG ---");
}
?>
