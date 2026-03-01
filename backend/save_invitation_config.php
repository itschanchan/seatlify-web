<?php
// 1. Prevent unwanted output (whitespace/errors)
ob_start();
ini_set('display_errors', 0); // Hide HTML errors from the response
error_reporting(E_ALL);       // Log errors internally

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

// Handle preflight OPTIONS request for CORS
if ($_SERVER['REQUEST_METHOD'] == 'OPTIONS') {
    exit(0);
}

$response = ['success' => false, 'message' => 'An unknown error occurred.'];

try {
    require_once 'db_connect.php';

    // Get raw POST data
    $input = file_get_contents("php://input");
    $data = json_decode($input, true);

    if (json_last_error() !== JSON_ERROR_NONE) {
        throw new Exception("Invalid JSON data received.", 400);
    }

    if (!isset($data['event_id']) || !isset($data['config'])) {
        throw new Exception("Missing event_id or config data.", 400);
    }

    $event_id = intval($data['event_id']);
    // Encode the config array back to a JSON string for storage
    $config_json = json_encode($data['config']);

    $sql = "UPDATE events SET invitation_config = ? WHERE event_id = ?";
    $stmt = $conn->prepare($sql);

    if ($stmt) {
        $stmt->bind_param("si", $config_json, $event_id);
        if ($stmt->execute()) {
            $response = ['success' => true, 'message' => 'Configuration saved.'];
        } else {
            throw new Exception('Execute failed: ' . $stmt->error, 500);
        }
        $stmt->close();
    } else {
        throw new Exception('Prepare failed: ' . $conn->error, 500);
    }
    $conn->close();

} catch (Exception $e) {
    $code = ($e->getCode() >= 400 && $e->getCode() < 600) ? $e->getCode() : 500;
    http_response_code($code);
    error_log("save_invitation_config error: " . $e->getMessage());
    $response = ['success' => false, 'message' => $e->getMessage()];
}

// Final cleanup and output of clean JSON
ob_end_clean();
echo json_encode($response);
?>