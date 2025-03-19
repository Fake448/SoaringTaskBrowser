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
    if (!$data || !isset($data['igcTitle']) || !isset($data['igcWaypoints'])) {
        throw new Exception("Invalid input data. Required keys: igcTitle and igcWaypoints.");
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
        // Loop through each candidate and validate its waypoints.
        foreach ($titleResults as $candidate) {
            // logMessage("Validating candidate with EntrySeqID: " . $candidate['EntrySeqID']);
            if (validateCandidate($candidate, $igcWaypoints)) {
                $foundTask = $candidate;
                // logMessage("Candidate validated successfully.");
                break;
            } else {
                // logMessage("Candidate with EntrySeqID " . $candidate['EntrySeqID'] . " failed waypoint validation.");
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
            } else {
                // logMessage("Candidate with EntrySeqID " . $candidate['EntrySeqID'] . " failed waypoint validation (waypoint search).");
            }
        }
    }

    if ($foundTask) {
        // logMessage("Found matching task: EntrySeqID = " . $foundTask['EntrySeqID'] . ", Title = " . $foundTask['Title']);
        echo json_encode([
            'status' => 'found',
            'EntrySeqID' => $foundTask['EntrySeqID'],
            'Title' => $foundTask['Title']
        ]);
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
 *
 * This version normalizes the string using str_replace and preg_replace, then uses sscanf.
 *
 * @param string $coord
 * @return float|null
 */
function coordinateToDecimal($coord) {
    $coord = trim($coord);
    // Replace any variant of the degree symbol with a standard one.
    $coord = str_replace(array("\xC2\xB0", "°"), "°", $coord);
    // Replace multiple spaces with a single space.
    $coord = preg_replace('/\s+/', ' ', $coord);
    // logMessage("coordinateToDecimal normalized: " . $coord . " (hex: " . bin2hex($coord) . ")");
    // Use sscanf to extract the components.
    $result = sscanf($coord, "%c%d° %d' %f", $hem, $deg, $min, $sec);
    if ($result === 4) {
        $decimal = $deg + ($min / 60) + ($sec / 3600);
        if ($hem === 'S' || $hem === 'W') {
            $decimal = -$decimal;
        }
        // logMessage("coordinateToDecimal (sscanf): Conversion result: " . $decimal);
        return $decimal;
    } else {
        // logMessage("coordinateToDecimal: sscanf failed for input: " . $coord);
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
 * Compare two coordinate strings (e.g., "N70°56'38.94\"" vs "N70°56'38.92\"")
 * allowing for a small tolerance.
 *
 * @param string $coord1
 * @param string $coord2
 * @param float $tolerance in decimal degrees (default: 0.001)
 * @return bool
 */
function compareCoordinates($coord1, $coord2, $tolerance = 0.001) {
    $dec1 = coordinateToDecimal($coord1);
    $dec2 = coordinateToDecimal($coord2);
    // logMessage("Decimal conversion: coord1 ($coord1) = " . var_export($dec1, true) . "; coord2 ($coord2) = " . var_export($dec2, true));
    if ($dec1 === null || $dec2 === null) {
        return false;
    }
    $difference = abs($dec1 - $dec2);
    // logMessage("Difference: " . $difference . " (tolerance: " . $tolerance . ")");
    return $difference <= $tolerance;
}

/**
 * Updated validateCandidate function using normalization and tolerance.
 */
function validateCandidate($candidate, $igcWaypoints) {
    if (!isset($candidate['PLNXML'])) {
        // logMessage("Candidate missing PLNXML.");
        return false;
    }
    $xmlString = $candidate['PLNXML'];
    libxml_use_internal_errors(true);
    $xml = simplexml_load_string($xmlString);
    if (!$xml) {
        // logMessage("Failed to parse PLNXML for candidate.");
        return false;
    }
    $xmlWaypoints = [];
    // Extract waypoints from the XML.
    foreach ($xml->xpath('/SimBase.Document/FlightPlan.FlightPlan/ATCWaypoint') as $wp) {
        $id = (string)$wp['id'];
        $worldPosRaw = trim((string)$wp->WorldPosition);
        $normalized = normalizeXmlCoordinate($worldPosRaw);
        if ($normalized) {
            // Reassemble into a string with a comma between latitude and longitude.
            $position = $normalized[0] . "," . $normalized[1];
        } else {
            $position = $worldPosRaw;
        }
        $xmlWaypoints[$id] = $position;
    }
    // logMessage("Extracted XML Waypoints: " . print_r($xmlWaypoints, true));
    
    // Compare each required waypoint.
    foreach ($igcWaypoints as $wpID => $igcCoord) {
        // logMessage("Comparing waypoint ID: " . $wpID);
        // logMessage("IGC coordinate: " . $igcCoord);
        if (!isset($xmlWaypoints[$wpID])) {
            // logMessage("Waypoint " . $wpID . " not found in XML.");
            return false;
        }
        // logMessage("XML coordinate (normalized): " . $xmlWaypoints[$wpID]);
        // Split XML coordinate into latitude and longitude parts.
        $xmlParts = explode(',', $xmlWaypoints[$wpID]);
        if (count($xmlParts) < 2) {
            // logMessage("XML coordinate for " . $wpID . " is in unexpected format: " . $xmlWaypoints[$wpID]);
            return false;
        }
        $xmlLat = trim($xmlParts[0]);
        $xmlLon = trim($xmlParts[1]);
        
        // Process IGC coordinate: remove extra spaces and split by comma.
        $igcCoord = str_replace(" ", "", $igcCoord);
        $igcParts = explode(',', $igcCoord);
        if (count($igcParts) < 2) {
            // logMessage("IGC coordinate for waypoint " . $wpID . " is in unexpected format: " . $igcCoord);
            return false;
        }
        $igcLat = trim($igcParts[0]);
        $igcLon = trim($igcParts[1]);
        
        // Compare latitude and longitude separately.
        $latMatch = compareCoordinates($igcLat, $xmlLat);
        $lonMatch = compareCoordinates($igcLon, $xmlLon);
        // logMessage("Latitude comparison for " . $wpID . ": IGC (" . $igcLat . ") vs XML (" . $xmlLat . ") => " . ($latMatch ? "match" : "mismatch"));
        // logMessage("Longitude comparison for " . $wpID . ": IGC (" . $igcLon . ") vs XML (" . $xmlLon . ") => " . ($lonMatch ? "match" : "mismatch"));
        if (!$latMatch || !$lonMatch) {
            // logMessage("Coordinate mismatch for waypoint " . $wpID . ".");
            return false;
        }
    }
    return true;
}
?>
