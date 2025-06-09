<?php
session_start();
require_once __DIR__ . '/CommonFunctions.php';
header('Content-Type: application/json');

// 1) Make sure we have the Discord token and a logged-in user
if (empty($_SESSION['discord_token']) || empty($_SESSION['user']['id'])) {
    http_response_code(401);
    echo json_encode([
        'success' => false,
        'message' => 'Not authenticated'
    ]);
    exit;
}

// 2) Call Discord’s /users/@me to get the latest avatar hash
$token = $_SESSION['discord_token'];
$ch = curl_init('https://discord.com/api/v10/users/@me');
curl_setopt_array($ch, [
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_HTTPHEADER     => [
        "Authorization: Bearer $token"
    ],
]);
$data = json_decode(curl_exec($ch), true);
curl_close($ch);

if (empty($data['id'])) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Discord API error'
    ]);
    exit;
}

// 3) Build a valid CDN URL (custom avatar or default)
$discordId = $data['id'];
$hash      = $data['avatar'];         // may be null
$disc      = $data['discriminator'];  // to pick default avatar

if ($hash) {
    $newUrl = "https://cdn.discordapp.com/avatars/{$discordId}/{$hash}.png?size=256";
} else {
    $index  = intval($disc) % 5;
    $newUrl = "https://cdn.discordapp.com/embed/avatars/{$index}.png?size=256";
}

// 4) Persist into your SQLite Users table
$config       = include __DIR__ . '/config.php';
$pdo = new PDO("sqlite:{$config['databasePath']}");
$pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

$stmt = $pdo->prepare("UPDATE Users SET AvatarURL = ? WHERE WSGUserID = ?");
$stmt->execute([
    $newUrl,
    $_SESSION['user']['id']
]);

// 5) Sync session so TB.getUserConnectionInfo() returns it
$_SESSION['user']['avatar'] = $newUrl;

// 6) Return success + new URL
echo json_encode([
    'success'   => true,
    'avatarUrl' => $newUrl
]);
