<?php
// 1. Prevent unwanted output (whitespace/errors)
ob_start();
ini_set('display_errors', 0); // Hide HTML errors
error_reporting(E_ALL);       // Still log errors internally

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *'); // Allow access from other devices/ports
header('Access-Control-Allow-Methods: GET');

$response = ['success' => false, 'message' => 'Unknown error'];

try {
    // 2. Check if file exists before requiring
    if (!file_exists('db_connection.php')) {
        throw new Exception("Database configuration missing.");
    }
    require_once 'db_connect.php';

    if (!isset($conn) || $conn->connect_error) {
        throw new Exception("Database connection failed.");
    }

    $event_id = isset($_GET['event_id']) ? intval($_GET['event_id']) : 0;

    if ($event_id <= 0) {
        throw new Exception("Invalid Event ID");
    }

    $sql = "SELECT e.*, v.name AS venue_name, v.address AS venue_address 
            FROM events e 
            LEFT JOIN venues v ON e.venue_id = v.venue_id 
            WHERE e.event_id = ?";

    $stmt = $conn->prepare($sql);
    if (!$stmt) {
        throw new Exception("Database error: " . $conn->error);
    }

    $stmt->bind_param("i", $event_id);
    $stmt->execute();
    $result = $stmt->get_result();

    if ($row = $result->fetch_assoc()) {
        // 3. Safely decode JSON fields
        $row['invitation_config'] = isset($row['invitation_config']) ? json_decode($row['invitation_config']) : null;
        $row['blueprint_layout'] = isset($row['blueprint_layout']) ? json_decode($row['blueprint_layout']) : [];
        $row['tickets'] = isset($row['tickets']) ? json_decode($row['tickets']) : [];
        $row['row_layout_data'] = isset($row['row_layout_data']) ? json_decode($row['row_layout_data']) : [];
        $row['table_layout_data'] = isset($row['table_layout_data']) ? json_decode($row['table_layout_data']) : [];

        $response = ['success' => true, 'event' => $row];
    } else {
        $response = ['success' => false, 'message' => 'Event not found'];
    }
    $stmt->close();
    $conn->close();

} catch (Exception $e) {
    $response = ['success' => false, 'message' => $e->getMessage()];
}

// 4. Output clean JSON
ob_end_clean();
echo json_encode($response);
?>