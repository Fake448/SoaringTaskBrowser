<?php
require __DIR__ . '/CommonFunctions.php';

$taskID = $_GET['taskID'] ?? null;
$filename = $_GET['filename'] ?? null;

if (!$taskID || !$filename) {
    http_response_code(400);
    die("Missing parameters.");
}

$repositoryUrl = "https://siglr.com/DiscordPostHelper/TaskBrowser/Tasks/$taskID.dphx";
$tempDir = __DIR__ . '/DPHXTemp';
$taskFolder = $tempDir . "/$taskID";
$dphxFile = "$taskFolder/$taskID.dphx";

// Ensure the temp directory exists
if (!file_exists($tempDir)) {
    mkdir($tempDir, 0755, true);
}

// Check if the task folder exists
if (!file_exists($taskFolder)) {
    mkdir($taskFolder, 0755, true);
    
    // Download the DPHX file
    $dphxContent = @file_get_contents($repositoryUrl);
    if ($dphxContent === false) {
        http_response_code(404);
        die("DPHX file not found in repository.");
    }

    file_put_contents($dphxFile, $dphxContent);

    // Extract the DPHX file
    $zip = new ZipArchive();
    if ($zip->open($dphxFile) === TRUE) {
        $zip->extractTo($taskFolder);
        $zip->close();
    } else {
        http_response_code(500);
        die("Failed to extract DPHX file.");
    }
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
    exit;
} else {
    http_response_code(404);
    die("Requested file not found.");
}

// Function to clean up old folders
function cleanupOldTempFolders($tempDir) {
    foreach (glob("$tempDir/*") as $folder) {
        if (is_dir($folder) && time() - filemtime($folder) > 48 * 3600) {
            array_map('unlink', glob("$folder/*"));
            rmdir($folder);
        }
    }
}
?>
