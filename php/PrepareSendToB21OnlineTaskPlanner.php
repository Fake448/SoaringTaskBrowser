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

    echo json_encode([
        'status' => 'success',
        'taskFolder' => $taskFolder
    ]);
} catch (Exception $e) {
    echo json_encode(['status' => 'error', 'message' => $e->getMessage()]);
}
