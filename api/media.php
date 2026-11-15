<?php
require_once __DIR__ . '/db.php';

header('Content-Type: application/json; charset=utf-8');

$method = $_SERVER['REQUEST_METHOD'];

try {
    $pdo = getDB();

    if ($method === 'GET') {
        $stmt = $pdo->query('SELECT id, publication, article, media_url, release_date FROM media ORDER BY release_date DESC');
        echo json_encode($stmt->fetchAll());

    } elseif ($method === 'POST') {
        $input = json_decode(file_get_contents('php://input'), true);

        $publication = trim($input['publication'] ?? '');
        $article     = trim($input['article'] ?? '');
        $mediaUrl    = trim($input['media_url'] ?? '');
        $releaseDate = trim($input['release_date'] ?? '');

        if ($publication === '' || $article === '' || $mediaUrl === '' || $releaseDate === '') {
            http_response_code(400);
            echo json_encode(['error' => 'All fields are required.']);
            exit;
        }

        $stmt = $pdo->prepare('INSERT INTO media (publication, article, media_url, release_date) VALUES (?, ?, ?, ?)');
        $stmt->execute([$publication, $article, $mediaUrl, $releaseDate]);

        http_response_code(201);
        echo json_encode([
            'id'           => (int) $pdo->lastInsertId(),
            'publication'  => $publication,
            'article'      => $article,
            'media_url'    => $mediaUrl,
            'release_date' => $releaseDate,
        ]);

    } elseif ($method === 'DELETE') {
        $id = filter_input(INPUT_GET, 'id', FILTER_VALIDATE_INT);
        if (!$id) {
            http_response_code(400);
            echo json_encode(['error' => 'Valid id is required.']);
            exit;
        }

        $stmt = $pdo->prepare('DELETE FROM media WHERE id = ?');
        $stmt->execute([$id]);

        if ($stmt->rowCount() === 0) {
            http_response_code(404);
            echo json_encode(['error' => 'Entry not found.']);
        } else {
            echo json_encode(['deleted' => $id]);
        }

    } else {
        http_response_code(405);
        echo json_encode(['error' => 'Method not allowed.']);
    }

} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['error' => 'Database error.']);
}
