# Automação de postagem nas redes via n8n — Blueprint

> **Status:** PARADO a pedido do Marcelo (jun/2026). Documento de referência pra retomar.
> **Caminho escolhido:** n8n como **motor** de publicação. O Hub agenda no calendário e dispara um webhook; o n8n publica nas redes e devolve o resultado (callback). Code-first, controle total.

---

## ⚠️ Verdade importante (ler antes)
O n8n poupa de **construir** o código de OAuth/orquestração, mas **não** poupa da credencial da Meta. Pra publicar no Instagram/Facebook via Graph API, o n8n ainda precisa de:
- um **app Meta (Business)** com permissões `instagram_content_publish`, `pages_manage_posts`, `pages_read_engagement`, `business_management`;
- um **token de Página** do cliente (ou **System User token** do Business Manager da SAL com os assets dos clientes compartilhados).

Em produção, isso = **App Review da Meta** (semanas). 

**Duas sub-opções no passo "publicar":**
- **B1 — n8n → Graph API direto:** controle total, mas precisa do app Meta aprovado + tokens dos clientes.
- **B2 (híbrido) — n8n → agregador** (Ayrshare / Postiz / Mixpost): o n8n orquestra, o agregador publica (já tem as aprovações). Une o controle do n8n com o "sem App Review". ← **atalho mais rápido.**

O blueprint serve pros dois — só muda o nó de "publicar". Abaixo está o **B1 (Meta direto)** detalhado.

---

## 1. Visão geral do fluxo
```
[GATILHO] Webhook "sal-hub-publicar" (POST, do Hub)
    ↓
[VALIDA] token no header (x-sal-token) — inválido → 401 e para
    ↓
[RESPONDE 200] "recebido" pro Hub (na hora) → segue processando async
    ↓
[SPLIT] para cada canal em `canais[]`
    ↓
[SWITCH] por canal
 ├─ INSTAGRAM → [sub-fluxo IG por formato] → resultado
 ├─ FACEBOOK  → [publica na Página]        → resultado
 ├─ LINKEDIN  → (stub, extensível)         → resultado
 ├─ TIKTOK    → (stub)                      → resultado
 └─ YOUTUBE   → (stub)                      → resultado
    ↓
[MERGE] junta resultados [{canal, status, urlPublicada?, erro?}]
    ↓
[CALLBACK] HTTP POST → Hub /api/posts/{postId}/resultado-publicacao (com x-sal-token)
```

### Sub-fluxo INSTAGRAM (Graph API v21.0)
```
[IF formato]
 ├─ FEED (1 imagem):
 │    POST /{ig}/media (image_url, caption) → creation_id
 │    → POST /{ig}/media_publish (creation_id) → media_id
 ├─ CARROSSEL:
 │    p/ cada mídia: POST /{ig}/media (image_url, is_carousel_item=true) → child_id
 │    → POST /{ig}/media (media_type=CAROUSEL, children=[ids], caption) → creation_id
 │    → media_publish
 └─ REELS (vídeo, assíncrono):
      POST /{ig}/media (media_type=REELS, video_url, caption, share_to_feed=true) → creation_id
      → [WAIT loop] GET /{creation_id}?fields=status_code até FINISHED
      → media_publish
 ↓ (se primeiroComentario) POST /{media_id}/comments (message)
 ↓ monta urlPublicada (ou guarda media_id)
```

## 2. Blueprint nó-a-nó

| # | Nó | Tipo | O que faz |
|---|---|---|---|
| 1 | **Webhook** | Trigger | `POST /webhook/sal-hub-publicar`. Recebe o payload do Hub. |
| 2 | **IF — token** | Condição | `{{$json.headers["x-sal-token"]}} == $env.SAL_TOKEN`. Falso → Respond 401 e fim. |
| 3 | **Respond to Webhook** | Ação | Responde `200 {recebido:true}` na hora (não deixa o Hub esperando a publicação). |
| 4 | **Set — normaliza** | Ação | Extrai `postId, canais, legenda, formato, midias, contaIds, primeiroComentario`. |
| 5 | **Split Out (canais)** | Ação | Itera o array `canais`, 1 item por canal. |
| 6 | **Switch — canal** | Condição | Roteia por `INSTAGRAM/FACEBOOK/LINKEDIN/TIKTOK/YOUTUBE`. |
| 7a | **IG: Switch formato** | Condição | FEED / CARROSSEL / REELS. |
| 7b | **IG: HTTP — criar media** | Ação | `POST graph.facebook.com/v21.0/{{contaIds.instagram}}/media` (params conforme formato). **Continue On Fail = ON.** |
| 7c | **IG: (Reels) Wait + GET status** | Ação/loop | Poll `status_code` até `FINISHED` (vídeo processa async; timeout ~5 min). |
| 7d | **IG: HTTP — media_publish** | Ação | `POST .../{{ig}}/media_publish` com `creation_id`. |
| 7e | **IG: HTTP — 1º comentário** | Ação | (se houver) `POST .../{media_id}/comments`. |
| 8 | **FB: HTTP — publicar** | Ação | `POST .../{{contaIds.facebook}}/photos` (url+message) ou `/feed`. |
| 9 | **Set — resultado do canal** | Ação | `{canal, status:'PUBLICADO'|'ERRO', urlPublicada, erro}`. |
| 10 | **Merge / Code — agrega** | Ação | Junta todos os resultados num array. |
| 11 | **HTTP — Callback Hub** | Ação | `POST hub.salestrategias.com.br/api/posts/{{postId}}/resultado-publicacao`, header `x-sal-token`, body `{resultados:[...]}`. **Retry: 3x, backoff.** |

