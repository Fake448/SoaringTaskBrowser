<?php
require __DIR__ . '/CommonFunctions.php';

header('Content-Type: application/json');

$taskID = $_GET['taskID'] ?? null;

if (!$taskID) {
    echo json_encode(['status' => 'error', 'message' => 'Missing task ID.']);
    exit;
}

try {
    // Retrieve and unpack the DPHX file
    $taskFolder = retrieveAndUnpackDPHX($taskID);

    // Get the file names from the current task
    $plnFilename = $_GET['plnFilename'] ?? null;
    $wprFilename = $_GET['wprFilename'] ?? null;

    if (!$plnFilename || !$wprFilename) {
        echo json_encode(['status' => 'error', 'message' => 'Missing PLN or WPR filename.']);
        exit;
    }

    // Check if the files exist in the task folder
    $plnFile = "$taskFolder/$plnFilename";
    $wprFile = "$taskFolder/$wprFilename";

    if (!file_exists($plnFile) || !file_exists($wprFile)) {
        echo json_encode(['status' => 'error', 'message' => 'PLN or WPR file not found in unpacked folder.']);
        exit;
    }

    // Generate URLs for the task planner
    $plnUrl = urlencode($plnFilename);
    $wprUrl = urlencode($wprFilename);

    echo json_encode([
        'status' => 'success',
        'plnUrl' => $plnUrl,
        'wprUrl' => $wprUrl
    ]);
} catch (Exception $e) {
    echo json_encode(['status' => 'error', 'message' => $e->getMessage()]);
}
