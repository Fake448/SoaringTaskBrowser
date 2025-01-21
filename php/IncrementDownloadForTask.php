<?php
require __DIR__ . '/CommonFunctions.php';

try {
    // Open the database connection
    $pdo = new PDO("sqlite:$databasePath");
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

    // Retrieve the parameters from the query string
    $entrySeqID = isset($_GET['EntrySeqID']) && !empty($_GET['EntrySeqID']) ? $_GET['EntrySeqID'] : null;
    $taskID = isset($_GET['TaskID']) && !empty($_GET['TaskID']) ? $_GET['TaskID'] : null;

    if ($entrySeqID || $taskID) {
        // Get the current UTC time
        $now = new DateTime("now", new DateTimeZone("UTC"));
        $nowFormatted = $now->format('Y-m-d H:i:s');

        // Build the WHERE clause based on provided parameter
        $whereClause = $entrySeqID ? "EntrySeqID = :id" : "TaskID = :id";
        $idValue = $entrySeqID ? $entrySeqID : $taskID;

        // Define the query to update the record
        $updateQuery = "
            UPDATE Tasks 
            SET 
                TotDownloads = TotDownloads + 1, 
                LastDownloadUpdate = :lastDownloadUpdate 
            WHERE 
                $whereClause
        ";

        // Prepare and execute the update query
        $stmt = $pdo->prepare($updateQuery);
        $stmt->bindParam(':lastDownloadUpdate', $nowFormatted, PDO::PARAM_STR);
        $stmt->bindParam(':id', $idValue, PDO::PARAM_STR);
        $stmt->execute();

        // Define the query to retrieve the updated record
        $selectQuery = "
            SELECT TotDownloads, LastDownloadUpdate 
            FROM Tasks 
            WHERE $whereClause
        ";

        // Prepare and execute the select query
        $stmt = $pdo->prepare($selectQuery);
        $stmt->bindParam(':id', $idValue, PDO::PARAM_STR);
        $stmt->execute();
        $task = $stmt->fetch(PDO::FETCH_ASSOC);

        if ($task) {
            echo json_encode(['status' => 'success', 'TotDownloads' => $task['TotDownloads'], 'LastDownloadUpdate' => $task['LastDownloadUpdate']]);
        } else {
            echo json_encode(['status' => 'error', 'message' => 'No task found with the provided identifier']);
        }
    } else {
        // Handle missing parameters
        logMessage("--- Script running IncrementDownloadForTask ---");
        echo json_encode([
            'status' => 'error',
            'message' => 'Missing both EntrySeqID and TaskID parameters'
        ]);
        logMessage("--- End of script IncrementDownloadForTask ---");
    }

} catch (PDOException $e) {
    logMessage("--- Script running IncrementDownloadForTask ---");
    echo json_encode([
        'status' => 'error',
        'message' => 'Connection failed: ' . $e->getMessage()
    ]);
    logMessage("--- End of script IncrementDownloadForTask ---");
}
?>
