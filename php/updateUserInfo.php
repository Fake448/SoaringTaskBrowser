<?php
header('Content-Type: application/json');
require_once __DIR__ . '/CommonFunctions.php';

// 1) Ensure user is logged in
if (empty($_SESSION['user']['id'])) {
    http_response_code(401);
    echo json_encode(['success' => false, 'message' => 'Not authenticated']);
    exit;
}

// 2) Read & decode JSON body
$raw = file_get_contents('php://input');
$data = json_decode($raw, true);
if (!is_array($data)) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Invalid JSON']);
    exit;
}

$pilotName = trim($data['pilotName'] ?? '');
$compId    = trim($data['compId']    ?? '');

if ($pilotName === '' || $compId === '') {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Both Pilot Name and Competition ID are required']);
    exit;
}

// 3) Connect to database
// CommonFunctions.php should define $databasePath
$pdo = new PDO("sqlite:$databasePath");
$pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

try {
    // 4) Update the Users table
    $stmt = $pdo->prepare("
        UPDATE Users
           SET PilotName = :pilot,
               CompID    = :comp
         WHERE WSGUserID = :uid
    ");
    $stmt->execute([
        ':pilot' => $pilotName,
        ':comp'  => $compId,
        ':uid'   => $_SESSION['user']['id']
    ]);

    // 5) Sync session values so front-end reload shows new data
    $_SESSION['user']['pilotName'] = $pilotName;
    $_SESSION['user']['compId']    = $compId;

    echo json_encode(['success' => true]);
} catch (Exception $e) {
    // Log error server-side if you wish:
    logMessage("updateUserInfo error: " . $e->getMessage());

    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Database error'
    ]);
}
