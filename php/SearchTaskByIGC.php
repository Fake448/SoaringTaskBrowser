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
        // pull the real IDs out of our numeric array
        $ids = array_column($igcWaypoints, 'id');
    
        $likeClauses = [];
        $params      = [];
        foreach ($ids as $wpID) {
            $likeClauses[] = "PLNXML LIKE ?";
            $params[]      = '%<ATCWaypoint id="' . $wpID . '">%';
        }
    
        if (!empty($likeClauses)) {
            $sql  = "SELECT * FROM Tasks WHERE " . implode(' AND ', $likeClauses);
            // logMessage("Waypoint Query: " . $sql);
            // logMessage("Waypoint Query Params: " . print_r($params, true));
    
            $stmt = $pdo->prepare($sql);
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
    }

    // STEP 3: match by interior waypoint names only, then validate all coords
    if (!$foundTask) {
        // pull the real IDs out of the list
        $ids = array_column($igcWaypoints, 'id');
        // logMessage("Step 3: raw IGC waypoint IDs: " . implode(',', $ids));
    
        // need at least 3 to drop first+last
        if (count($ids) > 2) {
            // grab only the middle IDs
            $interiorIDs = array_slice($ids, 1, -1);
            // logMessage("Step 3: interior waypoint IDs (dropping first & last): " . implode(',', $interiorIDs));
    
            // build WHERE PLNXML LIKE ? AND … for each interior ID
            $likeClauses = [];
            $params      = [];
            foreach ($interiorIDs as $wpID) {
                $likeClauses[] = "PLNXML LIKE ?";
                $params[]      = '%<ATCWaypoint id="' . $wpID . '">%';
            }
    
            $sql = "SELECT * FROM Tasks WHERE " . implode(" AND ", $likeClauses);
            // logMessage("Step 3: SQL query: " . $sql . " | params: " . print_r($params, true));
    
            $stmt = $pdo->prepare($sql);
            $stmt->execute($params);
            $cands = $stmt->fetchAll(PDO::FETCH_ASSOC);
            // logMessage("Step 3: fetched " . count($cands) . " candidate(s)");
    
            foreach ($cands as $candidate) {
                $eid = $candidate['EntrySeqID'] ?? 'unknown';
                // logMessage("Step 3: validating candidate EntrySeqID: " . $eid);
                if (validateCandidate($candidate, $igcWaypoints)) {
                    // logMessage("Step 3: candidate validated successfully: EntrySeqID " . $eid);
                    $foundTask = $candidate;
                    break;
                } else {
                    // logMessage("Step 3: candidate failed coordinate validation: EntrySeqID " . $eid);
                }
            }
    
            if (!$foundTask) {
                // logMessage("Step 3: no valid candidate found in interior-only search");
            }
        } else {
            // logMessage("Step 3: skipped interior search—only " . count($ids) . " waypoint(s) present");
        }
    }

    if ($foundTask) {
        // Build the IGCKey using the new format:
        // EntrySeqID_CompetitionID_GliderType_IGCRecordDateTimeUTC
        $entrySeqID = $foundTask['EntrySeqID'];
        $simDateTime = $foundTask['SimDateTime'];
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

                          plannerVersion: html(selector: \"#b21_task_planner_version\", visible: true) {
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

                    if (json_last_error() === JSON_ERROR_NONE
                        && isset($decoded['data']['tracklogsHTML']['html'])
                    ) {
                        // Make sure plannerVersion is defined, even if empty
                        if (!isset($decoded['data']['plannerVersion']['html'])) {
                            $decoded['data']['plannerVersion'] = ['html' => ''];
                        }
                        $browserlessResult = $decoded;
                    } else {
                        // Raw HTML fallback: wrap in the expected structure, including plannerVersion
                        $browserlessResult = [
                            'data' => [
                                'tracklogsHTML'   => ['html' => $bl_response],
                                'plannerVersion'  => ['html' => '']
                            ]
                        ];
                    }
                } else {
                    $browserlessResult = [
                        'error' => 'Browserless token not configured and fake response file not found.'
                    ];
                }
            }

            // --- BEGIN: Parse Browserless Response to Extract IGC Results ---
            if (isset($browserlessResult['data']['tracklogsHTML']['html'])) {
                // 1. Extract the raw HTML for tracklogs...
                $htmlContent = $browserlessResult['data']['tracklogsHTML']['html'];

                // 2. Extract the planner version (TPVersion)
                $plannerVersion = '';
                if (isset($browserlessResult['data']['plannerVersion']['html'])) {
                    $plannerVersion = trim($browserlessResult['data']['plannerVersion']['html']);
                }

                // 3. Load the tracklogs HTML into DOMDocument
                $htmlContent = '<?xml encoding="UTF-8">' . $htmlContent;
                $dom = new DOMDocument('1.0', 'UTF-8');
                libxml_use_internal_errors(true);
                $dom->loadHTML($htmlContent);
                libxml_clear_errors();
                $xpath = new DOMXPath($dom);

                // 4. Find the rows in the tracklogs table
                $rows = $xpath->query('//table[@id="tracklogs_table"]//tr');
                if ($rows->length > 0) {
                    // pick the “current” row if present
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

                    // 5. Extract the info cell
                    $infoDiv = $xpath->query('.//td[contains(@class,"tracklogs_entry_info")]', $targetRow)->item(0);
                    if ($infoDiv) {
                        // pilot / task name & icon
                        $nameDiv = $xpath->query('.//div[contains(@class,"tracklogs_entry_name")]', $infoDiv)->item(0);
                        $rawNameContent = trim($nameDiv->textContent);
                        $igcValid = (mb_substr($rawNameContent, 0, 1) === "🔒");

                        // result details div
                        $resultDivCandidates = $xpath->query('.//div[contains(@class, "tracklogs_entry_finished")]', $nameDiv);
                        if ($resultDivCandidates->length > 0) {
                            $resultDiv = $resultDivCandidates->item(0);
                            $class = $resultDiv->getAttribute('class');
                            $taskCompleted = (strpos($class, "tracklogs_entry_finished_ok") !== false);
                            $penalties    = (strpos($class, "penalties") !== false);

                            $span       = $xpath->query('.//span', $resultDiv)->item(0);
                            $resultText = trim($span->textContent);

                            $duration = $distance = $speed = null;
                            if ($taskCompleted) {
                                $parts = preg_split('/\s+/', $resultText);
                                if (count($parts) >= 3 && strpos($parts[1], 'km') !== false) {
                                    // AAT: duration, distance, speed
                                    $duration = $parts[0];
                                    $distance = sprintf('%.1f', floatval(str_replace('km', '', $parts[1])));
                                    $speed    = sprintf('%.1f', floatval(str_replace('kph', '', $parts[2])));
                                } elseif (count($parts) >= 2) {
                                    // normal: duration, speed
                                    $duration = $parts[0];
                                    $speed    = sprintf('%.1f', floatval(str_replace('kph', '', $parts[1])));
                                }
                            } else {
                                // incomplete: only flown distance
                                $distance = sprintf('%.1f', floatval(str_replace('km', '', $resultText)));
                            }

                            // 6. Build parsedResults including TPVersion
                            $parsedResults = [
                                "TaskCompleted" => $taskCompleted,
                                "Penalties"     => $penalties,
                                "Duration"      => $duration,
                                "Distance"      => $distance,
                                "Speed"         => $speed,
                                "IGCValid"      => $igcValid,
                                "TPVersion"     => $plannerVersion
                            ];

                            // 7. Write results.json
                            $resultsFile = $igcKeyDir . '/results.json';
                            $jsonData = json_encode($parsedResults, JSON_PRETTY_PRINT);
                            if ($jsonData === false) {
                                throw new Exception("Failed to encode parsed results as JSON: " . json_last_error_msg());
                            }
                            if (file_put_contents($resultsFile, $jsonData) === false) {
                                throw new Exception("Failed to write results file to $resultsFile");
                            }

                            // 8. Attach to the response
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
                'SimDateTime' => $foundTask['SimDateTime'],
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
 * Validate a candidate TASK against the ordered IGC waypoints.
 * Skips id/name lookup for first & last waypoints, using position by index instead.
 *
 * @param array $candidate    The task row, must include ['PLNXML']
 * @param array $igcWaypoints Numeric array of ['id'=>'…','coord'=>'…']
 * @return bool               True if all waypoints pass tolerance check
 */
function validateCandidate(array $candidate, array $igcWaypoints): bool {
    $entrySeq = $candidate['EntrySeqID'] ?? 'unknown';
    // logMessage("validateCandidate: *** START validation for EntrySeqID: {$entrySeq} ***");

    // Build human list of IGC fixes
    $igcList = array_map(fn($w)=> "{$w['id']}=>{$w['coord']}", $igcWaypoints);
    // logMessage("validateCandidate: IGC waypoints: " . implode(', ', $igcList));

    if (empty($candidate['PLNXML'])) {
        // logMessage("validateCandidate: Missing PLNXML");
        return false;
    }

    // Parse the PLNXML
    libxml_use_internal_errors(true);
    $xml = simplexml_load_string($candidate['PLNXML']);
    if (!$xml) {
        // foreach (libxml_get_errors() as $err) {
        //     logMessage("validateCandidate: XML parse error: " . trim($err->message));
        // }
        libxml_clear_errors();
        return false;
    }

    // Extract all ATCWaypoint elements in order
    $nodes = $xml->xpath('/SimBase.Document/FlightPlan.FlightPlan/ATCWaypoint');
    if (!$nodes) {
        // logMessage("validateCandidate: No ATCWaypoint elements in PLNXML");
        return false;
    }

    // Build two structures:
    // 1) $orderedXmlPos[i] = "lat,lon" for waypoint at index i
    // 2) $xmlMapById[name] = "lat,lon" for lookup by id (interior fixes)
    $orderedXmlPos = [];
    $xmlMapById    = [];
    $dump = [];
    foreach ($nodes as $i => $wp) {
        $nameAttr = (string)$wp['id'];
        $rawPos   = trim((string)$wp->WorldPosition);
        $norm     = normalizeXmlCoordinate($rawPos);
        $pos      = $norm ? "{$norm[0]},{$norm[1]}" : $rawPos;

        $orderedXmlPos[$i]   = $pos;
        $xmlMapById[$nameAttr] = $pos;
        $dump[] = "{$i}:{$nameAttr}=>{$pos}";
    }
    // logMessage("validateCandidate: PLNXML waypoints by index|id: " . implode(' | ', $dump));

    $n = count($igcWaypoints);
    // Compare each IGC fix to the corresponding XML position
    foreach ($igcWaypoints as $i => $wp) {
        $wpID    = $wp['id'];
        $igcCoord= $wp['coord'];
        // logMessage("validateCandidate: Checking IGC waypoint #{$i} ID='{$wpID}', Coord='{$igcCoord}'");

        // First or last? use position by index, skip id lookup
        if ($i === 0 || $i === $n - 1) {
            $xmlPos = $orderedXmlPos[$i];
            // logMessage("validateCandidate: First/last fix—using XML index {$i} => {$xmlPos}");
        } else {
            // interior: must exist by id
            if (!isset($xmlMapById[$wpID])) {
                // logMessage("validateCandidate: Interior waypoint '{$wpID}' not found by id");
                return false;
            }
            $xmlPos = $xmlMapById[$wpID];
            // logMessage("validateCandidate: Matched interior '{$wpID}' => {$xmlPos}");
        }

        // Split lat/lon from XML
        [$xmlLat, $xmlLon] = explode(',', $xmlPos) + [null, null];
        if ($xmlLat === null || $xmlLon === null) {
            // logMessage("validateCandidate: Invalid XML coords for '{$wpID}': {$xmlPos}");
            return false;
        }
        $xmlLat = trim($xmlLat);
        $xmlLon = trim($xmlLon);

        // Parse IGC coords (strip spaces)
        $parts = explode(',', str_replace(' ', '', $igcCoord));
        if (count($parts) < 2) {
            // logMessage("validateCandidate: Invalid IGC coord for '{$wpID}': {$igcCoord}");
            return false;
        }
        [$igcLat, $igcLon] = array_map('trim', $parts);

        // Compare latitude
        // logMessage("validateCandidate: Comparing LAT '{$wpID}' — IGC={$igcLat} vs XML={$xmlLat}");
        $latOk = compareCoordinates($igcLat, $xmlLat);

        // Compare longitude
        // logMessage("validateCandidate: Comparing LON '{$wpID}' — IGC={$igcLon} vs XML={$xmlLon}");
        $lonOk = compareCoordinates($igcLon, $xmlLon);

        if (!($latOk && $lonOk)) {
            // logMessage("validateCandidate: Mismatch for '{$wpID}': latOk=" . ($latOk?'true':'false') . ", lonOk=" . ($lonOk?'true':'false'));
            return false;
        }

        // logMessage("validateCandidate: Waypoint #{$i} '{$wpID}' matches successfully");
    }

    // logMessage("validateCandidate: *** ALL WAYPOINTS MATCH for EntrySeqID {$entrySeq} ***");
    return true;
}
?>
