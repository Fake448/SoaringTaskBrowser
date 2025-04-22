<?php
require __DIR__ . '/CommonFunctions.php';

try {
    // Check if EntrySeqID is provided
    if (!isset($_GET['entrySeqID'])) {
        throw new Exception('Missing required parameter: entrySeqID');
    }

    $entrySeqID = (int)$_GET['entrySeqID'];

    // Open the database connection
    $pdo = new PDO("sqlite:$databasePath");
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

    // Define the query to retrieve the task details
    $query = "
        SELECT
            TaskID,
            EntrySeqID, 
            Title,
            ShortDescription,
            MainAreaPOI,
            DepartureName,
            DepartureICAO,
            DepartureExtra,
            ArrivalName,
            ArrivalICAO,
            ArrivalExtra,
            SimDateTime,
            SimDateTimeExtraInfo,
            IncludeYear,
            SoaringRidge,
            SoaringThermals,
            SoaringWaves,
            SoaringDynamic,
            SoaringExtraInfo,
            DurationMin,
            DurationMax,
            DurationExtraInfo,
            TaskDistance,
            TotalDistance,
            RecommendedGliders,
            RecommendedAddOnsList,
            DifficultyRating,
            DifficultyExtraInfo,
            LongDescription,
            WeatherSummary,
            Credits,
            Countries,
            PLNFilename,
            PLNXML,
            WPRFilename,
            WPRXML,
            RepostText,
            LastUpdate,
            LastUpdateDescription,
            TotDownloads,
            SuppressBaroPressureWarningSymbol,
            BaroPressureExtraInfo,
            ExtraFilesList,
            Status,
            DiscordPostID,
            Availability
        FROM Tasks
        WHERE EntrySeqID = :entrySeqID AND Status = 99
    ";

    // Prepare and execute the query
    $stmt = $pdo->prepare($query);
    $stmt->bindParam(':entrySeqID', $entrySeqID, PDO::PARAM_INT);
    $stmt->execute();

    // Fetch the task details
    $task = $stmt->fetch(PDO::FETCH_ASSOC);

    if ($task) {
        // Get the current UTC timestamp
        $nowUTC = (new DateTime('now', new DateTimeZone('UTC')))->getTimestamp();

        // Convert Availability to UTC timestamp (if set)
        $availabilityTimestamp = !empty($task['Availability'])
            ? DateTime::createFromFormat('Y-m-d H:i:s', $task['Availability'], new DateTimeZone('UTC'))->getTimestamp()
            : null;

        // Check if the task is unavailable due to the Availability date
        if ($availabilityTimestamp !== null && $availabilityTimestamp > $nowUTC) {
            header('Content-Type: application/json');
            echo json_encode([
                'status' => 'unavailable',
                'message' => 'Task is not available yet.',
                'availability' => $task['Availability']
            ]);
            exit;
        }

        // Format XML fields for nicer display.
        $task['PLNXML'] = prettyPrintXml($task['PLNXML']);
        $task['WPRXML'] = prettyPrintXml($task['WPRXML']);

        // Retrieve IGCRecords for this task (via EntrySeqID)
        $igcQuery = "SELECT 
                        IGCKey,
                        EntrySeqID,
                        IGCRecordDateTimeUTC,
                        IGCUploadDateTimeUTC,
                        LocalDate,
                        LocalTime,
                        BeginTimeUTC,
                        Pilot,
                        GliderType,
                        GliderID,
                        CompetitionID,
                        CompetitionClass,
                        NB21Version,
                        Sim,
                        TaskCompleted,
                        Penalties,
                        Duration,
                        Distance,
                        Speed,
                        IGCValid,
                        TPVersion
                     FROM IGCRecords
                     WHERE EntrySeqID = :entrySeqID";
        $stmtIgc = $pdo->prepare($igcQuery);
        $stmtIgc->bindParam(':entrySeqID', $entrySeqID, PDO::PARAM_INT);
        $stmtIgc->execute();
        $igcRecords = $stmtIgc->fetchAll(PDO::FETCH_ASSOC);

        foreach ($igcRecords as &$record) {
            // Process IGCRecordDateTimeUTC if it's exactly 12 characters (YYMMDDHHMMSS)
            if (!empty($record['IGCRecordDateTimeUTC']) && strlen($record['IGCRecordDateTimeUTC']) === 12) {
                $raw = $record['IGCRecordDateTimeUTC'];  // e.g. "241113003550"
                $yy = (int) substr($raw, 0, 2);   // "24"
                $mm = (int) substr($raw, 2, 2);   // "11"
                $dd = (int) substr($raw, 4, 2);   // "13"
                $HH = (int) substr($raw, 6, 2);   // "00"
                $mi = (int) substr($raw, 8, 2);   // "35"
                $ss = (int) substr($raw, 10, 2);  // "50"
                // Convert short year 24 => 2024 (customize logic if you need beyond 2050)
                $fullYear = $yy + 2000;
                // Format as "YYYY-MM-DD HH:MM" (seconds not shown in display)
                $record['IGCRecordDateTimeUTC'] = sprintf("%04d-%02d-%02d %02d:%02d", $fullYear, $mm, $dd, $HH, $mi);

                // Build a formatted date/time string
                // e.g. "2024-11-13 00:35:50 UTC"
                $record['IGCRecordDateTimeUTC'] = sprintf(
                    "%04d-%02d-%02d %02d:%02d",
                    $fullYear, $mm, $dd, $HH, $mi
                );
                // Transform the "Sim" field so that it only returns the year.
                if (!empty($record['Sim'])) {
                    $record['Sim'] = 'MS' . substr($record['Sim'], -4);
                }
            }
    
            // Convert new fields back to their display formats
    
            // TaskCompleted and Penalties: convert stored INTEGER (0/1) back to a boolean.
            $record['TaskCompleted'] = (bool)$record['TaskCompleted'];
            $record['Penalties'] = (bool)$record['Penalties'];
            $record['IGCValid'] = (bool)$record['IGCValid'];
    
            // Duration: Convert from seconds (stored as an INTEGER) back to "HH:MM:SS" text.
            if (isset($record['Duration']) && is_numeric($record['Duration'])) {
                $durationSec = (int)$record['Duration'];
                $hours = floor($durationSec / 3600);
                $minutes = floor(($durationSec % 3600) / 60);
                $seconds = $durationSec % 60;
                $record['Duration'] = sprintf("%02d:%02d:%02d", $hours, $minutes, $seconds);
            }
    
            // Distance and Speed: We leave them as float.
            // (Ensure they are numbers; no extra formatting is applied here.)
            $record['Distance'] = isset($record['Distance']) ? (float)$record['Distance'] : null;
            $record['Speed']    = isset($record['Speed']) ? (float)$record['Speed'] : null;
        }
        unset($record); // Clean up the reference.

        // Attach the IGCRecords to the task details.
        $task['IGCRecords'] = $igcRecords;

        // Output the task details as JSON.
        header('Content-Type: application/json');
        echo json_encode($task);
    } else {
        // If no task was found, return a clean message.
        header('Content-Type: application/json');
        echo json_encode(['status' => 'not_found', 'message' => 'Task not found']);
    }
} catch (Exception $e) {
    header('Content-Type: application/json');
    echo json_encode(['error' => $e->getMessage()]);
}
?>
