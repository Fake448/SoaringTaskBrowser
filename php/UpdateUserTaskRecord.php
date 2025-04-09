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

/**
 * Helper function to read a POST field. 
 * Returns NULL if the field is not set, is an empty string, or literally 'null' (case-insensitive).
 */
function getPostValueOrNull($key) {
    if (!isset($_POST[$key])) {
        return null;
    }
    $val = trim($_POST[$key]);
    // If it's an empty string or literally "null" (case-insensitive), return NULL.
    if ($val === "" || strtolower($val) === "null") {
        return null;
    }
    return $val;
}

// We will maintain a list of all possible fields in the UsersTasks table that you want to update or insert.
// This ensures that if the record does not exist, we can insert NULL for fields not posted.
$allFields = [
    'PrivateNotes',
    'Tags',
    'PublicFeedback',
    'DifficultyRating',
    'QualityRating',
    'MarkedFlownDateUTC',
    'MarkedFlyNextUTC',
    'MarkedFavoritesUTC'
];

// This array will hold only the fields we actually want to update (for an existing record).
$updates = [];

// For insertion, we will always supply all columns, defaulting to NULL if not posted.
$insertColumns = ['WSGUserID', 'EntrySeqID'];
$insertPlaceholders = [':wsgUserID', ':entrySeqID'];

// We always bind these params for both UPDATE and INSERT.
$params = [
    ':wsgUserID'  => $wsgUserID,
    ':entrySeqID' => $entrySeqID
];

try {
    // Open the database connection.
    $pdo = new PDO("sqlite:$databasePath");
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

    // First, check if a record exists for this user and task.
    $sqlCheck = "
        SELECT COUNT(*) 
        FROM UsersTasks 
        WHERE WSGUserID = :wsgUserID AND EntrySeqID = :entrySeqID
    ";
    $stmtCheck = $pdo->prepare($sqlCheck);
    $stmtCheck->execute([
        ':wsgUserID'  => $wsgUserID,
        ':entrySeqID' => $entrySeqID
    ]);
    $recordExists = ($stmtCheck->fetchColumn() > 0);

    // Loop over the known fields and see what the user posted. 
    // If posted (or we always want to handle them on INSERT), store them in $params.
    foreach ($allFields as $field) {
        $postValue = getPostValueOrNull($field);

        // For an existing record, only update fields explicitly provided in $_POST.
        // For a new record, we do an INSERT including all columns, using NULL for unprovided fields.
        if (!$recordExists) {
            // The record does not exist: we insert a row with all fields (some might be NULL).
            $insertColumns[] = $field;        // e.g. MarkedFlownDateUTC
            $insertPlaceholders[] = ":$field";  
            $params[":$field"] = $postValue;  // possibly NULL
        } else {
            // The record exists: only update if the field was actually posted.
            if (array_key_exists($field, $_POST)) {
                $updates[] = "$field = :$field";
                $params[":$field"] = $postValue;
            }
        }
    }

    if ($recordExists) {
        // If we have no fields to update, return a message
        if (empty($updates)) {
            echo json_encode(["success" => true, "message" => "No fields were updated"]);
            exit;
        }

        // Build the UPDATE statement dynamically
        $sqlUpdate = "
            UPDATE UsersTasks 
            SET " . implode(", ", $updates) . " 
            WHERE WSGUserID = :wsgUserID AND EntrySeqID = :entrySeqID
        ";
        $stmtUpdate = $pdo->prepare($sqlUpdate);

        // Bind all parameters, converting any null to PDO::PARAM_NULL
        foreach ($params as $key => $value) {
            $stmtUpdate->bindValue($key, $value, is_null($value) ? PDO::PARAM_NULL : PDO::PARAM_STR);
        }

        $stmtUpdate->execute();
        echo json_encode(["success" => true, "message" => "Record updated"]);
    } else {
        // Build the INSERT statement (always insert all fields, some may be NULL).
        $sqlInsert = "
            INSERT INTO UsersTasks (" . implode(", ", $insertColumns) . ") 
            VALUES (" . implode(", ", $insertPlaceholders) . ")
        ";
        $stmtInsert = $pdo->prepare($sqlInsert);

        // Bind all parameters
        foreach ($params as $key => $value) {
            $stmtInsert->bindValue($key, $value, is_null($value) ? PDO::PARAM_NULL : PDO::PARAM_STR);
        }

        $stmtInsert->execute();
        echo json_encode(["success" => true, "message" => "Record created"]);
    }
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(["error" => $e->getMessage()]);
}
?>
