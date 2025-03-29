<?php
session_start();

// Include common functions and configuration
include_once 'CommonFunctions.php';

// Retrieve Discord credentials from configuration
$clientId     = $config['discordClientId'];
$clientSecret = $config['discordClientSecret'];
$redirectUri  = $config['discordRedirectUri'];

// Set session and cookie parameters to persist for 30 days
ini_set('session.gc_maxlifetime', 86400 * 30);
session_set_cookie_params(86400 * 30);

// Check for error (user cancelled, etc.)
if (isset($_GET['error'])) {
    // Optionally, you can log the error:
    // logMessage("Discord OAuth error: " . $_GET['error'] . " - " . $_GET['error_description']);
    
    // Redirect back to the account tab without logging in
    header('Location: ../index.html?tab=accountTab');
    exit();
}

if (isset($_GET['code'])) {
    $code = $_GET['code'];

    $tokenUrl = 'https://discord.com/api/oauth2/token';
    $data = [
        'client_id'     => $clientId,
        'client_secret' => $clientSecret,
        'grant_type'    => 'authorization_code',
        'code'          => $code,
        'redirect_uri'  => $redirectUri
    ];

    $options = [
        'http' => [
            'header'  => "Content-type: application/x-www-form-urlencoded\r\n",
            'method'  => 'POST',
            'content' => http_build_query($data)
        ]
    ];

    $context = stream_context_create($options);
    $result = file_get_contents($tokenUrl, false, $context);
    if ($result === FALSE) {
        die('Error fetching access token.');
    }
    $tokenData = json_decode($result, true);
    if (!isset($tokenData['access_token'])) {
        die('Invalid access token response: ' . json_encode($tokenData));
    }
    $accessToken = $tokenData['access_token'];

    $userUrl = 'https://discord.com/api/users/@me';
    $options = [
        'http' => [
            'header' => "Authorization: Bearer $accessToken\r\n",
            'method' => 'GET'
        ]
    ];

    $context = stream_context_create($options);
    $userResult = file_get_contents($userUrl, false, $context);
    if ($userResult === FALSE) {
        die('Error fetching user data.');
    }
    $userData = json_decode($userResult, true);
    if (!isset($userData['id'])) {
        die('Invalid user data response: ' . json_encode($userData));
    }

    $_SESSION['user'] = $userData;

    // Set cookies for persistent login (30 days)
    setcookie('user_id',   $userData['id'],       time() + (86400 * 30), "/");
    setcookie('username',  $userData['username'], time() + (86400 * 30), "/");
    setcookie('avatar',    $userData['avatar'],   time() + (86400 * 30), "/");

    // Redirect to the account tab on your main page
    header('Location: ../index.html?tab=accountTab');
    exit();
}
?>
