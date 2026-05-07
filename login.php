<?php
declare(strict_types=1);

require __DIR__ . '/db.php';

$data = getJsonInput();
$email = strtolower(trim((string) ($data->email ?? '')));
$password = (string) ($data->password ?? '');

if ($email === '' || $password === '') {
    http_response_code(400);
    echo json_encode([
        'status' => 'error',
        'message' => 'Vui lòng nhập email và mật khẩu.',
    ]);
    exit;
}

$stmt = $pdo->prepare('SELECT name, email, password, points FROM users WHERE email = :email LIMIT 1');
$stmt->execute([':email' => $email]);
$user = $stmt->fetch();

if (!$user || !password_verify($password, $user['password'])) {
    http_response_code(401);
    echo json_encode([
        'status' => 'error',
        'message' => 'Email hoặc mật khẩu không đúng.',
    ]);
    exit;
}

echo json_encode([
    'status' => 'success',
    'message' => 'Đăng nhập thành công.',
    'user' => publicUser($user),
]);
