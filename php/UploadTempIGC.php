<?php
require_once __DIR__ . '/CommonFunctions.php';

header('Content-Type: application/json');

try {
    // Check required POST parameters.
    $required = ['EntrySeqID', 'TaskID', 'PLNFilename', 'WPRFilename'];
    foreach ($required as $field) {
        if (!isset($_POST[$field]) || trim($_POST[$field]) === "") {
            throw new Exception("Missing required field: $field");
        }
    }
    
    $entrySeqID = (int) $_POST['EntrySeqID'];
    $taskID = trim($_POST['TaskID']);
    // Strip any directory paths; keep only the filenames.
    $plnFilename = basename(trim($_POST['PLNFilename']));
    $wprFilename = basename(trim($_POST['WPRFilename']));
    
    // Check file upload.
    if (!isset($_FILES['igcFile']) || $_FILES['igcFile']['error'] !== UPLOAD_ERR_OK) {
        throw new Exception("IGC file not uploaded or error during upload.");
    }
    
    // Define a temporary directory for IGC uploads.
    $tempDir = __DIR__ . '/DPHXTemp';
    
    // Create a random folder name.
    $randomFolder = uniqid("igc_", true);
    $destFolder = $tempDir . '/' . $randomFolder;
    if (!mkdir($destFolder, 0755, true)) {
        throw new Exception("Failed to create temporary folder: $destFolder");
    }
    
    // Use the original file name.
    $destFilename = basename($_FILES['igcFile']['name']);
    $destFilePath = $destFolder . '/' . $destFilename;
    
    // Move the uploaded file.
    if (!move_uploaded_file($_FILES['igcFile']['tmp_name'], $destFilePath)) {
        throw new Exception("Failed to move uploaded IGC file.");
    }
    
    // Build the URL to access the uploaded IGC file.
    // (The $taskBrowserPathHTTPS variable is still used here if needed to form the URL)
    $igcFileUrl = rtrim($taskBrowserPathHTTPS, '/') . '/TempIGCUploads/' . $randomFolder . '/' . $destFilename;
    // Remove protocol (http:// or https://) for the planner parameters.
    $igcFileUrlNoProtocol = preg_replace('/^https?:\/\//', '', $igcFileUrl);
    
    // Call the PrepareSendToB21OnlineTaskPlanner.php script located in the same folder.
    // Use output buffering and set $_GET to simulate query parameters.
    ob_start();
    $_GET['taskID'] = $taskID;
    include __DIR__ . '/PrepareSendToB21OnlineTaskPlanner.php';
    $prepareResponse = ob_get_clean();
    if ($prepareResponse === false) {
        throw new Exception("Failed to capture output from PrepareSendToB21OnlineTaskPlanner.php");
    }
    $prepareData = json_decode($prepareResponse, true);
    if (!$prepareData || $prepareData['status'] !== 'success') {
        throw new Exception("PrepareSendToB21OnlineTaskPlanner error: " . ($prepareData['message'] ?? 'Unknown error'));
    }
    $taskFolder = $prepareData['taskFolder'];
    
    // Construct the URL for the Online Planner using the provided (sanitized) filenames.
    $plnParam = urlencode($taskFolder . "/" . $plnFilename);
    $wprParam = urlencode($taskFolder . "/" . $wprFilename);
    $igcParam = urlencode($igcFileUrlNoProtocol);
    
    // Build the planner URL (parameters without protocol as requested).
    $plannerUrl = "xp-soaring.github.io/tasks/b21_task_planner/index.html?pln={$plnParam}&wpr={$wprParam}&igc={$igcParam}";
    
    echo json_encode([
        'status' => 'success',
        'plannerUrl' => $plannerUrl,
        'tempFolder' => $randomFolder
    ]);
    
} catch (Exception $e) {
    echo json_encode(['status' => 'error', 'message' => $e->getMessage()]);
}
?>
