<?php
require_once __DIR__ . '/CommonFunctions.php';

try {
    $pdo = new PDO("sqlite:$databasePath");
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

    // === Top Performances ===
    $sql = "
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
        JOIN Tasks T ON IGC.EntrySeqID = T.EntrySeqID
        WHERE
            IGC.IGCValid = 1
            AND IGC.TaskCompleted = 1
            AND abs(strftime('%s', T.SimDateTime) - strftime(
                '%s',
                substr(T.SimDateTime, 1, 4) || '-' || 
                substr(IGC.LocalDate, 6, 5) || ' ' || 
                substr(IGC.LocalTime, 1, 2) || ':' || 
                substr(IGC.LocalTime, 3, 2) || ':' || 
                substr(IGC.LocalTime, 5, 2)
            )) <= 1800
            AND IGC.Speed = (
                SELECT MAX(Speed)
                FROM IGCRecords I2
                WHERE 
                    I2.EntrySeqID = IGC.EntrySeqID
                    AND I2.IGCValid = 1
                    AND I2.TaskCompleted = 1
                    AND abs(strftime('%s', T.SimDateTime) - strftime(
                        '%s',
                        substr(T.SimDateTime, 1, 4) || '-' || 
                        substr(I2.LocalDate, 6, 5) || ' ' || 
                        substr(I2.LocalTime, 1, 2) || ':' || 
                        substr(I2.LocalTime, 3, 2) || ':' || 
                        substr(I2.LocalTime, 5, 2)
                    )) <= 1800
            )
        GROUP BY IGC.EntrySeqID
        ORDER BY IGC.IGCUploadDateTimeUTC DESC
        LIMIT 10
    ";

    $stmt = $pdo->prepare($sql);
    $stmt->execute();
    $results = $stmt->fetchAll(PDO::FETCH_ASSOC);

    // Format speed
    foreach ($results as &$row) {
        $row['Speed'] = number_format((float)$row['Speed'], 1, '.', '');
    }
    unset($row);

    // Save to file
    $jsonPath = __DIR__ . '/../otherdata/latestTopIGCs.json';
    file_put_contents($jsonPath, json_encode($results, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));

    echo "✔ Top IGC data written to latestTopIGCs.json\n";
} catch (Exception $e) {
    echo "❌ Error: " . $e->getMessage();
}

// === Top Contributors (Last 30 Days) ===
try {
    $stmt = $pdo->query("
        SELECT 
            Pilot,
            COUNT(*) AS UploadCount
        FROM IGCRecords
        WHERE 
            IGCUploadDateTimeUTC >= datetime('now', '-7 days')
            AND Pilot IS NOT NULL
            AND TRIM(Pilot) <> ''
        GROUP BY Pilot
        ORDER BY UploadCount DESC, Pilot ASC
        LIMIT 5;
    ");

    $contribResults = $stmt->fetchAll(PDO::FETCH_ASSOC);

    $jsonPathContrib = __DIR__ . '/../otherdata/topIGCContributors.json';
    file_put_contents($jsonPathContrib, json_encode($contribResults, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));

    echo "✔ Top contributors written to topIGCContributors.json\n";
} catch (Exception $e) {
    echo "❌ Error generating top contributors: " . $e->getMessage();
}
