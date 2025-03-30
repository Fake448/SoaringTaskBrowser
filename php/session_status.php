<?php
session_start();

// Set session and cookie parameters to persist for 30 days
ini_set('session.gc_maxlifetime', 86400 * 30);
session_set_cookie_params(86400 * 30);

// Include CommonFunctions.php to access configuration variables (like $databasePath)
include_once 'CommonFunctions.php';

$response = [];

// If session has the new user data, update LastLoginUTC
if (isset($_SESSION['user']) && isset($_SESSION['user']['id'])) {
    $wsgUserID = $_SESSION['user']['id'];
    
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
} 
// If session doesn't exist but a WSGUserID cookie is present, load user info from the database
else if (isset($_COOKIE['WSGUserID'])) {
    $wsgUserID = $_COOKIE['WSGUserID'];
    
    // Connect to the database
    $pdo = new PDO("sqlite:$databasePath");
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    
    // Retrieve the user record from the Users table
    $stmt = $pdo->prepare("SELECT WSGUserID, WSGDisplayName FROM Users WHERE WSGUserID = ?");
    $stmt->execute([$wsgUserID]);
    $userRow = $stmt->fetch(PDO::FETCH_ASSOC);
    
    if ($userRow) {
        // Set session using available info; additional fields (like discordID and avatar)
        // could be retrieved if stored, but here we set them to null.
        $_SESSION['user'] = [
            'id'          => $userRow['WSGUserID'],
            'displayName' => $userRow['WSGDisplayName'],
            'discordID'   => null,
            'avatar'      => null
        ];
        
        // Update the last login time in the database
        $nowUTC = gmdate('Y-m-d H:i:s');
        $updateStmt = $pdo->prepare("UPDATE Users SET LastLoginUTC = ? WHERE WSGUserID = ?");
        $updateStmt->execute([$nowUTC, $wsgUserID]);
        
        $response = [
            'loggedIn' => true,
            'user' => $_SESSION['user']
        ];
    } else {
        $response = ['loggedIn' => false];
    }
} else {
    $response = ['loggedIn' => false];
}

echo json_encode($response);
?>
