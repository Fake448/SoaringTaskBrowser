<?php
require_once __DIR__ . '/CommonFunctions.php';

try {
    $pdo = new PDO("sqlite:$databasePath");
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

    // SQL query to find top IGC records by task
    $stmt = $pdo->query("
        WITH ValidIGCs AS (
            SELECT 
                IGC.*,
                T.SimDateTime,
                datetime(
                    substr(T.SimDateTime, 1, 4) || '-' || 
                    substr(IGC.LocalDate, 6, 5) || ' ' || 
                    substr(IGC.LocalTime, 1, 2) || ':' || 
                    substr(IGC.LocalTime, 3, 2) || ':' || 
                    substr(IGC.LocalTime, 5, 2)
                ) AS ReconstructedLocalDT
            FROM IGCRecords IGC
            JOIN Tasks T ON IGC.EntrySeqID = T.EntrySeqID
            WHERE IGC.IGCValid = 1 AND IGC.TaskCompleted = 1
        ),
        FilteredValidIGCs AS (
            SELECT *
            FROM ValidIGCs
            WHERE abs(strftime('%s', SimDateTime) - strftime('%s', ReconstructedLocalDT)) <= 1800
        ),
        TopValidIGCs AS (
            SELECT *
            FROM FilteredValidIGCs
            WHERE (EntrySeqID, Speed) IN (
                SELECT EntrySeqID, MAX(Speed)
                FROM FilteredValidIGCs
                GROUP BY EntrySeqID
            )
        )
        SELECT 
            V.IGCKey,
            V.EntrySeqID,
            V.IGCUploadDateTimeUTC,
            V.Pilot,
            V.GliderID,
            V.GliderType,
            V.CompetitionClass,
            V.Speed,
            T.Title
        FROM TopValidIGCs V
        JOIN Tasks T ON V.EntrySeqID = T.EntrySeqID
        GROUP BY V.EntrySeqID
        ORDER BY V.IGCUploadDateTimeUTC DESC
        LIMIT 10;
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
