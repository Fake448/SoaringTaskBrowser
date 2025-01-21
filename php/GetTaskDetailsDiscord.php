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
        WHERE EntrySeqID = :entrySeqID
    ";

    $stmt = $pdo->prepare($query);
    $stmt->bindParam(':entrySeqID', $entrySeqID, PDO::PARAM_INT);
    $stmt->execute();

    $task = $stmt->fetch(PDO::FETCH_ASSOC);

    if ($task) {
        header('Content-Type: application/json');
        echo json_encode($task);
    } else {
        throw new Exception('Task not found');
    }
} catch (Exception $e) {
    header('Content-Type: application/json');
    echo json_encode(['error' => $e->getMessage()]);
}
?>
