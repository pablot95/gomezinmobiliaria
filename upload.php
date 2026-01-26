<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *'); 

// Configuración
$target_dir = "uploads/";
if (!file_exists($target_dir)) {
    mkdir($target_dir, 0755, true);
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    if (isset($_FILES['image'])) {
        $file = $_FILES['image'];
        
        // Allowed extensions
        $allowed = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'mp4', 'webm', 'mov'];
        $extension = strtolower(pathinfo($file["name"], PATHINFO_EXTENSION));

        if (!in_array($extension, $allowed)) {
            http_response_code(400);
            echo json_encode(['error' => 'Tipo de archivo no permitido.']);
            exit;
        }

        // Basic check for images only (skip for videos)
        $videoExtensions = ['mp4', 'webm', 'mov'];
        if (!in_array($extension, $videoExtensions)) {
            $check = getimagesize($file["tmp_name"]);
            if($check === false) {
                http_response_code(400);
                echo json_encode(['error' => 'El archivo no es una imagen válida.']);
                exit;
            }
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