/* Comportamentos do site: menu, revelação e atualização do destaque do blog. */
(function () {
  var b = document.querySelector('.menu-btn'), n = document.getElementById('nav');
  if (b && n) b.addEventListener('click', function () {
    var o = n.classList.toggle('aberto');
    b.setAttribute('aria-expanded', o ? 'true' : 'false');
  });

  /* dropdown de serviços: fecha ao clicar fora ou ao escolher um destino */
  var drop = document.querySelector('.drop');
  if (drop) {
    document.addEventListener('click', function (e) {
      if (!drop.contains(e.target)) drop.removeAttribute('open');
    });
    drop.addEventListener('click', function (e) {
      if (e.target.closest && e.target.closest('a')) drop.removeAttribute('open');
    });
  }

  /* dia/noite: alterna o data-tema, guarda a escolha e avisa a barra do navegador */
  var tb = document.querySelector('.tema-btn');
  if (tb) tb.addEventListener('click', function () {
    var claro = document.documentElement.getAttribute('data-tema') !== 'claro';
    if (claro) document.documentElement.setAttribute('data-tema', 'claro');
    else document.documentElement.removeAttribute('data-tema');
    try { localStorage.setItem('tema', claro ? 'claro' : 'escuro'); } catch (e) {}
    var m = document.querySelector('meta[name="theme-color"]');
    if (m) m.setAttribute('content', claro ? '#FBF9F4' : '#0B0A18');
  });
  var alvos = document.querySelectorAll('.rev');
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('on'); io.unobserve(e.target); } });
    }, { rootMargin: '0px 0px -8% 0px' });
    alvos.forEach(function (el) { io.observe(el); });
  } else {
    alvos.forEach(function (el) { el.classList.add('on'); });
  }

  /* O blog vem pronto do build (bom para SEO e para quem navega sem JS).
     Aqui a barra do topo E os três cards são atualizados com o que a API
     tiver de mais novo, para a home nunca envelhecer entre publicações.
     O cb= fura o cache que chegou a servir uma lista com uma semana de
     atraso no próprio build. */
  var caixa = document.querySelector('[data-blog-destaque]');
  var grade = document.querySelector('[data-blog-cards]');
  if ((caixa || grade) && 'fetch' in window) {
    fetch('https://www.salestrategias.com.br/wp-json/wp/v2/posts?per_page=4&_embed=wp:featuredmedia,wp:term&cb=' + Date.now())
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (d) {
        if (!d || !d.length) return;
        var limpo = function (s) { var t = document.createElement('textarea'); t.innerHTML = String(s || '').replace(/<[^>]*>/g, ''); return t.value.trim(); };
        var catDe = function (p) { return ((((p._embedded || {})['wp:term'] || []).flat()).filter(function (t) { return t && t.taxonomy === 'category'; })[0] || {}).name || 'Blog'; };
        var dataBR = function (iso) { return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' }).format(new Date(iso)); };

        // barra do topo: o mais novo
        var p0 = d[0];
        if (caixa && p0.link !== caixa.getAttribute('href')) {
          var campo = function (n) { return caixa.querySelector('[data-campo="' + n + '"]'); };
          caixa.setAttribute('href', p0.link);
          if (campo('titulo')) campo('titulo').textContent = limpo(p0.title && p0.title.rendered);
          if (campo('categoria')) campo('categoria').textContent = catDe(p0);
          var t = campo('data');
          if (t) { t.setAttribute('datetime', p0.date); t.textContent = dataBR(p0.date); }
        }

        // os três cards: 2º ao 4º mais novos
        if (grade) {
          var cards = grade.querySelectorAll('.artigo');
          d.slice(1, 4).forEach(function (p, i) {
            var c = cards[i];
            if (!c) return;
            var a = c.querySelector('a');
            if (!a || a.getAttribute('href') === p.link) return;
            a.setAttribute('href', p.link);
            var capa = (((p._embedded || {})['wp:featuredmedia'] || [])[0] || {}).source_url;
            var fig = c.querySelector('figure');
            if (fig) {
              fig.innerHTML = capa
                ? '<img src="' + capa + '" alt="" loading="lazy" decoding="async" width="640" height="360">'
                : '<span class="sem-capa" aria-hidden="true"></span>';
              var im = fig.querySelector('img');
              if (im) im.alt = limpo(p.title && p.title.rendered);
            }
            var cat = c.querySelector('.artigo-cat');
            if (cat) cat.textContent = catDe(p);
            var h3 = c.querySelector('h3');
            if (h3) h3.textContent = limpo(p.title && p.title.rendered);
            var res = c.querySelector('p');
            if (res) res.textContent = limpo(p.excerpt && p.excerpt.rendered).slice(0, 150) + '…';
            var tm = c.querySelector('time');
            if (tm) { tm.setAttribute('datetime', p.date); tm.textContent = dataBR(p.date); }
            var lt = c.querySelector('[data-leitura]');
            if (lt) {
              var palavras = limpo(p.content && p.content.rendered).split(/\s+/).length;
              lt.textContent = Math.max(1, Math.round(palavras / 200)) + ' min de leitura';
            }
          });
        }
      })
      .catch(function () { /* offline ou API fora: fica o do build */ });
  }
})();
