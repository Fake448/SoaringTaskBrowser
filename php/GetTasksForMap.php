<?php
require __DIR__ . '/CommonFunctions.php';

try {
    // Open the database connection
    $pdo = new PDO("sqlite:$databasePath");
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

    // Define the query to retrieve all task records with bounding box information
    $query = "
        SELECT 
            EntrySeqID, 
            TaskID, 
            Title,
            LatMin,
            LatMax,
            LongMin,
            LongMax,
            PLNXML
        FROM 
            Tasks
    ";

    // Prepare and execute the task query
    $stmt = $pdo->prepare($query);
    $stmt->execute();
    $tasks = $stmt->fetchAll(PDO::FETCH_ASSOC);

    // Query to get the total number of tasks
    $countQuery = "SELECT COUNT(*) as totalTasks FROM Tasks";
    $countStmt = $pdo->prepare($countQuery);
    $countStmt->execute();
    $totalTasks = $countStmt->fetch(PDO::FETCH_ASSOC)['totalTasks'];

    // Query to get the oldest and newest dates in the LastUpdate field
    $dateQuery = "SELECT MIN(LastUpdate) as oldestDate, MAX(LastUpdate) as newestDate FROM Tasks";
    $dateStmt = $pdo->prepare($dateQuery);
    $dateStmt->execute();
    $dates = $dateStmt->fetch(PDO::FETCH_ASSOC);

    // Prepare the final response with tasks, total task count, and date information
    $response = [
        'tasks' => $tasks,
        'totalTasks' => $totalTasks,
        'oldestDate' => $dates['oldestDate'],
        'newestDate' => $dates['newestDate']
    ];

    // Output the results as JSON
    header('Content-Type: application/json');
    echo json_encode($response);

} catch (PDOException $e) {
    logMessage("Connection failed: " . $e->getMessage());
    header('Content-Type: application/json');
    echo json_encode(['error' => 'Connection failed']);
}
?>
