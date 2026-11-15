<?php
session_start();
require_once __DIR__ . '/db.php';

header('Content-Type: application/json; charset=utf-8');

$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    echo json_encode(['authenticated' => !empty($_SESSION['admin'])]);

} elseif ($method === 'POST') {
    $input = json_decode(file_get_contents('php://input'), true);
    $user = trim($input['username'] ?? '');
    $pass = $input['password'] ?? '';

    if ($user === ADMIN_USER && $pass === ADMIN_PASS) {
        $_SESSION['admin'] = true;
        echo json_encode(['authenticated' => true]);
    } else {
        http_response_code(401);
        echo json_encode(['error' => 'Invalid username or password.']);
    }

} elseif ($method === 'DELETE') {
    session_destroy();
    echo json_encode(['authenticated' => false]);

} else {
    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed.']);
}
