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
    
    // Ensure file is uploaded.
    if (!isset($_FILES['igcFile']) || $_FILES['igcFile']['error'] !== UPLOAD_ERR_OK) {
        throw new Exception("IGC file not uploaded or error during upload.");
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
    
    // Move the uploaded file.
    if (!move_uploaded_file($_FILES['igcFile']['tmp_name'], $destFilename)) {
        throw new Exception("Failed to move uploaded file.");
    }
    
    // Insert the new record into IGCRecords table.
    $insertQuery = "INSERT INTO IGCRecords 
        (IGCKey, EntrySeqID, IGCRecordDateTimeUTC, IGCUploadDateTimeUTC, LocalTime, BeginTimeUTC, Pilot, GliderType, GliderID, CompetitionID, CompetitionClass, NB21Version, Sim, WSGUserID, Comment)
        VALUES 
        (:IGCKey, :EntrySeqID, :IGCRecordDateTimeUTC, :IGCUploadDateTimeUTC, :LocalTime, :BeginTimeUTC, :Pilot, :GliderType, :GliderID, :CompetitionID, :CompetitionClass, :NB21Version, :Sim, :WSGUserID, :Comment)";
    
    $stmt = $pdo->prepare($insertQuery);
    $stmt->bindParam(':IGCKey', $IGCKey, PDO::PARAM_STR);
    $stmt->bindParam(':EntrySeqID', $EntrySeqID, PDO::PARAM_INT);
    $stmt->bindParam(':IGCRecordDateTimeUTC', $IGCRecordDateTimeUTC, PDO::PARAM_STR);
    $stmt->bindParam(':IGCUploadDateTimeUTC', $IGCUploadDateTimeUTC, PDO::PARAM_STR);
    $stmt->bindParam(':LocalTime', $LocalTime, PDO::PARAM_STR);
    $stmt->bindParam(':BeginTimeUTC', $BeginTimeUTC, PDO::PARAM_STR);
    $stmt->bindParam(':Pilot', $Pilot, PDO::PARAM_STR);
    $stmt->bindParam(':GliderType', $GliderType, PDO::PARAM_STR);
    $stmt->bindParam(':GliderID', $GliderID, PDO::PARAM_STR);
    $stmt->bindParam(':CompetitionID', $CompetitionID, PDO::PARAM_STR);
    $stmt->bindParam(':CompetitionClass', $CompetitionClass, PDO::PARAM_STR);
    $stmt->bindParam(':NB21Version', $NB21Version, PDO::PARAM_STR);
    $stmt->bindParam(':Sim', $Sim, PDO::PARAM_STR);
    $stmt->bindParam(':WSGUserID', $WSGUserID, PDO::PARAM_INT);
    $stmt->bindParam(':Comment', $IGCComment, PDO::PARAM_STR);
    
    $stmt->execute();
    
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
        // if the new IGCRecordDateTimeUTC is more recent.
        $currentMarked = $existingTask['MarkedFlownDateUTC'];
        if (empty($currentMarked) || strtotime($IGCRecordDateTimeUTC) > strtotime($currentMarked)) {
            $updateTaskQuery = "UPDATE UsersTasks SET MarkedFlownDateUTC = :IGCRecordDateTimeUTC 
                WHERE WSGUserID = :WSGUserID AND EntrySeqID = :EntrySeqID";
            $stmt = $pdo->prepare($updateTaskQuery);
            $stmt->bindParam(':IGCRecordDateTimeUTC', $IGCRecordDateTimeUTC, PDO::PARAM_STR);
            $stmt->bindParam(':WSGUserID', $WSGUserID, PDO::PARAM_INT);
            $stmt->bindParam(':EntrySeqID', $EntrySeqID, PDO::PARAM_INT);
            $stmt->execute();
        }
    } else {
        // Insert a new record with the MarkedFlownDateUTC value.
        $insertTaskQuery = "INSERT INTO UsersTasks (WSGUserID, EntrySeqID, MarkedFlownDateUTC)
            VALUES (:WSGUserID, :EntrySeqID, :IGCRecordDateTimeUTC)";
        $stmt = $pdo->prepare($insertTaskQuery);
        $stmt->bindParam(':WSGUserID', $WSGUserID, PDO::PARAM_INT);
        $stmt->bindParam(':EntrySeqID', $EntrySeqID, PDO::PARAM_INT);
        $stmt->bindParam(':IGCRecordDateTimeUTC', $IGCRecordDateTimeUTC, PDO::PARAM_STR);
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
