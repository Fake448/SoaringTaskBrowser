<?php
// session_display.php

// Start (or resume) the session.
session_start();

// Set the content-type header to JSON.
header('Content-Type: application/json');

// Output the current session data as JSON.
echo json_encode($_SESSION, JSON_PRETTY_PRINT);
?>
