<?php
require __DIR__ . '/CommonFunctions.php';

header('Content-Type: application/json');

try {
    // logMessage("SearchTaskByIGC.php: Script started.");

    // Read JSON input from POST
    $input = file_get_contents('php://input');
    // logMessage("Input JSON: " . $input);
    
    if (!$input) {
        throw new Exception("No input received.");
    }
    $data = json_decode($input, true);
    if (!$data || !isset($data['igcTitle']) || !isset($data['igcWaypoints']) || !isset($data['pilot']) || !isset($data['gliderType']) || !isset($data['IGCRecordDateTimeUTC'])) {
        throw new Exception("Invalid input data. Required keys: igcTitle, igcWaypoints, pilot, gliderType, IGCRecordDateTimeUTC.");
    }
    
    $igcTitle = trim($data['igcTitle']);
    $igcWaypoints = $data['igcWaypoints']; // associative array: waypointID => coordinate string
    // logMessage("IGC Title: " . $igcTitle);
    // logMessage("IGC Waypoints: " . print_r($igcWaypoints, true));

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
    
    // logMessage("Title Query: " . $titleQuery);
    // logMessage("Title Query Clause: " . $titleClause);
    // logMessage("Title Results Count: " . count($titleResults));
    
    if (!empty($titleResults)) {
        foreach ($titleResults as $candidate) {
            // logMessage("Validating candidate with EntrySeqID: " . $candidate['EntrySeqID']);
            if (validateCandidate($candidate, $igcWaypoints)) {
                $foundTask = $candidate;
                // logMessage("Candidate validated successfully.");
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
            $params[] = '%<ATCWaypoint id="' . $wpID . '">%';
        }
        $whereClause = implode(" AND ", $likeClauses);
        $wpQuery = "SELECT * FROM Tasks WHERE " . $whereClause;
        // logMessage("Waypoint Query: " . $wpQuery);
        // logMessage("Waypoint Query Params: " . print_r($params, true));
        $stmt = $pdo->prepare($wpQuery);
        $stmt->execute($params);
        $wpResults = $stmt->fetchAll(PDO::FETCH_ASSOC);
        // logMessage("Waypoint Results Count: " . count($wpResults));
        
        foreach ($wpResults as $candidate) {
            // logMessage("Validating candidate (waypoint search) with EntrySeqID: " . $candidate['EntrySeqID']);
            if (validateCandidate($candidate, $igcWaypoints)) {
                $foundTask = $candidate;
                // logMessage("Candidate validated successfully in waypoint search.");
                break;
            }
        }
    }

    if ($foundTask) {
        // Build the IGCKey: EntrySeqID_Pilot_GliderType_IGCRecordDateTimeUTC
        $entrySeqID = $foundTask['EntrySeqID'];
        $pilot = trim($data['pilot']);
        $gliderType = trim($data['gliderType']);
        $recordDateTimeUTC = trim($data['IGCRecordDateTimeUTC']); // already combined in JS
        
        $IGCKey = $entrySeqID . "_" . $pilot . "_" . $gliderType . "_" . $recordDateTimeUTC;
        // logMessage("Constructed IGCKey: " . $IGCKey);
        
        // Check the IGCRecords table for a previous entry with the same key
        $checkQuery = "SELECT * FROM IGCRecords WHERE IGCKey = :igcKey";
        $stmt = $pdo->prepare($checkQuery);
        $stmt->bindParam(':igcKey', $IGCKey, PDO::PARAM_STR);
        $stmt->execute();
        $existingRecord = $stmt->fetch(PDO::FETCH_ASSOC);
        
        if ($existingRecord) {
            // If an entry already exists, return a duplicate message.
            // logMessage("Duplicate IGC record found for key: " . $IGCKey);
            echo json_encode([
                'status' => 'duplicate',
                'message' => 'An IGC record with this key already exists.'
            ]);
        } else {
            // No duplicate found; return the found task.
            // logMessage("Found matching task: EntrySeqID = " . $foundTask['EntrySeqID'] . ", Title = " . $foundTask['Title']);
            echo json_encode([
                'status' => 'found',
                'EntrySeqID' => $foundTask['EntrySeqID'],
                'Title' => $foundTask['Title']
            ]);
        }
    } else {
        // logMessage("No matching task found.");
        echo json_encode([
            'status' => 'not_found',
            'message' => 'No matching task was found.'
        ]);
    }

} catch (Exception $e) {
    // logMessage("Error: " . $e->getMessage());
    echo json_encode(['error' => $e->getMessage()]);
    exit;
}

/**
 * Convert a coordinate string (e.g., "N70° 56' 38.94\"" or "N70°56'38.94\"") to a decimal degree.
 * This version normalizes the string using str_replace and preg_replace, then uses sscanf.
 *
 * @param string $coord
 * @return float|null
 */
function coordinateToDecimal($coord) {
    $coord = trim($coord);
    $coord = str_replace(array("\xC2\xB0", "°"), "°", $coord);
    $coord = preg_replace('/\s+/', ' ', $coord);
    // logMessage("coordinateToDecimal normalized: " . $coord);
    $result = sscanf($coord, "%c%d° %d' %f", $hem, $deg, $min, $sec);
    if ($result === 4) {
        $decimal = $deg + ($min / 60) + ($sec / 3600);
        if ($hem === 'S' || $hem === 'W') {
            $decimal = -$decimal;
        }
        return $decimal;
    }
    return null;
}

/**
 * Normalize an XML coordinate string by removing the elevation portion.
 * For example, from "N70° 56' 38.92\",W8° 39' 8.43\",+000021.00" return an array:
 *   [ "N70° 56' 38.92\"", "W8° 39' 8.43\"" ]
 *
 * @param string $xmlCoord
 * @return array|null
 */
function normalizeXmlCoordinate($xmlCoord) {
    $parts = explode(',', $xmlCoord);
    if (count($parts) >= 2) {
        return [ trim($parts[0]), trim($parts[1]) ];
    }
    return null;
}

/**
 * Compare two coordinate strings allowing for a small tolerance.
 *
 * @param string $coord1
 * @param string $coord2
 * @param float $tolerance (default: 0.001)
 * @return bool
 */
function compareCoordinates($coord1, $coord2, $tolerance = 0.001) {
    $dec1 = coordinateToDecimal($coord1);
    $dec2 = coordinateToDecimal($coord2);
    if ($dec1 === null || $dec2 === null) {
        return false;
    }
    $difference = abs($dec1 - $dec2);
    return $difference <= $tolerance;
}

/**
 * Updated validateCandidate function using normalization and tolerance.
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
    foreach ($xml->xpath('/SimBase.Document/FlightPlan.FlightPlan/ATCWaypoint') as $wp) {
        $id = (string)$wp['id'];
        $worldPosRaw = trim((string)$wp->WorldPosition);
        $normalized = normalizeXmlCoordinate($worldPosRaw);
        if ($normalized) {
            $position = $normalized[0] . "," . $normalized[1];
        } else {
            $position = $worldPosRaw;
        }
        $xmlWaypoints[$id] = $position;
    }
    
    foreach ($igcWaypoints as $wpID => $igcCoord) {
        if (!isset($xmlWaypoints[$wpID])) {
            return false;
        }
        $xmlParts = explode(',', $xmlWaypoints[$wpID]);
        if (count($xmlParts) < 2) {
            return false;
        }
        $xmlLat = trim($xmlParts[0]);
        $xmlLon = trim($xmlParts[1]);
        $igcCoord = str_replace(" ", "", $igcCoord);
        $igcParts = explode(',', $igcCoord);
        if (count($igcParts) < 2) {
            return false;
        }
        $igcLat = trim($igcParts[0]);
        $igcLon = trim($igcParts[1]);
        $latMatch = compareCoordinates($igcLat, $xmlLat);
        $lonMatch = compareCoordinates($igcLon, $xmlLon);
        if (!$latMatch || !$lonMatch) {
            return false;
        }
    }
    return true;
}
?>
