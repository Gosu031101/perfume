<?php
declare(strict_types=1);

require __DIR__ . '/db.php';

$data = getJsonInput();
$email = strtolower(trim((string) ($data->email ?? '')));
$name = trim((string) ($data->name ?? ''));
$points = (int) ($data->points ?? 0);

if ($email === '') {
    http_response_code(400);
    echo json_encode([
        'status' => 'error',
        'message' => 'Thiếu email tài khoản.',
    ]);
    exit;
}

$stmt = $pdo->prepare(
    'UPDATE users SET name = COALESCE(NULLIF(:name, ""), name), points = :points WHERE email = :email'
);
$stmt->execute([
    ':name' => $name,
    ':points' => max(0, $points),
    ':email' => $email,
]);

if ($stmt->rowCount() === 0) {
    http_response_code(404);
    echo json_encode([
        'status' => 'error',
        'message' => 'Không tìm thấy tài khoản.',
    ]);
    exit;
}

$select = $pdo->prepare('SELECT name, email, points FROM users WHERE email = :email LIMIT 1');
$select->execute([':email' => $email]);

echo json_encode([
    'status' => 'success',
    'message' => 'Đã cập nhật điểm thành viên.',
    'user' => publicUser($select->fetch()),
]);
