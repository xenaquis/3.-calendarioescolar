/* search.js — Autocomplete con fuzzy match
   Copiar a public/js/ cuando el sitio necesite búsqueda (visachileno).
   Uso: Search.init('input-id', 'results-id', items, onSelect) */
var Search = (function () {
  function init(inputId, resultsId, items, onSelect) {
    var input = document.getElementById(inputId);
    var results = document.getElementById(resultsId);
    if (!input || !results) return;

    var selectedIndex = -1;

    input.addEventListener('input', function () {
      var query = normalize(input.value.trim());
      if (query.length < 2) {
        results.innerHTML = '';
        results.style.display = 'none';
        return;
      }

      var matches = items
        .filter(function (item) {
          var text = normalize(item.text || item.name || item);
          return text.indexOf(query) !== -1;
        })
        .slice(0, 8);

      if (matches.length === 0) {
        results.innerHTML = '<div class="search-no-results">Sin resultados</div>';
        results.style.display = 'block';
        return;
      }

      selectedIndex = -1;
      results.innerHTML = matches.map(function (item, i) {
        var label = item.text || item.name || item;
        return '<div class="search-item" data-index="' + i + '" role="option">' + escapeHtml(label) + '</div>';
      }).join('');
      results.style.display = 'block';

      // Click en resultado
      results.querySelectorAll('.search-item').forEach(function (el, i) {
        el.addEventListener('click', function () {
          select(matches[i]);
        });
      });
    });

    // Navegación con teclado
    input.addEventListener('keydown', function (e) {
      var items_el = results.querySelectorAll('.search-item');
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        selectedIndex = Math.min(selectedIndex + 1, items_el.length - 1);
        highlight(items_el);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        selectedIndex = Math.max(selectedIndex - 1, 0);
        highlight(items_el);
      } else if (e.key === 'Enter' && selectedIndex >= 0) {
        e.preventDefault();
        var matched = items.filter(function (item) {
          return normalize(item.text || item.name || item).indexOf(normalize(input.value.trim())) !== -1;
        }).slice(0, 8);
        if (matched[selectedIndex]) select(matched[selectedIndex]);
      } else if (e.key === 'Escape') {
        results.style.display = 'none';
      }
    });

    // Cerrar al hacer click fuera
    document.addEventListener('click', function (e) {
      if (!input.contains(e.target) && !results.contains(e.target)) {
        results.style.display = 'none';
      }
    });

    function select(item) {
      input.value = item.text || item.name || item;
      results.style.display = 'none';
      if (onSelect) onSelect(item);
    }

    function highlight(els) {
      els.forEach(function (el, i) {
        el.classList.toggle('search-item--active', i === selectedIndex);
      });
    }
  }

  function normalize(str) {
    return str.toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  }

  function escapeHtml(str) {
    var div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  return { init: init };
})();
