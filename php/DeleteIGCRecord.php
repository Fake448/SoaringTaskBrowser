<?php
require __DIR__ . '/CommonFunctions.php';

header('Content-Type: application/json');

try {
    // Check required POST parameter.
    if (!isset($_POST['IGCKey']) || trim($_POST['IGCKey']) === "") {
        throw new Exception("Missing required field: IGCKey");
    }
    
    $IGCKey = trim($_POST['IGCKey']);
    
    // Open the database connection.
    $pdo = new PDO("sqlite:$databasePath");
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    
    // Check if a record with the given IGCKey exists.
    $checkQuery = "SELECT * FROM IGCRecords WHERE IGCKey = :igcKey";
    $stmt = $pdo->prepare($checkQuery);
    $stmt->bindParam(':igcKey', $IGCKey, PDO::PARAM_STR);
    $stmt->execute();
    $record = $stmt->fetch(PDO::FETCH_ASSOC);
    
    if (!$record) {
        echo json_encode([
            'status' => 'not_found',
            'message' => 'No IGC record found with the given key.'
        ]);
        exit;
    }
    
    // Extract EntrySeqID from the IGCKey.
    // Expected format: EntrySeqID_CompetitionID_GliderType_IGCRecordDateTimeUTC
    $parts = explode('_', $IGCKey);
    if (count($parts) < 4) {
        throw new Exception("Invalid IGCKey format.");
    }
    $EntrySeqID = $parts[0];
    
    // Determine the destination folder.
    // Note: $taskBrowserPath should be a filesystem path to the TaskBrowser folder.
    $destFolder = rtrim($taskBrowserPath, '/\\') . '/IGCFiles/' . $EntrySeqID;
    $destFilename = $destFolder . '/' . $IGCKey . '.igc';
    
    // Delete the file if it exists.
    if (file_exists($destFilename)) {
        if (!unlink($destFilename)) {
            throw new Exception("Failed to delete the file: $destFilename");
        }
    }
    
    // Delete the record from IGCRecords table.
    $deleteQuery = "DELETE FROM IGCRecords WHERE IGCKey = :igcKey";
    $stmt = $pdo->prepare($deleteQuery);
    $stmt->bindParam(':igcKey', $IGCKey, PDO::PARAM_STR);
    $stmt->execute();
    
    echo json_encode([
        'status' => 'success',
        'message' => 'IGC record and file deleted successfully.',
        'IGCKey' => $IGCKey
    ]);
    
} catch (Exception $e) {
    echo json_encode(['error' => $e->getMessage()]);
    exit;
}
?>
