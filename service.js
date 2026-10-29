// Horizon : service Node.js lancé par TizenBrew (ES5 uniquement, les TV anciennes embarquent Node 4).
// La page du launcher n'a pas accès à l'API tizen. Ce service lui expose, en local uniquement
// (127.0.0.1), la liste des applis installées, leurs icônes et leur lancement.
//
// « Remplacer l'accueil » : le service écoute les changements d'état des applis (API publique
// tizen.application.addAppStatusChangeListener). Quand l'accueil Samsung s'affiche (touche Home,
// allumage, sortie d'une appli), il rouvre aussitôt TizenBrew, qui affiche Horizon.
// Rien n'est modifié dans le système : il suffit de désactiver l'option ou de retirer le module.
var http = require('http');
var url = require('url');
var fs = require('fs');

var PORT = 8097;
var VERSION = 2; // à augmenter à chaque changement : une version plus récente remplace l'ancienne

var PASS_THROUGH_MS = 4000;   // Home appuyé deux fois en moins de 4 s : l'accueil Samsung reste affiché
var LEARN_MS = 12000;         // durée de l'apprentissage de la touche Home
var TAKEOVER_DELAY_MS = 250;  // petit délai avant de rouvrir Horizon
var LOOP_LIMIT = 4;           // sécurité : plus de 4 reprises en 20 s, l'option se coupe toute seule
var LOOP_WINDOW_MS = 20000;

var appsById = {};
var visibleIds = {};
var brewIds = {};       // identifiants de TizenBrew (interface et service)
var brewLaunchId = null;

var config = { enabled: false, homeIds: [] };
var state = {
  listener: false,
  listenerError: null,
  learning: false,
  learnedAt: 0,
  learnFailedAt: 0,
  lastTakeover: 0,
  passThrough: false,
  takeovers: [],
  autoDisabledAt: 0
};
var events = [];        // journal des derniers changements d'état, pour le diagnostic
var learnCandidates = {};
var learnTimer = null;
var listenerId = null;

// ---------------------------------------------------------------- Réglages persistants
var CONFIG_DIRS = [
  (process.env.HOME || '') + '/share',
  process.env.HOME || '',
  '/home/owner/share',
  '/opt/usr/home/owner/share',
  '/tmp'
];
var configPath = null;

function loadConfig() {
  for (var i = 0; i < CONFIG_DIRS.length; i++) {
    if (!CONFIG_DIRS[i]) continue;
    var p = CONFIG_DIRS[i] + '/horizon-tv.json';
    try {
      var c = JSON.parse(fs.readFileSync(p, 'utf8'));
      config.enabled = !!c.enabled;
      config.homeIds = c.homeIds || [];
      configPath = p;
      return;
    } catch (e) {}
  }
}

function saveConfig() {
  var dirs = configPath ? [configPath.replace(/\/horizon-tv\.json$/, '')].concat(CONFIG_DIRS) : CONFIG_DIRS;
  for (var i = 0; i < dirs.length; i++) {
    if (!dirs[i]) continue;
    try {
      fs.writeFileSync(dirs[i] + '/horizon-tv.json', JSON.stringify(config));
      configPath = dirs[i] + '/horizon-tv.json';
      return true;
    } catch (e) {}
  }
  return false;
}

// ---------------------------------------------------------------- Applis
function reply(res, status, body) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Cache-Control': 'no-store'
  });
  res.end(JSON.stringify(body));
}

function pkgOf(id) { return String(id || '').split('.')[0]; }

