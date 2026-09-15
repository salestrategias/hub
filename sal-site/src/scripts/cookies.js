/**
 * Consentimento de cookies. Só carrega medição depois do aceite.
 *
 * O identificador do GA4 entra por variável de ambiente. Enquanto não houver
 * um, a barra continua funcionando e apenas guarda a escolha da pessoa.
 */
(function () {
  'use strict';

  var CHAVE = 'sal-cookies';
  var GA = import.meta.env.PUBLIC_GA_ID || '';
  var barra = document.getElementById('cookies');
  if (!barra) return;

  function guardado() {
    try {
      return localStorage.getItem(CHAVE);
    } catch (e) {
      return null; // navegação anônima com storage bloqueado
    }
  }

  function guardar(valor) {
    try {
      localStorage.setItem(CHAVE, valor);
    } catch (e) {
      /* sem storage, a escolha vale só para esta visita */
    }
  }

  function carregarMedicao() {
    if (!GA || window.__salGa) return;
    window.__salGa = true;

    window.dataLayer = window.dataLayer || [];
    window.gtag = function () { window.dataLayer.push(arguments); };
    window.gtag('js', new Date());
    // anonimiza o IP e desliga sinais de publicidade por padrão
    window.gtag('config', GA, { anonymize_ip: true, allow_google_signals: false });

    var s = document.createElement('script');
    s.async = true;
    s.src = 'https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(GA);
    document.head.appendChild(s);
  }

  function fechar() {
    barra.hidden = true;
    barra.classList.remove('visivel');
  }

  function decidir(valor) {
    guardar(valor);
    if (valor === 'aceitar') carregarMedicao();
    fechar();
  }

  barra.addEventListener('click', function (e) {
    var alvo = e.target.closest('[data-cookies]');
    if (alvo) decidir(alvo.getAttribute('data-cookies'));
  });

  var escolha = guardado();
  if (escolha === 'aceitar') {
    carregarMedicao();
  } else if (escolha !== 'recusar') {
    barra.hidden = false;
    requestAnimationFrame(function () { barra.classList.add('visivel'); });
  }

  // permite reabrir a escolha a partir da política de privacidade
  document.addEventListener('click', function (e) {
    if (e.target.closest('[data-rever-cookies]')) {
      e.preventDefault();
      barra.hidden = false;
      requestAnimationFrame(function () { barra.classList.add('visivel'); });
    }
  });
})();
