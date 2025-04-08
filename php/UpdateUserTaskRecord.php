<?php
require_once __DIR__ . '/session_restore.php';
require_once __DIR__ . '/CommonFunctions.php';

header('Content-Type: application/json');

// Ensure the user is logged in.
if (!isset($_SESSION['user']) || !isset($_SESSION['user']['id'])) {
    http_response_code(401);
    echo json_encode(["error" => "User not authenticated"]);
    exit;
}

$wsgUserID = $_SESSION['user']['id'];

// Ensure the required parameter (entrySeqID) is provided via POST.
if (!isset($_POST['entrySeqID'])) {
    http_response_code(400);
    echo json_encode(["error" => "Missing required parameter: entrySeqID"]);
    exit;
}

$entrySeqID = (int) $_POST['entrySeqID'];

// Build an array of fields to update based on provided POST values.
$updates = [];
$params = [':wsgUserID' => $wsgUserID, ':entrySeqID' => $entrySeqID];

// Markings - these are date/time strings or an empty string.
if (isset($_POST['MarkedFlown'])) {
    $updates[] = "MarkedFlownDateUTC = :markedFlown";
    $params[':markedFlown'] = $_POST['MarkedFlown'];
}
if (isset($_POST['MarkedFlyNext'])) {
    $updates[] = "MarkedFlyNextUTC = :markedFlyNext";
    $params[':markedFlyNext'] = $_POST['MarkedFlyNext'];
}
if (isset($_POST['MarkedFavorites'])) {
    $updates[] = "MarkedFavoritesUTC = :markedFavorites";
    $params[':markedFavorites'] = $_POST['MarkedFavorites'];
}

// Ratings.
if (isset($_POST['DifficultyRating'])) {
    $updates[] = "DifficultyRating = :difficultyRating";
    $params[':difficultyRating'] = $_POST['DifficultyRating'];
}
if (isset($_POST['QualityRating'])) {
    $updates[] = "QualityRating = :qualityRating";
    $params[':qualityRating'] = $_POST['QualityRating'];
}

// Text fields.
if (isset($_POST['PublicFeedback'])) {
    $updates[] = "PublicFeedback = :publicFeedback";
    $params[':publicFeedback'] = $_POST['PublicFeedback'];
}
if (isset($_POST['PrivateNotes'])) {
    $updates[] = "PrivateNotes = :privateNotes";
    $params[':privateNotes'] = $_POST['PrivateNotes'];
}
if (isset($_POST['Tags'])) {
    $updates[] = "Tags = :tags";
    $params[':tags'] = $_POST['Tags'];
}

if (empty($updates)) {
    echo json_encode(["error" => "No fields provided to update"]);
    exit;
}

try {
    // Open the database connection.
    $pdo = new PDO("sqlite:$databasePath");
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

    // Build the UPDATE SQL statement dynamically.
    $sql = "UPDATE UsersTasks SET " . implode(", ", $updates) . " WHERE WSGUserID = :wsgUserID AND EntrySeqID = :entrySeqID";
    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);

    echo json_encode(["success" => true]);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(["error" => $e->getMessage()]);
}
?>
