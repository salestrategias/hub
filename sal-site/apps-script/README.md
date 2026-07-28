# Agenda da SAL — como ligar o backend

A página `/agenda` funciona sem backend nenhum: se o endpoint não estiver
configurado, ela abre o WhatsApp com todas as respostas já formatadas, então
nenhum lead se perde. Mas com o Apps Script ligado ela fica igual à da Colmeia:
mostra os horários realmente livres no Google Calendar e cria o evento sozinha.

São dez minutos de trabalho, uma vez só.

## 1. Criar o projeto

1. Abra <https://script.google.com> **logado na conta Google da SAL** — é o
   calendário dessa conta que vai valer.
2. **Novo projeto** e apague o `function myFunction()` que vem pronto.
3. Cole o conteúdo de `agenda.gs` e salve.

## 2. Ajustar as configurações

No topo do arquivo, confira o bloco `CONFIG`:

| Campo | O que é |
|---|---|
| `CALENDARIO` | `'primary'` usa a agenda principal da conta. Para separar comercial de pessoal, crie um calendário só de reuniões e cole o ID dele aqui |
| `AVISAR` | e-mail que recebe o aviso de cada agendamento |
| `DURACAO_MIN` | 30 minutos, igual ao que o site mostra |
| `DIAS_A_FRENTE` | janela consultada no calendário |

Se quiser cada agendamento numa planilha, crie uma, copie o ID da URL e cole em
`PLANILHA_ID`. É opcional — sem isso tudo continua funcionando.

## 3. Publicar

1. **Implantar → Nova implantação**.
2. Tipo: **App da Web**.
3. Executar como: **Eu**.
4. Quem pode acessar: **Qualquer pessoa** — sem isso o site não consegue ler a
   disponibilidade nem gravar o agendamento.
5. Implantar, autorizar o acesso ao Calendar e ao Gmail, e **copiar a URL `/exec`**.

## 4. Ligar no site

Crie um arquivo `.env` na raiz de `sal-site/` com a URL copiada:

```
PUBLIC_AGENDA_ENDPOINT=https://script.google.com/macros/s/AKfy.../exec
```

Rebuild (`npx astro build`) e pronto.

O `.env` não vai para o repositório. Em produção, defina a mesma variável no
painel da hospedagem antes do build.

## 5. Conferir

- Abra `/agenda`: os dias devem mostrar a contagem de horários livres.
- Bloqueie um horário no Google Calendar, recarregue a página: aquele horário
  precisa aparecer riscado.
- Faça um agendamento de teste: o evento deve nascer no calendário, com convite
  para o e-mail informado, e o aviso deve chegar em `AVISAR`.

## O que acontece quando algo falha

O site foi escrito para nunca travar o lead:

- **Apps Script fora do ar na leitura** → todos os horários aparecem livres.
  A pessoa agenda normalmente e o conflito, se houver, é resolvido no contato.
- **Falha ao gravar** → a tela de confirmação aparece do mesmo jeito e o
  Apps Script manda o e-mail de aviso com todos os dados.
- **Endpoint não configurado** → abre o WhatsApp com as respostas formatadas.
- **Dois agendamentos no mesmo horário** → o segundo não sobrescreve o
  primeiro; o comercial recebe um e-mail marcado como conflito.

## Alterar horários de atendimento

As regras de horário ficam no site, em `public/js/agenda.js`:

```js
var DIAS_UTEIS = 10;   // quantos dias úteis mostrar
var HORA_INI = 9;      // primeiro horário
var HORA_FIM = 17;     // último horário
var DURACAO = 30;      // minutos
```

Se mudar a duração aqui, mude também `DURACAO_MIN` no `agenda.gs`.
