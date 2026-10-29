// Horizon : écran d'accueil minimaliste pour TV Samsung Tizen (module TizenBrew).
// ES5 volontairement : compatible avec les navigateurs des TV Samsung depuis 2017.
(function () {
  'use strict';

  var C = window.HORIZON_CONFIG;
  var API = 'http://127.0.0.1:' + C.servicePort;
  var DEMO = /[?&]demo\b/.test(location.search);
  var OFFLINE = /[?&]offline\b/.test(location.search);
  var KEY = { LEFT: 37, UP: 38, RIGHT: 39, DOWN: 40, ENTER: 13, BACK: 10009, ESC: 27, BACKSPACE: 8 };
  var LONG_PRESS = 650;
  var DAYS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
  var MONTHS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
  var STORE = { dock: 'horizon.dock', hidden: 'horizon.hidden' };

  function $(id) { return document.getElementById(id); }
  function each(list, fn) { for (var i = 0; i < list.length; i++) fn(list[i], i); }
  function norm(s) {
    return String(s || '').toLowerCase()
      .replace(/[àâä]/g, 'a').replace(/[éèêë]/g, 'e').replace(/[îï]/g, 'i')
      .replace(/[ôö]/g, 'o').replace(/[ùûü]/g, 'u').replace(/ç/g, 'c');
  }
  function load(key, fallback) {
    try { var v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; } catch (e) { return fallback; }
  }
  function save(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) {} }
  function shuffle(a) {
    for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; }
    return a;
  }
  function hash(s) { var h = 0; for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return Math.abs(h); }

  // ---------------------------------------------------------------- Horloge
  function pad(n) { return n < 10 ? '0' + n : '' + n; }
  function tick() {
    var d = new Date();
    $('time').textContent = pad(d.getHours()) + ':' + pad(d.getMinutes());
    $('date').textContent = DAYS[d.getDay()] + ' ' + d.getDate() + ' ' + MONTHS[d.getMonth()];
  }

  // ---------------------------------------------------------------- Fonds d'écran
  var layers = [$('bgA'), $('bgB')];
  var front = 0;
  var walls = [];
  var wallIndex = -1;
  var wallTimer = null;
  var failures = 0;

  function wikiUrl(file) {
    return 'https://commons.wikimedia.org/wiki/Special:FilePath/' +
      encodeURIComponent(file.replace(/ /g, '_')) + '?width=' + C.wallpaperWidth;
  }

  // Paysage de secours dessiné en SVG si les photos ne se chargent pas (TV hors ligne).
  var PALETTES = [
    ['#0f2027', '#2c5364', '#f2c94c', ['#1b3a4b', '#12303f', '#0b2230', '#06141d']],
    ['#355c7d', '#c06c84', '#f8b195', ['#4b3b5c', '#3a2d4a', '#2a2038', '#1a1426']],
    ['#0b1d3a', '#3a6186', '#e0eafc', ['#22395c', '#1a2d4a', '#122036', '#0a1424']],
    ['#1d4350', '#a43931', '#ffd194', ['#5a2d2b', '#432220', '#2e1716', '#1c0e0d']],
    ['#134e5e', '#71b280', '#fefefe', ['#2d6b5f', '#225449', '#183d35', '#0e2621']]
  ];
  function ridge(seed, base, amp, color) {
    var pts = 'M0 1080 L0 ' + base;
    for (var x = 0; x <= 1920; x += 40) {
      var y = base - amp * (0.55 * Math.sin((x + seed * 97) / 210) + 0.3 * Math.sin((x + seed * 31) / 83) + 0.15 * Math.sin((x + seed * 13) / 37));
      pts += ' L' + x + ' ' + Math.round(y);
    }
    return '<path d="' + pts + ' L1920 1080 Z" fill="' + color + '"/>';
  }
  function fallbackWallpaper(n) {
    var p = PALETTES[n % PALETTES.length];
    var seed = n * 7 + 3;
    var svg = '<svg xmlns="http://www.w3.org/2000/svg" width="1920" height="1080" viewBox="0 0 1920 1080">' +
      '<defs><linearGradient id="s" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="' + p[0] + '"/>' +
      '<stop offset="0.7" stop-color="' + p[1] + '"/></linearGradient>' +
      '<radialGradient id="g" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stop-color="' + p[2] + '" stop-opacity="0.95"/>' +
      '<stop offset="1" stop-color="' + p[2] + '" stop-opacity="0"/></radialGradient></defs>' +
      '<rect width="1920" height="1080" fill="url(#s)"/>' +
      '<circle cx="' + (1180 + (seed % 5) * 60) + '" cy="560" r="260" fill="url(#g)"/>' +
      '<circle cx="' + (1180 + (seed % 5) * 60) + '" cy="560" r="70" fill="' + p[2] + '" opacity="0.9"/>' +
      ridge(seed, 640, 120, p[3][0]) + ridge(seed + 1, 730, 100, p[3][1]) +
      ridge(seed + 2, 830, 80, p[3][2]) + ridge(seed + 3, 940, 60, p[3][3]) + '</svg>';
    return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  }

  function setCredit(place, source) {
    var credit = $('credit');
    credit.className = 'fade';
    setTimeout(function () {
      $('creditPlace').textContent = place || '';
      $('creditSource').textContent = source || '';
      credit.className = '';
    }, 700);
  }

  function showImage(src, place, source) {
    var back = layers[1 - front];
    var kb = 'kb' + Math.floor(Math.random() * 4);
    back.style.backgroundImage = 'url("' + src + '")';
    back.className = 'bg';
    void back.offsetWidth; // relance l'animation lente (effet Ken Burns)
    back.style.animationDuration = (C.wallpaperSeconds + C.fadeSeconds + 4) + 's';
    back.className = 'bg ' + kb + ' on';
    layers[front].className = layers[front].className.replace(' on', '');
    front = 1 - front;
    setCredit(place, source);
  }

  function nextWallpaper() {
    clearTimeout(wallTimer);
    if (!walls.length || failures >= walls.length) {
      var n = Math.floor(Math.random() * 1000);
      showImage(fallbackWallpaper(n), '', '');
      wallTimer = setTimeout(nextWallpaper, C.wallpaperSeconds * 1000);
      return;
    }
    wallIndex = (wallIndex + 1) % walls.length;
    var w = walls[wallIndex];
    var img = new Image();
    var done = false;
    var guard = setTimeout(function () { if (!done) { done = true; img.src = ''; onFail(); } }, 15000);
    function onFail() {
      clearTimeout(guard);
      w.failed = true;
      failures++;
      wallTimer = setTimeout(nextWallpaper, 200);
    }
    img.onload = function () {
      if (done) return;
      done = true;
      clearTimeout(guard);
      failures = 0;
      showImage(w.url, w.place, 'Wikimedia Commons');
      wallTimer = setTimeout(nextWallpaper, C.wallpaperSeconds * 1000);
    };
    img.onerror = function () { if (!done) { done = true; onFail(); } };
    img.src = w.url;
  }

  function startWallpapers() {
    each(layers, function (l) { l.style.transitionDuration = C.fadeSeconds + 's'; });
    walls = OFFLINE ? [] : shuffle(C.wallpapers.map(function (w) {
      return { url: wikiUrl(w.file), place: w.place };
    }));
    nextWallpaper();
  }

  // ---------------------------------------------------------------- Applis
  var apps = [];          // [{id, name, icon}]
  var byId = {};
  var dock = load(STORE.dock, null);
  var hidden = load(STORE.hidden, null);
  var showHidden = false;

  var DEMO_APPS = [
    ['canal', 'CANAL+', '#000000'], ['sfr', 'SFR TV', '#e2001a'], ['tizentube', 'TizenTube', '#3ec6e0'],
    ['netflix', 'Netflix', '#141414'], ['prime', 'Prime Video', '#00a8e1'], ['disney', 'Disney+', '#0b3d91'],
    ['youtube', 'YouTube', '#ffffff'], ['stremio', 'Stremio', '#7b5bf5'], ['francetv', 'france.tv', '#2b2f3a'],
    ['spotify', 'Spotify', '#1db954'], ['tvplus', 'Samsung TV Plus', '#1428a0'], ['workspace', 'Workspace', '#3b5bdb'],
    ['internet', 'Internet', '#4c6ef5'], ['gaming', 'Gaming Hub', '#5f3dc4'], ['arte', 'ARTE', '#fa481c'],
    ['molotov', 'Molotov', '#ff2d55'], ['plex', 'Plex', '#1f1f1f'], ['mytf1', 'TF1+', '#0a3d8f']
  ];

  function tileColor(app) {
    if (app.color) return app.color;
    var hues = [210, 260, 330, 20, 160, 190, 280, 0];
    var h = hues[hash(app.name) % hues.length];
    return 'linear-gradient(135deg, hsl(' + h + ',55%,42%), hsl(' + ((h + 40) % 360) + ',60%,24%))';
  }
  function textColor(bg) { return /#fff/i.test(bg) ? '#111' : '#fff'; }

  function buildTile(app) {
    var t = document.createElement('div');
    t.className = 'tile';
    var face = document.createElement('div');
    face.className = 'face';
    var bg = tileColor(app);
    face.style.background = bg;
    face.style.color = textColor(bg);
    face.textContent = app.name;
    t.appendChild(face);
    if (app.icon && !DEMO) {
      var img = document.createElement('img');
      img.crossOrigin = 'anonymous';
      img.onload = function () {
        // Icône large : elle remplit la tuile. Icône carrée : centrée, sur la couleur de son propre fond.
        var wide = img.naturalWidth && img.naturalWidth / img.naturalHeight > 1.6;
        img.className = wide ? 'cover' : 'pad';
        face.textContent = '';
        face.style.background = wide ? '#20232b' : iconBackground(img);
      };
      img.onerror = function () { if (img.parentNode) img.parentNode.removeChild(img); };
      img.src = API + '/icon?id=' + encodeURIComponent(app.id);
      t.appendChild(img);
    }
    return t;
  }

  // Lit la couleur du fond de l'icône (un peu à l'intérieur, pour éviter les coins arrondis).
  function iconBackground(img) {
    try {
      var c = document.createElement('canvas');
      c.width = 10; c.height = 10;
      var g = c.getContext('2d');
      g.drawImage(img, 0, 0, 10, 10);
      var p = g.getImageData(2, 2, 1, 1).data;
      if (p[3] > 200) return 'rgb(' + p[0] + ',' + p[1] + ',' + p[2] + ')';
    } catch (e) {}
    return '#20232b';
  }

  function matches(app, patterns) {
    var n = norm(app.name);
    for (var i = 0; i < patterns.length; i++) if (n.indexOf(norm(patterns[i])) !== -1) return true;
    return false;
  }

  function setApps(list) {
    apps = [];
    byId = {};
    var seen = {};
    each(list, function (a) {
      if (!a || !a.id || seen[a.id] || a.show === false) return;
      if (!a.name || (/^org\.tizen\./.test(a.id) && a.id !== 'org.tizen.browser')) return;
      seen[a.id] = true;
      a.name = String(a.name).split(' - ')[0].replace(/^\s+|\s+$/g, '');
      apps.push(a);
      byId[a.id] = a;
    });
    apps.sort(function (x, y) { return norm(x.name) < norm(y.name) ? -1 : 1; });

    if (!dock) {
      dock = [];
      each(C.defaultDock, function (p) {
        for (var i = 0; i < apps.length; i++) {
          if (dock.indexOf(apps[i].id) === -1 && matches(apps[i], [p])) { dock.push(apps[i].id); break; }
        }
      });
      save(STORE.dock, dock);
    }
    if (!hidden) {
      hidden = [];
      each(apps, function (a) { if (matches(a, C.hiddenByDefault)) hidden.push(a.id); });
      save(STORE.hidden, hidden);
    }
    renderDock();
    renderGrid();
  }

  function visibleDock() {
    var out = [];
    each(dock, function (id) { if (byId[id]) out.push(byId[id]); });
    return out;
  }

  // L'API tizen est parfois accessible directement depuis la page : dans ce cas, pas besoin du service.
  function pageTizen() {
    try { return window.tizen && tizen.application && typeof tizen.application.getAppsInfo === 'function'; } catch (e) { return false; }
  }

  function setDockMessage(text) {
    var track = $('dockTrack');
    if (track.children.length && !track.firstChild.getAttribute('data-msg')) return;
    track.innerHTML = '<div class="tile" data-msg="1"><div class="face" style="background:#20232b;font-size:22px">' + text + '</div></div>';
  }

  var serviceDown = false;
  function loadApps(attempt) {
    if (DEMO) {
      setApps(DEMO_APPS.map(function (d) { return { id: d[0], name: d[1], color: d[2], show: true }; }));
      return;
    }
    if (attempt === 1 && !apps.length) setDockMessage('Chargement des applis\u2026');
    if (pageTizen()) {
      try {
        tizen.application.getAppsInfo(function (list) {
          setApps(list.map(function (a) { return { id: a.id, name: a.name, show: a.show !== false, icon: false }; }));
        }, function () { viaService(); });
        return;
      } catch (e) {}
    }
    viaService();

    function viaService() {
      var xhr = new XMLHttpRequest();
      xhr.open('GET', API + '/apps');
      xhr.timeout = 2500;
      xhr.onload = function () {
        try { serviceDown = false; setApps(JSON.parse(xhr.responseText)); } catch (e) { retry(); }
      };
      xhr.onerror = xhr.ontimeout = retry;
      xhr.send();
    }
    function retry() {
      if (attempt < 12) { setTimeout(function () { loadApps(attempt + 1); }, 800); return; }
      serviceDown = true;
      setDockMessage('Service Horizon indisponible');
      showToast('Service Horizon indisponible : ferme et rouvre TizenBrew', 10000);
      // On continue d'essayer en fond : le service peut démarrer plus tard.
      setTimeout(function () { loadApps(2); }, 10000);
    }
  }

  function launch(app) {
    if (!app) return;
    showToast('Ouverture de ' + app.name + '\u2026', 2500);
    if (DEMO) return;
    if (pageTizen() && typeof tizen.application.launch === 'function') {
      try {
        tizen.application.launch(app.id, function () {}, function () { launchViaService(app); });
        return;
      } catch (e) {}
    }
    launchViaService(app);
  }

  function launchViaService(app) {
    var xhr = new XMLHttpRequest();
    xhr.open('GET', API + '/launch?id=' + encodeURIComponent(app.id));
    xhr.timeout = 8000;
    xhr.onload = function () { if (xhr.status !== 200) showToast('Impossible d\u2019ouvrir ' + app.name, 4000); };
    xhr.onerror = xhr.ontimeout = function () { showToast('Impossible d\u2019ouvrir ' + app.name, 4000); };
    xhr.send();
  }

  // ---------------------------------------------------------------- Rendu
  var zone = 'dock';
  var dockIndex = 0;
  var gridIndex = 0;
  var gridItems = [];
  var COLS = 6;

  function renderDock() {
    var track = $('dockTrack');
    track.innerHTML = '';
    var list = visibleDock();
    if (!list.length) {
      var empty = document.createElement('div');
      empty.className = 'tile';
      empty.innerHTML = '<div class="face" style="background:#20232b;font-size:22px">Ajoute des applis : flèche bas</div>';
      track.appendChild(empty);
    }
    each(list, function (app) { track.appendChild(buildTile(app)); });
    if (dockIndex >= list.length) dockIndex = Math.max(0, list.length - 1);
    focusDock();
  }

  function focusDock() {
    var tiles = $('dockTrack').children;
    each(tiles, function (t, i) { t.className = t.className.replace(' focused', '') + (i === dockIndex && zone === 'dock' ? ' focused' : ''); });
    var list = visibleDock();
    $('caption').textContent = list[dockIndex] ? list[dockIndex].name : '';
    // Fait défiler le dock si toutes les tuiles ne tiennent pas : la tuile choisie reste vers le centre.
    var step = 232 + 28;
    var view = $('dock').clientWidth - 36;
    var full = list.length * step + 20;
    var max = Math.max(0, full - view);
    var offset = Math.max(0, Math.min(10 + dockIndex * step + step / 2 - view / 2, max));
    $('dockTrack').style.transform = 'translateX(' + (-Math.round(offset)) + 'px)';
    $('dock').className = (offset > 1 ? 'more-left ' : '') + (offset < max - 1 ? 'more-right' : '');
  }

  function renderGrid() {
    var grid = $('grid');
    grid.innerHTML = '';
    gridItems = [];
    var hiddenCount = 0;
    each(apps, function (app) {
      var isHidden = hidden.indexOf(app.id) !== -1;
      if (isHidden) hiddenCount++;
      if (isHidden && !showHidden) return;
      gridItems.push({ type: 'app', app: app, hidden: isHidden });
    });
    gridItems.push({ type: 'toggle', count: hiddenCount });
    gridItems.push({ type: 'settings' });
    each(gridItems, function (item) {
      var cell = document.createElement('div');
      cell.className = 'cell';
      var tile;
      if (item.type === 'app') {
        tile = buildTile(item.app);
        if (dock.indexOf(item.app.id) !== -1) {
          var b = document.createElement('div'); b.className = 'badge'; b.textContent = 'Dock'; tile.appendChild(b);
        }
        if (item.hidden) tile.className += ' missing';
      } else if (item.type === 'toggle') {
        tile = buildTile({ id: '_toggle', name: showHidden ? 'Cacher les applis masquées' : 'Afficher les applis masquées (' + item.count + ')', color: '#2a2e38' });
        tile.firstChild.style.fontSize = '22px';
      } else {
        tile = buildTile({ id: '_settings', name: 'Réglages Horizon', color: '#3a3f4b' });
        tile.firstChild.style.fontSize = '24px';
      }
      var name = document.createElement('div');
      name.className = 'name';
      name.textContent = item.type === 'app' ? item.app.name : ' ';
      cell.appendChild(tile);
      cell.appendChild(name);
      grid.appendChild(cell);
    });
    if (gridIndex >= gridItems.length) gridIndex = gridItems.length - 1;
    focusGrid();
  }

  function focusGrid() {
    var cells = $('grid').children;
    each(cells, function (c, i) {
      var on = i === gridIndex && zone === 'grid';
      c.className = on ? 'cell focusedCell' : 'cell';
      var t = c.firstChild;
      t.className = t.className.replace(' focused', '') + (on ? ' focused' : '');
    });
    var row = Math.floor(gridIndex / COLS);
    var rowH = 135 + 16 + 30 + 46;
    $('grid').style.transform = 'translateY(' + (-Math.max(0, row - 1) * rowH) + 'px)';
  }

  // ---------------------------------------------------------------- Menu d'options
  var menuItems = [];
  var menuIndex = 0;
  var menuReturn = 'dock';

  function openMenu(title, items) {
    menuReturn = zone;
    menuItems = items;
    menuIndex = 0;
    $('menuTitle').textContent = title;
    var list = $('menuList');
    list.innerHTML = '';
    each(items, function (it) {
      var o = document.createElement('div');
      o.className = 'opt';
      o.textContent = it.label;
      list.appendChild(o);
    });
    zone = 'menu';
    setBody('menu', true);
    focusMenu();
  }
  function focusMenu() {
    each($('menuList').children, function (o, i) { o.className = i === menuIndex ? 'opt focused' : 'opt'; });
  }
  function closeMenu() {
    zone = menuReturn;
    setBody('menu', false);
    setBody('log', false);
    if (zone === 'dock') focusDock(); else focusGrid();
  }

  function dockMenu() {
    var list = visibleDock();
    var app = list[dockIndex];
    if (!app) return;
    openMenu(app.name, [
      { label: 'Ouvrir', run: function () { launch(app); } },
      { label: 'Déplacer vers la gauche', run: function () { moveInDock(app.id, -1); } },
      { label: 'Déplacer vers la droite', run: function () { moveInDock(app.id, 1); } },
      { label: 'Retirer du dock', run: function () { removeFromDock(app.id); } },
      { label: 'Annuler', run: function () {} }
    ]);
  }

  function gridMenu() {
    var item = gridItems[gridIndex];
    if (!item || item.type !== 'app') return;
    var app = item.app;
    var inDock = dock.indexOf(app.id) !== -1;
    var isHidden = hidden.indexOf(app.id) !== -1;
    openMenu(app.name, [
      { label: 'Ouvrir', run: function () { launch(app); } },
      inDock ? { label: 'Retirer du dock', run: function () { removeFromDock(app.id); } }
             : { label: 'Ajouter au dock', run: function () { dock.push(app.id); save(STORE.dock, dock); renderDock(); renderGrid(); showToast(app.name + ' ajouté au dock', 2500); } },
      isHidden ? { label: 'Ne plus masquer', run: function () { hidden.splice(hidden.indexOf(app.id), 1); save(STORE.hidden, hidden); renderGrid(); } }
               : { label: 'Masquer de cette liste', run: function () { hidden.push(app.id); save(STORE.hidden, hidden); renderGrid(); } },
      { label: 'Annuler', run: function () {} }
    ]);
  }

  function moveInDock(id, delta) {
    var i = dock.indexOf(id);
    var j = i + delta;
    // Saute les applis du dock qui ne sont plus installées.
    while (j >= 0 && j < dock.length && !byId[dock[j]]) j += delta;
    if (i < 0 || j < 0 || j >= dock.length) return;
    dock.splice(i, 1);
    dock.splice(j, 0, id);
    save(STORE.dock, dock);
    var list = visibleDock();
    for (var k = 0; k < list.length; k++) if (list[k].id === id) dockIndex = k;
    renderDock();
  }
  function removeFromDock(id) {
    var i = dock.indexOf(id);
    if (i < 0) return;
    dock.splice(i, 1);
    save(STORE.dock, dock);
    renderDock();
    renderGrid();
  }

  // ---------------------------------------------------------------- Remplacer l'accueil Samsung
  // Le service écoute l'API publique des états d'applis : quand l'accueil Samsung s'affiche
  // (touche Home, allumage, sortie d'une appli), il rouvre TizenBrew, donc Horizon.
  var seenLearn = 0;
  var seenFail = 0;
  var seenAuto = 0;

  function api(path, done) {
    if (DEMO) { done(null, demoStatus(path)); return; }
    var xhr = new XMLHttpRequest();
    xhr.open('GET', API + path);
    xhr.timeout = 4000;
    xhr.onload = function () {
      var data = null;
      try { data = JSON.parse(xhr.responseText); } catch (e) {}
      done(data ? null : new Error('json'), data);
    };
    xhr.onerror = xhr.ontimeout = function () { done(new Error('service')); };
    xhr.send();
  }

  var demo = { enabled: false, homeIds: [], listener: true, tizenbrew: 'demo.TizenBrew' };
  function demoStatus(path) {
    if (path.indexOf('/takeover/set') === 0) demo.enabled = /enabled=1/.test(path);
    if (path === '/takeover/learn') { demo.homeIds = ['com.samsung.tv.home']; demo.enabled = true; }
    if (path === '/events') return { events: [{ t: Date.now(), id: 'com.samsung.tv.home', active: true }], status: demo };
    return demo;
  }

  function settingsMenu() {
    api('/takeover', function (err, st) {
      if (err || !st) { showToast('Service Horizon indisponible : relance TizenBrew', 5000); return; }
      var items = [];
      if (!st.listener) {
        items.push({ label: 'Remplacer l\u2019accueil : non pris en charge par cette TV', run: function () {} });
      } else if (!st.homeIds || !st.homeIds.length) {
        items.push({ label: 'Remplacer l\u2019accueil Samsung\u2026', run: learnHome });
      } else {
        items.push(st.enabled
          ? { label: 'Remplacer l\u2019accueil Samsung : activé', run: function () { setTakeover(false); } }
          : { label: 'Remplacer l\u2019accueil Samsung : désactivé', run: function () { setTakeover(true); } });
        items.push({ label: 'Réapprendre la touche Home', run: learnHome });
      }
      items.push({ label: 'Journal technique', run: showLog });
      items.push({ label: 'Fermer', run: function () {} });
      openMenu('Réglages Horizon', items);
    });
  }

  function setTakeover(on) {
    api('/takeover/set?enabled=' + (on ? '1' : '0'), function (err) {
      if (err) { showToast('Service Horizon indisponible', 4000); return; }
      showToast(on ? 'Horizon remplace l\u2019accueil Samsung' : 'L\u2019accueil Samsung est de retour', 4000);
    });
  }

  function learnHome() {
    api('/takeover/learn', function (err) {
      if (err) { showToast('Service Horizon indisponible', 4000); return; }
      showToast('Appuie maintenant sur la touche Home de la télécommande', 12000);
    });
  }

  function showLog() {
    api('/events', function (err, data) {
      if (err || !data) { showToast('Service Horizon indisponible', 4000); return; }
      var st = data.status || {};
      var lines = [];
      lines.push({ label: 'Écoute : ' + (st.listener ? 'active' : 'indisponible' + (st.listenerError ? ' (' + st.listenerError + ')' : '')) });
      lines.push({ label: 'TizenBrew : ' + (st.tizenbrew || 'introuvable') });
      lines.push({ label: 'Accueil Samsung : ' + ((st.homeIds && st.homeIds.join(', ')) || 'pas encore appris') });
      lines.push({ label: 'Remplacement : ' + (st.enabled ? 'activé' : 'désactivé') + (st.configSaved ? '' : ' (réglage non enregistré)') });
      var ev = (data.events || []).slice(-8).reverse();
      each(ev, function (e) {
        var d = new Date(e.t);
        lines.push({ label: pad(d.getHours()) + ':' + pad(d.getMinutes()) + ':' + pad(d.getSeconds()) + '  ' + (e.active ? '\u25b2 ' : '\u25bd ') + e.id });
      });
      each(lines, function (l) { l.run = function () {}; });
      openMenu('Journal technique', lines);
      setBody('log', true);
    });
  }

  // Au retour sur Horizon : résultat de l'apprentissage ou coupure de sécurité.
  function checkTakeover() {
    if (DEMO) return;
    api('/takeover', function (err, st) {
      if (err || !st) return;
      var recent = function (t) { return t && st.now - t < 90000; };
      if (recent(st.learnedAt) && st.learnedAt !== seenLearn) {
        seenLearn = st.learnedAt;
        showToast('C\u2019est fait : Home ouvre Horizon. Home deux fois de suite : accueil Samsung', 9000);
      } else if (recent(st.learnFailedAt) && st.learnFailedAt !== seenFail) {
        seenFail = st.learnFailedAt;
        showToast('La TV n\u2019a pas signalé son accueil : remplacement impossible', 9000);
      } else if (recent(st.autoDisabledAt) && st.autoDisabledAt !== seenAuto) {
        seenAuto = st.autoDisabledAt;
        showToast('Remplacement de l\u2019accueil coupé par sécurité', 9000);
      }
    });
  }

  // ---------------------------------------------------------------- Ambiance et messages
  var idleTimer = null;
  function setBody(cls, on) {
    var c = ' ' + document.body.className + ' ';
    c = c.replace(' ' + cls + ' ', ' ');
    document.body.className = (on ? c + cls : c).replace(/^\s+|\s+$/g, '');
  }
  function isAmbient() { return (' ' + document.body.className + ' ').indexOf(' ambient ') !== -1; }
  function ambient(on) { setBody('ambient', on); }
  function resetIdle() {
    clearTimeout(idleTimer);
    idleTimer = setTimeout(function () { if (zone === 'dock') ambient(true); }, C.idleSeconds * 1000);
  }

  var toastTimer = null;
  function showToast(text, ms) {
    var t = $('toast');
    t.textContent = text;
    t.className = 'on';
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.className = ''; }, ms || 2500);
  }

  function openDrawer() {
    zone = 'grid';
    setBody('drawer', true);
    focusDock();
    focusGrid();
  }
  function closeDrawer() {
    zone = 'dock';
    setBody('drawer', false);
    focusGrid();
    focusDock();
  }

  // ---------------------------------------------------------------- Télécommande
  var enterDown = false;
  var longPressed = false;
  var enterTimer = null;

  function activate() {
    if (zone === 'dock') {
      var app = visibleDock()[dockIndex];
      if (app) launch(app); else openDrawer();
    } else if (zone === 'grid') {
      var item = gridItems[gridIndex];
      if (!item) return;
      if (item.type === 'toggle') { showHidden = !showHidden; renderGrid(); }
      else if (item.type === 'settings') settingsMenu();
      else launch(item.app);
    } else if (zone === 'menu') {
      var it = menuItems[menuIndex];
      closeMenu();
      if (it) it.run();
    }
  }

  function longPress() {
    longPressed = true;
    if (zone === 'dock') dockMenu();
    else if (zone === 'grid') gridMenu();
  }

  function move(code) {
    if (zone === 'dock') {
      var n = visibleDock().length;
      if (code === KEY.LEFT && dockIndex > 0) dockIndex--;
      else if (code === KEY.RIGHT && dockIndex < n - 1) dockIndex++;
      else if (code === KEY.DOWN) { openDrawer(); return; }
      focusDock();
    } else if (zone === 'grid') {
      var total = gridItems.length;
      if (code === KEY.LEFT && gridIndex % COLS > 0) gridIndex--;
      else if (code === KEY.RIGHT && gridIndex % COLS < COLS - 1 && gridIndex < total - 1) gridIndex++;
      else if (code === KEY.DOWN && gridIndex + COLS < total) gridIndex += COLS;
      else if (code === KEY.DOWN && Math.floor(gridIndex / COLS) < Math.floor((total - 1) / COLS)) gridIndex = total - 1;
      else if (code === KEY.UP) {
        if (gridIndex < COLS) { closeDrawer(); return; }
        gridIndex -= COLS;
      }
      focusGrid();
    } else if (zone === 'menu') {
      if (code === KEY.UP && menuIndex > 0) menuIndex--;
      else if (code === KEY.DOWN && menuIndex < menuItems.length - 1) menuIndex++;
      focusMenu();
    }
  }

  function back() {
    if (zone === 'menu') closeMenu();
    else if (zone === 'grid') closeDrawer();
    else ambient(true); // sur l'accueil, Retour lance le mode ambiance (rien d'autre ne se ferme)
  }

  document.addEventListener('keydown', function (e) {
    var code = e.keyCode;
    e.preventDefault();
    resetIdle();
    if (isAmbient()) {
      if (code === KEY.ENTER) enterDown = false;
      ambient(false);
      return;
    }
    if (code === KEY.ENTER) {
      if (enterDown) return; // répétition de touche maintenue
      enterDown = true;
      longPressed = false;
      clearTimeout(enterTimer);
      if (zone !== 'menu') enterTimer = setTimeout(longPress, LONG_PRESS);
      return;
    }
    if (code === KEY.BACK || code === KEY.ESC || code === KEY.BACKSPACE) { back(); return; }
    move(code);
  });

  document.addEventListener('keyup', function (e) {
    if (e.keyCode !== KEY.ENTER) return;
    if (!enterDown) return;
    enterDown = false;
    clearTimeout(enterTimer);
    if (!longPressed) activate();
  });

  // Quand on revient d'une appli : horloge à jour, accueil réaffiché, liste des applis rafraîchie.
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) { clearTimeout(wallTimer); return; }
    tick();
    if (zone === 'grid') closeDrawer();
    ambient(false);
    resetIdle();
    loadApps(1);
    nextWallpaper();
    checkTakeover();
  });

  // ---------------------------------------------------------------- Démarrage
  tick();
  setInterval(tick, 10000);
  startWallpapers();
  loadApps(1);
  resetIdle();
  setTimeout(checkTakeover, 1500);
})();
