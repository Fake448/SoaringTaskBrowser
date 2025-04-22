<?php
require __DIR__ . '/CommonFunctions.php';

header('Content-Type: application/json');

try {
    // Check required POST parameters.
    $required = [
        'IGCKey',
        'EntrySeqID',
        'IGCRecordDateTimeUTC',
        'IGCUploadDateTimeUTC',
        'LocalDate',
        'LocalTime',
        'BeginTimeUTC',
        'Pilot',
        'GliderType',
        'GliderID',
        'CompetitionID',
        'CompetitionClass',
        'NB21Version',
        'Sim',
        'WSGUserID'
    ];
    
    foreach ($required as $field) {
        if (!isset($_POST[$field]) || trim($_POST[$field]) === "") {
            throw new Exception("Missing required field: $field");
        }
    }
    
    // Retrieve parameters.
    $IGCKey = trim($_POST['IGCKey']);
    $EntrySeqID = (int) $_POST['EntrySeqID'];
    $IGCRecordDateTimeUTC = trim($_POST['IGCRecordDateTimeUTC']);
    $IGCUploadDateTimeUTC = trim($_POST['IGCUploadDateTimeUTC']);
    $LocalDate = trim($_POST['LocalDate']);
    $LocalTime = trim($_POST['LocalTime']);
    $BeginTimeUTC = trim($_POST['BeginTimeUTC']);
    $Pilot = trim($_POST['Pilot']);
    $GliderType = trim($_POST['GliderType']);
    $GliderID = trim($_POST['GliderID']);
    $CompetitionID = trim($_POST['CompetitionID']);
    $CompetitionClass = trim($_POST['CompetitionClass']);
    $NB21Version = trim($_POST['NB21Version']);
    $Sim = trim($_POST['Sim']);
    $IGCComment = isset($_POST['IGCComment']) ? trim($_POST['IGCComment']) : "";
    $WSGUserID = (int) trim($_POST['WSGUserID']);
    
    // Instead of ensuring an uploaded file exists in $_FILES, 
    // locate the previously saved IGC file in the temporary folder.
    $tempDir = __DIR__ . '/DPHXTemp';
    $sourceFolder = $tempDir . '/' . $IGCKey;
    $sourceFilePath = $sourceFolder . '/' . $IGCKey . '.igc';
    if (!file_exists($sourceFilePath)) {
        throw new Exception("IGC file not found in temporary folder.");
    }
    
    // Open the database connection.
    $pdo = new PDO("sqlite:$databasePath");
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    
    // Check if a record with the same IGCKey already exists.
    $checkQuery = "SELECT * FROM IGCRecords WHERE IGCKey = :igcKey";
    $stmt = $pdo->prepare($checkQuery);
    $stmt->bindParam(':igcKey', $IGCKey, PDO::PARAM_STR);
    $stmt->execute();
    $existingRecord = $stmt->fetch(PDO::FETCH_ASSOC);
    
    if ($existingRecord) {
        echo json_encode([
            'status' => 'duplicate',
            'message' => 'An IGC record with this key already exists.'
        ]);
        exit;
    }
    
    // Determine the destination folder.
    $destFolder = rtrim($taskBrowserPath, '/\\') . '/IGCFiles/' . $EntrySeqID;
    if (!is_dir($destFolder)) {
        if (!mkdir($destFolder, 0755, true)) {
            throw new Exception("Failed to create destination folder: $destFolder");
        }
    }
    
    // Destination filename: [IGCKey].igc
    $destFilename = $destFolder . '/' . $IGCKey . '.igc';
    
    // Move the saved IGC file from its temporary folder to the official destination.
    if (!rename($sourceFilePath, $destFilename)) {
        throw new Exception("Failed to move saved IGC file to destination folder.");
    }

    // Read the results from the results.json file ===
    $resultsFile = $sourceFolder . '/results.json';
    if (!file_exists($resultsFile)) {
        throw new Exception("Results file not found in temporary folder.");
    }
    $resultsContent = file_get_contents($resultsFile);
    $parsedResults = json_decode($resultsContent, true);
    if (json_last_error() !== JSON_ERROR_NONE) {
        throw new Exception("Failed to decode results file: " . json_last_error_msg());
    }

    // Extract the new TPVersion (planner version)
    $tpVersion = isset($parsedResults['TPVersion']) ? $parsedResults['TPVersion'] : null;

    // Convert boolean values to integers.
    $taskCompletedInt = !empty($parsedResults["TaskCompleted"]) ? 1 : 0;
    $penaltiesInt     = !empty($parsedResults["Penalties"])    ? 1 : 0;
    $igcValidInt      = !empty($parsedResults["IGCValid"])     ? 1 : 0;

    // Convert Duration from "HH:MM:SS" to seconds.
    $durationSeconds = 0;
    if (!empty($parsedResults["Duration"])) {
        list($hours, $minutes, $seconds) = explode(":", $parsedResults["Duration"]);
        $durationSeconds = ((int)$hours * 3600) + ((int)$minutes * 60) + ((int)$seconds);
    }

    // Convert Distance and Speed to float.
    $distanceFloat = (!empty($parsedResults["Distance"])) ? (float)$parsedResults["Distance"] : null;
    $speedFloat    = (!empty($parsedResults["Speed"]))    ? (float)$parsedResults["Speed"]    : null;

    // Insert the new record into IGCRecords table.
    // Note the added TPVersion column and placeholder.
    $insertQuery = "
      INSERT INTO IGCRecords (
        IGCKey, EntrySeqID, IGCRecordDateTimeUTC, IGCUploadDateTimeUTC, LocalTime,
        BeginTimeUTC, Pilot, GliderType, GliderID, CompetitionID,
        CompetitionClass, NB21Version, Sim, WSGUserID, Comment,
        TaskCompleted, Penalties, Duration, Distance, Speed, IGCValid,
        TPVersion, LocalDate
      ) VALUES (
        :IGCKey, :EntrySeqID, :IGCRecordDateTimeUTC, :IGCUploadDateTimeUTC, :LocalTime,
        :BeginTimeUTC, :Pilot, :GliderType, :GliderID, :CompetitionID,
        :CompetitionClass, :NB21Version, :Sim, :WSGUserID, :Comment,
        :TaskCompleted, :Penalties, :Duration, :Distance, :Speed, :IGCValid,
        :TPVersion, :LocalDate
      )
    ";

    $stmt = $pdo->prepare($insertQuery);
    $stmt->bindParam(':IGCKey',                 $IGCKey,               PDO::PARAM_STR);
    $stmt->bindParam(':EntrySeqID',             $EntrySeqID,           PDO::PARAM_INT);
    $stmt->bindParam(':IGCRecordDateTimeUTC',   $IGCRecordDateTimeUTC, PDO::PARAM_STR);
    $stmt->bindParam(':IGCUploadDateTimeUTC',   $IGCUploadDateTimeUTC, PDO::PARAM_STR);
    $stmt->bindParam(':LocalDate',              $LocalDate,            PDO::PARAM_STR);
    $stmt->bindParam(':LocalTime',              $LocalTime,            PDO::PARAM_STR);
    $stmt->bindParam(':BeginTimeUTC',           $BeginTimeUTC,         PDO::PARAM_STR);
    $stmt->bindParam(':Pilot',                  $Pilot,                PDO::PARAM_STR);
    $stmt->bindParam(':GliderType',             $GliderType,           PDO::PARAM_STR);
    $stmt->bindParam(':GliderID',               $GliderID,             PDO::PARAM_STR);
    $stmt->bindParam(':CompetitionID',          $CompetitionID,        PDO::PARAM_STR);
    $stmt->bindParam(':CompetitionClass',       $CompetitionClass,     PDO::PARAM_STR);
    $stmt->bindParam(':NB21Version',            $NB21Version,          PDO::PARAM_STR);
    $stmt->bindParam(':Sim',                    $Sim,                  PDO::PARAM_STR);
    $stmt->bindParam(':WSGUserID',              $WSGUserID,            PDO::PARAM_INT);
    $stmt->bindParam(':Comment',                $IGCComment,           PDO::PARAM_STR);
    $stmt->bindParam(':TaskCompleted',          $taskCompletedInt,     PDO::PARAM_INT);
    $stmt->bindParam(':Penalties',              $penaltiesInt,         PDO::PARAM_INT);
    $stmt->bindParam(':Duration',               $durationSeconds,      PDO::PARAM_INT);
    $stmt->bindParam(':Distance',               $distanceFloat);
    $stmt->bindParam(':Speed',                  $speedFloat);
    $stmt->bindParam(':IGCValid',               $igcValidInt,          PDO::PARAM_INT);
    $stmt->bindParam(':TPVersion',              $tpVersion,            PDO::PARAM_STR);

    $stmt->execute();
    
    // Transform IGCRecordDateTimeUTC to the desired format for saving in MarkedFlownDateUTC.
    if (!empty($IGCRecordDateTimeUTC) && strlen($IGCRecordDateTimeUTC) === 12) {
        $yy = (int) substr($IGCRecordDateTimeUTC, 0, 2);
        $mm = (int) substr($IGCRecordDateTimeUTC, 2, 2);
        $dd = (int) substr($IGCRecordDateTimeUTC, 4, 2);
        $HH = (int) substr($IGCRecordDateTimeUTC, 6, 2);
        $mi = (int) substr($IGCRecordDateTimeUTC, 8, 2);
        $fullYear = $yy + 2000;
        $formattedDate = sprintf("%04d-%02d-%02d %02d:%02d", $fullYear, $mm, $dd, $HH, $mi);
    } else {
        $formattedDate = $IGCRecordDateTimeUTC;
    }

    // Now, create or update the corresponding record in the UsersTasks table.
    // Check if a record already exists for this WSGUserID and EntrySeqID.
    $checkTaskQuery = "SELECT * FROM UsersTasks WHERE WSGUserID = :WSGUserID AND EntrySeqID = :EntrySeqID";
    $stmt = $pdo->prepare($checkTaskQuery);
    $stmt->bindParam(':WSGUserID', $WSGUserID, PDO::PARAM_INT);
    $stmt->bindParam(':EntrySeqID', $EntrySeqID, PDO::PARAM_INT);
    $stmt->execute();
    $existingTask = $stmt->fetch(PDO::FETCH_ASSOC);

    if ($existingTask) {
        // Determine if we should update: update if MarkedFlownDateUTC is empty or
        // if the new formatted date is more recent.
        $currentMarked = $existingTask['MarkedFlownDateUTC'];
        if (empty($currentMarked) || strtotime($formattedDate) > strtotime($currentMarked)) {
            $updateTaskQuery = "UPDATE UsersTasks SET MarkedFlownDateUTC = :markedDate 
                WHERE WSGUserID = :WSGUserID AND EntrySeqID = :EntrySeqID";
            $stmt = $pdo->prepare($updateTaskQuery);
            $stmt->bindParam(':markedDate', $formattedDate, PDO::PARAM_STR);
            $stmt->bindParam(':WSGUserID', $WSGUserID, PDO::PARAM_INT);
            $stmt->bindParam(':EntrySeqID', $EntrySeqID, PDO::PARAM_INT);
            $stmt->execute();
        }
    } else {
        // Insert a new record with the formatted MarkedFlownDateUTC value.
        $insertTaskQuery = "INSERT INTO UsersTasks (WSGUserID, EntrySeqID, MarkedFlownDateUTC)
            VALUES (:WSGUserID, :EntrySeqID, :markedDate)";
        $stmt = $pdo->prepare($insertTaskQuery);
        $stmt->bindParam(':WSGUserID', $WSGUserID, PDO::PARAM_INT);
        $stmt->bindParam(':EntrySeqID', $EntrySeqID, PDO::PARAM_INT);
        $stmt->bindParam(':markedDate', $formattedDate, PDO::PARAM_STR);
        $stmt->execute();
    }

    echo json_encode([
        'status' => 'success',
        'message' => 'IGC record saved successfully.',
        'IGCKey' => $IGCKey
    ]);
    
} catch (Exception $e) {
    echo json_encode(['error' => $e->getMessage()]);
    exit;
}
?>
