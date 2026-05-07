<?php
declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');

$host = 'localhost';
$dbname = 'perfume_shop';
$dbUser = 'root';
$dbPass = '';

try {
    $pdo = new PDO(
        "mysql:host={$host};dbname={$dbname};charset=utf8mb4",
        $dbUser,
        $dbPass,
        [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        ]
    );
} catch (PDOException $error) {
    http_response_code(500);
    echo json_encode([
        'status' => 'error',
        'message' => 'Không thể kết nối cơ sở dữ liệu.',
    ]);
    exit;
}

function getJsonInput(): object
{
    $raw = file_get_contents('php://input');
    $data = json_decode($raw ?: '{}');

    if (!is_object($data)) {
        http_response_code(400);
        echo json_encode([
            'status' => 'error',
            'message' => 'Dữ liệu gửi lên không hợp lệ.',
        ]);
        exit;
    }

    return $data;
}

function publicUser(array $user): array
{
    return [
        'name' => $user['name'],
        'email' => $user['email'],
        'points' => (int) $user['points'],
    ];
}
