<?php
// save.php - Sube este archivo a tu webhost junto con data.json
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Headers: Content-Type");
header("Content-Type: application/json");

// 1. Configura tu contraseña aquí
$SECRET_KEY = "Carlos145";

// 2. Leer datos recibidos
$input = file_get_contents("php://input");
$data = json_decode($input, true);

// 3. Verificaciones de seguridad
if (!$data) {
    echo json_encode(["status" => "error", "message" => "No data received"]);
    exit;
}

if (!isset($data['secret']) || $data['secret'] !== $SECRET_KEY) {
    http_response_code(403);
    echo json_encode(["status" => "error", "message" => "Contrasena incorrecta"]);
    exit;
}

// 4. Guardar archivo (quitamos la contraseña antes de guardar)
unset($data['secret']);
$jsonString = json_encode($data, JSON_PRETTY_PRINT);

if (file_put_contents(__DIR__ . "/data.json", $jsonString)) {
    echo json_encode(["status" => "success", "message" => "Datos actualizados correctamente"]);
} else {
    echo json_encode(["status" => "error", "message" => "Error escribiendo archivo. Verifica permisos (CHMOD 777 o 664) en data.json"]);
}
?>