# signalk-victron-gui

Signal-K-Plugin und -Webapp, die die **Victron GUI v2** (Venus OS / Cerbo GX, Ekrano GX, Raspberry Pi) im Vollbild in Signal K anzeigt, und zwar so, dass das **[App Dock](https://github.com/SignalK/app-dock)** (`@signalk/app-dock`) einen **Doppelklick bzw. Doppeltipp überall in der GUI** erkennt.

## Warum das Ganze?

Das App Dock erkennt den Doppeltipp, indem es in die Seite der jeweils angezeigten App hineinhört. Ein Browser erlaubt das nur für Seiten im **selben Origin** (Schema, Host, Port). Die Victron GUI läuft aber auf dem GX-Gerät (`venus.local`) und damit in einem anderen Origin. Das Dock sieht Klicks darin nicht und zeigt stattdessen nur einen kleinen Notfall-Tab am Rand.

Dieses Paket löst das mit einem schlanken Reverse-Proxy im Signal-K-Server. Die Dateien der GUI werden unter dem Origin von Signal K ausgeliefert, und das Dock hört direkt in die Seite hinein.

```
Browser ──► Signal K  /signalk-victron-gui/                  (Webapp, iframe)
                └──► /plugins/signalk-victron-gui/gui/…  ──proxy──►  http://<GX>/gui-v2/…
Browser ───────────────────────── ws://<GX>:9001/ ───────────────►  MQTT (Messwerte, direkt)
```

Nur die statischen Dateien (HTML, JS, WASM) laufen über den Proxy. Die MQTT-WebSocket-Verbindung der GUI geht **nicht** durch den Proxy, sondern direkt vom Browser zum GX. Dafür wird der von der GUI unterstützte URL-Parameter `mqtt=ws://<GX>:9001/` gesetzt.

## Voraussetzungen

- Signal K Server (Node.js) mit installiertem App Dock (optional, die Webapp funktioniert auch ohne)
- GX-Gerät mit Venus OS und GUI v2, aus dem Netz des Signal-K-Servers erreichbar
- MQTT im LAN auf dem GX erreichbar („MQTT on LAN“), damit die GUI Messwerte bekommt
- Signal K und GUI beide über **HTTP** (bei HTTPS blockiert der Browser die `ws://`-Verbindung zum GX)

## Installation

```bash
cd ~/.signalk
npm install /pfad/zu/signalk-victron-gui
sudo systemctl restart signalk
```

Anschließend im Admin-UI unter **Server → Plugin Config → Victron GUI (Proxy)** den Host bzw. die IP des GX-Geräts eintragen, das Plugin aktivieren und speichern.

Danach:

- Die Webapp erscheint im Menü **Webapps** als „Victron GUI“ und ist direkt erreichbar unter  
  `http://<signalk-server>:3000/signalk-victron-gui/`
- Im App Dock über **Plugin Config → App Dock → Discover Installed Webapps** aufnehmen.

## Plugin-Einstellungen

| Einstellung | Standard | Bedeutung |
| --- | --- | --- |
| Host/IP des GX-Geräts | `venus.local` | Adresse des Venus-OS-Geräts. Bei Problemen mit mDNS die feste IP verwenden. |
| HTTP-Port der GUI | `80` | Port, auf dem das GX die GUI ausliefert |
| Pfad der GUI v2 | `/gui-v2/` | Pfad der GUI auf dem GX |
| MQTT-WebSocket-Port | `9001` | Direktverbindung Browser → GX. `0` setzt den `mqtt`-Parameter nicht, dann entscheidet die GUI selbst. |
| Zusätzliche URL-Parameter | leer | Werden an die GUI-Adresse gehängt, z. B. `colorScheme=dark&fullscreen` |

## URL-Parameter der Webapp

Anhängen an `…/signalk-victron-gui/`, mehrere mit `&` verbinden:

| Parameter | Wirkung |
| --- | --- |
| `?debug` | Zeigt unten links, ob Proxy- oder Direktmodus aktiv ist und warum |
| `?reload=10` | Lädt die GUI alle 10 Minuten neu (`0` = aus), praktisch für Wanddisplays |
| `?url=http://192.168.x.x/gui-v2/` | Erzwingt den Direktmodus mit dieser Adresse (siehe unten) |
| `?edge=40` | Breite der Randstreifen im Direktmodus in Pixeln (`0` = aus) |
| `?reset` | Löscht die im Browser gespeicherten Einstellungen |

## Direktmodus (Fallback)

Antwortet das Plugin nicht (nicht installiert, nicht aktiviert oder nicht erreichbar), lädt die Webapp die GUI direkt vom GX, standardmäßig `http://venus.local/gui-v2/`. Das funktioniert, aber das App Dock kann dann nicht in die Seite hineinhören. Als Ersatz gibt es zwei unsichtbare Streifen am linken und rechten Rand (Standard 24 px). Ein Doppelklick darauf öffnet das Dock. Mitten in der GUI zeigt das Dock seinen Notfall-Tab am Rand, der sich mit einem einzelnen Tipp öffnen lässt.

## Schnittstellen des Plugins

| Pfad | Beschreibung |
| --- | --- |
| `/plugins/signalk-victron-gui/info` | JSON mit der Adresse für die Webapp (`guiUrl`) und der aktuellen Konfiguration |
| `/plugins/signalk-victron-gui/gui/…` | Proxy auf `http://<GX>:<Port><Pfad>/…` |

Der Proxy entfernt `X-Frame-Options` und `Content-Security-Policy` aus den Antworten des GX, damit die GUI eingebettet werden kann. Er leitet keine Cookies oder Authorization-Header von Signal K an das GX weiter. Absolute Pfade auf die GUI (`"/gui-v2/…"`) in HTML-Dateien werden auf den Proxy-Pfad umgeschrieben, Weiterleitungen (`Location`) ebenfalls.

## Fehlersuche

- **Es erscheint nur der Direktmodus.** Mit `?debug` aufrufen und die Meldung unten links lesen. Zusätzlich `http://<signalk-server>:3000/plugins/signalk-victron-gui/info` im Browser öffnen: Kommt dort kein JSON, ist das Plugin nicht geladen. Dann prüfen, ob es nach der Installation einen Neustart gab, ob es unter *Plugin Config* aktiviert ist und was `journalctl -u signalk -n 100` meldet.
- **`HTTP 401` bei aktivierter Signal-K-Sicherheit.** Die Seite muss mit eingeloggtem Benutzer aufgerufen werden.
- **GUI lädt, zeigt aber keine Werte.** MQTT im LAN auf dem GX aktivieren und den MQTT-WebSocket-Port prüfen (Standard 9001).
- **Weiße Seite oder `502`-Meldung.** Das GX ist vom Signal-K-Server aus nicht erreichbar. Host/IP, Port und Pfad in den Plugin-Einstellungen prüfen.
- **Läuft Signal K per HTTPS,** blockiert der Browser die `ws://`-Verbindung zum GX (Mixed Content). Signal K per HTTP betreiben.

## Grenzen

- Der Proxy reicht nur HTTP durch, keine WebSockets. Die GUI verbindet sich deshalb direkt mit dem MQTT-Broker des GX.
- Ruft die GUI selbst Pfade außerhalb ihres Verzeichnisses mit absoluten Adressen auf, kann das hinter dem Proxy brechen. Beobachtet wurde das bisher nicht.
- Das Plugin ist für das lokale Boots-LAN gedacht. Es ist keine Absicherung der GUI nach außen.

## Entwicklung

Das Paket besteht aus nur wenigen Dateien und braucht keinen Build-Schritt:

```
index.js            Plugin: Konfigurationsschema, /info, Reverse-Proxy
public/index.html   Webapp: iframe mit Proxy-Modus und Direktmodus
public/icon.svg     Icon im Webapps-Menü
package.json        Keywords: signalk-webapp, signalk-node-server-plugin
```

## Lizenz

MIT
