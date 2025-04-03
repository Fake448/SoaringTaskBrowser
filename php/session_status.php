<?php
require_once __DIR__ . '/session_restore.php';
require_once __DIR__ . '/CommonFunctions.php';

$response = [];

// At this point, session_restore.php should have ensured that the session is active
// and, if a WSGUserID cookie was present, that $_SESSION['user'] is populated.

if (isset($_SESSION['user']) && isset($_SESSION['user']['id'])) {
    $wsgUserID = $_SESSION['user']['id'];
    
    try {
        // Connect to the database
        $pdo = new PDO("sqlite:$databasePath");
        $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
        
        // Update LastLoginUTC to current UTC time
        $nowUTC = gmdate('Y-m-d H:i:s');
        $stmt = $pdo->prepare("UPDATE Users SET LastLoginUTC = ? WHERE WSGUserID = ?");
        $stmt->execute([$nowUTC, $wsgUserID]);
        
        $response = [
            'loggedIn' => true,
            'user' => $_SESSION['user']
        ];
    } catch (Exception $e) {
        // Log the error if desired
        $response = ['loggedIn' => false, 'error' => $e->getMessage()];
    }
} else {
    $response = ['loggedIn' => false];
}

echo json_encode($response);
?>
