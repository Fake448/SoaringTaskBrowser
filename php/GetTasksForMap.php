<?php
require __DIR__ . '/CommonFunctions.php';

try {
    // Open the database connection
    $pdo = new PDO("sqlite:$databasePath");
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

    // Define the query to retrieve all records with bounding box information
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

    // Prepare and execute the query
    $stmt = $pdo->prepare($query);
    $stmt->execute();
    $worldMapInfo = $stmt->fetchAll(PDO::FETCH_ASSOC);

    // Output the results as JSON
    header('Content-Type: application/json');
    echo json_encode($worldMapInfo);

} catch (PDOException $e) {
    logMessage("Connection failed: " . $e->getMessage());
    header('Content-Type: application/json');
    echo json_encode(['error' => 'Connection failed']);
}
?>
