<?php
session_start();
require_once __DIR__ . '/db.php';

header('Access-Control-Allow-Origin: https://reacttf.org');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');
header('Access-Control-Allow-Credentials: true');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(204); exit; }

if (empty($_SESSION['admin'])) {
    http_response_code(401);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(['error' => 'Not authenticated.']);
    exit;
}

$csvPath  = __DIR__ . '/../static/data/pages.csv';
$jsonPath = __DIR__ . '/../static/data/pages.json';
$method   = $_SERVER['REQUEST_METHOD'];

function csvToJson(string $csvPath, string $jsonPath): void {
    $raw = trim(file_get_contents($csvPath));
    $rows = [];
    $len = strlen($raw);
    $i = 0;

    while ($i < $len) {
        $row = [];
        while ($i < $len) {
            $value = '';
            if ($raw[$i] === '"') {
                $i++;
                while ($i < $len) {
                    if ($raw[$i] === '"' && ($i + 1 < $len) && $raw[$i + 1] === '"') {
                        $value .= '"';
                        $i += 2;
                    } elseif ($raw[$i] === '"') {
                        $i++;
                        break;
                    } else {
                        $value .= $raw[$i];
                        $i++;
                    }
                }
            } else {
                while ($i < $len && $raw[$i] !== ',' && $raw[$i] !== "\n" && $raw[$i] !== "\r") {
                    $value .= $raw[$i];
                    $i++;
                }
            }
            $row[] = $value;
            if ($i < $len && $raw[$i] === ',') {
                $i++;
            } else {
                break;
            }
        }
        if ($i < $len && $raw[$i] === "\r") $i++;
        if ($i < $len && $raw[$i] === "\n") $i++;
        $rows[] = $row;
    }

    $header = array_shift($rows);
    $colIndex = [];
    foreach ($header as $idx => $name) {
        $colIndex[trim($name)] = $idx;
    }

    $pages = [];
    $currentSlug = null;

    foreach ($rows as $row) {
        $slug     = trim($row[$colIndex['slug']] ?? '');
        $category = trim($row[$colIndex['category']] ?? '');
        $titleKey = trim($row[$colIndex['titleKey']] ?? '');
        $intro    = trim($row[$colIndex['intro']] ?? '');
        $heading  = trim($row[$colIndex['sectionHeading']] ?? '');
        $paras    = trim($row[$colIndex['paragraphs']] ?? '');
        $list     = trim($row[$colIndex['list']] ?? '');

        if ($slug !== '') $currentSlug = $slug;
        if ($currentSlug === null) continue;

        if (!isset($pages[$currentSlug])) {
            $pages[$currentSlug] = [
                'category' => $category,
                'titleKey' => $titleKey,
                'intro'    => $intro,
                'sections' => [],
            ];
        } else {
            if ($category !== '') $pages[$currentSlug]['category'] = $category;
            if ($titleKey !== '') $pages[$currentSlug]['titleKey'] = $titleKey;
            if ($intro !== '')    $pages[$currentSlug]['intro']    = $intro;
        }

        if ($heading !== '') {
            $section = [
                'heading'    => $heading,
                'paragraphs' => $paras !== '' ? array_map('trim', explode('|', $paras)) : [],
            ];
            if ($list !== '') {
                $section['list'] = array_map('trim', explode('|', $list));
            }
            $pages[$currentSlug]['sections'][] = $section;
        }
    }

    $output = [
        '_comment' => 'Auto-generated from pages.csv — do not edit by hand. Run: npm run csv2json',
        'pages'    => (object) $pages,
    ];

    file_put_contents($jsonPath, json_encode($output, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE) . "\n");
}

if ($method === 'GET') {
    if (!file_exists($csvPath)) {
        http_response_code(404);
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode(['error' => 'pages.csv not found.']);
        exit;
    }
    header('Content-Type: text/csv; charset=utf-8');
    header('Content-Disposition: attachment; filename="pages.csv"');
    readfile($csvPath);

} elseif ($method === 'POST') {
    if (!isset($_FILES['csv']) || $_FILES['csv']['error'] !== UPLOAD_ERR_OK) {
        http_response_code(400);
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode(['error' => 'No file uploaded or upload error.']);
        exit;
    }

    $tmp = $_FILES['csv']['tmp_name'];
    $name = $_FILES['csv']['name'];

    if (pathinfo($name, PATHINFO_EXTENSION) !== 'csv') {
        http_response_code(400);
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode(['error' => 'Only .csv files are allowed.']);
        exit;
    }

    if (!move_uploaded_file($tmp, $csvPath)) {
        http_response_code(500);
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode(['error' => 'Failed to save file.']);
        exit;
    }

    csvToJson($csvPath, $jsonPath);

    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(['success' => true, 'message' => 'pages.csv and pages.json updated.']);

} else {
    http_response_code(405);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(['error' => 'Method not allowed.']);
}
