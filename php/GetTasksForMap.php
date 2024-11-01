<?php
require __DIR__ . '/CommonFunctions.php';

try {
    $pdo = new PDO("sqlite:$databasePath");
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

    // Get the filter values from query parameters
    $taskCount = isset($_GET['taskCount']) ? (int)$_GET['taskCount'] : PHP_INT_MAX;
    $startDate = $_GET['startDate'] ?? '2000-01-01'; // Use default min date if not provided
    $endDate = $_GET['endDate'] ?? date('Y-m-d'); // Use today's date if not provided
    $endDate = date('Y-m-d', strtotime($endDate . ' +1 day')); // Include endDate fully
    $durationMin = isset($_GET['durationMin']) ? (int)$_GET['durationMin'] : 0;
    $durationMax = isset($_GET['durationMax']) ? (int)$_GET['durationMax'] : PHP_INT_MAX;
    $includeNoDuration = isset($_GET['includeNoDuration']) ? (bool)$_GET['includeNoDuration'] : true;
    logMessage("Duration parameters: " . $durationMin .$durationMax .$includeNoDuration);

    // Get soaring type filters from query parameters
    $soaringTypes = [
        'soaringRidge' => isset($_GET['soaringRidge']) ? (int)$_GET['soaringRidge'] : 1,
        'soaringThermals' => isset($_GET['soaringThermals']) ? (int)$_GET['soaringThermals'] : 1,
        'soaringWaves' => isset($_GET['soaringWaves']) ? (int)$_GET['soaringWaves'] : 1,
        'soaringDynamic' => isset($_GET['soaringDynamic']) ? (int)$_GET['soaringDynamic'] : 1
    ];
    $soaringTypeFilter = $_GET['soaringTypeFilter'] ?? 'any';

    // Log the received parameters
    //logMessage("Received Parameters - Task Count: $taskCount, Start Date: $startDate, End Date: $endDate, Soaring Types: " . json_encode($soaringTypes) . ", Filter Type: $soaringTypeFilter");

    // Determine if all types are selected with "any" filter
    $allTypesSelected = array_reduce($soaringTypes, fn($carry, $value) => $carry && $value, true);

    // Build WHERE clause based on the filters
    $whereClauses = ["LastUpdate BETWEEN :startDate AND :endDate"];
    $params = [
        ':startDate' => $startDate,
        ':endDate' => $endDate,
        ':taskCount' => $taskCount
    ];

    // Add soaring type conditions only if necessary
    $soaringConditions = [];
    if (!($soaringTypeFilter === 'any' && $allTypesSelected)) {
        foreach ($soaringTypes as $column => $value) {
            if ($value) {
                switch ($soaringTypeFilter) {
                    case 'any': // At least one selected type (OR)
                        $soaringConditions[] = "$column = 1";
                        break;
                    case 'all': // All selected types (AND)
                        $soaringConditions[] = "$column = 1";
                        break;
                    case 'only': // Only selected types (AND) with exclusion of others
                        $soaringConditions[] = "$column = 1";
                        break;
                    case 'exclude': // Exclude selected types (AND for NOT)
                        $soaringConditions[] = "$column = 0";
                        break;
                }
            } elseif ($soaringTypeFilter === 'only') {
                // If "only" filter is applied, add condition to ensure unselected types are 0
                $soaringConditions[] = "$column = 0";
            }
        }
    }

    // Log the generated soaring conditions
    //logMessage("Generated Soaring Conditions: " . json_encode($soaringConditions));

    // Append soaring type conditions to WHERE clause if they are defined
    if (!empty($soaringConditions)) {
        if ($soaringTypeFilter === 'any') {
            $whereClauses[] = '(' . implode(' OR ', $soaringConditions) . ')';
        } else {
            $whereClauses[] = '(' . implode(' AND ', $soaringConditions) . ')';
        }
    }

    $durationConditions = [];
    // Tasks with both DurationMin and DurationMax specified
    $durationConditions[] = "(DurationMin IS NOT NULL AND DurationMax IS NOT NULL AND DurationMin >= :durationMin AND DurationMax <= :durationMax)";
    // Tasks with only DurationMin specified (interpreted as "around" that minimum value)
    $durationConditions[] = "(DurationMin IS NOT NULL AND DurationMax IS NULL AND DurationMin >= :durationMin AND DurationMin <= :durationMax)";
    // Tasks with only DurationMax specified (interpreted as "around" that maximum value)
    $durationConditions[] = "(DurationMin IS NULL AND DurationMax IS NOT NULL AND DurationMax >= :durationMin AND DurationMax <= :durationMax)";
    // Tasks with no duration specified (optional, if "include tasks with no duration" is checked)
    if ($includeNoDuration) {
        $durationConditions[] = "(DurationMin IS NULL AND DurationMax IS NULL)";
    }
    // Append to the main WHERE clause
    if (!empty($durationConditions)) {
        $whereClauses[] = '(' . implode(' OR ', $durationConditions) . ')';
    }

    // Final query with dynamic WHERE clause
    $query = "
        SELECT 
            EntrySeqID, 
            TaskID, 
            Title, 
            LatMin, 
            LatMax, 
            LongMin, 
            LongMax, 
            PLNXML,
            MainAreaPOI,
            DepartureName,
            DepartureICAO,
            ArrivalName,
            ArrivalICAO,
            SoaringRidge,
            SoaringThermals,
            SoaringWaves,
            SoaringDynamic,
            SoaringExtraInfo,
            DurationMin,
            DurationMax,
            TaskDistance,
            TotalDistance,
            RecommendedGliders,
            DifficultyRating,
            DifficultyExtraInfo,
            Credits,
            Countries,
            LastUpdate
        FROM Tasks
        WHERE " . implode(' AND ', $whereClauses) . "
        ORDER BY LastUpdate DESC
        LIMIT :taskCount
    ";

    // Log the final query to inspect the generated SQL
    logMessage("Final Query: " . $query);

    $stmt = $pdo->prepare($query);
    $stmt->bindValue(':startDate', $params[':startDate']);
    $stmt->bindValue(':endDate', $params[':endDate']);
    $stmt->bindValue(':taskCount', $params[':taskCount'], PDO::PARAM_INT);
    $stmt->bindValue(':durationMin', $durationMin, PDO::PARAM_INT);
    $stmt->bindValue(':durationMax', $durationMax, PDO::PARAM_INT);
    logMessage("Parameters: startDate={$params[':startDate']}, endDate={$params[':endDate']}, durationMin={$params[':durationMin']}, durationMax={$params[':durationMax']}, taskCount={$params[':taskCount']}");
    $stmt->execute();
    $tasks = $stmt->fetchAll(PDO::FETCH_ASSOC);

    // Query to get total task count without filters
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
?>
