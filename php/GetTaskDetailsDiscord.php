<?php
require __DIR__ . '/CommonFunctions.php';

try {
    // Validate entrySeqID parameter
    if (!isset($_GET['entrySeqID'])) {
        throw new Exception('Missing required parameter: entrySeqID');
    }

    $entrySeqID = (int)$_GET['entrySeqID'];

    // Open the database connection
    $pdo = new PDO("sqlite:$databasePath");
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

    // Query to retrieve task details
    $query = "
        SELECT
            TaskID,
            Title,
            PLNFilename,
            PLNXML,
            WPRFilename,
            WPRXML
        FROM Tasks
        WHERE EntrySeqID = :entrySeqID AND Status = 99
    ";

    $stmt = $pdo->prepare($query);
    $stmt->bindParam(':entrySeqID', $entrySeqID, PDO::PARAM_INT);
    $stmt->execute();

    $task = $stmt->fetch(PDO::FETCH_ASSOC);

    if ($task) {
        // Check if the task is unavailable due to the Availability date
        if (!empty($task['Availability']) && strtotime($task['Availability']) > time()) {
            header('Content-Type: application/json');
            echo json_encode([
                'status' => 'unavailable',
                'message' => 'Task is not available yet.',
                'availability' => $task['Availability']
            ]);
            exit;
        }

        // Output the task details as JSON
        header('Content-Type: application/json');
        echo json_encode($task);
    } else {
        // If no task was found, return a clean message
        header('Content-Type: application/json');
        echo json_encode(['status' => 'not_found', 'message' => 'Task not found']);
    }
} catch (Exception $e) {
    header('Content-Type: application/json');
    echo json_encode(['error' => $e->getMessage()]);
}
?>
