<?php
require_once __DIR__ . '/CommonFunctions.php';

try {
    $pdo = new PDO("sqlite:$databasePath");
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

    // SQL query to find top IGC records by task
    $stmt = $pdo->query("
        SELECT 
            IGC.IGCKey,
            IGC.EntrySeqID,
            IGC.IGCUploadDateTimeUTC,
            IGC.Pilot,
            IGC.GliderID,
            IGC.GliderType,
            IGC.CompetitionClass,
            IGC.Speed,
            T.Title
        FROM IGCRecords IGC
        JOIN (
            SELECT EntrySeqID, MAX(Speed) AS TopSpeed
            FROM IGCRecords
            WHERE IGCValid = 1 AND TaskCompleted = 1
            GROUP BY EntrySeqID
        ) Best ON IGC.EntrySeqID = Best.EntrySeqID AND IGC.Speed = Best.TopSpeed
        JOIN Tasks T ON IGC.EntrySeqID = T.EntrySeqID
        WHERE IGC.IGCValid = 1 AND IGC.TaskCompleted = 1
        GROUP BY IGC.EntrySeqID
        ORDER BY IGC.IGCUploadDateTimeUTC DESC
        LIMIT 25
    ");

    $results = $stmt->fetchAll(PDO::FETCH_ASSOC);

    // Round the speed to 1 decimal as clean float
    foreach ($results as &$row) {
        $row['Speed'] = number_format((float)$row['Speed'], 1, '.', '');
    }
    unset($row);

    // Save to JSON file
    $jsonPath = __DIR__ . '/../otherdata/latestTopIGCs.json';
    file_put_contents($jsonPath, json_encode($results, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));

    echo "✔ Top IGC data written to latestTopIGCs.json\n";
} catch (Exception $e) {
    echo "❌ Error: " . $e->getMessage();
}
