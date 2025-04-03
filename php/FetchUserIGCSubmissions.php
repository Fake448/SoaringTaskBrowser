<?php
session_start();
require __DIR__ . '/CommonFunctions.php';

// Ensure the user is logged in; if not, return an error response.
if (!isset($_SESSION['user']) || !isset($_SESSION['user']['id'])) {
    http_response_code(401);
    echo json_encode(["error" => "User not authenticated"]);
    exit;
}

// Use the user id stored in the session
$wsgUserID = $_SESSION['user']['id'];

try {
    // Open the database connection using the path from CommonFunctions.php.
    $pdo = new PDO("sqlite:$databasePath");
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

    // Retrieve IGC records for the logged in user, ordered by upload date descending.
    $query = "SELECT 
                IGCKey,
                EntrySeqID,
                IGCUploadDateTimeUTC,
                IGCRecordDateTimeUTC,
                Pilot,
                GliderType,
                GliderID,
                CompetitionID,
                CompetitionClass,
                NB21Version,
                Sim,
                WSGUserID,
                Comment
              FROM IGCRecords 
              WHERE WSGUserID = :wsgUserID
              ORDER BY IGCUploadDateTimeUTC DESC";
              
    $stmt = $pdo->prepare($query);
    $stmt->bindParam(':wsgUserID', $wsgUserID, PDO::PARAM_STR);
    $stmt->execute();
    $records = $stmt->fetchAll(PDO::FETCH_ASSOC);

    // Output the records as JSON.
    header('Content-Type: application/json');
    echo json_encode($records);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(["error" => $e->getMessage()]);
}
?>
