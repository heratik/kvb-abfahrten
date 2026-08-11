<?php
declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: public, max-age=300');

const KVB_STOPS_URL = 'https://www.kvb.koeln/qr/haltestellen/';

function respond(array $payload, int $status = 200): never
{
    http_response_code($status);
    echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

$query = trim((string) ($_GET['q'] ?? ''));
if (mb_strlen($query) < 2 || mb_strlen($query) > 100) {
    respond(['ok' => false, 'error' => 'Bitte mindestens zwei Suchzeichen übergeben'], 400);
}

$handle = curl_init(KVB_STOPS_URL);
curl_setopt_array($handle, [
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_CONNECTTIMEOUT => 5,
    CURLOPT_TIMEOUT => 12,
    CURLOPT_USERAGENT => 'Mozilla/5.0 KVB departure lookup',
    CURLOPT_REFERER => KVB_STOPS_URL,
]);
$html = curl_exec($handle);
$status = (int) curl_getinfo($handle, CURLINFO_HTTP_CODE);

if ($html === false || $status < 200 || $status >= 300) {
    respond(['ok' => false, 'error' => 'KVB-Haltestellenliste nicht erreichbar'], 502);
}

$html = mb_convert_encoding($html, 'UTF-8', 'Windows-1252');
preg_match_all("~href=['\"]?/qr/(\\d+)/['\"]?[^>]*>(.*?)</a>~si", $html, $matches, PREG_SET_ORDER);

$stops = [];
$needle = mb_strtolower($query);
foreach ($matches as $match) {
    $name = trim(html_entity_decode(strip_tags($match[2]), ENT_QUOTES | ENT_HTML5, 'UTF-8'));
    if ($name === '' || !str_contains(mb_strtolower($name), $needle)) {
        continue;
    }

    $stops[] = [
        'id' => $match[1],
        'name' => $name,
        'qrUrl' => 'https://www.kvb.koeln/qr/' . $match[1] . '/',
        'departuresUrl' => '/api/departures.php?name=' . rawurlencode('Köln ' . $name),
    ];

    if (count($stops) >= 20) {
        break;
    }
}

respond([
    'ok' => true,
    'query' => $query,
    'stops' => $stops,
]);
