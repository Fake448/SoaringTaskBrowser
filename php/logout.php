<?php
session_start();

// Unset all session variables
$_SESSION = [];

// Destroy the session
session_destroy();

// Delete cookies by setting their expiration time in the past
setcookie('user_id', '', time() - 3600, "/");
setcookie('username', '', time() - 3600, "/");
setcookie('avatar', '', time() - 3600, "/");

// Redirect to the login page
header('Location: ../index.html?tab=accountTab');
exit();
?>
