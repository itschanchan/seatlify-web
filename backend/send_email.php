<?php
// 1. Prevent unwanted output (whitespace/errors)
ob_start();
ini_set('display_errors', 0); // Hide HTML errors from the response
error_reporting(E_ALL);       // Log errors internally

// Set headers for JSON response and CORS
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *'); // Allows requests from any origin (like port 5500)
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

// Handle preflight OPTIONS request for CORS
if ($_SERVER['REQUEST_METHOD'] == 'OPTIONS') {
    exit(0);
}

$response = ['success' => false, 'message' => 'An unknown error occurred.'];

try {
    // Get raw POST data from the fetch request
    $input = file_get_contents("php://input");
    $data = json_decode($input, true);

    // Validate the incoming JSON
    if (json_last_error() !== JSON_ERROR_NONE) {
        throw new Exception("Invalid JSON data received.");
    }

    // Extract data sent from the frontend
    $to = $data['to'] ?? null;
    $eventTitle = $data['eventTitle'] ?? 'Your Event';
    $eventDate = $data['eventDate'] ?? '';
    $link = $data['link'] ?? null;
    $type = $data['type'] ?? 'invitation';

    if (!$to || !filter_var($to, FILTER_VALIDATE_EMAIL)) {
        throw new Exception("A valid recipient email address is required.");
    }
    if (!$link) {
        throw new Exception("An invitation link is required.");
    }

    // --- Build the Email ---
    $subject = "You're invited to: " . $eventTitle;
    $formattedDate = $eventDate ? date('F j, Y \a\t g:i A', strtotime($eventDate)) : 'an upcoming event';

    // Basic HTML email template
    $body = "
        <html>
        <body style='font-family: sans-serif; color: #333;'>
            <div style='max-width: 600px; margin: auto; padding: 20px; border: 1px solid #ddd; border-radius: 8px;'>
                <h2 style='color: #0d6efd;'>You're Invited!</h2>
                <p>You have been invited to the following event:</p>
                <h3 style='margin-bottom: 0;'>{$eventTitle}</h3>
                <p style='margin-top: 5px; color: #6c757d;'>Scheduled for {$formattedDate}</p>
                <p>Please click the link below to view the full invitation and RSVP.</p>
                <p style='text-align: center;'>
                    <a href='{$link}' style='display: inline-block; padding: 12px 25px; background-color: #0d6efd; color: #fff; text-decoration: none; border-radius: 5px;'>View Invitation</a>
                </p>
                <hr style='border: none; border-top: 1px solid #eee; margin: 20px 0;'/>
                <p style='font-size: 0.8em; color: #999;'>This email was sent from Seatlify.</p>
            </div>
        </body>
        </html>
    ";

    $headers = "MIME-Version: 1.0" . "\r\n";
    $headers .= "Content-type:text/html;charset=UTF-8" . "\r\n";
    $headers .= 'From: <no-reply@seatlify.com>' . "\r\n"; // It's good practice to set a From address

    // --- Send the Email ---
    if (mail($to, $subject, $body, $headers)) {
        $response = ['success' => true, 'message' => 'Email sent successfully.'];
    } else {
        throw new Exception('PHP mail() function failed. Please ensure your server (XAMPP) is configured to send emails.');
    }

} catch (Exception $e) {
    http_response_code(400); // Set a "Bad Request" status for client-side errors
    $response = ['success' => false, 'message' => $e->getMessage()];
}

// Final cleanup and output of clean JSON
ob_end_clean();
echo json_encode($response);
?>