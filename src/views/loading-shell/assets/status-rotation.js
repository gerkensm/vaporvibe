(function() {
  var base = __DEFAULT_MESSAGE__;
  var provided = __PROVIDED_MESSAGE__;
  var statuses = __STATUS_MESSAGES__;
  var rotationEnabled = __ROTATION_ENABLED__;
  var pool = statuses.filter(function(entry) { return entry !== provided; });
  for (var i = pool.length - 1; i > 0; i--) {
    var j = Math.floor(Math.random() * (i + 1));
    var tmp = pool[i];
    pool[i] = pool[j];
    pool[j] = tmp;
  }
  var unique = [provided].concat(pool);
  var target = document.querySelector('[data-status]');
  var index = 0;
  if (!rotationEnabled) {
    if (target) {
      target.textContent = provided || base;
    }
    return;
  }
  if (target && unique.length > 1) {
    setTimeout(function() {
      index = (index + 1) % unique.length;
      target.textContent = unique[index];
    }, 900);
    setInterval(function() {
      index = (index + 1) % unique.length;
      target.textContent = unique[index];
    }, 3500);
  } else if (target && unique.length === 1) {
    target.textContent = unique[0] || base;
  }
})();
