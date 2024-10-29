<?php
require __DIR__ . '/CommonFunctions.php';

try {
    $pdo = new PDO("sqlite:$databasePath");
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

    // Get the filter values from query parameters
    $taskCount = isset($_GET['taskCount']) ? (int)$_GET['taskCount'] : PHP_INT_MAX;
    $startDate = $_GET['startDate'] ?? '2000-01-01'; // Use default min date if not provided
    $endDate = $_GET['endDate'] ?? date('Y-m-d'); // Use today's date if not provided

    // Add one day to endDate to ensure inclusivity
    $endDate = date('Y-m-d', strtotime($endDate . ' +1 day'));

    // Query to retrieve tasks with filters
    $query = "
        SELECT EntrySeqID, TaskID, Title, LatMin, LatMax, LongMin, LongMax, PLNXML
        FROM Tasks
        WHERE LastUpdate BETWEEN :startDate AND :endDate
        LIMIT :taskCount
    ";

    $stmt = $pdo->prepare($query);
    $stmt->bindValue(':startDate', $startDate);
    $stmt->bindValue(':endDate', $endDate);
    $stmt->bindValue(':taskCount', $taskCount, PDO::PARAM_INT);

    $stmt->execute();
    $tasks = $stmt->fetchAll(PDO::FETCH_ASSOC);

    // Query to get total task count
    $countQuery = "SELECT COUNT(*) as totalTasks FROM Tasks";
    $countStmt = $pdo->prepare($countQuery);
    $countStmt->execute();
    $totalTasks = $countStmt->fetch(PDO::FETCH_ASSOC)['totalTasks'];

    // Query to get oldest and newest dates
    $dateQuery = "SELECT MIN(LastUpdate) as oldestDate, MAX(LastUpdate) as newestDate FROM Tasks";
    $dateStmt = $pdo->prepare($dateQuery);
    $dateStmt->execute();
    $dates = $dateStmt->fetch(PDO::FETCH_ASSOC);

    $response = [
        'tasks' => $tasks,
        'totalTasks' => $totalTasks,
        'oldestDate' => $dates['oldestDate'],
        'newestDate' => $dates['newestDate']
    ];

    header('Content-Type: application/json');
    echo json_encode($response);

} catch (PDOException $e) {
    logMessage("Connection failed: " . $e->getMessage());
    header('Content-Type: application/json');
    echo json_encode(['error' => 'Connection failed']);
}
