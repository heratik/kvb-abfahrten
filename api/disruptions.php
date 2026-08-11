<?php
declare(strict_types=1);
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: public, max-age=300');

$handle = curl_init('https://www.kvb.cologne/fahrtinfo/betriebslage/index.html');
curl_setopt_array($handle, [CURLOPT_RETURNTRANSFER => true, CURLOPT_CONNECTTIMEOUT => 5, CURLOPT_TIMEOUT => 15, CURLOPT_USERAGENT => 'KVB departure app']);
$html = curl_exec($handle); $status = (int) curl_getinfo($handle, CURLINFO_HTTP_CODE);
if ($html === false || $status < 200 || $status >= 300) { http_response_code(502); echo json_encode(['ok'=>false,'error'=>'KVB-Störungsseite nicht erreichbar']); exit; }
$html = iconv('Windows-1252', 'UTF-8//IGNORE', $html);
preg_match_all('~<li[^>]*class="[^"]*list-group-item[^\"]*"[^>]*>.*?<h3[^>]*class="liniennummer"[^>]*>(.*?)</h3>.*?<b>(.*?)</b>~si', $html, $matches, PREG_SET_ORDER);
$items = [];
foreach ($matches as $match) {
    $line = trim(strip_tags($match[1]));
    $text = trim(html_entity_decode(strip_tags($match[2]), ENT_QUOTES | ENT_HTML5, 'UTF-8'));
    if ($line !== '' && $text !== '') $items[] = ['line'=>$line, 'text'=>$text];
}
echo json_encode(['ok'=>true,'items'=>$items], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
