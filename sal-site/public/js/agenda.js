/* =========================================================================
   Agenda da SAL — escolha do horário + qualificação em 12 passos.

   Arquitetura, sem servidor próprio:
     GET  APPS_SCRIPT  → devolve os horários JÁ OCUPADOS no Google Calendar
     POST APPS_SCRIPT  → cria o evento e avisa o comercial

   O compromisso vem antes do esforço: a pessoa escolhe o horário primeiro e
   só depois responde as perguntas. Quem já separou um horário na agenda
   desiste muito menos no meio do formulário.
   ========================================================================= */
(function () {
  'use strict';

  // Troque pela URL /exec da implantação do Apps Script (veja apps-script/README.md).
  var APPS_SCRIPT = window.SAL_AGENDA_ENDPOINT || '';
  var WHATSAPP = '5551993380278';

  var DIAS_UTEIS = 10;      // quantos dias úteis mostrar
  var HORA_INI = 9;         // 09:00
  var HORA_FIM = 17;        // último slot às 17:00
  var DURACAO = 30;         // minutos

  var DOW = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
  var MES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
             'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

  /* ---------------------------------------------------------------- perguntas */
  var PERGUNTAS = [
    { id: 'nome', tipo: 'text', q: 'Como podemos te chamar?', ph: 'Seu nome completo', req: true },
    { id: 'email', tipo: 'email', q: 'Qual o seu melhor e-mail?', ph: 'voce@suaempresa.com.br', req: true },
    { id: 'whatsapp', tipo: 'tel', q: 'E o seu WhatsApp?', ph: '(51) 99999-9999', req: true },
    { id: 'empresa', tipo: 'text', q: 'Qual o nome da sua empresa?', ph: 'Ex: Loja Bela Vista', req: true },
    { id: 'site', tipo: 'text', q: 'Tem site, loja virtual ou Perfil no Google?', ph: 'Cole o link ou o @ do Instagram', req: false,
      ajuda: 'Se não tiver nenhum, escreva "não tenho". A gente olha antes da reunião.' },
    { id: 'tipo', tipo: 'escolha', q: 'Que tipo de negócio você tem?', req: true,
      opcoes: ['E-commerce', 'Loja física, uma unidade', 'Rede com várias lojas', 'Loja física e e-commerce', 'Serviço local (clínica, restaurante, academia)'] },
    { id: 'unidades', tipo: 'escolha', q: 'Quantas unidades físicas você tem?', req: true,
      opcoes: ['Uma', 'De 2 a 5', 'De 6 a 15', 'Mais de 15', 'Nenhuma, só vendo online'] },
    { id: 'faturamento', tipo: 'escolha', q: 'Qual o seu faturamento mensal hoje?', req: true,
      opcoes: ['Até R$ 50 mil', 'De R$ 50 mil a R$ 200 mil', 'De R$ 200 mil a R$ 500 mil', 'Acima de R$ 500 mil'] },
    { id: 'hoje', tipo: 'escolha', q: 'O que você já faz de marketing hoje?', req: true,
      opcoes: ['Nada ainda', 'Só anúncio', 'Só orgânico: SEO, Google ou conteúdo', 'Anúncio e orgânico', 'Já tenho agência'] },
    { id: 'verba', tipo: 'escolha', q: 'Quanto pretende investir em anúncios por mês?', req: true,
      opcoes: ['Até R$ 1.500', 'De R$ 1.500 a R$ 5 mil', 'De R$ 5 mil a R$ 20 mil', 'Acima de R$ 20 mil', 'Ainda não sei'],
      ajuda: 'É a verba de anúncio, não o valor do trabalho. Serve para a gente já chegar na reunião com um plano realista.' },
    { id: 'objetivo', tipo: 'escolha', q: 'Qual o seu principal objetivo agora?', req: true,
      opcoes: ['Levar mais gente até a loja', 'Vender mais no e-commerce', 'Aparecer no Google e no mapa', 'Reduzir o custo de aquisição', 'Estruturar a operação do zero'] },
    { id: 'desafio', tipo: 'texto', q: 'Qual o seu maior desafio hoje?', ph: 'Pode escrever à vontade. É o que a gente mais lê antes da reunião.', req: false }
  ];

  var ROTULOS = {
    nome: 'Nome', email: 'E-mail', whatsapp: 'WhatsApp', empresa: 'Empresa',
    site: 'Site / Perfil', tipo: 'Tipo de negócio', unidades: 'Unidades',
    faturamento: 'Faturamento', hoje: 'Faz hoje', verba: 'Verba de anúncio',
    objetivo: 'Objetivo', desafio: 'Desafio'
  };

  /* ---------------------------------------------------------------- estado */
  var respostas = {};
  var passo = 0;               // índice em PERGUNTAS; === length → revisão
  var diaSel = null;           // Date
  var horaSel = null;          // "HH:MM"
  var ocupados = {};           // "YYYY-MM-DD" → Set("HH:MM")

  var $ = function (s) { return document.querySelector(s); };

  /* ---------------------------------------------------------------- utilidades */
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function iso(d) {
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }
  function padSlot(h) { var p = h.split(':'); return String(p[0]).padStart(2, '0') + ':' + p[1]; }
  function diaLongo(d) { return DOW[d.getDay()] + ', ' + d.getDate() + ' de ' + MES[d.getMonth()]; }

  function proximosDias() {
    var out = [], d = new Date(), guard = 0;
    d.setHours(0, 0, 0, 0);
    while (out.length < DIAS_UTEIS && guard++ < 40) {
      if (d.getDay() !== 0 && d.getDay() !== 6) out.push(new Date(d));
      d.setDate(d.getDate() + 1);
    }
    return out;
  }

  function slotsDoDia(d) {
    var out = [], agora = new Date(), hoje = iso(agora) === iso(d);
    for (var h = HORA_INI; h <= HORA_FIM; h++) {
      for (var m = 0; m < 60; m += DURACAO) {
        if (h === HORA_FIM && m > 0) break;
        var rot = String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0');
        var passou = hoje && (h < agora.getHours() || (h === agora.getHours() && m <= agora.getMinutes()));
        var ocupado = (ocupados[iso(d)] || new Set()).has(rot);
        out.push({ hora: rot, livre: !passou && !ocupado });
      }
    }
    return out;
  }

  /* ---------------------------------------------------------------- calendário */
  function pintarDias() {
    var alvo = $('#dias');
    if (!alvo) return;
    alvo.innerHTML = '';
    proximosDias().forEach(function (d) {
      var livres = slotsDoDia(d).filter(function (s) { return s.livre; }).length;
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'dia' + (diaSel && iso(diaSel) === iso(d) ? ' sel' : '') + (livres ? '' : ' vazio');
      b.disabled = !livres;
      b.setAttribute('aria-pressed', diaSel && iso(diaSel) === iso(d) ? 'true' : 'false');
      b.innerHTML = '<span class="dow">' + DOW[d.getDay()] + '</span>' +
                    '<span class="num">' + d.getDate() + '</span>' +
                    '<span class="livres">' + (livres ? livres + ' livres' : 'sem vaga') + '</span>';
      b.addEventListener('click', function () { diaSel = d; horaSel = null; pintarDias(); pintarHoras(); });
      alvo.appendChild(b);
    });
  }

  function pintarHoras() {
    var alvo = $('#horas');
    if (!alvo) return;
    if (!diaSel) { alvo.innerHTML = '<p class="vazio-msg">Escolha um dia ao lado para ver os horários.</p>'; return; }
    alvo.innerHTML = '';
    slotsDoDia(diaSel).forEach(function (s) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'hora' + (horaSel === s.hora ? ' sel' : '');
      b.disabled = !s.livre;
      b.textContent = s.hora;
      b.addEventListener('click', function () { horaSel = s.hora; pintarHoras(); confirmarHorario(); });
      alvo.appendChild(b);
    });
  }

  function confirmarHorario() {
    if (!diaSel || !horaSel) return;
    $('#etapa-horario').hidden = true;
    $('#etapa-form').hidden = false;
    $('#resumo-horario').textContent = diaLongo(diaSel) + ', às ' + horaSel;
    passo = 0;
    pintarPergunta();
    $('#etapa-form').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  /* ---------------------------------------------------------------- formulário */
  function pintarPergunta() {
    var alvo = $('#pergunta');
    if (passo >= PERGUNTAS.length) return pintarRevisao();

    var p = PERGUNTAS[passo];
    var v = respostas[p.id] || '';
    var html = '<p class="passo-num">Pergunta ' + (passo + 1) + ' de ' + PERGUNTAS.length + '</p>' +
               '<h2 id="pergunta-titulo">' + esc(p.q) + '</h2>';
    if (p.ajuda) html += '<p class="ajuda">' + esc(p.ajuda) + '</p>';

    if (p.tipo === 'escolha') {
      html += '<div class="opcoes">';
      p.opcoes.forEach(function (o) {
        html += '<button type="button" class="opcao' + (v === o ? ' sel' : '') + '" data-valor="' + esc(o) + '">' + esc(o) + '</button>';
      });
      html += '</div>';
    } else if (p.tipo === 'texto') {
      html += '<textarea id="campo" rows="4" placeholder="' + esc(p.ph || '') + '">' + esc(v) + '</textarea>';
    } else {
      html += '<input id="campo" type="' + p.tipo + '" value="' + esc(v) + '" placeholder="' + esc(p.ph || '') +
              '" autocomplete="' + (p.id === 'email' ? 'email' : p.id === 'nome' ? 'name' : p.id === 'whatsapp' ? 'tel' : 'off') + '" />';
    }
    html += '<p class="erro" id="erro" hidden></p>';
    alvo.innerHTML = html;

    var barra = $('#progresso-barra');
    if (barra) barra.style.width = ((passo / PERGUNTAS.length) * 100) + '%';
    $('#voltar').hidden = passo === 0;
    $('#avancar').textContent = passo === PERGUNTAS.length - 1 ? 'Revisar respostas' : 'Continuar';

    var campo = $('#campo');
    if (campo) {
      campo.focus();
      if (p.id === 'whatsapp') campo.addEventListener('input', mascaraTelefone);
      campo.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' && p.tipo !== 'texto') { e.preventDefault(); avancar(); }
      });
    }
    alvo.querySelectorAll('.opcao').forEach(function (b) {
      b.addEventListener('click', function () {
        respostas[p.id] = b.getAttribute('data-valor');
        passo++; pintarPergunta();
      });
    });
  }

  // (DD) 9XXXX-XXXX para celular, (DD) XXXX-XXXX para fixo
  function mascaraTelefone(e) {
    var d = e.target.value.replace(/\D/g, '').slice(0, 11);
    var s = d;
    if (d.length > 2) s = '(' + d.slice(0, 2) + ') ' + d.slice(2);
    if (d.length > 6) {
      var corte = d.length > 10 ? 7 : 6;
      s = '(' + d.slice(0, 2) + ') ' + d.slice(2, corte) + '-' + d.slice(corte);
    }
    e.target.value = s;
  }

  function avancar() {
    var p = PERGUNTAS[passo];
    if (!p) return;
    if (p.tipo === 'escolha') return;
    var campo = $('#campo'), valor = campo ? campo.value.trim() : '';
    var erro = $('#erro');

    if (p.req && !valor) return falhar(erro, 'Esse campo é necessário para a gente conseguir te retornar.');
    if (p.tipo === 'email' && valor && !/^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/.test(valor)) return falhar(erro, 'Confere esse e-mail? Parece faltar alguma coisa.');
    if (p.tipo === 'tel' && valor.replace(/\D/g, '').length < 10) return falhar(erro, 'Faltou o DDD ou algum dígito.');

    erro.hidden = true;
    respostas[p.id] = valor;
    passo++;
    pintarPergunta();
  }

  function falhar(erro, msg) { erro.textContent = msg; erro.hidden = false; return false; }

  function pintarRevisao() {
    var html = '<p class="passo-num">Última conferida</p><h2 id="pergunta-titulo">Está tudo certo?</h2>' +
               '<dl class="revisao">';
    Object.keys(ROTULOS).forEach(function (k) {
      if (!respostas[k]) return;
      html += '<div><dt>' + esc(ROTULOS[k]) + '</dt><dd>' + esc(respostas[k]) + '</dd></div>';
    });
    html += '</dl>';
    $('#pergunta').innerHTML = html;
    $('#progresso-barra').style.width = '100%';
    $('#voltar').hidden = false;
    $('#avancar').textContent = 'Confirmar reunião ↗';
  }

  /* ---------------------------------------------------------------- envio */
  function gcalData(d, hora) {
    var p = hora.split(':');
    var ini = new Date(d); ini.setHours(+p[0], +p[1], 0, 0);
    var fim = new Date(ini.getTime() + DURACAO * 60000);
    var f = function (x) { return x.toISOString().replace(/[-:]|\.\d{3}/g, ''); };
    return f(ini) + '/' + f(fim);
  }

  function enviar() {
    var btn = $('#avancar');
    btn.disabled = true;
    btn.textContent = 'Confirmando…';

    var dados = Object.assign({}, respostas, {
      data: iso(diaSel),
      hora: horaSel,
      duracao: DURACAO,
      origem: 'site/agenda'
    });

    var corpo = Object.keys(dados).map(function (k) {
      return encodeURIComponent(k) + '=' + encodeURIComponent(dados[k]);
    }).join('&');

    var pronto = function () {
      $('#etapa-form').hidden = true;
      $('#etapa-fim').hidden = false;
      $('#fim-horario').textContent = diaLongo(diaSel) + ', às ' + horaSel;
      var texto = encodeURIComponent('Diagnóstico SAL · ' + (respostas.empresa || respostas.nome || ''));
      var detalhe = encodeURIComponent('Reunião de diagnóstico com a SAL Estratégias de Marketing. 30 minutos, online.');
      $('#gcal').href = 'https://calendar.google.com/calendar/render?action=TEMPLATE&text=' + texto +
                        '&dates=' + gcalData(diaSel, horaSel) + '&details=' + detalhe;
      $('#zap').href = 'https://wa.me/' + WHATSAPP + '?text=' +
        encodeURIComponent('Oi! Acabei de agendar um diagnóstico para ' + diaLongo(diaSel) + ' às ' + horaSel + '. Sou ' + (respostas.nome || '') + ', da ' + (respostas.empresa || '') + '.');
      $('#etapa-fim').scrollIntoView({ behavior: 'smooth', block: 'start' });
    };

    if (!APPS_SCRIPT) {
      // Endpoint ainda não configurado: não perde o lead, manda pelo WhatsApp.
      var resumo = Object.keys(ROTULOS).filter(function (k) { return respostas[k]; })
        .map(function (k) { return ROTULOS[k] + ': ' + respostas[k]; }).join('\n');
      window.open('https://wa.me/' + WHATSAPP + '?text=' + encodeURIComponent(
        'Agendamento pelo site\n' + diaLongo(diaSel) + ' às ' + horaSel + '\n\n' + resumo), '_blank');
      return pronto();
    }

    // urlencoded + no-cors: o Apps Script não responde ao preflight de CORS.
    fetch(APPS_SCRIPT, {
      method: 'POST', mode: 'no-cors',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: corpo
    }).then(pronto).catch(pronto);
  }

  /* ---------------------------------------------------------------- disponibilidade */
  function carregarDisponibilidade() {
    if (!APPS_SCRIPT) return;
    fetch(APPS_SCRIPT + '?acao=disponibilidade')
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (d) {
        if (!d || typeof d !== 'object') return;
        Object.keys(d).forEach(function (dia) {
          ocupados[dia] = new Set((d[dia] || []).map(padSlot));
        });
        pintarDias(); pintarHoras();
      })
      .catch(function () { /* fallback: sem dados, todos os horários seguem livres */ });
  }

  /* ---------------------------------------------------------------- início */
  function iniciar() {
    if (!$('#dias')) return;
    pintarDias();
    pintarHoras();
    carregarDisponibilidade();

    $('#avancar').addEventListener('click', function () {
      if (passo >= PERGUNTAS.length) return enviar();
      avancar();
    });
    $('#voltar').addEventListener('click', function () {
      if (passo > 0) { passo--; pintarPergunta(); }
    });
    $('#trocar-horario').addEventListener('click', function () {
      $('#etapa-form').hidden = true;
      $('#etapa-horario').hidden = false;
      $('#etapa-horario').scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar);
  else iniciar();
})();
