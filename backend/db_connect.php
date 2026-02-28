<?php
$servername = "localhost";
$username = "root";
$password = "";
$dbname = "seatlify_db";

try {
    $conn = new mysqli($servername, $username, $password, $dbname);

    if ($conn->connect_error) {
        throw new Exception("Database connection failed");
    }

} catch (Exception $e) {
    die("Error: " . $e->getMessage());
}

?>