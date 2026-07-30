/* Comportamentos do site: menu, revelação e atualização do destaque do blog. */
(function () {
  var b = document.querySelector('.menu-btn'), n = document.getElementById('nav');
  if (b && n) b.addEventListener('click', function () {
    var o = n.classList.toggle('aberto');
    b.setAttribute('aria-expanded', o ? 'true' : 'false');
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

  /* O destaque do blog vem pronto do build (bom para SEO e para quem
     navega sem JS). Aqui só conferimos se saiu post novo depois
     do último build, para o bloco não envelhecer entre publicações. */
  var caixa = document.querySelector('[data-blog-destaque]');
  if (caixa && 'fetch' in window) {
    fetch('https://www.salestrategias.com.br/wp-json/wp/v2/posts?per_page=1&_embed=wp:term')
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (d) {
        var p = d && d[0];
        if (!p || p.link === caixa.getAttribute('href')) return;
        var limpo = function (s) { var t = document.createElement('textarea'); t.innerHTML = String(s || '').replace(/<[^>]*>/g, ''); return t.value.trim(); };
        var cat = ((((p._embedded || {})['wp:term'] || []).flat()).filter(function (t) { return t && t.taxonomy === 'category'; })[0] || {}).name || 'Blog';
        var campo = function (n) { return caixa.querySelector('[data-campo="' + n + '"]'); };
        caixa.setAttribute('href', p.link);
        if (campo('titulo')) campo('titulo').textContent = limpo(p.title && p.title.rendered);
        if (campo('categoria')) campo('categoria').textContent = cat;
        var t = campo('data');
        if (t) {
          t.setAttribute('datetime', p.date);
          t.textContent = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' }).format(new Date(p.date));
        }
      })
      .catch(function () { /* offline ou API fora: fica o do build */ });
  }
})();
