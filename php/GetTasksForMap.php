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

    // Get soaring type filters from query parameters
    $soaringTypes = [
        'soaringRidge' => isset($_GET['soaringRidge']) ? (int)$_GET['soaringRidge'] : 1,
        'soaringThermals' => isset($_GET['soaringThermals']) ? (int)$_GET['soaringThermals'] : 1,
        'soaringWaves' => isset($_GET['soaringWaves']) ? (int)$_GET['soaringWaves'] : 1,
        'soaringDynamic' => isset($_GET['soaringDynamic']) ? (int)$_GET['soaringDynamic'] : 1
    ];
    $soaringTypeFilter = $_GET['soaringTypeFilter'] ?? 'any';

    // Logging
    //logMessage("Received Parameters - Task Count: $taskCount, Start Date: $startDate, End Date: $endDate, DurationMin: $durationMin, DurationMax: $durationMax, IncludeNoDuration: $includeNoDuration, Soaring Types: " . json_encode($soaringTypes) . ", Filter Type: $soaringTypeFilter");

    // Base WHERE clause for date range AND status = 99
    $whereClauses = [
        "LastUpdate BETWEEN :startDate AND :endDate",
        "Status = 99"
    ];
    $params = [
        ':startDate' => $startDate,
        ':endDate' => $endDate,
        ':taskCount' => $taskCount,
        ':durationMin' => $durationMin,
        ':durationMax' => $durationMax
    ];

    // Add soaring type conditions if required
    $soaringConditions = [];
    $allTypesSelected = array_reduce($soaringTypes, fn($carry, $value) => $carry && $value, true);
    if (!($soaringTypeFilter === 'any' && $allTypesSelected)) {
        foreach ($soaringTypes as $column => $value) {
            if ($value) {
                switch ($soaringTypeFilter) {
                    case 'any':
                        $soaringConditions[] = "$column = 1";
                        break;
                    case 'all':
                        $soaringConditions[] = "$column = 1";
                        break;
                    case 'only':
                        $soaringConditions[] = "$column = 1";
                        break;
                    case 'exclude':
                        $soaringConditions[] = "$column = 0";
                        break;
                }
            } elseif ($soaringTypeFilter === 'only') {
                $soaringConditions[] = "$column = 0";
            }
        }
    }

    // Add soaring type conditions to WHERE clause
    if (!empty($soaringConditions)) {
        $whereClauses[] = $soaringTypeFilter === 'any' 
            ? '(' . implode(' OR ', $soaringConditions) . ')'
            : '(' . implode(' AND ', $soaringConditions) . ')';
    }

    // Add duration conditions
    $durationConditions = [
        "((NOT (DurationMin IS NULL OR DurationMin = '' OR DurationMin = 0)) AND (NOT (DurationMax IS NULL OR DurationMax = '' OR DurationMax = 0)) AND DurationMin >= :durationMin AND DurationMax <= :durationMax)",
        "((NOT (DurationMin IS NULL OR DurationMin = '' OR DurationMin = 0)) AND (DurationMax IS NULL OR DurationMax = '' OR DurationMax = 0) AND DurationMin >= :durationMin AND DurationMin <= :durationMax)",
        "((DurationMin IS NULL OR DurationMin = '' OR DurationMin = 0) AND (NOT (DurationMax IS NULL OR DurationMax = '' OR DurationMax = 0)) AND DurationMax >= :durationMin AND DurationMax <= :durationMax)"
    ];

    // Include tasks with no duration if specified
    if ($includeNoDuration) {
        $durationConditions[] = "((DurationMin = 0 OR DurationMin = '' OR DurationMin IS NULL) AND (DurationMax = 0 OR DurationMax = '' OR DurationMax IS NULL))";
    }

    // Add duration conditions to WHERE clause
    $whereClauses[] = '(' . implode(' OR ', $durationConditions) . ')';

    // Final query
    $query = "
        SELECT 
            EntrySeqID, TaskID, Title, LatMin, LatMax, LongMin, LongMax, PLNXML,
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
    //$debugQuery = $query;
    //foreach ($params as $key => $value) {
    //    $debugQuery = str_replace($key, is_int($value) ? $value : "'$value'", $debugQuery);
    //}
    //logMessage("Debug Query: $debugQuery");

    // Execute query with parameters
    $stmt = $pdo->prepare($query);
    foreach ($params as $key => $value) {
        $stmt->bindValue($key, $value, is_int($value) ? PDO::PARAM_INT : PDO::PARAM_STR);
    }
    $stmt->execute();
    $tasks = $stmt->fetchAll(PDO::FETCH_ASSOC);

    // Additional query for total task count
    $countQuery = "SELECT COUNT(*) as totalTasks FROM Tasks";
    $countStmt = $pdo->prepare($countQuery);
    $countStmt->execute();
    $totalTasks = $countStmt->fetch(PDO::FETCH_ASSOC)['totalTasks'];

    // Additional query for oldest and newest dates
    $dateQuery = "SELECT MIN(LastUpdate) as oldestDate, MAX(LastUpdate) as newestDate FROM Tasks";
    $dateStmt = $pdo->prepare($dateQuery);
    $dateStmt->execute();
    $dates = $dateStmt->fetch(PDO::FETCH_ASSOC);

    // Response
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