function listApps(done) {
  try {
    tizen.application.getAppsInfo(function (apps) {
      var out = [];
      appsById = {};
      visibleIds = {};
      brewIds = {};
      var brewPkg = null;
      apps.forEach(function (a) {
        appsById[a.id] = a;
        if (a.show !== false) visibleIds[a.id] = true;
        if (/tizenbrew/i.test(a.name || '') && a.show !== false && !brewLaunchId) { brewLaunchId = a.id; }
        if (/tizenbrew/i.test(a.name || '') || /tizenbrew/i.test(a.id)) { brewIds[a.id] = true; brewPkg = pkgOf(a.id); }
        out.push({ id: a.id, name: a.name, show: a.show !== false, icon: !!a.iconPath });
      });
      if (brewPkg) apps.forEach(function (a) { if (pkgOf(a.id) === brewPkg) brewIds[a.id] = true; });
      try {
        var me = tizen.application.getCurrentApplication().appInfo.id;
        brewIds[me] = true;
        apps.forEach(function (a) { if (pkgOf(a.id) === pkgOf(me)) brewIds[a.id] = true; });
      } catch (e) {}
      done(null, out);
    }, function (e) {
      done(e || new Error('getAppsInfo'));
    });
  } catch (e) {
    done(e);
  }
}

function launchApp(id, ok, ko) {
  try {
    tizen.application.launch(id, function () { if (ok) ok(); }, function (e) { if (ko) ko(e); });
  } catch (e) { if (ko) ko(e); }
}

var TYPES = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', svg: 'image/svg+xml', gif: 'image/gif' };

