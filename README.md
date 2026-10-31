# EVA-Werkstatt – das EVA-Prinzip in 3D

Eine 3D-Simulation (Three.js) für den Informatikunterricht: Die Schülerinnen und Schüler sitzen an einem virtuellen
Schreibtisch mit einem Computer. Nach und nach tauchen Geräte auf. Sie werden **eingesteckt**, am Computer
**ausprobiert** und danach in Kartons **Eingabe / Verarbeitung / Ausgabe** **einsortiert**.

Die Simulation ersetzt den Stationsaufbau mit echter Hardware aus
[eva-mouse](https://github.com/HansTydecks/eva-mouse), [eva-keyboard](https://github.com/HansTydecks/eva-keyboard),
[eva-mic](https://github.com/HansTydecks/eva-mic), [eva-camera](https://github.com/HansTydecks/eva-camera),
[eva-barcode](https://github.com/HansTydecks/eva-barcode) und eva-touch. Es wird **keine** Webcam- oder
Mikrofon-Freigabe benötigt – alles passiert virtuell.

## Ablauf

| Station | Gerät(e) | Aufgabe am Computer |
|---|---|---|
| Tutorial | – | Tasse greifen, zu den Kartons schauen |
| 1 | Bildschirm (HDMI, gelb) | einstecken → Computer startet |
| 2 | Maus (USB, blau) | Memory mit dem Mauszeiger |
| 3 | Tastatur (USB) | „HALLO COMPUTER“ auf der echten Tastatur tippen |
| 4 | Lautsprecher (grün) + Barcode-Scanner (USB) | Kasse: Cola, Milch, Schokolade und Saft scannen → Ware, Preis und Summe am Bildschirm |
| 5 | MIDI-Keyboard (USB) | Tonleiter C D E F G A H C spielen (nächste Taste leuchtet), danach freiwillig „Alle meine Entchen“ |
| 6 | Studiomikrofon (rosa) | ein C „singen“ (Leertaste halten, Mausrad = Tonhöhe) |
| 7 | Webcam + Drucker (USB) | Foto mit Filter aufnehmen und ausdrucken |
| 8 | Touchscreen (USB-C, lila) | Tippen (Blasen), Wischen (Fotos), Ziehen (Formen) – Eingabe **und** Ausgabe |
| Finale | Maus, Tastatur, Lautsprecher, Bildschirm, Computer | alles einsortieren, Abschluss-Übersicht |

Nach jeder Station zeigt eine EVA-Leiste, was Eingabe, Verarbeitung und Ausgabe waren. Danach wird das Gerät
einsortiert. Falsch einsortierte Geräte hüpfen mit einer Erklärung aus dem Karton zurück.

## Physik-Spaß

- Die Kaffeetasse kann umkippen – dann läuft der Kaffee aus und bildet Pfützen (auf Geräten gibt es Funken).
  Steht sie wieder eine Weile, wird nachgefüllt.
- Der Kaktus zerbricht, wenn er vom Tisch fällt oder gegen die Wand fliegt. Kurz darauf steht ein neuer da.
- Alles, was auf den Boden fällt, wird nach einer Sekunde zurück auf den Tisch gestellt.
- Vor dem großen Fenster fliegen Vögel, ein Heißluftballon und ein Flugzeug mit EVA-Banner vorbei; die Wanduhr zeigt die echte Uhrzeit.

## Bedienung

- **Linke Maustaste halten**: greifen · **loslassen**: ablegen oder werfen
- **Mausrad**: gehaltenen Gegenstand drehen (z. B. die Webcam ausrichten)
- **Bildschirmrand** oder **◀ Kartons / Tisch ▶**: umschauen
- **Auf die eingesteckte Maus klicken**: Hand liegt auf der Maus, der Zeiger am Monitor bewegt sich mit;
  **Rechtsklick / Esc**: Maus loslassen
- **?** oben rechts: Byte wiederholt die Aufgabe und eine Geisterhand zeigt, was zu tun ist.
  Nach einiger Zeit ohne Fortschritt erscheinen Pfeil und Geisterhand automatisch.

Tipp: Falls der Browser die Mauszeiger-Sperre (Pointer-Lock) blockiert, `?nolock` an die Adresse anhängen.

## Technik

- Statische Seite ohne Build-Schritt (GitHub-Pages-tauglich), ES-Module mit Importmap
- Three.js 0.187 und cannon-es 0.20 liegen in `vendor/` – funktioniert auch ohne Internet im Schulnetz
- Alle 3D-Modelle werden im Code aus Grundformen erzeugt, Töne mit der Web-Audio-API synthetisiert
- Computer-Ausgaben sind nur hörbar, wenn die virtuellen Lautsprecher eingesteckt sind

Lokal starten (ES-Module brauchen einen Webserver):

```bash
python3 -m http.server 8000
```

Dann `http://localhost:8000` öffnen.

### Dateien

```
index.html, styles.css         Oberfläche (Start, Byte, Fortschritt, Endbildschirm)
src/main.js                    Aufbau, Ereignisse, Tastatur, Hauptschleife
src/scene/room.js, models.js   Raum, Schreibtisch, Kartons, alle Gerätemodelle
src/interaction/               Greifhand, Kabel/Stecker/Buchsen, Kamera
src/devices.js                 Geräte-Definitionen (Kategorie, Anschluss, Erklärung)
src/computer/                  „EVA-OS“ auf dem Monitor und die Apps der Stationen
src/game/                      Ablauf (Stationen, Hinweise) und Sortier-Logik
src/ui/                        HUD und 3D-Hilfen (Pfeil, Geisterhand)
```

© 2025 Hans Tydecks · Three.js und cannon-es stehen unter der MIT-Lizenz (siehe `vendor/`).
