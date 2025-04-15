<?php
require_once __DIR__ . '/CommonFunctions.php';

// Set session and cookie parameters to persist for 30 days.
// If you need the cookie to be available on all subdomains, adjust the domain accordingly.
ini_set('session.gc_maxlifetime', 86400 * 30);
session_set_cookie_params(86400 * 30);

// Start the session if it is not already active.
if (session_status() !== PHP_SESSION_ACTIVE) {
    session_start();
    logMessage("Session Restore - Session ID: " . session_id());
}

// If session data isn't set but the WSGUserID cookie exists, restore the session.
if (!isset($_SESSION['user']) && isset($_COOKIE['WSGUserID'])) {
    // Load configuration directly to get $databasePath (adjust the path as necessary).
    $config = include __DIR__ . '/config.php';
    $databasePath = $config['databasePath'];

    try {
        $pdo = new PDO("sqlite:$databasePath");
        $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

        // Prepare and execute query to fetch user data.
        $stmt = $pdo->prepare("SELECT WSGUserID, WSGDisplayName, AvatarURL FROM Users WHERE WSGUserID = ?");
        $stmt->execute([$_COOKIE['WSGUserID']]);
        $userRow = $stmt->fetch(PDO::FETCH_ASSOC);

        if ($userRow) {
            $_SESSION['user'] = [
                'id'          => $userRow['WSGUserID'],
                'displayName' => $userRow['WSGDisplayName'],
                'discordID'   => null,  // Set accordingly if available.
                'avatar'      => $userRow['AvatarURL']
            ];
        }
    } catch (Exception $e) {
        // Log the error (or handle as needed) without outputting anything.
        logMessage("Error restoring session: " . $e->getMessage());
    }
}
