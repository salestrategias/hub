/**
 * Agenda da SAL — backend em Google Apps Script.
 *
 * Faz duas coisas:
 *   doGet(?acao=disponibilidade)  → devolve os horários JÁ OCUPADOS no calendário
 *   doPost(...)                   → cria o evento e avisa o comercial por e-mail
 *
 * Não existe servidor, banco nem chave de API. O Apps Script roda dentro da
 * conta Google da SAL e é o próprio calendário que serve de fonte da verdade.
 *
 * Como publicar: veja README.md nesta mesma pasta.
 */

// ----------------------------------------------------------------- ajustes
var CONFIG = {
  CALENDARIO: 'primary',                       // ou o ID de um calendário específico
  AVISAR: 'marcelo@salestrategias.com.br',     // quem recebe o aviso de novo agendamento
  DURACAO_MIN: 30,
  DIAS_A_FRENTE: 20,                           // janela consultada no calendário
  FUSO: 'America/Sao_Paulo',
  ORIGENS_PERMITIDAS: [                        // de onde o formulário pode postar
    'https://salestrategias.com.br',
    'https://www.salestrategias.com.br'
  ]
};

// A ordem aqui é a ordem das colunas da planilha. Nem todo campo vem em toda
// solicitação: o formulário pergunta só o que vale para o tipo de negócio.
var ROTULOS = {
  nome: 'Nome', email: 'E-mail', whatsapp: 'WhatsApp', empresa: 'Empresa',
  tipo: 'Tipo de negócio', site: 'Site / Perfil', plataforma: 'Plataforma',
  unidades: 'Unidades', faturamento: 'Faturamento', hoje: 'Faz hoje',
  verba: 'Verba de anúncio', objetivo: 'Objetivo', desafio: 'Desafio'
};

// ----------------------------------------------------------------- leitura
/**
 * Devolve { "YYYY-MM-DD": ["09:00","09:30", ...] } com os horários ocupados.
 * O site trata qualquer falha aqui de forma silenciosa: se não vier resposta,
 * todos os horários aparecem como livres e ninguém fica travado.
 */
function doGet(e) {
  if (!e || !e.parameter || e.parameter.acao !== 'disponibilidade') {
    return json({ ok: true, servico: 'agenda-sal' });
  }

  var cal = CONFIG.CALENDARIO === 'primary'
    ? CalendarApp.getDefaultCalendar()
    : CalendarApp.getCalendarById(CONFIG.CALENDARIO);

  var ini = new Date(); ini.setHours(0, 0, 0, 0);
  var fim = new Date(ini); fim.setDate(fim.getDate() + CONFIG.DIAS_A_FRENTE);

  var ocupados = {};
  cal.getEvents(ini, fim).forEach(function (ev) {
    if (ev.isAllDayEvent()) return;
    var t = ev.getStartTime();
    var f = ev.getEndTime();
    // marca todos os slots de 30 min que o evento cobre, inclusive os longos
    for (var d = new Date(t); d < f; d.setMinutes(d.getMinutes() + CONFIG.DURACAO_MIN)) {
      var dia = Utilities.formatDate(d, CONFIG.FUSO, 'yyyy-MM-dd');
      var hora = Utilities.formatDate(d, CONFIG.FUSO, 'HH:mm');
      (ocupados[dia] = ocupados[dia] || []).push(hora);
    }
  });

  return json(ocupados);
}

// ----------------------------------------------------------------- escrita
function doPost(e) {
  try {
    var p = (e && e.parameter) || {};
    if (!p.nome || !p.email || !p.data || !p.hora) {
      return json({ ok: false, erro: 'faltam campos obrigatorios' });
    }

    var partes = String(p.data).split('-');
    var hm = String(p.hora).split(':');
    var inicio = new Date(+partes[0], +partes[1] - 1, +partes[2], +hm[0], +hm[1], 0);
    var fim = new Date(inicio.getTime() + (Number(p.duracao) || CONFIG.DURACAO_MIN) * 60000);

    var cal = CONFIG.CALENDARIO === 'primary'
      ? CalendarApp.getDefaultCalendar()
      : CalendarApp.getCalendarById(CONFIG.CALENDARIO);

    // Trava simples contra dois agendamentos no mesmo horário: se alguém
    // preencheu o formulário enquanto outra pessoa fechava o mesmo slot,
    // o evento não é criado em cima e o comercial é avisado do conflito.
    var conflito = cal.getEvents(inicio, fim).filter(function (ev) { return !ev.isAllDayEvent(); });
    if (conflito.length) {
      avisar('CONFLITO de horário no agendamento', p, 'Esse horário já estava ocupado. Combine outro com a pessoa.');
      return json({ ok: false, erro: 'horario ocupado' });
    }

    var titulo = 'Diagnóstico SAL · ' + (p.empresa || p.nome);
    var evento = cal.createEvent(titulo, inicio, fim, {
      description: descricao(p),
      guests: p.email,
      sendInvites: true
    });

    try { evento.addPopupReminder(60); } catch (err) { /* lembrete é opcional */ }

    avisar('Novo diagnóstico agendado', p, '');
    registrarNaPlanilha(p);

    return json({ ok: true, id: evento.getId() });
  } catch (err) {
    // Nunca devolve erro cru para o site: o lead já preencheu tudo, e o
    // aviso por e-mail garante que ninguém se perca mesmo se o Calendar falhar.
    try { avisar('FALHA ao criar evento', (e && e.parameter) || {}, String(err)); } catch (ignora) {}
    return json({ ok: false, erro: String(err) });
  }
}

// ----------------------------------------------------------------- apoio
function descricao(p) {
  var linhas = ['Agendamento feito pelo site da SAL.', ''];
  Object.keys(ROTULOS).forEach(function (k) {
    if (p[k]) linhas.push(ROTULOS[k] + ': ' + p[k]);
  });
  linhas.push('', 'Origem: ' + (p.origem || 'site'));
  return linhas.join('\n');
}

function avisar(assunto, p, extra) {
  if (!CONFIG.AVISAR) return;
  var corpo = [
    assunto,
    '',
    'Quando: ' + (p.data || '?') + ' às ' + (p.hora || '?'),
    ''
  ];
  Object.keys(ROTULOS).forEach(function (k) {
    if (p[k]) corpo.push(ROTULOS[k] + ': ' + p[k]);
  });
  if (extra) corpo.push('', extra);
  MailApp.sendEmail(CONFIG.AVISAR, '[SAL] ' + assunto + ' · ' + (p.empresa || p.nome || ''), corpo.join('\n'));
}

/**
 * Opcional: guarda cada agendamento numa aba de planilha, para virar funil.
 * Deixe PLANILHA_ID vazio se não quiser.
 */
var PLANILHA_ID = '';
function registrarNaPlanilha(p) {
  if (!PLANILHA_ID) return;
  try {
    var aba = SpreadsheetApp.openById(PLANILHA_ID).getSheets()[0];
    if (aba.getLastRow() === 0) {
      aba.appendRow(['Recebido em', 'Data', 'Hora'].concat(Object.keys(ROTULOS).map(function (k) { return ROTULOS[k]; })));
    }
    aba.appendRow([new Date(), p.data, p.hora].concat(Object.keys(ROTULOS).map(function (k) { return p[k] || ''; })));
  } catch (err) { /* planilha é acessório: nunca derruba o agendamento */ }
}

function json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
