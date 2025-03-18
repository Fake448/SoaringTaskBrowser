<?php
require __DIR__ . '/CommonFunctions.php';

header('Content-Type: application/json');

try {
    error_log("SearchTaskByIGC.php: Script started.");
    
    // Read JSON input from POST
    $input = file_get_contents('php://input');
    error_log("Input JSON: " . $input);
    
    if (!$input) {
        throw new Exception("No input received.");
    }
    $data = json_decode($input, true);
    if (!$data || !isset($data['igcTitle']) || !isset($data['igcWaypoints'])) {
        throw new Exception("Invalid input data. Required keys: igcTitle and igcWaypoints.");
    }
    
    $igcTitle = trim($data['igcTitle']);
    $igcWaypoints = $data['igcWaypoints']; // associative array: waypointID => coordinate string
    
    error_log("IGC Title: " . $igcTitle);
    error_log("IGC Waypoints: " . print_r($igcWaypoints, true));

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
    
    error_log("Title Query: " . $titleQuery);
    error_log("Title Query Clause: " . $titleClause);
    error_log("Title Results Count: " . count($titleResults));
    
    if (!empty($titleResults)) {
        // Loop through each candidate and validate its waypoints.
        foreach ($titleResults as $candidate) {
            error_log("Validating candidate with EntrySeqID: " . $candidate['EntrySeqID']);
            if (validateCandidate($candidate, $igcWaypoints)) {
                $foundTask = $candidate;
                error_log("Candidate validated successfully.");
                break;
            } else {
                error_log("Candidate with EntrySeqID " . $candidate['EntrySeqID'] . " failed waypoint validation.");
            }
        }
    }

    // STEP 2: If no title match found, search by waypoint IDs.
    if (!$foundTask) {
        $likeClauses = [];
        $params = [];
        foreach (array_keys($igcWaypoints) as $wpID) {
            $likeClauses[] = "PLNXML LIKE ?";
            $params[] = '%<ATCWaypoint id="' . $wpID . '">%';
        }
        $whereClause = implode(" AND ", $likeClauses);
        $wpQuery = "SELECT * FROM Tasks WHERE " . $whereClause;
        error_log("Waypoint Query: " . $wpQuery);
        error_log("Waypoint Query Params: " . print_r($params, true));
        $stmt = $pdo->prepare($wpQuery);
        $stmt->execute($params);
        $wpResults = $stmt->fetchAll(PDO::FETCH_ASSOC);
        error_log("Waypoint Results Count: " . count($wpResults));
        
        foreach ($wpResults as $candidate) {
            error_log("Validating candidate (waypoint search) with EntrySeqID: " . $candidate['EntrySeqID']);
            if (validateCandidate($candidate, $igcWaypoints)) {
                $foundTask = $candidate;
                error_log("Candidate validated successfully in waypoint search.");
                break;
            } else {
                error_log("Candidate with EntrySeqID " . $candidate['EntrySeqID'] . " failed waypoint validation (waypoint search).");
            }
        }
    }

    if ($foundTask) {
        error_log("Found matching task: EntrySeqID = " . $foundTask['EntrySeqID'] . ", Title = " . $foundTask['Title']);
        echo json_encode([
            'status' => 'found',
            'EntrySeqID' => $foundTask['EntrySeqID'],
            'Title' => $foundTask['Title']
        ]);
    } else {
        error_log("No matching task found.");
        echo json_encode([
            'status' => 'not_found',
            'message' => 'No matching task was found.'
        ]);
    }

} catch (Exception $e) {
    error_log("Error: " . $e->getMessage());
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
 * @param array $candidate
 * @param array $igcWaypoints  Associative array (waypointID => coordinate string)
 * @return bool True if the candidate’s waypoints match the igcWaypoints.
 */
function validateCandidate($candidate, $igcWaypoints) {
    if (!isset($candidate['PLNXML'])) {
        error_log("Candidate missing PLNXML.");
        return false;
    }
    $xmlString = $candidate['PLNXML'];
    libxml_use_internal_errors(true);
    $xml = simplexml_load_string($xmlString);
    if (!$xml) {
        error_log("Failed to parse PLNXML for candidate.");
        return false;
    }
    $xmlWaypoints = [];
    // Extract waypoints from the XML.
    foreach ($xml->xpath('/SimBase.Document/FlightPlan.FlightPlan/ATCWaypoint') as $wp) {
        $id = (string)$wp['id'];
        $position = trim((string)$wp->WorldPosition);
        $xmlWaypoints[$id] = $position;
    }
    error_log("Extracted XML Waypoints: " . print_r($xmlWaypoints, true));
    
    // Compare each required waypoint.
    foreach ($igcWaypoints as $wpID => $igcCoord) {
        error_log("Comparing waypoint ID: " . $wpID);
        error_log("IGC coordinate: " . $igcCoord);
        if (!isset($xmlWaypoints[$wpID])) {
            error_log("Waypoint " . $wpID . " not found in XML.");
            return false;
        }
        error_log("XML coordinate: " . $xmlWaypoints[$wpID]);
        // Basic string comparison; adjust tolerance logic as needed.
        if ($xmlWaypoints[$wpID] !== $igcCoord) {
            error_log("Coordinate mismatch for waypoint " . $wpID . ": IGC (" . $igcCoord . ") vs XML (" . $xmlWaypoints[$wpID] . ")");
            return false;
        }
    }
    return true;
}
?>
