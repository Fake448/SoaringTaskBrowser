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

// Helper function to check if a POST field is empty and return null if so.
function getPostValueOrNull($key) {
    return (isset($_POST[$key]) && trim($_POST[$key]) !== "") ? $_POST[$key] : null;
}

// Build an array of fields to update based on provided POST values.
$updates = [];
$params = [
    ':wsgUserID' => $wsgUserID,
    ':entrySeqID' => $entrySeqID
];

// Markings - these are date/time strings or empty (to be set as NULL).
if (isset($_POST['MarkedFlown'])) {
    $value = getPostValueOrNull('MarkedFlown');
    $updates[] = "MarkedFlownDateUTC = :markedFlown";
    $params[':markedFlown'] = $value;
}
if (isset($_POST['MarkedFlyNext'])) {
    $value = getPostValueOrNull('MarkedFlyNext');
    $updates[] = "MarkedFlyNextUTC = :markedFlyNext";
    $params[':markedFlyNext'] = $value;
}
if (isset($_POST['MarkedFavorites'])) {
    $value = getPostValueOrNull('MarkedFavorites');
    $updates[] = "MarkedFavoritesUTC = :markedFavorites";
    $params[':markedFavorites'] = $value;
}

// Ratings.
if (isset($_POST['DifficultyRating'])) {
    $value = getPostValueOrNull('DifficultyRating');
    $updates[] = "DifficultyRating = :difficultyRating";
    $params[':difficultyRating'] = $value;
}
if (isset($_POST['QualityRating'])) {
    $value = getPostValueOrNull('QualityRating');
    $updates[] = "QualityRating = :qualityRating";
    $params[':qualityRating'] = $value;
}

// Text fields.
if (isset($_POST['PublicFeedback'])) {
    $value = getPostValueOrNull('PublicFeedback');
    $updates[] = "PublicFeedback = :publicFeedback";
    $params[':publicFeedback'] = $value;
}
if (isset($_POST['PrivateNotes'])) {
    $value = getPostValueOrNull('PrivateNotes');
    $updates[] = "PrivateNotes = :privateNotes";
    $params[':privateNotes'] = $value;
}
if (isset($_POST['Tags'])) {
    $value = getPostValueOrNull('Tags');
    $updates[] = "Tags = :tags";
    $params[':tags'] = $value;
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
    
    // Bind parameters. PDO will convert PHP nulls to SQL NULL.
    foreach ($params as $key => $value) {
        $stmt->bindValue($key, $value, is_null($value) ? PDO::PARAM_NULL : PDO::PARAM_STR);
    }
    
    $stmt->execute();

    echo json_encode(["success" => true]);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(["error" => $e->getMessage()]);
}
?>
