<?php
require __DIR__ . '/CommonFunctions.php';

try {
    $pdo = new PDO("sqlite:$databasePath");
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

    // Parameter assignments
    $taskCount = isset($_GET['taskCount']) ? (int)$_GET['taskCount'] : PHP_INT_MAX;
    $startDate = $_GET['startDate'] ?? '2000-01-01';
    $endDate = $_GET['endDate'] ?? date('Y-m-d');
    $endDate = date('Y-m-d', strtotime($endDate . ' +1 day'));
    $durationMin = isset($_GET['durationMin']) ? (int)$_GET['durationMin'] : 0;
    $durationMax = isset($_GET['durationMax']) ? (int)$_GET['durationMax'] : PHP_INT_MAX;
    $includeNoDuration = isset($_GET['includeNoDuration']) ? (bool)$_GET['includeNoDuration'] : true;

    // Debug log parameters
    //logMessage("Received Parameters: Task Count = $taskCount, Start Date = $startDate, End Date = $endDate, DurationMin = $durationMin, DurationMax = $durationMax, IncludeNoDuration = $includeNoDuration");

    // WHERE clause setup
    $whereClauses = ["LastUpdate BETWEEN :startDate AND :endDate"];
    $params = [
        ':startDate' => $startDate,
        ':endDate' => $endDate,
        ':taskCount' => $taskCount,
        ':durationMin' => $durationMin,
        ':durationMax' => $durationMax
    ];

    // Duration conditions
    $durationConditions = [
        "((NOT (DurationMin IS NULL OR DurationMin = '' OR DurationMin = 0)) AND (NOT (DurationMax IS NULL OR DurationMax = '' OR DurationMax = 0)) AND DurationMin >= :durationMin AND DurationMax <= :durationMax)",
        "((NOT (DurationMin IS NULL OR DurationMin = '' OR DurationMin = 0)) AND (DurationMax IS NULL OR DurationMax = '' OR DurationMax = 0) AND DurationMin >= :durationMin AND DurationMin <= :durationMax)",
        "((DurationMin IS NULL OR DurationMin = '' OR DurationMin = 0) AND (NOT (DurationMax IS NULL OR DurationMax = '' OR DurationMax = 0)) AND DurationMax >= :durationMin AND DurationMax <= :durationMax)"
    ];
    // Tasks with no duration specified (optional, if "include tasks with no duration" is checked)
    if ($includeNoDuration) {
        $durationConditions[] = "((DurationMin = 0 OR DurationMin = '' OR DurationMin IS NULL) AND (DurationMax = 0 OR DurationMax = '' OR DurationMax IS NULL))";
    }
    $whereClauses[] = '(' . implode(' OR ', $durationConditions) . ')';

    // Final query
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

    // Debug the final query with parameter substitution
    $debugQuery = $query;
    foreach ($params as $key => $value) {
        $debugQuery = str_replace($key, is_int($value) ? $value : "'$value'", $debugQuery);
    }
    //logMessage("Debug Query: $debugQuery");

    // Execute
    $stmt = $pdo->prepare($query);
    foreach ($params as $key => $value) {
        $stmt->bindValue($key, $value, is_int($value) ? PDO::PARAM_INT : PDO::PARAM_STR);
    }
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