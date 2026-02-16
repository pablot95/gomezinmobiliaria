<?php
// Headers CORS completos - DEBEN estar PRIMERO
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');
header('Access-Control-Max-Age: 86400'); // 24 horas

// Manejar preflight request (OPTIONS)
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

// Configuración
$target_dir = "uploads/";
if (!file_exists($target_dir)) {
    mkdir($target_dir, 0755, true);
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    if (isset($_FILES['image'])) {
        $file = $_FILES['image'];

        // Chequear errores de subida
        if ($file['error'] !== UPLOAD_ERR_OK) {
            $uploadErrors = [
                UPLOAD_ERR_INI_SIZE => 'El archivo excede el tamaño máximo permitido por el servidor.',
                UPLOAD_ERR_FORM_SIZE => 'El archivo es demasiado grande.',
                UPLOAD_ERR_PARTIAL => 'La subida fue interrumpida.',
                UPLOAD_ERR_NO_FILE => 'No se seleccionó ningún archivo.',
                UPLOAD_ERR_NO_TMP_DIR => 'Error de servidor: falta carpeta temporal.',
                UPLOAD_ERR_CANT_WRITE => 'Error de servidor: fallo al escribir.',
                UPLOAD_ERR_EXTENSION => 'Error de servidor: extensión PHP detuvo subida.'
            ];
            $msg = isset($uploadErrors[$file['error']]) ? $uploadErrors[$file['error']] : 'Error desconocido de subida.';
            http_response_code(400);
            echo json_encode(['error' => $msg]);
            exit;
        }
        
        // Allowed extensions
        $allowed = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'mp4', 'webm', 'mov', 'avi'];
        $extension = strtolower(pathinfo($file["name"], PATHINFO_EXTENSION));

        if (!in_array($extension, $allowed)) {
            http_response_code(400);
            echo json_encode(['error' => 'Tipo de archivo no permitido. Formatos válidos: ' . implode(', ', $allowed)]);
            exit;
        }
        
        // Verificar tamaño del archivo (150MB máximo)
        $maxSize = 150 * 1024 * 1024; // 150MB en bytes
        if ($file['size'] > $maxSize) {
            $sizeMB = round($file['size'] / (1024 * 1024), 2);
            http_response_code(400);
            echo json_encode(['error' => "El archivo es demasiado grande ({$sizeMB}MB). Máximo permitido: 150MB."]);
            exit;
        }

        // Basic check for images only (skip for videos)
        $videoExtensions = ['mp4', 'webm', 'mov', 'avi'];
        if (!in_array($extension, $videoExtensions)) {
            $check = getimagesize($file["tmp_name"]);
            if($check === false) {
                http_response_code(400);
                echo json_encode(['error' => 'El archivo no es una imagen válida.']);
                exit;
            }
        } else {
            // Log video upload attempt for debugging
            error_log("Uploading video: {$file['name']} - Size: " . round($file['size'] / (1024 * 1024), 2) . "MB");
        }

        // Generar nombre único
        $extension = pathinfo($file["name"], PATHINFO_EXTENSION);
        $fileName = time() . '_' . uniqid() . '.' . $extension;
        $target_file = $target_dir . $fileName;

        if (move_uploaded_file($file["tmp_name"], $target_file)) {
            // Construir URL pública
            $protocol = isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] === 'on' ? "https" : "http";
            $domain = $_SERVER['HTTP_HOST'];
            
            // Detección de subcarpeta (si el sitio no está en la raíz)
            $scriptDir = dirname($_SERVER['SCRIPT_NAME']);
            // Limpiar barras duplicadas o finales
            $path = rtrim($scriptDir, '/');
            
            $url = "$protocol://$domain$path/$target_file";
            
            echo json_encode(['success' => true, 'url' => $url]);
        } else {
            http_response_code(500);
            echo json_encode(['error' => 'Error al mover el archivo al directorio uploads.']);
        }
    } else {
        http_response_code(400);
        echo json_encode(['error' => 'No se recibió ninguna imagen.']);
    }
} else {
    http_response_code(405);
    echo json_encode(['error' => 'Método no permitido.']);
}
?>