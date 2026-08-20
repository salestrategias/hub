/* SAL Blog: menu, barra de cookies e medição — a mesma escolha do site. */
(function () {
  'use strict';

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

  /* dia/noite: mesma chave do site (tema), o visitante transita sem quebra */
  var tb = document.querySelector('.tema-btn');
  if (tb) tb.addEventListener('click', function () {
    var claro = document.documentElement.getAttribute('data-tema') !== 'claro';
    if (claro) document.documentElement.setAttribute('data-tema', 'claro');
    else document.documentElement.removeAttribute('data-tema');
    try { localStorage.setItem('tema', claro ? 'claro' : 'escuro'); } catch (e) {}
    var m = document.querySelector('meta[name="theme-color"]');
    if (m) m.setAttribute('content', claro ? '#F7F9FC' : '#0B1526');
  });

  /* Consentimento: mesma chave do site estático (sal-cookies), então quem
     já decidiu lá não vê a barra de novo aqui. */
  var CHAVE = 'sal-cookies';
  var GA = (window.SAL && window.SAL.ga) || '';
  var barra = document.getElementById('cookies');

  function guardado() { try { return localStorage.getItem(CHAVE); } catch (e) { return null; } }
  function guardar(v) { try { localStorage.setItem(CHAVE, v); } catch (e) { /* sem storage */ } }

  function medir() {
    if (!GA || window.__salGa) return;
    window.__salGa = true;
    window.dataLayer = window.dataLayer || [];
    window.gtag = function () { window.dataLayer.push(arguments); };
    window.gtag('js', new Date());
    window.gtag('config', GA, { anonymize_ip: true, allow_google_signals: false });
    var s = document.createElement('script');
    s.async = true;
    s.src = 'https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(GA);
    document.head.appendChild(s);
  }

  if (barra) {
    barra.addEventListener('click', function (e) {
      var alvo = e.target.closest('[data-cookies]');
      if (!alvo) return;
      var v = alvo.getAttribute('data-cookies');
      guardar(v);
      if (v === 'aceitar') medir();
      barra.hidden = true;
    });
    var escolha = guardado();
    if (escolha === 'aceitar') medir();
    else if (escolha !== 'recusar') barra.hidden = false;
  }

  /* Busca navega por caminho (/blog/search/termo/): o cache de página do
     servidor ignora query strings, então ?s= nunca chegaria ao WordPress. */
  document.querySelectorAll('form.busca').forEach(function (f) {
    f.addEventListener('submit', function (e) {
      var campo = f.querySelector('input[name="s"]');
      var termo = campo ? campo.value.trim() : '';
      e.preventDefault();
      if (!termo) return;
      var base = (f.getAttribute('action') || '/').replace(/\/+$/, '');
      window.location = base + '/search/' + encodeURIComponent(termo) + '/';
    });
  });

  /* Tabelas dentro do artigo rolam na horizontal em vez de estourar a folha. */
  document.querySelectorAll('.conteudo table').forEach(function (t) {
    if (t.parentElement && t.parentElement.classList.contains('rolagem')) return;
    var caixa = document.createElement('div');
    caixa.className = 'rolagem';
    t.parentNode.insertBefore(caixa, t);
    caixa.appendChild(t);
  });
})();
