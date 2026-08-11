<?php
declare(strict_types=1);
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: public, max-age=300');

$lat = filter_var($_GET['lat'] ?? null, FILTER_VALIDATE_FLOAT);
$lon = filter_var($_GET['lon'] ?? null, FILTER_VALIDATE_FLOAT);
if ($lat === false || $lon === false || $lat < -90 || $lat > 90 || $lon < -180 || $lon > 180) {
    http_response_code(400); echo json_encode(['ok'=>false,'error'=>'Ungültige Koordinaten']); exit;
}

$handle = curl_init('https://data.webservice-kvb.koeln/service/opendata/haltestellen/json');
curl_setopt_array($handle, [CURLOPT_RETURNTRANSFER => true, CURLOPT_CONNECTTIMEOUT => 5, CURLOPT_TIMEOUT => 15]);
$json = curl_exec($handle);
$status = (int) curl_getinfo($handle, CURLINFO_HTTP_CODE);
if ($json === false || $status < 200 || $status >= 300) $json = null;
$json = is_string($json) ? iconv('Windows-1252', 'UTF-8//IGNORE', $json) : null;
$data = is_string($json) ? json_decode($json, true, 512, JSON_INVALID_UTF8_SUBSTITUTE) : null;
if (!is_array($data)) { http_response_code(502); echo json_encode(['ok'=>false,'error'=>'KVB-Haltestellen nicht erreichbar']); exit; }

$stops = [];
foreach (($data['features'] ?? []) as $feature) {
    $coords = $feature['geometry']['coordinates'] ?? [];
    $name = trim((string)($feature['properties']['Name'] ?? ''));
    if (count($coords) < 2 || $name === '') continue;
    $dLat = deg2rad((float)$coords[1] - $lat); $dLon = deg2rad((float)$coords[0] - $lon);
    $a = sin($dLat / 2) ** 2 + cos(deg2rad($lat)) * cos(deg2rad((float)$coords[1])) * sin($dLon / 2) ** 2;
    $distance = 6371000 * 2 * asin(sqrt($a));
    $key = mb_strtolower($name);
    if (!isset($stops[$key]) || $distance < $stops[$key]['distance']) {
        $stops[$key] = ['name'=>$name, 'distance'=>$distance, 'lat'=>(float)$coords[1], 'lon'=>(float)$coords[0]];
    }
}
$stops = array_values($stops);
usort($stops, fn($a, $b) => $a['distance'] <=> $b['distance']);
echo json_encode(['ok'=>true,'stops'=>array_slice($stops, 0, 8)], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
