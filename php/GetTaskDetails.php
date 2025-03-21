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
                        LocalTime,
                        BeginTimeUTC,
                        Pilot,
                        GliderType,
                        GliderID,
                        CompetitionID,
                        CompetitionClass,
                        NB21Version,
                        Sim
                     FROM IGCRecords
                     WHERE EntrySeqID = :entrySeqID";
        $stmtIgc = $pdo->prepare($igcQuery);
        $stmtIgc->bindParam(':entrySeqID', $entrySeqID, PDO::PARAM_INT);
        $stmtIgc->execute();
        $igcRecords = $stmtIgc->fetchAll(PDO::FETCH_ASSOC);

        foreach ($igcRecords as &$record) {
            // If the field is set and exactly 12 characters (YYMMDDHHMMSS)
            if (!empty($record['IGCRecordDateTimeUTC']) && strlen($record['IGCRecordDateTimeUTC']) === 12) {
                $raw = $record['IGCRecordDateTimeUTC'];  // e.g. "241113003550"
        
                // Extract YY, MM, DD, HH, mm, ss
                $yy = (int) substr($raw, 0, 2);  // "24" -> 24
                $mm = (int) substr($raw, 2, 2);  // "11" -> 11
                $dd = (int) substr($raw, 4, 2);  // "13" -> 13
                $HH = (int) substr($raw, 6, 2);  // "00" -> 0
                $mi = (int) substr($raw, 8, 2);  // "35" -> 35
                $ss = (int) substr($raw, 10, 2); // "50" -> 50

                // Convert short year 24 => 2024 (customize logic if you need beyond 2050)
                $fullYear = $yy + 2000;

                // Build a formatted date/time string
                // e.g. "2024-11-13 00:35:50 UTC"
                $record['IGCRecordDateTimeUTC'] = sprintf(
                    "%04d-%02d-%02d %02d:%02d UTC",
                    $fullYear, $mm, $dd, $HH, $mi
                );
            }
            // else leave it as is (or handle invalid length)
        }
        unset($record); // good practice after foreach by reference

        // Attach the IGC records to the task details.
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
