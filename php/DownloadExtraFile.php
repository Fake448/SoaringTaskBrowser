<?php
require __DIR__ . '/CommonFunctions.php';

$taskID = $_GET['taskID'] ?? null;
$filename = $_GET['filename'] ?? null;

if (!$taskID || !$filename) {
    http_response_code(400);
    die("Missing parameters.");
}

$repositoryUrl = "$taskRepositoryPath/$taskID.dphx";
$tempDir = __DIR__ . '/DPHXTemp';
$taskFolder = "$tempDir/$taskID";
$dphxFile = "$taskFolder/$taskID.dphx";

// Ensure the temp directory exists
if (!file_exists($tempDir)) {
    mkdir($tempDir, 0755, true);
}

// **Register cleanup function to run at the end**
register_shutdown_function('cleanupOldTempFolders', $tempDir);

// **Get last modified time of the remote file**
$remoteLastModified = getRemoteFileLastModified($repositoryUrl);
logMessage("Remote Last-Modified for TaskID $taskID: " . ($remoteLastModified ? date("Y-m-d H:i:s", $remoteLastModified) : "Unavailable"));

// **Get the creation/modification time of the local folder (if it exists)**
$localLastModified = file_exists($taskFolder) ? filemtime($taskFolder) : 0;
logMessage("Local Task Folder Last Modified: " . ($localLastModified ? date("Y-m-d H:i:s", $localLastModified) : "Folder does not exist"));

// **If the folder does not exist OR the DPHX file was updated, delete the folder and refresh**
if (!file_exists($taskFolder) || ($remoteLastModified > $localLastModified && $remoteLastModified > 0)) {
    logMessage("Updating Task Folder for TaskID $taskID.");

    if (file_exists($taskFolder)) {
        deleteFolder($taskFolder);
    }

    mkdir($taskFolder, 0755, true);

    // Download the DPHX file
    $dphxContent = @file_get_contents($repositoryUrl);
    if ($dphxContent === false) {
        http_response_code(404);
        logMessage("Error: DPHX file not found in repository for TaskID $taskID. $repositoryUrl");
        die("DPHX file not found in repository.");
    }

    file_put_contents($dphxFile, $dphxContent);
    logMessage("DPHX file downloaded successfully for TaskID $taskID.");

    // Extract the DPHX file
    $zip = new ZipArchive();
    if ($zip->open($dphxFile) === TRUE) {
        $zip->extractTo($taskFolder);
        $zip->close();
        logMessage("DPHX file extracted successfully for TaskID $taskID.");
    } else {
        http_response_code(500);
        logMessage("Error: Failed to extract DPHX file for TaskID $taskID.");
        die("Failed to extract DPHX file.");
    }
} else {
    logMessage("No update required for TaskID $taskID.");
}

// Serve the requested file
$requestedFile = "$taskFolder/$filename";
if (file_exists($requestedFile)) {
    $fileExtension = pathinfo($requestedFile, PATHINFO_EXTENSION);
    $mimeTypes = [
        'jpg' => 'image/jpeg',
        'jpeg' => 'image/jpeg',
        'png' => 'image/png',
        'gif' => 'image/gif',
        'bmp' => 'image/bmp',
        'webp' => 'image/webp',
    ];

    $mimeType = $mimeTypes[$fileExtension] ?? 'application/octet-stream';

    header('Content-Description: File Transfer');
    header('Content-Type: ' . $mimeType);
    header('Content-Disposition: inline; filename="' . basename($requestedFile) . '"');
    header('Expires: 0');
    header('Cache-Control: must-revalidate');
    header('Pragma: public');
    header('Content-Length: ' . filesize($requestedFile));
    readfile($requestedFile);
    logMessage("Served file: $requestedFile");
    exit;
} else {
    http_response_code(404);
    logMessage("Error: Requested file not found - $requestedFile.");
    die("Requested file not found.");
}

// **Function to clean up old folders**
function cleanupOldTempFolders($tempDir) {
    foreach (glob("$tempDir/*") as $folder) {
        if (is_dir($folder) && time() - filemtime($folder) > 48 * 3600) {
            deleteFolder($folder);
        }
    }
}

// **Function to delete a folder and its contents**
function deleteFolder($folder) {
    if (!is_dir($folder)) return;
    foreach (glob("$folder/*") as $file) {
        is_dir($file) ? deleteFolder($file) : unlink($file);
    }
    rmdir($folder);
}

// Function to fetch the last modified timestamp of a remote file
function getRemoteFileLastModified($url) {
    $ch = curl_init($url);
    curl_setopt($ch, CURLOPT_NOBODY, true); // Fetch headers only
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_HEADER, true);
    curl_setopt($ch, CURLOPT_FILETIME, true);
    curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false); // Disable SSL verification if needed
    curl_setopt($ch, CURLOPT_FOLLOWLOCATION, true); // Follow redirects

    // Execute cURL request
    $headers = curl_exec($ch);
    $filetime = curl_getinfo($ch, CURLINFO_FILETIME);
    $http_code = curl_getinfo($ch, CURLINFO_HTTP_CODE);

    curl_close($ch);

    // Log the headers and extracted timestamp
    logMessage("HTTP Response Code: $http_code");
    logMessage("cURL Retrieved Headers for $url:\n" . print_r($headers, true));
    logMessage("Extracted Last-Modified for $url: " . ($filetime !== -1 ? date("Y-m-d H:i:s", $filetime) : "Unavailable"));

    return ($filetime !== -1) ? $filetime : 0;
}

?>
