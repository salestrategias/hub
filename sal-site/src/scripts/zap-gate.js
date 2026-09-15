/* =========================================================================
   Porteira do WhatsApp.

   Qualquer clique em link do wa.me abre um formulário curto (nome, WhatsApp,
   e-mail, site) antes de seguir. Os dados vão para o funil do SAL Hub e a
   pessoa segue para a conversa — mesmo que o registro falhe, ela nunca fica
   presa no meio do caminho.

   Exceção: links com data-zap-livre (a confirmação da agenda, onde a pessoa
   acabou de preencher um formulário inteiro).
   ========================================================================= */
(function () {
  'use strict';

  var HUB = 'https://hub.salestrategias.com.br/api/leads/capture';
  var TOKEN = import.meta.env.PUBLIC_HUB_FORM_TOKEN || '';

  var caixa = document.getElementById('zapgate');
  var form = document.getElementById('zapgate-form');
  if (!caixa || !form) return;

  var destino = '';

  function esconder() {
    caixa.hidden = true;
    document.body.style.overflow = '';
  }

  function mostrar(url) {
    destino = url;
    caixa.hidden = false;
    document.body.style.overflow = 'hidden';
    // devolve o que a pessoa já preencheu numa visita anterior
    try {
      var memoria = JSON.parse(localStorage.getItem('sal-zapgate') || '{}');
      ['nome', 'whatsapp', 'email', 'site'].forEach(function (k) {
        if (memoria[k] && !form.elements[k].value) form.elements[k].value = memoria[k];
      });
    } catch (e) { /* localStorage bloqueado: segue sem memória */ }
    form.elements.nome.focus();
  }

  document.addEventListener('click', function (ev) {
    var a = ev.target.closest ? ev.target.closest('a[href*="wa.me"]') : null;
    if (!a || a.hasAttribute('data-zap-livre')) return;
    ev.preventDefault();
    mostrar(a.href);
  });

  caixa.querySelectorAll('[data-zapgate-fecha]').forEach(function (el) {
    el.addEventListener('click', esconder);
  });
  document.addEventListener('keydown', function (ev) {
    if (ev.key === 'Escape' && !caixa.hidden) esconder();
  });

  // (DD) 9XXXX-XXXX enquanto digita
  form.elements.whatsapp.addEventListener('input', function (e) {
    var d = e.target.value.replace(/\D/g, '').slice(0, 11);
    var s = d;
    if (d.length > 2) s = '(' + d.slice(0, 2) + ') ' + d.slice(2);
    if (d.length > 6) {
      var corte = d.length > 10 ? 7 : 6;
      s = '(' + d.slice(0, 2) + ') ' + d.slice(2, corte) + '-' + d.slice(corte);
    }
    e.target.value = s;
  });

  form.addEventListener('submit', function (ev) {
    ev.preventDefault();
    var erro = document.getElementById('zapgate-erro');
    var v = {
      nome: form.elements.nome.value.trim(),
      whatsapp: form.elements.whatsapp.value.trim(),
      email: form.elements.email.value.trim(),
      site: form.elements.site.value.trim()
    };

    if (v.nome.length < 2) return falhar(erro, 'Como podemos te chamar?');
    if (v.whatsapp.replace(/\D/g, '').length < 10) return falhar(erro, 'Faltou o DDD ou algum dígito no WhatsApp.');
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/.test(v.email)) return falhar(erro, 'Confere esse e-mail? Parece faltar alguma coisa.');
    erro.hidden = true;

    try { localStorage.setItem('sal-zapgate', JSON.stringify(v)); } catch (e) { /* sem memória, sem drama */ }

    // registra no funil sem segurar a pessoa: keepalive faz o envio
    // sobreviver à troca de página que vem logo abaixo
    if (TOKEN) {
      try {
        fetch(HUB, {
          method: 'POST',
          keepalive: true,
          headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + TOKEN },
          body: JSON.stringify({
            nome: v.nome,
            telefone: v.whatsapp,
            email: v.email,
            siteOuInsta: v.site,
            origem: 'site-whatsapp',
            mensagem: 'Clicou no WhatsApp na página ' + location.pathname
          })
        }).catch(function () { /* o funil falhou, a conversa não */ });
      } catch (e) { /* idem */ }
    }

    var url = destino || 'https://wa.me/5551993380278';
    if (url.indexOf('text=') === -1) {
      url += (url.indexOf('?') === -1 ? '?' : '&') + 'text=' +
        encodeURIComponent('Oi! Sou ' + v.nome + '. Vim pelo site da SAL e quero falar sobre o meu negócio.');
    }
    esconder();
    window.location.href = url;
  });

  function falhar(el, msg) { el.textContent = msg; el.hidden = false; }
})();
