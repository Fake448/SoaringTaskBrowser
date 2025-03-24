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
    $plnFilename = basename(str_replace('\\', '/', trim($_POST['PLNFilename'])));
    $wprFilename = basename(str_replace('\\', '/', trim($_POST['WPRFilename'])));
    
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
    
    // Use the original file name for the IGC file.
    $destFilename = basename($_FILES['igcFile']['name']);
    $destFilePath = $destFolder . '/' . $destFilename;
    
    // Move the uploaded IGC file.
    if (!move_uploaded_file($_FILES['igcFile']['tmp_name'], $destFilePath)) {
        throw new Exception("Failed to move uploaded IGC file.");
    }
    
    // Build the URL to access the uploaded IGC file.
    // Derive the base path from __DIR__ and then apply path transformation.
    $igcBasePath = __DIR__ . '/DPHXTemp';
    if (strpos($igcBasePath, '/home3/siglr3/soaring.siglr.com/') === 0) {
        $igcBasePath = str_replace('/home3/siglr3/soaring.siglr.com/', 'soaring.siglr.com/', $igcBasePath);
    } elseif (strpos($igcBasePath, '/home3/siglr3/wesimglide/') === 0) {
        $igcBasePath = str_replace('/home3/siglr3/wesimglide/', 'wesimglide.org/', $igcBasePath);
    }
    // IGC file URL (without protocol)
    $igcFileUrl = $igcBasePath . '/' . $randomFolder . '/' . $destFilename;
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
    // $taskFolder is expected to be a URL path like:
    // soaring.siglr.com/php/DPHXTemp/P-83263a91-88dd-4507-97e5-983f8dc4b082
    $taskFolder = $prepareData['taskFolder'];
    
    // Build URLs for the PLN and WPR files using $taskFolder.
    $plnFileUrl = $taskFolder . "/" . $plnFilename;
    $wprFileUrl = $taskFolder . "/" . $wprFilename;
    
    // Build comp file content.
    // For the comp file, each URL MUST include "https://".
    $plnFileUrlComp = 'https://' . $plnFileUrl;
    $wprFileUrlComp = 'https://' . $wprFileUrl;
    $igcFileUrlComp = 'https://' . $igcFileUrlNoProtocol;
    
    $compFileContent = $plnFileUrlComp . "\n" . $wprFileUrlComp . "\n" . $igcFileUrlComp;
    $compFilePath = $destFolder . '/listoffiles.comp';
    if (file_put_contents($compFilePath, $compFileContent) === false) {
        throw new Exception("Failed to create comp file: $compFilePath");
    }
    
    // Build the comp file URL (without protocol) for the planner URL.
    $compFileUrl = $igcBasePath . '/' . $randomFolder . '/listoffiles.comp';
    
    // Build the final planner URL.
    // The planner URL will pass:
    // - wpr: the URL for the WPR file (without protocol)
    // - comp: the URL for the comp file (without protocol)
    $wprParam = rawurlencode($wprFileUrl);
    $compParam = rawurlencode($compFileUrl);
    
    $plannerUrl = "xp-soaring.github.io/tasks/b21_task_planner/index.html?wpr={$wprParam}&comp={$compParam}";
    
    echo json_encode([
        'status'     => 'success',
        'plannerUrl' => $plannerUrl,
        'tempFolder' => $randomFolder
    ]);
    
} catch (Exception $e) {
    echo json_encode(['status' => 'error', 'message' => $e->getMessage()]);
}
?>
