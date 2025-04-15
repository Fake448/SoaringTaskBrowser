<?php
require __DIR__ . '/CommonFunctions.php';
require_once __DIR__ . '/session_restore.php';

header('Content-Type: application/json');

// Ensure the user is logged in; if not, return an error response.
if (!isset($_SESSION['user']) || !isset($_SESSION['user']['id'])) {
    http_response_code(401);
    echo json_encode(["error" => "User not authenticated"]);
    exit;
}

logMessage("Session ID: " . session_id());

try {
    // logMessage("SearchTaskByIGC.php: Script started.");

    // Use POST data instead of reading JSON from php://input
    $data = $_POST;
    if (empty($data)) {
        throw new Exception("No POST data received.");
    }
    // If igcWaypoints is sent as a JSON string, decode it.
    if (isset($data['igcWaypoints']) && is_string($data['igcWaypoints'])) {
        $data['igcWaypoints'] = json_decode($data['igcWaypoints'], true);
    }
    if (
        !isset($data['igcTitle']) || 
        !isset($data['igcWaypoints']) || 
        !isset($data['pilot']) || 
        !isset($data['gliderType']) || 
        !isset($data['competitionID']) || 
        !isset($data['IGCRecordDateTimeUTC'])
    ) {
        throw new Exception("Invalid input data. Required keys: igcTitle, igcWaypoints, pilot, gliderType, competitionID, IGCRecordDateTimeUTC.");
    }
    
    $igcTitle = trim($data['igcTitle']);
    $igcWaypoints = $data['igcWaypoints']; // associative array: waypointID => coordinate string
    // logMessage("IGC Title: " . $igcTitle);
    // logMessage("IGC Waypoints: " . print_r($igcWaypoints, true));

    // Validate that the IGC file has been provided as an upload.
    if (!isset($_FILES['igcFile']) || $_FILES['igcFile']['error'] !== UPLOAD_ERR_OK) {
        throw new Exception("IGC file not provided in the upload.");
    }

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
        // Build the IGCKey using the new format:
        // EntrySeqID_CompetitionID_GliderType_IGCRecordDateTimeUTC
        $entrySeqID = $foundTask['EntrySeqID'];
        $competitionID = trim($data['competitionID']);
        $gliderType = trim($data['gliderType']);
        $recordDateTimeUTC = trim($data['IGCRecordDateTimeUTC']); // expected in YYMMDDHHMMSS format
        
        $IGCKey = $entrySeqID . "_" . $competitionID . "_" . $gliderType . "_" . $recordDateTimeUTC;
        // logMessage("Constructed IGCKey: " . $IGCKey);
        
        // Check the IGCRecords table for a previous entry with the same key
        $checkQuery = "SELECT * FROM IGCRecords WHERE IGCKey = :igcKey";
        $stmt = $pdo->prepare($checkQuery);
        $stmt->bindParam(':igcKey', $IGCKey, PDO::PARAM_STR);
        $stmt->execute();
        $existingRecord = $stmt->fetch(PDO::FETCH_ASSOC);
        
        if ($existingRecord) {
            // logMessage("Duplicate IGC record found for key: " . $IGCKey);
            echo json_encode([
                'status' => 'duplicate',
                'message' => 'An IGC record with this key already exists.',
                'IGCKey' => $IGCKey
            ]);
        } else {
            // logMessage("Found matching task: EntrySeqID = " . $foundTask['EntrySeqID'] . ", Title = " . $foundTask['Title']);
            // Save the IGC file under the temporary folder under the igckey subfolder
            $tempDir = __DIR__ . '/DPHXTemp';
            if (!is_dir($tempDir)) {
                mkdir($tempDir, 0755, true);
            }
            $igcKeyDir = $tempDir . '/' . $IGCKey;
            if (!is_dir($igcKeyDir)) {
                mkdir($igcKeyDir, 0755, true);
            }
            $targetFile = $igcKeyDir . '/' . $IGCKey . '.igc';
            
            if (!move_uploaded_file($_FILES['igcFile']['tmp_name'], $targetFile)) {
                throw new Exception("Failed to save the uploaded IGC file.");
            }
            
            // --- Begin Browserless Call Integration ---
            if (isset($blesstok) && !empty($blesstok)) {
                // Remove the protocol from $wsgRoot (e.g., "https://wesimglide.org" becomes "wesimglide.org")
                $rootWithoutProtocol = preg_replace('#^https?://#', '', $wsgRoot);

                // Build the URL without including "https://"
                $igcFileUrl = $rootWithoutProtocol . "/php/DPHXTemp/{$IGCKey}/" . urlencode($IGCKey . '.igc');

                $url = "https://production-sfo.browserless.io/chrome/bql";
                $endpoint = sprintf("%s?token=%s", $url, $blesstok);

                // Build the GraphQL mutation, injecting the igcFileUrl in place of the placeholder.
                $query = "mutation ExtractTracklogsOnly {
                          goto(
                            url: \"https://xp-soaring.github.io/tasks/b21_task_planner/index.html?igc={$igcFileUrl}\",
                            waitUntil: networkIdle
                          ) {
                            status
                          }

                          waitTracklogs: waitForSelector(selector: \"#tracklogs\", visible: true) {
                            time
                          }

                          tracklogsHTML: html(selector: \"#tracklogs\", visible: true) {
                            html
                          }
                        }";

                $postData = json_encode([
                    'query' => $query,
                    'operationName' => "ExtractTracklogsOnly"
                ]);

                $curl = curl_init();
                curl_setopt_array($curl, [
                    CURLOPT_URL => $endpoint,
                    CURLOPT_RETURNTRANSFER => true,
                    CURLOPT_ENCODING => "",
                    CURLOPT_MAXREDIRS => 10,
                    CURLOPT_TIMEOUT => 30,
                    CURLOPT_HTTP_VERSION => CURL_HTTP_VERSION_1_1,
                    CURLOPT_CUSTOMREQUEST => "POST",
                    CURLOPT_POSTFIELDS => $postData,
                    CURLOPT_HTTPHEADER => [
                        "Content-Type: application/json",
                    ]
                ]);
                $bl_response = curl_exec($curl);
                if (curl_errno($curl)) {
                    // Log or handle the cURL error if necessary.
                    $bl_error = curl_error($curl);
                    $browserlessResult = ["error" => $bl_error];
                } else {
                    $browserlessResult = json_decode($bl_response, true);
                }
                curl_close($curl);
            } else {
                // Fake Browserless response for testing: read from a local file.
                $fakeResponseFile = __DIR__ . '/fake_browserless_response.txt';
                if (file_exists($fakeResponseFile)) {
                    $bl_response = file_get_contents($fakeResponseFile);
                    $decoded = json_decode($bl_response, true);
                    if (json_last_error() === JSON_ERROR_NONE && isset($decoded['data']['tracklogsHTML']['html'])) {
                        // Use the decoded JSON if it has the expected structure.
                        $browserlessResult = $decoded;
                    } else {
                        // Otherwise, assume the file contains raw HTML
                        // and wrap it in the expected structure.
                        $browserlessResult = [
                            "data" => [
                                "tracklogsHTML" => [
                                    "html" => $bl_response
                                ]
                            ]
                        ];
                    }
                } else {
                    $browserlessResult = ["error" => "Browserless token not configured and fake response file not found."];
                }
            }

            // --- BEGIN: Parse Browserless Response to Extract IGC Results ---
            logMessage("Parse Browserless Response to Extract IGC Results");
            if (isset($browserlessResult['data']['tracklogsHTML']['html'])) {
                $htmlContent = $browserlessResult['data']['tracklogsHTML']['html'];
                $dom = new DOMDocument();
                libxml_use_internal_errors(true);
                $dom->loadHTML($htmlContent);
                libxml_clear_errors();
                $xpath = new DOMXPath($dom);
    
                // Look for the table with id "tracklogs_table" and then its rows.
                $rows = $xpath->query('//table[@id="tracklogs_table"]//tr');
                if ($rows->length > 0) {
                    // Prefer the row with class "tracklogs_entry_current" if present; otherwise, take the first row.
                    $targetRow = null;
                    foreach ($rows as $row) {
                        if (strpos($row->getAttribute('class'), "tracklogs_entry_current") !== false) {
                            $targetRow = $row;
                            break;
                        }
                    }
                    if ($targetRow === null) {
                        $targetRow = $rows->item(0);
                    }
        
                    // Extract the information from the information column.
                    logMessage("Extract the information from the information column");
                    $infoDiv = $xpath->query('.//td[contains(@class,"tracklogs_entry_info")]', $targetRow)->item(0);
                    if ($infoDiv) {
                        // Extract the pilot/task information and result details.
                        $nameDiv = $xpath->query('.//div[contains(@class,"tracklogs_entry_name")]', $infoDiv)->item(0);
                        $resultDivCandidates = $xpath->query('.//div[contains(@class, "tracklogs_entry_finished")]', $nameDiv);
                        if ($resultDivCandidates->length > 0) {
                            $resultDiv = $resultDivCandidates->item(0);
                            $class = $resultDiv->getAttribute('class');
                            // Determine task completion and penalty status.
                            $taskCompleted = (strpos($class, "tracklogs_entry_finished_ok") !== false);
                            $penalties = (strpos($class, "penalties") !== false);
                
                            // Get the text content from the <span> inside the result div.
                            $span = $xpath->query('.//span', $resultDiv)->item(0);
                            $resultText = trim($span->textContent);
                
                            $duration = null;
                            $distance = null;
                            $speed = null;
                
                            if ($taskCompleted) {
                                // Completed tasks will have either 2 metrics (normal: duration & speed)
                                // or 3 metrics (AAT: duration, distance, speed).
                                $parts = preg_split('/\s+/', $resultText);
                                if (count($parts) >= 3) {
                                    $duration = $parts[0];
                                    if (strpos($parts[1], 'km') !== false) {
                                        // This is an AAT completed task: duration, distance, and speed.
                                        $distance = floatval(str_replace('km', '', $parts[1]));
                                        $speed = floatval(str_replace('kph', '', $parts[2]));
                                    } else {
                                        // Normal completed task: duration and speed.
                                        $speed = floatval(str_replace('kph', '', $parts[1]));
                                    }
                                } elseif (count($parts) == 2) {
                                    $duration = $parts[0];
                                    $speed = floatval(str_replace('kph', '', $parts[1]));
                                }
                            } else {
                                // Incomplete tasks: only flown distance is provided.
                                $distance = floatval(str_replace('km', '', $resultText));
                            }

                            // Build the parsed results array.
                            logMessage("Build the parsed results array");
                            $parsedResults = [
                                "TaskCompleted" => $taskCompleted,
                                "Penalties" => $penalties,
                                "Duration" => $duration,
                                "Distance" => $distance,
                                "Speed" => $speed
                            ];
                
                            $_SESSION['parsedResults'] = $parsedResults;
                            logMessage("Parsed Results stored in session: " . print_r($_SESSION['parsedResults'], true));
                
                            // Also attach the parsed results to the Browserless result for the JSON response.
                            $browserlessResult['parsedResults'] = $parsedResults;
                        } else {
                            $browserlessResult['error'] = "Result element not found in tracklogs entry.";
                        }
                    } else {
                        $browserlessResult['error'] = "Information column not found in tracklogs entry.";
                    }
                } else {
                    $browserlessResult['error'] = "No tracklogs found in the HTML.";
                }
            } else {
                $browserlessResult['error'] = "Browserless response did not include tracklogs HTML.";
            }
            // --- END: Parsing Browserless Response ---
    
            // Return the found task details along with the Browserless task results.
            echo json_encode([
                'status' => 'found',
                'EntrySeqID' => $foundTask['EntrySeqID'],
                'Title' => $foundTask['Title'],
                'browserless' => $browserlessResult
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
 * Updated validateCandidate function using normalization and tolerance with additional logging.
 */
function validateCandidate($candidate, $igcWaypoints) {
    // logMessage("validateCandidate: Starting candidate validation for EntrySeqID: " . ($candidate['EntrySeqID'] ?? 'unknown'));
    
    if (!isset($candidate['PLNXML'])) {
        // logMessage("validateCandidate: Candidate does not have PLNXML");
        return false;
    }
    
    $xmlString = $candidate['PLNXML'];
    libxml_use_internal_errors(true);
    $xml = simplexml_load_string($xmlString);
    
    if (!$xml) {
        $errors = libxml_get_errors();
        //foreach ($errors as $error) {
            // logMessage("validateCandidate: XML parsing error: " . trim($error->message));
        //}
        libxml_clear_errors();
        return false;
    }
    
    $xmlWaypoints = [];
    $xmlWpList = $xml->xpath('/SimBase.Document/FlightPlan.FlightPlan/ATCWaypoint');
    //if (!$xmlWpList) {
        // logMessage("validateCandidate: No ATCWaypoint elements found in XML");
    //}
    
    foreach ($xmlWpList as $wp) {
        $id = (string)$wp['id'];
        $worldPosRaw = trim((string)$wp->WorldPosition);
        $normalized = normalizeXmlCoordinate($worldPosRaw);
        if ($normalized) {
            $position = $normalized[0] . "," . $normalized[1];
        } else {
            $position = $worldPosRaw;
        }
        $xmlWaypoints[$id] = $position;
        // logMessage("validateCandidate: Extracted waypoint - ID: " . $id . ", Position: " . $position);
    }
    
    foreach ($igcWaypoints as $wpID => $igcCoord) {
        // logMessage("validateCandidate: Checking IGC waypoint - ID: " . $wpID . ", Coord: " . $igcCoord);
        
        if (!isset($xmlWaypoints[$wpID])) {
            // logMessage("validateCandidate: IGC waypoint " . $wpID . " not found in candidate XML.");
            return false;
        }
        
        $xmlParts = explode(',', $xmlWaypoints[$wpID]);
        if (count($xmlParts) < 2) {
            // logMessage("validateCandidate: XML waypoint " . $wpID . " has invalid coordinate format: " . $xmlWaypoints[$wpID]);
            return false;
        }
        
        $xmlLat = trim($xmlParts[0]);
        $xmlLon = trim($xmlParts[1]);
        
        // Remove any spaces from the IGC coordinate
        $igcCoordNoSpaces = str_replace(" ", "", $igcCoord);
        $igcParts = explode(',', $igcCoordNoSpaces);
        if (count($igcParts) < 2) {
            // logMessage("validateCandidate: IGC waypoint " . $wpID . " has invalid coordinate format: " . $igcCoord);
            return false;
        }
        
        $igcLat = trim($igcParts[0]);
        $igcLon = trim($igcParts[1]);
        
        // logMessage("validateCandidate: Comparing waypoint " . $wpID . " latitudes - IGC: " . $igcLat . " vs XML: " . $xmlLat);
        $latMatch = compareCoordinates($igcLat, $xmlLat);
        
        // logMessage("validateCandidate: Comparing waypoint " . $wpID . " longitudes - IGC: " . $igcLon . " vs XML: " . $xmlLon);
        $lonMatch = compareCoordinates($igcLon, $xmlLon);
        
        if (!$latMatch || !$lonMatch) {
            // logMessage("validateCandidate: Coordinate mismatch for waypoint " . $wpID . ". latMatch: " . ($latMatch ? "true" : "false") . ", lonMatch: " . ($lonMatch ? "true" : "false"));
            return false;
        } else {
            // logMessage("validateCandidate: Waypoint " . $wpID . " matches successfully.");
        }
    }
    
    // logMessage("validateCandidate: All IGC waypoints validated successfully for candidate.");
    return true;
}
?>
