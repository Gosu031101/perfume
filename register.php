<?php
declare(strict_types=1);

require __DIR__ . '/db.php';

$data = getJsonInput();
$name = trim((string) ($data->name ?? ''));
$email = strtolower(trim((string) ($data->email ?? '')));
$password = (string) ($data->password ?? '');

if ($name === '' || $email === '' || $password === '') {
    http_response_code(400);
    echo json_encode([
        'status' => 'error',
        'message' => 'Vui lòng nhập đủ họ tên, email và mật khẩu.',
    ]);
    exit;
}

if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
    http_response_code(400);
    echo json_encode([
        'status' => 'error',
        'message' => 'Email không hợp lệ.',
    ]);
    exit;
}

if (strlen($password) < 6) {
    http_response_code(400);
    echo json_encode([
        'status' => 'error',
        'message' => 'Mật khẩu cần ít nhất 6 ký tự.',
    ]);
    exit;
}

try {
    $stmt = $pdo->prepare(
        'INSERT INTO users (name, email, password, points) VALUES (:name, :email, :password, 0)'
    );
    $stmt->execute([
        ':name' => $name,
        ':email' => $email,
        ':password' => password_hash($password, PASSWORD_DEFAULT),
    ]);

    echo json_encode([
        'status' => 'success',
        'message' => 'Đăng ký thành công.',
        'user' => [
            'name' => $name,
            'email' => $email,
            'points' => 0,
        ],
    ]);
} catch (PDOException $error) {
    http_response_code(409);
    echo json_encode([
        'status' => 'error',
        'message' => 'Email này đã được đăng ký.',
    ]);
}
