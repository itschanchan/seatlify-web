<?php
/*
 * Database Setup Script for Seatlify
 * Run this script once to initialize the database and tables.
 */

$servername = "localhost";
$username = "root";
$password = ""; // Default XAMPP password is empty
$dbname = "seatlify_db";

// 1. Create Connection
$conn = new mysqli($servername, $username, $password);

// Check connection
if ($conn->connect_error) {
    die("Connection failed: " . $conn->connect_error);
}

// 2. Create Database
$sql = "CREATE DATABASE IF NOT EXISTS $dbname";
if ($conn->query($sql) === TRUE) {
    echo "Database '$dbname' created successfully (or already exists).<br>";
} else {
    die("Error creating database: " . $conn->error);
}

// 3. Select Database
$conn->select_db($dbname);

// 4. Define Table Schemas (Order matters for Foreign Keys)
$tables = [
    // USERS (Dependency for Organizations, Events, Orders)
    "users" => "CREATE TABLE IF NOT EXISTS users (
        user_id BIGINT AUTO_INCREMENT PRIMARY KEY,
        username VARCHAR(50) UNIQUE NOT NULL,
        email VARCHAR(100) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        first_name VARCHAR(50),
        last_name VARCHAR(50),
        role ENUM('admin', 'organizer', 'user') DEFAULT 'user',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )",

    // ORGANIZATIONS
    "organizations" => "CREATE TABLE IF NOT EXISTS organizations (
        organization_id BIGINT AUTO_INCREMENT PRIMARY KEY,
        owner_user_id BIGINT NOT NULL,
        org_name VARCHAR(150) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (owner_user_id) REFERENCES users(user_id)
    )",

    // ORGANIZATION MEMBERS
    "organization_members" => "CREATE TABLE IF NOT EXISTS organization_members (
        id BIGINT AUTO_INCREMENT PRIMARY KEY,
        organization_id BIGINT NOT NULL,
        user_id BIGINT NOT NULL,
        role ENUM('owner','admin','staff') NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE (organization_id, user_id),
        FOREIGN KEY (organization_id) REFERENCES organizations(organization_id),
        FOREIGN KEY (user_id) REFERENCES users(user_id)
    )",

    // VENUES
    "venues" => "CREATE TABLE IF NOT EXISTS venues (
        venue_id BIGINT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(150),
        address VARCHAR(255),
        city VARCHAR(100),
        province VARCHAR(100),
        capacity INT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )",

    // EVENTS
    "events" => "CREATE TABLE IF NOT EXISTS events (
        event_id BIGINT AUTO_INCREMENT PRIMARY KEY,
        organization_id BIGINT NOT NULL,
        venue_id BIGINT NOT NULL,
        title VARCHAR(200),
        description TEXT,
        start_datetime DATETIME,
        end_datetime DATETIME,
        status ENUM('draft','published','completed','cancelled') DEFAULT 'draft',
        created_by BIGINT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        
        -- Fields for seat planner and invitations, often from mock DB
        attendees INT,
        layout_preference VARCHAR(50),
        total_seats INT,
        total_tables INT,
        is_paid BOOLEAN DEFAULT FALSE,
        invitation_config JSON,
        blueprint_layout JSON,
        tickets JSON,
        row_layout_data JSON,
        table_layout_data JSON,

        FOREIGN KEY (organization_id) REFERENCES organizations(organization_id),
        FOREIGN KEY (venue_id) REFERENCES venues(venue_id),
        FOREIGN KEY (created_by) REFERENCES users(user_id)
    )",

    // TICKET TYPES
    "ticket_types" => "CREATE TABLE IF NOT EXISTS ticket_types (
        ticket_type_id BIGINT AUTO_INCREMENT PRIMARY KEY,
        event_id BIGINT NOT NULL,
        name VARCHAR(100),
        price DECIMAL(10,2),
        quantity_total INT,
        sale_start DATETIME,
        sale_end DATETIME,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (event_id) REFERENCES events(event_id)
    )",

    // SEATS
    "seats" => "CREATE TABLE IF NOT EXISTS seats (
        seat_id BIGINT AUTO_INCREMENT PRIMARY KEY,
        event_id BIGINT NOT NULL,
        seat_label VARCHAR(10),
        seat_row VARCHAR(10),
        seat_column VARCHAR(10),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE (event_id, seat_row, seat_column),
        FOREIGN KEY (event_id) REFERENCES events(event_id)
    )",

    // ORDERS
    "orders" => "CREATE TABLE IF NOT EXISTS orders (
        order_id BIGINT AUTO_INCREMENT PRIMARY KEY,
        user_id BIGINT NOT NULL,
        event_id BIGINT NOT NULL,
        total_amount DECIMAL(10,2),
        status ENUM('pending','paid','cancelled') DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(user_id),
        FOREIGN KEY (event_id) REFERENCES events(event_id)
    )",

    // ISSUED TICKETS
    "tickets" => "CREATE TABLE IF NOT EXISTS tickets (
        ticket_id BIGINT AUTO_INCREMENT PRIMARY KEY,
        order_id BIGINT NOT NULL,
        ticket_type_id BIGINT NOT NULL,
        seat_id BIGINT NULL,
        qr_code VARCHAR(255),
        status ENUM('active','used','cancelled') DEFAULT 'active',
        checkin_time DATETIME NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (order_id) REFERENCES orders(order_id),
        FOREIGN KEY (ticket_type_id) REFERENCES ticket_types(ticket_type_id),
        FOREIGN KEY (seat_id) REFERENCES seats(seat_id)
    )",

    // PAYMENTS
    "payments" => "CREATE TABLE IF NOT EXISTS payments (
        payment_id BIGINT AUTO_INCREMENT PRIMARY KEY,
        order_id BIGINT NOT NULL,
        amount DECIMAL(10,2),
        currency VARCHAR(10),
        payment_provider ENUM('stripe','paymongo','gcash'),
        payment_status ENUM('pending','paid','failed','refunded'),
        transaction_ref VARCHAR(255),
        paid_at DATETIME NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (order_id) REFERENCES orders(order_id)
    )"
];

// 5. Execute Queries
foreach ($tables as $tableName => $sql) {
    if ($conn->query($sql) === TRUE) {
        echo "Table '$tableName' checked/created successfully.<br>";
    } else {
        echo "Error creating table '$tableName': " . $conn->error . "<br>";
    }
}

$conn->close();
echo "<br><strong>Database setup completed!</strong>";
?>