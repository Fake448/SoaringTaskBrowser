<?php

function getRemoteFileHeaders($url) {
    $ch = curl_init($url);
    curl_setopt($ch, CURLOPT_NOBODY, true); // Fetch headers only
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_HEADER, true);
    curl_setopt($ch, CURLOPT_FILETIME, true);
    curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false); // Disable SSL verification if needed
    curl_setopt($ch, CURLOPT_FOLLOWLOCATION, true); // Follow redirects

    // Execute the request
    $response = curl_exec($ch);
    $filetime = curl_getinfo($ch, CURLINFO_FILETIME);
    $http_code = curl_getinfo($ch, CURLINFO_HTTP_CODE);

    // Close cURL session
    curl_close($ch);

    // Output the headers
    echo "<pre>";
    echo "HTTP Response Code: $http_code\n";
    echo "cURL Raw Headers Response:\n$response\n";
    echo "Extracted Last-Modified Timestamp: " . ($filetime !== -1 ? date("Y-m-d H:i:s", $filetime) : "Unavailable") . "\n";
    echo "</pre>";
}

// Test URL
$testUrl = "https://siglr.com/DiscordPostHelper/TaskBrowser/Tasks/1325553918981443645.dphx";

// Call function
getRemoteFileHeaders($testUrl);

?>