function sendIcon(res, app) {
  if (!app || !app.iconPath) { reply(res, 404, { error: 'no icon' }); return; }
  var path = String(app.iconPath).replace(/^file:\/\//, '');
  fs.readFile(path, function (err, data) {
    if (err) { reply(res, 404, { error: 'unreadable icon' }); return; }
    var ext = (path.split('.').pop() || '').toLowerCase();
    res.writeHead(200, {
      'Content-Type': TYPES[ext] || 'application/octet-stream',
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'max-age=86400'
    });
    res.end(data);
  });
}

// ---------------------------------------------------------------- Remplacer l'accueil
function isBrew(id) { return !!brewIds[id] || /tizenbrew/i.test(id); }
function isHome(id) { return config.homeIds.indexOf(id) !== -1; }

function bringHorizon() {
  if (!brewLaunchId) return;
  var now = Date.now();
  state.takeovers = state.takeovers.filter(function (t) { return now - t < LOOP_WINDOW_MS; });
  state.takeovers.push(now);
  if (state.takeovers.length > LOOP_LIMIT) {
    // Sécurité anti-boucle : on arrête de reprendre la main et on le signale dans Horizon.
    config.enabled = false;
    state.autoDisabledAt = now;
    saveConfig();
    return;
  }
  state.lastTakeover = now;
  launchApp(brewLaunchId);
}

function onStatus(appId, isActive) {
  var now = Date.now();
  events.push({ t: now, id: appId, active: !!isActive });
  if (events.length > 40) events.shift();
  if (!isActive) return;

  if (state.learning) {
    // Pendant l'apprentissage : on retient les applis système (invisibles dans la liste) qui s'activent.
    if (!isBrew(appId) && !visibleIds[appId]) learnCandidates[appId] = true;
    return;
  }

  if (!isHome(appId)) {
    // Une autre appli prend la main : on sort du mode « accueil Samsung autorisé ».
    if (!isBrew(appId)) state.passThrough = false;
    return;
  }
  if (!config.enabled || !brewLaunchId) return;
  if (state.passThrough) return;
  if (now - state.lastTakeover < PASS_THROUGH_MS) {
    // Deuxième appui sur Home juste après : l'utilisateur veut vraiment l'accueil Samsung.
    state.passThrough = true;
    return;
  }
  setTimeout(bringHorizon, TAKEOVER_DELAY_MS);
}

function startListener() {
  try {
    listenerId = tizen.application.addAppStatusChangeListener(onStatus);
    state.listener = true;
  } catch (e) {
    state.listener = false;
    state.listenerError = String((e && e.message) || e);
  }
}

function startLearning() {
  learnCandidates = {};
  state.learning = true;
  clearTimeout(learnTimer);
  learnTimer = setTimeout(finishLearning, LEARN_MS);
}

function finishLearning() {
  state.learning = false;
  var ids = Object.keys(learnCandidates);
  if (ids.length) {
    config.homeIds = ids;
    config.enabled = true;
    state.learnedAt = Date.now();
    state.passThrough = false;
    state.takeovers = [];
    saveConfig();
    bringHorizon();
  } else {
    state.learnFailedAt = Date.now();
  }
}

function status() {
  return {
    version: VERSION,
    enabled: config.enabled,
    homeIds: config.homeIds,
    listener: state.listener,
    listenerError: state.listenerError,
    learning: state.learning,
    learnedAt: state.learnedAt,
    learnFailedAt: state.learnFailedAt,
    autoDisabledAt: state.autoDisabledAt,
    tizenbrew: brewLaunchId,
    configSaved: configPath,
    now: Date.now()
  };
}

// ---------------------------------------------------------------- Serveur local
var server = http.createServer(function (req, res) {
  var request = url.parse(req.url, true);
  var q = request.query || {};
  var id = q.id;

  if (request.pathname === '/apps') {
    listApps(function (err, apps) {
      if (err) reply(res, 500, { error: String(err.message || err) });
      else reply(res, 200, apps);
    });
  } else if (request.pathname === '/launch' && id) {
    launchApp(id, function () { reply(res, 200, { ok: true }); }, function (e) { reply(res, 500, { error: e && e.message }); });
  } else if (request.pathname === '/icon' && id) {
    if (appsById[id]) sendIcon(res, appsById[id]);
    else listApps(function () { sendIcon(res, appsById[id]); });
  } else if (request.pathname === '/takeover') {
    reply(res, 200, status());
  } else if (request.pathname === '/takeover/set') {
    config.enabled = q.enabled === '1';
    if (config.enabled) { state.autoDisabledAt = 0; state.takeovers = []; state.passThrough = false; }
    var saved = saveConfig();
    reply(res, 200, { ok: true, saved: saved, status: status() });
  } else if (request.pathname === '/takeover/learn') {
    listApps(function () { startLearning(); reply(res, 200, { ok: true, seconds: LEARN_MS / 1000 }); });
  } else if (request.pathname === '/takeover/forget') {
    config.enabled = false;
    config.homeIds = [];
    saveConfig();
    reply(res, 200, { ok: true });
  } else if (request.pathname === '/events') {
    reply(res, 200, { events: events, status: status() });
  } else if (request.pathname === '/version') {
    reply(res, 200, { version: VERSION });
  } else if (request.pathname === '/shutdown') {
    // Remplacé par une version plus récente : on arrête aussi l'écoute, pour ne pas reprendre la main en double.
    try { if (listenerId !== null) tizen.application.removeAppStatusChangeListener(listenerId); } catch (e) {}
    listenerId = null;
    clearTimeout(learnTimer);
    reply(res, 200, { ok: true });
    server.close();
  } else {
    reply(res, 404, { error: 'not found' });
  }
});

// Si une ancienne version du service occupe déjà le port, on lui demande de s'arrêter.
var attempts = 0;
function listen() { server.listen(PORT, '127.0.0.1'); }

server.on('error', function (e) {
  if (e.code !== 'EADDRINUSE' || ++attempts > 3) return;
  http.get({ host: '127.0.0.1', port: PORT, path: '/version' }, function (res) {
    var body = '';
    res.on('data', function (chunk) { body += chunk; });
    res.on('end', function () {
      var running = 0;
      try { running = JSON.parse(body).version || 0; } catch (err) {}
      if (running >= VERSION) return;
      http.get({ host: '127.0.0.1', port: PORT, path: '/shutdown' }, function () {}).on('error', function () {});
      setTimeout(listen, 500);
    });
  }).on('error', function () { setTimeout(listen, 500); });
});

loadConfig();
listApps(function () {});
startListener();
listen();
