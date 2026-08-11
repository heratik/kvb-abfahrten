# KVB Abfahrten

Eine schnelle, mobile Web-App für aktuelle Abfahrten an Kölner KVB-Haltestellen.

Die App konzentriert sich auf die eine Frage, die unterwegs zählt: **Wann fährt meine Bahn oder mein Bus?** Favorisierte Haltestellen lassen sich direkt öffnen, nach Linienrichtung filtern und mit anderen teilen.

## Funktionen

- aktuelle Abfahrten mit Countdown und Uhrzeit
- Echtzeit- oder Fahrplanstatus der Verbindung
- Verspätungen und Steig/Gleis, sofern von der KVB geliefert
- Richtungsfilter bei mehreren Zielen
- Favoriten speichern, umbenennen, sortieren und entfernen
- Haltestellen suchen und neue Favoriten hinzufügen
- Haltestellen in der Nähe per Gerätestandort finden
- Abfahrten einer Haltestelle über einen Link teilen
- aktuelle KVB-Störungen aufrufen
- automatische Aktualisierung geöffneter Abfahrten
- letzter bekannter Datenstand als Offline-Fallback
- Light- und Darkmode
- installierbare Progressive Web App (PWA)

## Technischer Überblick

Das Projekt ist bewusst schlank gehalten und kommt ohne Frontend-Framework oder Build-Schritt aus:

- **Frontend:** HTML, CSS und modernes Vanilla JavaScript
- **Backend:** kleine PHP-API-Endpunkte als Proxy für KVB-/HAFAS-Daten
- **Offline:** Service Worker plus lokaler Abfahrts-Cache
- **Speicher:** Favoriten und Theme-Einstellung im `localStorage`
- **Deployment:** für einen PHP-fähigen Webserver geeignet

Die API-Endpunkte liegen unter [`api/`](api/):

- [`stops.php`](api/stops.php) – Haltestellen suchen
- [`departures.php`](api/departures.php) – Abfahrten laden
- [`nearby.php`](api/nearby.php) – Haltestellen in der Nähe
- [`disruptions.php`](api/disruptions.php) – Störungsmeldungen

## Lokal starten

Da die PHP-Endpunkte benötigt werden, sollte die App über einen lokalen PHP-Server gestartet werden:

```bash
php -S localhost:8080
```

Danach im Browser öffnen:

<http://localhost:8080>

Für die Standortsuche muss der Browser einen sicheren Kontext verwenden. `localhost` wird dafür von modernen Browsern normalerweise akzeptiert.

## Daten und Datenschutz

Die App speichert Favoriten und die gewählte Darstellung lokal im Browser. Für die Abfahrts-, Such- und Störungsdaten werden Anfragen an die im Backend konfigurierten KVB-Dienste gestellt. Die Standortsuche verwendet die Browser-Geolocation-API und wird nur nach Zustimmung des Nutzers ausgeführt.

## Projektstatus

Die Kernfunktionen für Suche, Favoriten, Abfahrten, Umgebungssuche, Störungen, Teilen und PWA-Betrieb sind umgesetzt. Als nächste Qualitätsstufe stehen insbesondere weitere Accessibility-Prüfungen sowie Browser- und Smoke-Tests an.

## Lizenz

Für dieses Projekt ist aktuell keine separate Lizenzdatei hinterlegt.

---

Made with ♥ in Cologne by [ekrem.eu](https://ekrem.eu)
