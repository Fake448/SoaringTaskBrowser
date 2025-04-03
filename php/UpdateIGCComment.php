<?php
require __DIR__ . '/CommonFunctions.php';

header('Content-Type: application/json');

try {
    // Check required POST parameters.
    if (!isset($_POST['IGCKey']) || trim($_POST['IGCKey']) === "") {
        throw new Exception("Missing required field: IGCKey");
    }
    if (!isset($_POST['Comment'])) {
        throw new Exception("Missing required field: Comment");
    }
    
    $IGCKey = trim($_POST['IGCKey']);
    $newComment = trim($_POST['Comment']);
    
    // Open the database connection.
    $pdo = new PDO("sqlite:$databasePath");
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    
    // Optionally, you could check here if a record with the given IGCKey exists.
    // For brevity, we proceed directly to update.
    
    $updateQuery = "UPDATE IGCRecords SET Comment = :comment WHERE IGCKey = :igcKey";
    $stmt = $pdo->prepare($updateQuery);
    $stmt->bindParam(':comment', $newComment, PDO::PARAM_STR);
    $stmt->bindParam(':igcKey', $IGCKey, PDO::PARAM_STR);
    $stmt->execute();
    
    echo json_encode([
        'status' => 'success',
        'message' => 'IGC comment updated successfully.',
        'IGCKey' => $IGCKey,
        'Comment' => $newComment
    ]);
    
} catch (Exception $e) {
    echo json_encode(['error' => $e->getMessage()]);
    exit;
}
?>