## 3. Integrações (configurar no n8n)
- **Credencial Meta (Graph API):** app Meta Business; **token de Página de longa duração** por cliente (ou System User token do BM da SAL). Permissões listadas acima. Requer App Review pra produção.
- **IG account:** Profissional (Business/Creator) ligada a uma Página.
- **`SAL_TOKEN`** (env no n8n): segredo compartilhado Hub↔n8n.
- **(B2 alternativo):** credencial do agregador (1 API key) no lugar dos nós Graph — pula o App Review.

## 4. Tratamento de erros
- Cada HTTP node: **"Continue On Fail" ON** → erro vira `{status:'ERRO', erro: msg}` (um canal falhar não derruba os outros).
- **Reels:** timeout no poll → ERRO "processamento demorou".
- **Error Workflow** global do n8n → loga + avisa (WhatsApp/email) em falha inesperada.
- **Callback** com retry 3x; se o Hub não responder, loga (o Hub tem um "destravador" — ver lado do Hub).

## 5. Como testar (sem postar de verdade)
1. Conta IG de teste (ou modo Dev do app Meta — posta só em contas com papel no app).
2. Dispara o webhook com `curl`/Postman (payload de 1 imagem feed).
3. Confere o container criado, o publish e o callback chegando.
4. Só depois liga num cliente real.

## 6. Custo
- **n8n self-hosted:** R$0 (só o VPS).
- **B2 com agregador:** plano pago (free limitado; planos por nº de perfis).

---

## 🔌 Contratos dos webhooks (Hub ↔ n8n)

### ① Webhook IN — Hub → n8n
`POST {n8n}/webhook/sal-hub-publicar` · header `x-sal-token: <SAL_TOKEN>`
```json
{
  "postId": "...",
  "clienteNome": "...",
  "contaIds": { "instagram": "<ig_user_id>", "facebook": "<page_id>" },
  "canais": ["INSTAGRAM", "FACEBOOK"],
  "legenda": "texto da legenda",
  "formato": "FEED",                 // FEED | CARROSSEL | REELS | STORIES
  "midias": ["https://hub.salestrategias.com.br/api/midia/<id>"],
  "primeiroComentario": null
}
```

### ② Callback — n8n → Hub
`POST https://hub.salestrategias.com.br/api/posts/{postId}/resultado-publicacao` · header `x-sal-token: <SAL_TOKEN>`
```json
{
  "resultados": [
    { "canal": "INSTAGRAM", "status": "PUBLICADO", "urlPublicada": "https://instagram.com/p/..." },
    { "canal": "FACEBOOK", "status": "ERRO", "erro": "token expirado" }
  ]
}
```

---

## 🏗️ Lado do Hub (a construir quando retomar)
1. **Schema:** `ContaSocial` por cliente (rede + `contaIdExterno`; tokens ficam no n8n, o Hub só guarda os IDs). No `Post`: `autoPublicar Boolean`, `statusPublicacao` (AGENDADO→PUBLICANDO→PUBLICADO/ERRO), `resultadoPublicacao Json`, `publicadoEm`.
2. **Mídia pública:** rota `/api/midia/[id]` que serve a arte por URL pública (o Instagram busca a imagem por URL — dataURL não serve).
3. **Worker/agendador:** a cada minuto, pega posts `autoPublicar && AGENDADO && dataPublicacao<=agora`, marca PUBLICANDO e dispara o webhook do n8n. (cron no VPS batendo num endpoint interno, ou node-cron no container.)
4. **Callback endpoint** `/api/posts/[id]/resultado-publicacao` (valida `x-sal-token`, grava resultado/status) + "destravador" (se ficar PUBLICANDO > X min → ERRO).
5. **UI:** conectar contas por cliente, toggle "publicar automático" no post, status de publicação no calendário/PostSheet.

---

## Segurança
- Token aleatório forte compartilhado (`SAL_TOKEN`) validado nos **dois** sentidos (header `x-sal-token` no webhook de entrada e no callback).
- Tokens das redes ficam **só no n8n** (credenciais), nunca no Hub.
- Endpoint de callback valida o token antes de gravar qualquer coisa.
