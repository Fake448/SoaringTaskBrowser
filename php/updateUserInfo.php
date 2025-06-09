<?php
require_once __DIR__ . '/session_restore.php';
require_once __DIR__ . '/CommonFunctions.php';

header('Content-Type: application/json');

// 1) Auth checks
if (empty($_SESSION['user']['id'])) {
    http_response_code(401);
    echo json_encode(array('success' => false, 'message' => 'User not authenticated'));
    exit;
}

$wsgUserID = (int) $_SESSION['user']['id'];
if ($wsgUserID <= 0) {
    http_response_code(400);
    echo json_encode(array('success' => false, 'message' => 'Invalid user ID'));
    exit;
}

// 2) Decode input
$raw  = file_get_contents('php://input');
$data = json_decode($raw, true);
if (!is_array($data)) {
    http_response_code(400);
    echo json_encode(array('success' => false, 'message' => 'Invalid JSON'));
    exit;
}

$pilotName = trim($data['pilotName'] ?? '');
$compId    = trim($data['compId']    ?? '');
if ($pilotName === '' || $compId === '') {
    http_response_code(400);
    echo json_encode(array(
        'success' => false,
        'message' => 'Both Pilot Name and Competition ID are required'
    ));
    exit;
}

// 3) DB connection
$pdo = new PDO('sqlite:' . $databasePath);
$pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

try {
    // 4) Update profile
    $upd = $pdo->prepare('
        UPDATE Users
           SET PilotName = :pilot,
               CompID    = :comp
         WHERE WSGUserID = :uid
    ');
    $upd->execute(array(
        ':pilot' => $pilotName,
        ':comp'  => $compId,
        ':uid'   => $wsgUserID
    ));

    // 5) Sync session
    $_SESSION['user']['pilotName'] = $pilotName;
    $_SESSION['user']['compId']    = $compId;

    // 6) Prepare match-finding statements
    $selUnassigned = $pdo->prepare('
        SELECT IGCKey, Pilot, CompetitionID
          FROM IGCRecords
         WHERE WSGUserID = 0
    ');
    $findBoth = $pdo->prepare('
        SELECT 1
          FROM Users
         WHERE PilotName = :pilot
           AND CompID    = :comp
         LIMIT 1
    ');
    $findByComp  = $pdo->prepare('SELECT WSGUserID FROM Users WHERE CompID    = :comp');
    $findByPilot = $pdo->prepare('SELECT WSGUserID FROM Users WHERE PilotName = :pilot');

    // 7) Scan unassigned records
    $selUnassigned->execute();
    $matches = array();

    while ($rec = $selUnassigned->fetch(PDO::FETCH_ASSOC)) {
        $matched = false;

        // a) exact pilot+comp match
        $findBoth->execute(array(
            ':pilot' => $rec['Pilot'],
            ':comp'  => $rec['CompetitionID']
        ));
        if ($findBoth->fetch()) {
            $matched = true;
        } else {
            // b) fallbacks
            $findByComp->execute(array(':comp'  => $rec['CompetitionID']));
            $compRows  = $findByComp->fetchAll(PDO::FETCH_COLUMN, 0);

            $findByPilot->execute(array(':pilot' => $rec['Pilot']));
            $pilotRows = $findByPilot->fetchAll(PDO::FETCH_COLUMN, 0);

            // unique-comp -> this user?
            if (count($compRows) === 1 && $compRows[0] == $wsgUserID && count($pilotRows) === 0) {
                $matched = true;
            }
            // unique-pilot -> this user?
            elseif (count($pilotRows) === 1 && $pilotRows[0] == $wsgUserID && count($compRows) === 0) {
                $matched = true;
            }
        }

        if ($matched) {
            $matches[] = array(
                'IGCKey'        => $rec['IGCKey'],
                'Pilot'         => $rec['Pilot'],
                'CompetitionID' => $rec['CompetitionID']
            );
        }
    }

    // 8) Respond
    echo json_encode(array(
        'success' => true,
        'matches' => $matches
    ));
}
catch (Exception $e) {
    logMessage('updateUserInfo error: ' . $e->getMessage());
    http_response_code(500);
    echo json_encode(array('success' => false, 'message' => 'Database error'));
}
