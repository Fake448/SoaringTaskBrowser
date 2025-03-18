<?php
require __DIR__ . '/CommonFunctions.php';

header('Content-Type: application/json');

try {
    // Read JSON input from POST
    $input = file_get_contents('php://input');
    if (!$input) {
        throw new Exception("No input received.");
    }
    $data = json_decode($input, true);
    if (!$data || !isset($data['igcTitle']) || !isset($data['igcWaypoints'])) {
        throw new Exception("Invalid input data. Required keys: igcTitle and igcWaypoints.");
    }
    
    $igcTitle = trim($data['igcTitle']);
    $igcWaypoints = $data['igcWaypoints']; // associative array: waypointID => coordinate string

    // Open the database connection
    $pdo = new PDO("sqlite:$databasePath");
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

    $foundTask = null;

    // STEP 1: Search by Title
    $titleQuery = "SELECT * FROM Tasks WHERE PLNXML LIKE :titleClause";
    $stmt = $pdo->prepare($titleQuery);
    $titleClause = '%<Title>' . $igcTitle . '</Title>%';
    $stmt->bindParam(':titleClause', $titleClause, PDO::PARAM_STR);
    $stmt->execute();
    $titleResults = $stmt->fetchAll(PDO::FETCH_ASSOC);

    if (!empty($titleResults)) {
        // If one record found, validate its waypoints.
        foreach ($titleResults as $candidate) {
            if (validateCandidate($candidate, $igcWaypoints)) {
                $foundTask = $candidate;
                break;
            }
        }
    }

    // STEP 2: If no title match found, search by waypoint IDs.
    if (!$foundTask) {
        $likeClauses = [];
        $params = [];
        foreach (array_keys($igcWaypoints) as $wpID) {
            $likeClauses[] = "PLNXML LIKE ?";
            // Note: we assume the XML contains <ATCWaypoint id="[ID]">
            $params[] = '%<ATCWaypoint id="' . $wpID . '">%';
        }
        $whereClause = implode(" AND ", $likeClauses);
        $wpQuery = "SELECT * FROM Tasks WHERE " . $whereClause;
        $stmt = $pdo->prepare($wpQuery);
        $stmt->execute($params);
        $wpResults = $stmt->fetchAll(PDO::FETCH_ASSOC);
        foreach ($wpResults as $candidate) {
            if (validateCandidate($candidate, $igcWaypoints)) {
                $foundTask = $candidate;
                break;
            }
        }
    }

    if ($foundTask) {
        // Return EntrySeqID and Title of the task
        echo json_encode([
            'status' => 'found',
            'EntrySeqID' => $foundTask['EntrySeqID'],
            'Title' => $foundTask['Title']
        ]);
    } else {
        echo json_encode([
            'status' => 'not_found',
            'message' => 'No matching task was found.'
        ]);
    }

} catch (Exception $e) {
    echo json_encode(['error' => $e->getMessage()]);
    exit;
}

/**
 * Validate a candidate task record by comparing its waypoints from the PLNXML field
 * to the required igcWaypoints.
 *
 * For each waypoint in the igcWaypoints object, this function will:
 *   - Load the PLNXML using SimpleXML,
 *   - Check that an <ATCWaypoint> with an id attribute equal to the waypoint key exists,
 *   - And compare the WorldPosition value with the coordinate string from the IGC.
 *
 * (Coordinate comparison here is a simple string equality check.
 *  In production you might want to allow for small rounding differences.)
 *
 * @param array $candidate
 * @param array $igcWaypoints  Associative array (waypointID => coordinate string)
 * @return bool True if the candidate’s waypoints match the igcWaypoints.
 */
function validateCandidate($candidate, $igcWaypoints) {
    if (!isset($candidate['PLNXML'])) {
        return false;
    }
    $xmlString = $candidate['PLNXML'];
    libxml_use_internal_errors(true);
    $xml = simplexml_load_string($xmlString);
    if (!$xml) {
        return false;
    }
    $xmlWaypoints = [];
    // Extract waypoints from the XML.
    foreach ($xml->xpath('/SimBase.Document/FlightPlan.FlightPlan/ATCWaypoint') as $wp) {
        $id = (string)$wp['id'];
        // Normalize the world position string by trimming whitespace.
        $position = trim((string)$wp->WorldPosition);
        $xmlWaypoints[$id] = $position;
    }
    // For each required waypoint, check if it exists and if its position matches.
    foreach ($igcWaypoints as $wpID => $igcCoord) {
        if (!isset($xmlWaypoints[$wpID])) {
            return false;
        }
        // Basic string comparison; replace with tolerance-based comparison if needed.
        if ($xmlWaypoints[$wpID] !== $igcCoord) {
            return false;
        }
    }
    return true;
}
?>
