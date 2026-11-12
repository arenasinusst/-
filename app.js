(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var nativeApp = window.NIGHTGLOW_NATIVE === true;
  var storageKey = 'nightglow-settings';
  var defaults = {text: '今晚开心', color: '#ff3aaf', style: 'tube', size: 100, glow: 70, motion: 'still', speed: 4, direction: 'left', breathe: false, background: 'grid', brightness: 100};
  var prefs = Object.assign({}, defaults);
  try {
    var saved = JSON.parse(window.NIGHTGLOW_SETTINGS || localStorage.getItem(storageKey) || '{}');
    Object.keys(defaults).forEach(function (key) { if (typeof saved[key] === typeof defaults[key]) prefs[key] = saved[key]; });
  } catch (e) {}
  function clamp(value, min, max, fallback) { return Number.isFinite(Number(value)) ? Math.max(min, Math.min(max, Number(value))) : fallback; }
  function cleanText(value) { return Array.from(String(value).replace(/[\r\n]+/g, ' ')).slice(0, 60).join(''); }
  prefs.text = cleanText(prefs.text);
  if (!/^#[0-9a-f]{6}$/i.test(prefs.color)) prefs.color = defaults.color;
  prefs.color = prefs.color.toLowerCase();
  [['style', ['tube', 'solid', 'outline']], ['motion', ['still', 'scroll']], ['direction', ['left', 'right']], ['background', ['grid', 'black']]].forEach(function (entry) { if (entry[1].indexOf(prefs[entry[0]]) < 0) prefs[entry[0]] = defaults[entry[0]]; });
  prefs.size = clamp(prefs.size, 60, 180, 100);
  prefs.glow = clamp(prefs.glow, 30, 100, 70);
  prefs.speed = clamp(prefs.speed, 1, 10, 4);
  prefs.brightness = clamp(prefs.brightness, 25, 100, 100);
  var colorNames = {'#ff3aaf': '霓虹粉', '#4df5ff': '冰川蓝', '#ae7aff': '梦境紫', '#b7ff65': '青柠绿', '#ffbf55': '日落橙'};
  var styleNames = {tube: '霓虹灯管', solid: '柔光字', outline: '空心字'};
  // Offline snapshot of the Spanish title column from Notion.
  var spanishVocabulary = ["rodilla", "hacha", "estereotipo", "clímax", "gancho", "percha", "perchero", "condimentar", "velcro", "destornillador", "morder", "ladrar", "amenazar", "atardecer", "amanecer", "la puesta del sol", "rodamiento", "impartir", "encargado", "azararse", "darlo todo", "dar lugar a", "lectura", "adquirir", "optar", "apostar por", "descenso", "abaratar", "puesto que", "prever", "salir a cuenta", "optar por/a", "desembolsar", "amortización", "metros cuadrados", "rigor", "estropear", "avería", "someter", "trazar", "selva", "fiera", "presa", "masticar", "aparato", "involucrarse", "relativo", "destacar", "derogación", "acarrear", "criterio", "restante", "retirar", "abastecer", "hucha", "atribuir", "interrogar", "impedir que", "asesorar", "portada", "entrañable", "discurso", "comprobar", "ensayo", "resistencia", "pliego", "diáfano", "sereno", "bastón", "polvoriento", "cisne", "escaño", "naufragar", "cuaderno", "fraguar", "rigor de fierro", "reposo", "suplemento", "astucia", "redimir", "basado en", "pormenor", "temor", "azaroso", "arduo", "alentador", "hallar", "ejemplar", "terminante", "severidad", "relativamente sencillo", "articular", "alborozo", "convenio", "acentuar", "inclemente", "deslucir", "ojear", "rescatar", "stock salvo venta", "puntos de anclaje", "resguardo", "contingencia", "diagnosticar", "padecer", "consentimiento", "vigente", "casilla", "rogar", "llevar consigo el NIE", "fibra", "citado", "acreditar", "acreditado", "envoltura", "envolver", "encuesta", "intervenir", "alerta", "delicadamente", "de veras", "anzuelo", "anciano", "insinuar", "tornarse", "salvaje", "constar de", "chaleco", "sedentario", "cuerda", "ambulante", "oficio", "apodo", "sucesor", "butaca", "delito", "penoso", "inquilino", "excentrico", "semejante", "suculenta", "repostería", "pavimento", "mosaico", "vestíbulo", "retrasar", "atrasar", "cronométrico", "convenir a algo", "fatigar", "fatiga", "consignar", "presupuesto", "recorrer", "suceso", "extraviado", "arrepentirse de", "censar", "a través de", "veterinario", "perseguir", "obstáculo", "requisito", "disponer de", "obligatoriedad", "decreto", "ordenanza", "imposición", "aplazar", "soltar", "comportar", "obedecer", "desobedecer", "inauguración", "inaugurar", "consistorio", "señalar", "comportarse", "sanción", "correa", "importe", "tras", "suelto", "apretar", "flojo", "tal y como", "desatar", "mentalizar", "apropiado", "pretender", "atestiguar", "de tal manera que", "propósito", "rectificar", "comunicativo", "avariento", "prodigar"];
  var wordSession = null, wordReturnText = null, wordTimer = null;
  var paused = false, presenting = false, offlineReady = nativeApp;
  var saveTimer, layoutFrame, controlsTimer, toastTimer, wakeLock = null, fullscreenRequested = false;
  var helpReturnFocus = null, presentReturnFocus = null;
  var reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  function saveNow() {
    clearTimeout(saveTimer);
    var json = JSON.stringify(prefs);
    try { localStorage.setItem(storageKey, json); } catch (e) {}
    if (nativeApp) {
      try { window.webkit.messageHandlers.persistSettings.postMessage(json); } catch (e) {}
    }
  }
  function scheduleSave() { clearTimeout(saveTimer); saveTimer = setTimeout(saveNow, 160); }
  function toast(message) {
    clearTimeout(toastTimer); $('toast').textContent = message; $('toast').hidden = false;
    toastTimer = setTimeout(function () { $('toast').hidden = true; }, 3200);
  }
  function setPressed(selector, property) {
    Array.prototype.forEach.call(document.querySelectorAll(selector), function (button) {
      var attribute = selector.slice(1, -1);
      button.setAttribute('aria-pressed', String(button.getAttribute(attribute) === prefs[property]));
    });
  }
  function syncControls() {
    $('message').value = prefs.text;
    $('character-count').textContent = Array.from(prefs.text).length + ' / 60';
    $('custom-color').value = prefs.color;
    $('color-name').textContent = colorNames[prefs.color] || '自定义';
    $('text-size').value = prefs.size;
    $('size-value').textContent = Math.round(prefs.size) + '%';
    $('glow').value = prefs.glow;
    $('glow-value').textContent = Math.round(prefs.glow) + '%';
    $('speed').value = prefs.speed;
    $('speed-value').textContent = Math.round(prefs.speed) + ' 档';
    $('brightness').value = prefs.brightness;
    $('brightness-value').textContent = Math.round(prefs.brightness) + '%';
    $('breathe').checked = prefs.breathe;
    $('scroll-settings').hidden = prefs.motion !== 'scroll';
    $('present-button').disabled = !prefs.text.trim();
    $('quick-present').disabled = !prefs.text.trim();
    [['[data-color]', 'color'], ['[data-style]', 'style'], ['[data-motion]', 'motion'], ['[data-direction]', 'direction'], ['[data-background]', 'background']].forEach(function (entry) { setPressed(entry[0], entry[1]); });
    syncWordControls();
  }
  function syncWordControls() {
    var active = !!wordSession;
    var progress = active ? '第 ' + (wordSession.index + 1) + ' / 10 个' : '';
    $('draw-words').textContent = active ? '重新抽取 10 个' : '✦ 随机抽取 10 个';
    $('word-navigation').hidden = !active;
    $('vocabulary-progress').hidden = !active;
    $('vocabulary-progress').textContent = progress;
    $('word-previous').disabled = !active || wordSession.index === 0;
    $('word-next').disabled = !active || wordSession.index >= wordSession.words.length - 1;
    $('presentation-word-previous').hidden = !active;
    $('presentation-word-next').hidden = !active;
    $('presentation-word-progress').hidden = !active;
    $('presentation-word-progress').textContent = progress;
  }
  function stopWordTimer() {
    clearInterval(wordTimer);
    wordTimer = null;
  }
  function showVocabularyWord(index) {
    if (!wordSession) return;
    wordSession.index = Math.max(0, Math.min(wordSession.words.length - 1, index));
    prefs.text = wordSession.words[wordSession.index];
    if (wordSession.index === wordSession.words.length - 1) stopWordTimer();
    apply();
    scheduleSave();
  }
  function moveVocabularyWord(offset) {
    if (!wordSession) return;
    var next = wordSession.index + offset;
    if (next < 0 || next >= wordSession.words.length) return;
    showVocabularyWord(next);
    if (next < wordSession.words.length - 1) {
      stopWordTimer();
      wordTimer = setInterval(function () {
        if (!wordSession || wordSession.index >= wordSession.words.length - 1) { stopWordTimer(); return; }
        showVocabularyWord(wordSession.index + 1);
      }, 5000);
    }
  }
  function drawVocabularyWords() {
    stopWordTimer();
    var pool = Array.from(new Set(spanishVocabulary));
    for (var i = pool.length - 1; i > 0; i--) {
      var swap = Math.floor(Math.random() * (i + 1));
      var value = pool[i]; pool[i] = pool[swap]; pool[swap] = value;
    }
    if (!wordSession) wordReturnText = prefs.text;
    wordSession = {words: pool.slice(0, 10), index: 0};
    showVocabularyWord(0);
    wordTimer = setInterval(function () {
      if (!wordSession || wordSession.index >= wordSession.words.length - 1) { stopWordTimer(); return; }
      showVocabularyWord(wordSession.index + 1);
    }, 5000);
    toast('已从离线词库抽出 10 个单词');
  }
  function endVocabularySession(restoreText) {
    stopWordTimer();
    wordSession = null;
    if (restoreText && wordReturnText !== null) prefs.text = wordReturnText;
    wordReturnText = null;
    apply();
    scheduleSave();
  }
  function animationState() {
    var animated = prefs.motion === 'scroll' || prefs.breathe;
    var effectivePause = paused || reducedMotion.matches;
    document.body.classList.toggle('is-paused', effectivePause);
    $('preview-pause').disabled = !animated || reducedMotion.matches;
    $('presentation-pause').hidden = !animated || reducedMotion.matches;
    $('preview-pause').setAttribute('aria-pressed', String(effectivePause));
    $('presentation-pause').setAttribute('aria-pressed', String(effectivePause));
    $('pause-label').textContent = paused ? '继续动效' : '暂停动效';
    $('presentation-pause').setAttribute('aria-label', paused ? '继续动效' : '暂停动效');
    $('pause-icon').setAttribute('href', paused ? '#i-play' : '#i-pause');
    $('presentation-pause-icon').setAttribute('href', paused ? '#i-play' : '#i-pause');
    $('preview-type').textContent = styleNames[prefs.style] + ' / ' + (prefs.motion === 'scroll' ? '滚动' : (prefs.breathe ? '呼吸' : '常亮'));
    $('display-note').textContent = reducedMotion.matches && animated ? '已跟随系统减少动态效果' : (paused && animated ? '动效已暂停' : '灯光已点亮');
  }
  function makeWord() {
    var span = document.createElement('span');
    span.className = 'neon-word'; span.textContent = prefs.text;
    return span;
  }
  function layoutSign() {
    layoutFrame = null;
    var board = $('board'), rect = board.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    var fontSize = Math.min(rect.width * 0.19, rect.height * 0.48) * prefs.size / 100;
    fontSize = Math.max(8, Math.min(fontSize, rect.height * 0.56));
    board.style.setProperty('--sign-size', fontSize + 'px');
    var groupA = $('group-a'), groupB = $('group-b');
    groupA.textContent = ''; groupB.textContent = '';
    var word = makeWord(); word.style.paddingRight = '0px'; groupA.appendChild(word);
    var measured = word.getBoundingClientRect().width || fontSize * Math.max(1, Array.from(prefs.text).length);
    var widthLimit = rect.width * 0.9;
    if (prefs.motion === 'still' && measured > widthLimit) {
      fontSize = Math.max(4, fontSize * widthLimit / measured);
      board.style.setProperty('--sign-size', fontSize + 'px');
    }
    groupB.hidden = prefs.motion !== 'scroll';
    if (prefs.motion === 'scroll') {
      var gap = Math.max(60, fontSize * 0.9);
      board.style.setProperty('--word-gap', gap + 'px');
      word.style.paddingRight = '';
      var count = Math.max(2, Math.min(12, Math.ceil(rect.width / (measured + gap)) + 1));
      for (var i = 1; i < count; i++) groupA.appendChild(makeWord());
      for (var j = 0; j < count; j++) groupB.appendChild(makeWord());
      var groupWidth = groupA.getBoundingClientRect().width || count * (measured + gap);
      board.style.setProperty('--duration', Math.max(4, groupWidth / (25 + prefs.speed * 19)) + 's');
    }
    if (fontSize < 22 && prefs.text.trim() && prefs.motion === 'still') $('display-note').textContent = '长句用滚动展示，会更清晰';
  }
  function scheduleLayout() { if (!layoutFrame) layoutFrame = requestAnimationFrame(layoutSign); }
  function apply() {
    var rgb = [1, 3, 5].map(function (start) { return parseInt(prefs.color.slice(start, start + 2), 16); }).join(',');
    document.documentElement.style.setProperty('--neon', prefs.color);
    document.documentElement.style.setProperty('--neon-rgb', rgb);
    document.documentElement.style.setProperty('--glow', String(prefs.glow / 70));
    document.documentElement.style.setProperty('--light', String(prefs.brightness / 100));
    $('board').className = 'board style-' + prefs.style + ' background-' + prefs.background + (prefs.motion === 'scroll' ? ' is-scrolling' : '') + (prefs.direction === 'right' ? ' direction-right' : '') + (prefs.breathe ? ' breathing' : '');
    $('board').setAttribute('aria-label', prefs.text.trim() ? '霓虹灯牌：' + prefs.text : '空白灯牌');
    $('empty-message').hidden = !!prefs.text.trim();
    $('marquee-window').hidden = !prefs.text.trim();
    syncControls(); animationState(); scheduleLayout();
  }
  function change(property, value) { prefs[property] = value; if (property === 'motion' || property === 'breathe') paused = false; apply(); scheduleSave(); }
  function togglePause() {
    if (reducedMotion.matches || (prefs.motion === 'still' && !prefs.breathe)) return;
    paused = !paused; animationState(); showPresentationControls();
  }
  function showPresentationControls() {
    clearTimeout(controlsTimer); document.body.classList.remove('controls-hidden');
    if (presenting) controlsTimer = setTimeout(function () { document.body.classList.add('controls-hidden'); }, 3500);
  }
  function present(value) {
    if (value && !prefs.text.trim()) { toast('先输入灯牌文字'); return; }
    if (presenting === value) return;
    presenting = value;
    document.body.classList.toggle('is-presenting', value);
    $('presentation-controls').hidden = !value;
    $('app-shell').setAttribute('aria-label', value ? '正在展示灯牌' : '编辑灯牌');
    if (value) {
      presentReturnFocus = document.activeElement;
      saveNow(); $('board').focus(); showPresentationControls(); requestWakeLock();
      var method = document.documentElement.requestFullscreen || document.documentElement.webkitRequestFullscreen;
      if (!nativeApp && method) {
        try { fullscreenRequested = true; var result = method.call(document.documentElement); if (result && result.catch) result.catch(function () { fullscreenRequested = false; }); } catch (e) { fullscreenRequested = false; }
      }
    } else {
      clearTimeout(controlsTimer); document.body.classList.remove('controls-hidden');
      var exit = document.exitFullscreen || document.webkitExitFullscreen;
      if (!nativeApp && (document.fullscreenElement || document.webkitFullscreenElement) && exit) {
        try { var promise = exit.call(document); if (promise && promise.catch) promise.catch(function () {}); } catch (e) {}
      }
      fullscreenRequested = false;
      if (presentReturnFocus && presentReturnFocus.focus) presentReturnFocus.focus({preventScroll: true});
    }
    scheduleLayout();
  }
  function closeHelp() {
    $('help-overlay').hidden = true;
    if (helpReturnFocus && helpReturnFocus.focus) helpReturnFocus.focus();
  }
  function openHelp() {
    helpReturnFocus = document.activeElement;
    if (nativeApp) {
      $('install-guide').textContent = '全部文字效果和素材都内置在 App 中，无需账号或网络。普通覆盖更新时会保留本机设置。';
      $('wake-guide').textContent = 'App 在前台时自动保持屏幕常亮，离开后恢复系统控制。';
      $('download-link').hidden = true;
    }
    $('help-overlay').hidden = false; $('help-overlay').querySelector('[role=dialog]').focus();
  }
  function requestWakeLock() {
    if (nativeApp || !('wakeLock' in navigator) || document.hidden || wakeLock) return;
    navigator.wakeLock.request('screen').then(function (lock) { wakeLock = lock; lock.addEventListener('release', function () { if (wakeLock === lock) wakeLock = null; }); }).catch(function () {});
  }

  $('message').addEventListener('input', function (event) {
    var value = cleanText(event.target.value);
    if (wordSession) { stopWordTimer(); wordSession = null; wordReturnText = null; syncWordControls(); }
    change('text', value);
  });
  $('draw-words').addEventListener('click', drawVocabularyWords);
  $('word-previous').addEventListener('click', function () { moveVocabularyWord(-1); });
  $('word-next').addEventListener('click', function () { moveVocabularyWord(1); });
  $('word-stop').addEventListener('click', function () { endVocabularySession(true); });
  $('presentation-word-previous').addEventListener('click', function () { moveVocabularyWord(-1); });
  $('presentation-word-next').addEventListener('click', function () { moveVocabularyWord(1); });
  [['[data-color]', 'color'], ['[data-style]', 'style'], ['[data-motion]', 'motion'], ['[data-direction]', 'direction'], ['[data-background]', 'background']].forEach(function (entry) {
    Array.prototype.forEach.call(document.querySelectorAll(entry[0]), function (button) { button.addEventListener('click', function () { change(entry[1], button.getAttribute(entry[0].slice(1, -1))); }); });
  });
  Array.prototype.forEach.call(document.querySelectorAll('[data-preset]'), function (button) { button.addEventListener('click', function () { change('text', button.getAttribute('data-preset')); }); });
  $('custom-color').addEventListener('input', function (event) { if (/^#[0-9a-f]{6}$/i.test(event.target.value)) change('color', event.target.value.toLowerCase()); });
  [['text-size', 'size', 60, 180], ['glow', 'glow', 30, 100], ['speed', 'speed', 1, 10], ['brightness', 'brightness', 25, 100]].forEach(function (entry) { $(entry[0]).addEventListener('input', function (event) { change(entry[1], clamp(event.target.value, entry[2], entry[3], defaults[entry[1]])); }); });
  $('breathe').addEventListener('change', function (event) { change('breathe', event.target.checked); });
  $('reset-button').addEventListener('click', function () { stopWordTimer(); wordSession = null; wordReturnText = null; prefs = Object.assign({}, defaults); paused = false; apply(); saveNow(); toast('已恢复默认灯牌'); });
  $('preview-pause').addEventListener('click', togglePause);
  $('presentation-pause').addEventListener('click', togglePause);
  $('present-button').addEventListener('click', function () { present(true); });
  $('quick-present').addEventListener('click', function () { present(true); });
  $('exit-button').addEventListener('click', function () { present(false); });
  $('board').addEventListener('click', function () { if (presenting) showPresentationControls(); });
  $('board').addEventListener('pointermove', function (event) { if (presenting && event.pointerType === 'mouse') showPresentationControls(); }, {passive: true});
  $('help-button').addEventListener('click', openHelp);
  $('help-close').addEventListener('click', closeHelp);
  $('help-done').addEventListener('click', closeHelp);
  $('help-overlay').addEventListener('click', function (event) { if (event.target === $('help-overlay')) closeHelp(); });
  document.addEventListener('keydown', function (event) {
    if (!$('help-overlay').hidden) {
      if (event.key === 'Escape') closeHelp();
      if (event.key === 'Tab') {
        var focusable = Array.prototype.filter.call($('help-overlay').querySelectorAll('button,a,input'), function (node) { return !node.closest('[hidden]'); });
        var first = focusable[0], last = focusable[focusable.length - 1];
        if (event.shiftKey && (document.activeElement === first || document.activeElement === $('help-overlay').querySelector('[role=dialog]'))) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }
      return;
    }
    if (event.key === 'Escape' && presenting) present(false);
    if (['INPUT', 'TEXTAREA', 'BUTTON', 'A'].indexOf(event.target.tagName) >= 0) return;
    if (event.key.toLowerCase() === 'f') present(!presenting);
    if (event.code === 'Space') { event.preventDefault(); togglePause(); }
  });
  function fullscreenChanged() { if (fullscreenRequested && !(document.fullscreenElement || document.webkitFullscreenElement)) present(false); scheduleLayout(); }
  document.addEventListener('fullscreenchange', fullscreenChanged);
  document.addEventListener('webkitfullscreenchange', fullscreenChanged);
  document.addEventListener('visibilitychange', function () { document.body.classList.toggle('is-sleeping', document.hidden); if (document.hidden) saveNow(); else { requestWakeLock(); scheduleLayout(); } });
  window.addEventListener('pagehide', saveNow);
  window.addEventListener('pageshow', function () { requestWakeLock(); scheduleLayout(); });
  window.addEventListener('resize', scheduleLayout);
  if (typeof ResizeObserver !== 'undefined') new ResizeObserver(scheduleLayout).observe($('board'));
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(scheduleLayout);
  if (reducedMotion.addEventListener) reducedMotion.addEventListener('change', function () { animationState(); scheduleLayout(); });
  $('offline-text').textContent = 'GitHub Pages 网页版';
  $('offline-status').classList.add('ready');
  apply(); requestWakeLock();
})();
