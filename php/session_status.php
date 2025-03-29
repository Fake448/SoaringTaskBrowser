<?php
session_start();

// Set session and cookie parameters to persist for 30 days
ini_set('session.gc_maxlifetime', 86400 * 30);
session_set_cookie_params(86400 * 30);

$response = [];

if (isset($_SESSION['user'])) {
    $response = [
        'loggedIn' => true,
        'user' => $_SESSION['user']
    ];
} else if (isset($_COOKIE['user_id']) && isset($_COOKIE['username']) && isset($_COOKIE['avatar'])) {
    $_SESSION['user'] = [
        'id' => $_COOKIE['user_id'],
        'username' => $_COOKIE['username'],
        'avatar' => $_COOKIE['avatar']
    ];
    $response = [
        'loggedIn' => true,
        'user' => $_SESSION['user']
    ];
} else {
    $response = ['loggedIn' => false];
}

echo json_encode($response);
?>
