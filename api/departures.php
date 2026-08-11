<?php
declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');

const HAFAS_GATE_URL = 'https://auskunft.kvb.koeln/gate';
const HAFAS_AID = 'Rt6foY5zcTTRXMQs';

function respond(array $payload, int $status = 200): never
{
    http_response_code($status);
    echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function hafasRequest(string $locationId, string $locationName): array
{
    $request = [
        'ver' => '1.78',
        'lang' => 'deu',
        'auth' => [
            'type' => 'AID',
            'aid' => HAFAS_AID,
        ],
        'client' => [
            'id' => 'HAFAS',
            'type' => 'WEB',
            'name' => 'webapp',
            'l' => 'vs_webapp',
            'v' => 10008,
        ],
        'formatted' => false,
        'svcReqL' => [[
            'meth' => 'StationBoard',
            'req' => [
                'stbLoc' => [
                    ...($locationId !== '' ? ['lid' => $locationId] : ['name' => $locationName]),
                    'type' => 'S',
                ],
                'type' => 'DEP',
                'maxJny' => 20,
            ],
            'id' => '1|0|',
        ]],
    ];

    $handle = curl_init(HAFAS_GATE_URL);
    curl_setopt_array($handle, [
        CURLOPT_POST => true,
        CURLOPT_POSTFIELDS => json_encode($request, JSON_UNESCAPED_UNICODE),
        CURLOPT_HTTPHEADER => ['Content-Type: application/json'],
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_CONNECTTIMEOUT => 5,
        CURLOPT_TIMEOUT => 12,
    ]);

    $raw = curl_exec($handle);
    $error = curl_error($handle);
    $status = (int) curl_getinfo($handle, CURLINFO_HTTP_CODE);

    if ($raw === false || $status < 200 || $status >= 300) {
        respond([
            'ok' => false,
            'error' => 'KVB-Datenquelle nicht erreichbar',
            'details' => $error ?: 'HTTP ' . $status,
        ], 502);
    }

    $decoded = json_decode($raw, true);
    if (!is_array($decoded)) {
        respond(['ok' => false, 'error' => 'Ungültige Antwort der KVB-Datenquelle'], 502);
    }

    return $decoded;
}

function formatTime(string $date, string $time): string
{
    $hours = (int) substr($time, 0, 2);
    $minutes = substr($time, 2, 2);
    $seconds = substr($time, 4, 2);
    $dayOffset = intdiv($hours, 24);
    $hours %= 24;

    $dateTime = DateTimeImmutable::createFromFormat(
        '!Ymd H:i:s',
        sprintf('%s %02d:%s:%s', $date, $hours, $minutes, $seconds),
        new DateTimeZone('Europe/Berlin')
    );

    if ($dateTime === false) {
        return $date . ' ' . $time;
    }

    return $dateTime->modify('+' . $dayOffset . ' day')->format(DateTimeInterface::ATOM);
}

$locationId = trim((string) ($_GET['lid'] ?? ''));
 $locationName = trim((string) ($_GET['name'] ?? ''));
if (($locationId === '' && $locationName === '') || strlen($locationId) > 500 || strlen($locationName) > 200 || ($locationId !== '' && !str_starts_with($locationId, 'A=1@'))) {
    respond([
        'ok' => false,
    'error' => 'Bitte lid oder name als Haltestelle übergeben',
    ], 400);
}

$response = hafasRequest($locationId, $locationName);
$service = $response['svcResL'][0] ?? [];
$result = $service['res'] ?? [];

if (($service['err'] ?? $response['err'] ?? '') !== 'OK') {
    respond(['ok' => false, 'error' => 'Keine Abfahrten verfügbar'], 502);
}

$common = $result['common'] ?? [];
$products = $common['prodL'] ?? [];
$journeys = $result['jnyL'] ?? [];
$departures = [];

foreach ($journeys as $journey) {
    $stop = $journey['stbStop'] ?? [];
    $productRef = $journey['prodL'][0]['prodX'] ?? null;
    $product = $productRef !== null ? ($products[$productRef] ?? []) : [];
    $time = (string) ($stop['dTimeR'] ?? $stop['dTimeS'] ?? '');

    if (strlen($time) !== 6) {
        continue;
    }

    $scheduled = (string) ($stop['dTimeS'] ?? $time);
    $delay = null;
    if (strlen($scheduled) === 6 && $scheduled !== $time) {
        $scheduledSeconds = ((int) substr($scheduled, 0, 2) * 3600) + ((int) substr($scheduled, 2, 2) * 60) + (int) substr($scheduled, 4, 2);
        $realtimeSeconds = ((int) substr($time, 0, 2) * 3600) + ((int) substr($time, 2, 2) * 60) + (int) substr($time, 4, 2);
        $delay = (int) round(($realtimeSeconds - $scheduledSeconds) / 60);
    }

    $departures[] = [
        'line' => (string) ($product['name'] ?? ''),
        'direction' => (string) ($journey['dirTxt'] ?? ''),
        'platform' => (string) ($stop['dPltfR']['txt'] ?? $stop['dPltfS']['txt'] ?? ''),
        'time' => formatTime((string) ($journey['date'] ?? date('Ymd')), $time),
        'scheduledTime' => formatTime((string) ($journey['date'] ?? date('Ymd')), $scheduled),
        'delayMinutes' => $delay,
        'realtime' => ($stop['dProgType'] ?? '') === 'PROGNOSED',
    ];
}

respond([
    'ok' => true,
    'source' => 'KVB HAFAS StationBoard',
    'locationId' => $locationId ?: null,
    'locationName' => $locationName ?: null,
    'departures' => $departures,
]);
