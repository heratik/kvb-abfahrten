# Implementation Plan: KVB-App Ausbau

## Overview

Die App wird um komfortablere Favoritenverwaltung, robustere Offline-/Aktualisierungsfunktionen, bessere PWA-Eigenschaften, verständlichere Fehlerzustände und eine abschließende Qualitätsprüfung erweitert.

## Architekturentscheidungen

- Favoriten bleiben lokal in `localStorage`; die bestehende Normalisierung wird als zentrale Datenlogik weiterverwendet.
- Drag & Drop ergänzt die vorhandenen Auf-/Ab-Aktionen und bleibt per Tastatur sowie auf Touch-Geräten bedienbar.
- Die App nutzt progressive Verbesserung: Kernfunktionen funktionieren ohne neue externe Abhängigkeiten.
- Automatische Aktualisierung wird nur für geöffnete Abfahrten ausgeführt, um unnötige Netzwerklast zu vermeiden.

## Phasen und Aufgaben

### Phase 1: Favoriten und Kerninteraktionen

- [ ] Drag & Drop für Favoriten mit persistierter Reihenfolge
- [ ] Favorit direkt aus der Liste entfernen und optional umbenennen
- [ ] „In der Nähe“ automatisch nach Favoritenänderungen aktualisieren
- [ ] Checkpoint: Favoriten hinzufügen, doppelte Einträge verhindern, sortieren und entfernen

### Phase 2: Aktualisierung und Offline-Verhalten

- [ ] Automatische Aktualisierung geöffneter Favoriten verbessern
- [ ] Offline-/Cache-Zustände sichtbarer und verständlicher machen
- [ ] Netzwerk- und API-Fehler mit Retry-Aktion versehen
- [ ] Checkpoint: Online, Offline-Cache und Wiederholungsaktion prüfen

### Phase 3: Teilen und PWA

- [ ] Geteilte Links robust über Haltestellen-ID absichern
- [ ] PWA-Manifest und Service-Worker auf App-Icon, Start und Cache prüfen
- [ ] Installierbarkeit und Offline-Start verbessern

### Phase 4: Qualität und Zugänglichkeit

- [ ] Fokusführung, Tastaturbedienung und ARIA-Zustände prüfen
- [ ] Responsive Layout in Light-/Darkmode prüfen
- [ ] Test- und Smoke-Test-Hilfen ergänzen
- [ ] Abschlussprüfung mit Syntax-, HTTP- und Browser-Checks

## Offene Entscheidungen

- Keine: Für Umbenennen verwende ich eine kleine native Eingabe im Verwaltungsdialog; falls sich dabei eine UX-Frage ergibt, frage ich gezielt nach.

## Risiken

| Risiko | Mitigation |
|---|---|
| Drag & Drop kann Touch-/Tastaturbedienung verschlechtern | Auf-/Ab-Buttons beibehalten und sichtbare Drop-Ziele verwenden |
| Externe KVB-Daten können offline oder instabil sein | Bestehenden Cache nutzen, Retry anbieten, Fehler verständlich darstellen |
| Service-Worker kann alte Assets ausliefern | Versionsnummer erhöhen und Cache-Strategie kontrolliert aktualisieren |
