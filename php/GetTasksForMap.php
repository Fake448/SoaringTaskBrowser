<?php
require __DIR__ . '/CommonFunctions.php';

try {
    $pdo = new PDO("sqlite:$databasePath");
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

    // Get the filter values from query parameters
    $taskCount = isset($_GET['taskCount']) ? (int)$_GET['taskCount'] : PHP_INT_MAX;
    $startDate = $_GET['startDate'] ?? '2000-01-01';
    $endDate = $_GET['endDate'] ?? date('Y-m-d');
    $endDate = date('Y-m-d', strtotime($endDate . ' +1 day'));
    $durationMin = isset($_GET['durationMin']) ? (int)$_GET['durationMin'] : 0;
    $durationMax = isset($_GET['durationMax']) ? (int)$_GET['durationMax'] : PHP_INT_MAX;
    $includeNoDuration = isset($_GET['includeNoDuration']) ? (bool)$_GET['includeNoDuration'] : true;

    // Log received parameters
    logMessage("Received Parameters - Task Count: $taskCount, Start Date: $startDate, End Date: $endDate, DurationMin: $durationMin, DurationMax: $durationMax, IncludeNotSpecified: $includeNoDuration");

    // Prepare params array, adding durationMin and durationMax explicitly here
    $params = [
        ':startDate' => $startDate,
        ':endDate' => $endDate,
        ':taskCount' => $taskCount,
        ':durationMin' => $durationMin,
        ':durationMax' => $durationMax
    ];

    // Log parameters just before binding to verify they are correct
    logMessage("Binding Parameters: " . json_encode($params));

    // Build the query
    $whereClauses = ["LastUpdate BETWEEN :startDate AND :endDate"];
    
    $durationConditions = [];
    $durationConditions[] = "(DurationMin IS NOT NULL AND DurationMax IS NOT NULL AND DurationMin >= :durationMin AND DurationMax <= :durationMax)";
    $durationConditions[] = "(DurationMin IS NOT NULL AND DurationMax IS NULL AND DurationMin >= :durationMin AND DurationMin <= :durationMax)";
    $durationConditions[] = "(DurationMin IS NULL AND DurationMax IS NOT NULL AND DurationMax >= :durationMin AND DurationMax <= :durationMax)";
    if ($includeNoDuration) {
        $durationConditions[] = "(DurationMin IS NULL AND DurationMax IS NULL)";
    }
    $whereClauses[] = '(' . implode(' OR ', $durationConditions) . ')';

    // Construct final SQL query
    $query = "
        SELECT EntrySeqID, TaskID, Title, LatMin, LatMax, LongMin, LongMax, PLNXML,
               MainAreaPOI, DepartureName, DepartureICAO, ArrivalName, ArrivalICAO,
               SoaringRidge, SoaringThermals, SoaringWaves, SoaringDynamic, SoaringExtraInfo,
               DurationMin, DurationMax, TaskDistance, TotalDistance, RecommendedGliders,
               DifficultyRating, DifficultyExtraInfo, Credits, Countries, LastUpdate
        FROM Tasks
        WHERE " . implode(' AND ', $whereClauses) . "
        ORDER BY LastUpdate DESC
        LIMIT :taskCount
    ";

    // Log the final query
    logMessage("Final Query: " . $query);

    // Prepare and execute the query
    $stmt = $pdo->prepare($query);
    foreach ($params as $key => $value) {
        $stmt->bindValue($key, $value, is_int($value) ? PDO::PARAM_INT : PDO::PARAM_STR);
    }
    // Log parameters just before binding to verify they are correct
    logMessage("$stmt";
    $stmt->execute();
    $tasks = $stmt->fetchAll(PDO::FETCH_ASSOC);

    // Additional query to get total task count without filters
    $countQuery = "SELECT COUNT(*) as totalTasks FROM Tasks";
    $countStmt = $pdo->prepare($countQuery);
    $countStmt->execute();
    $totalTasks = $countStmt->fetch(PDO::FETCH_ASSOC)['totalTasks'];

    // Additional query to get oldest and newest dates
    $dateQuery = "SELECT MIN(LastUpdate) as oldestDate, MAX(LastUpdate) as newestDate FROM Tasks";
    $dateStmt = $pdo->prepare($dateQuery);
    $dateStmt->execute();
    $dates = $dateStmt->fetch(PDO::FETCH_ASSOC);

    // Construct response
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
?>