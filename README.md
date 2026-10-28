# SignalK_Victron_GUI
Das ist jetzt eine Signal-K-Webapp: ein kleines npm-Paket namens signalk-victron-gui aus package.json, public/index.html und public/icon.svg. Der Signal-K-Server erkennt es am Keyword signalk-webapp und listet es unter „Webapps“, mit dem Namen „Victron GUI“ und dem Blitz-Icon. Die Webapp zeigt die Victron GUI v2 im Vollbild-iframe an. Ich habe sie nicht auf einem laufenden Signal-K-Server getestet.

Installation auf dem Pi:

Ordner signalk-victron-gui auf den Pi kopieren, z. B. nach /home/pi/signalk-victron-gui.
Installieren und den Server neu starten:
   cd ~/.signalk
   npm install /home/pi/signalk-victron-gui
   sudo systemctl restart signalk
Dann erscheint „Victron GUI“ im Signal-K-Menü „Webapps“. Direkt erreichbar ist sie unter http://<pi>:3000/signalk-victron-gui/.

Adresse einstellen:

In public/index.html steht oben als Standard http://venus.local/gui-v2/. Wenn dein GX-Gerät per mDNS nicht auflösbar ist, trag dort die feste IP ein.
Zur Laufzeit änderst du sie über das Zahnrad unten rechts, dort gibt es auch das optionale automatische Neuladen. Gespeichert wird sie im Browser.
Per Link geht …/signalk-victron-gui/?url=http://192.168.x.x/gui-v2/. Das ist praktisch für KIP-Kiosk oder Lesezeichen.

Hinweise:

Läuft Signal K per HTTPS und die GUI per HTTP, blockiert der Browser das Einbetten. Im normalen Boots-LAN mit HTTP auf beiden Seiten gibt es dieses Problem nicht.
Verbietet die GUI das Einbetten, bleibt als Ausweg der Button „In neuem Tab öffnen“. Falls das bei dir auftritt, kann ich dir alternativ einen kleinen Reverse-Proxy als Signal-K-Plugin oder nginx-Config bauen.
