'use strict';
/*
 * Signal K Plugin "Victron GUI (Proxy)"
 * Liefert die statischen Dateien der Victron GUI v2 (Venus OS / GX) unter dem Origin des
 * Signal-K-Servers aus:   /plugins/signalk-victron-gui/gui/   ->   http://<venus>/gui-v2/
 * Dadurch liegt die GUI im selben Origin wie das App Dock, und dieses hört Doppelklicks direkt.
 * Die MQTT-WebSocket-Verbindung der GUI geht NICHT über den Proxy, sondern direkt vom Browser
 * zum GX-Gerät (URL-Parameter  ?mqtt=ws://<venus>:9001/ ).
 */
const http = require('http');

module.exports = function (app) {
  const plugin = {
    id: 'signalk-victron-gui',
    name: 'Victron GUI (Proxy)',
    description: 'Liefert die Victron GUI v2 unter dem Signal-K-Origin aus (für Doppelklick im App Dock)'
  };

  const DEFAULTS = { venusHost: 'venus.local', venusPort: 80, guiPath: '/gui-v2/', mqttPort: 9001, extraQuery: '' };
  let cfg = Object.assign({}, DEFAULTS);
  const PREFIX = '/plugins/' + plugin.id;

  plugin.schema = {
    type: 'object',
    properties: {
      venusHost: { type: 'string', title: 'Host/IP des GX-Geräts (Venus OS)', default: DEFAULTS.venusHost },
      venusPort: { type: 'number', title: 'HTTP-Port der GUI', default: DEFAULTS.venusPort },
      guiPath: { type: 'string', title: 'Pfad der GUI v2 auf dem GX', default: DEFAULTS.guiPath },
      mqttPort: {
        type: 'number',
        title: 'MQTT-WebSocket-Port (direkt Browser → GX), 0 = Parameter nicht setzen',
        default: DEFAULTS.mqttPort
      },
      extraQuery: { type: 'string', title: 'Zusätzliche URL-Parameter (z. B. colorScheme=dark&fullscreen)', default: '' }
    }
  };

  plugin.start = function (options) {
    cfg = Object.assign({}, DEFAULTS, options || {});
    if (app.setPluginStatus) app.setPluginStatus('Proxy auf http://' + cfg.venusHost + ':' + cfg.venusPort + guiBase() + '/');
  };
  plugin.stop = function () {};

  const guiBase = () => ('/' + String(cfg.guiPath || '').replace(/^\/+|\/+$/g, '')).replace(/^\/$/, '');

  function guiUrl() {
    const q = [];
    if (Number(cfg.mqttPort) > 0) q.push('mqtt=' + encodeURIComponent('ws://' + cfg.venusHost + ':' + cfg.mqttPort + '/'));
    if (cfg.extraQuery) q.push(String(cfg.extraQuery).replace(/^[?&]/, ''));
    return PREFIX + '/gui/' + (q.length ? '?' + q.join('&') : '');
  }

  function rewriteLocation(loc) {
    const path = loc.replace(/^https?:\/\/[^/]+/i, '');
    const b = guiBase();
    return path.indexOf(b + '/') === 0 || path === b ? PREFIX + '/gui' + path.slice(b.length) : loc;
  }

  function proxy(req, res) {
    const pathOnly = req.originalUrl.split('?')[0];
    if (pathOnly === PREFIX + '/gui') {                       // ohne Schrägstrich: relative Pfade würden brechen
      return res.redirect(302, PREFIX + '/gui/' + req.originalUrl.slice(pathOnly.length));
    }
    const rest = req.url || '/';
    const upstreamPath = guiBase() + rest;
    const isDoc = /^\/(\?|$)/.test(rest) || /\.html?(\?|$)/i.test(rest);

    const headers = Object.assign({}, req.headers, { host: cfg.venusHost + ':' + cfg.venusPort });
    ['cookie', 'authorization', 'referer', 'origin'].forEach(function (h) { delete headers[h]; });
    if (isDoc) headers['accept-encoding'] = 'identity';       // HTML wird umgeschrieben -> unkomprimiert holen

    const up = http.request(
      { host: cfg.venusHost, port: cfg.venusPort, path: upstreamPath, method: req.method, headers: headers, timeout: 20000 },
      function (ur) {
        const h = Object.assign({}, ur.headers);
        delete h['x-frame-options'];
        delete h['content-security-policy'];
        if (h.location) h.location = rewriteLocation(h.location);

        if (isDoc && ur.statusCode === 200 && /text\/html/i.test(h['content-type'] || '')) {
          const chunks = [];
          ur.on('data', function (c) { chunks.push(c); });
          ur.on('end', function () {
            const abs = guiBase() + '/';
            let body = Buffer.concat(chunks).toString('utf8');
            // absolute Pfade auf die GUI ("/gui-v2/...") auf den Proxy-Pfad umbiegen
            body = body.split('"' + abs).join('"' + PREFIX + '/gui/')
                       .split("'" + abs).join("'" + PREFIX + '/gui/');
            delete h['content-length'];
            res.writeHead(200, h);
            res.end(body);
          });
        } else {
          res.writeHead(ur.statusCode, h);
          ur.pipe(res);
        }
      }
    );
    up.on('timeout', function () { up.destroy(new Error('Zeitüberschreitung')); });
    up.on('error', function (e) {
      if (!res.headersSent) {
        res.status(502).type('text/plain').send('Victron GUI nicht erreichbar (' + cfg.venusHost + ':' + cfg.venusPort + '): ' + e.message);
      } else res.end();
    });
    req.pipe(up);
  }

  plugin.registerWithRouter = function (router) {
    router.get('/info', function (req, res) {
      res.json({ guiUrl: guiUrl(), venusHost: cfg.venusHost, venusPort: cfg.venusPort, guiPath: cfg.guiPath, mqttPort: cfg.mqttPort });
    });
    router.use('/gui', proxy);
  };

  return plugin;
};
