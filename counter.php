<?php
// header("Access-Control-Allow-Origin: *"); // Server likely sets this already
header("Access-Control-Allow-Headers: Content-Type");
header("Content-Type: application/json");

/* 
  Sistema simple de conteo de visitas
  Guarda un número plano en visits.txt
*/

$file = __DIR__ . '/visits.txt';

// Acción solicitada (get = leer, add = sumar)
$action = isset($_GET['action']) ? $_GET['action'] : 'add';

// Leer contador actual
$current = 0;
if (file_exists($file)) {
  $current = (int) file_get_contents($file);
}

if ($action === 'add') {
  // Protección simple contra Spam (Opcional - solo IPs unicas por sesion PHP)
  // session_start();
  // if (!isset($_SESSION['counted'])) {
  $current++;
  file_put_contents($file, $current);
  //     $_SESSION['counted'] = true;
  // }
}

echo json_encode(["status" => "success", "count" => $current]);
?>