# Setup pendente — Blog SAL automatizado

Checklist da ativação (ordem importa). Tempo total: ~25 min. Itens marcados **[CLAUDE]** eu executo; **[MARCELO]** só você consegue.

## 0. [CLAUDE] Commit dos arquivos do blog

O clone do VPS só enxerga o que está no GitHub. Me autorize ("pode commitar") que eu commito `blog/` + assets de logo e subo pro `main`.

## 1. [MARCELO] Application Password no WordPress (~2 min)

1. `salestrategias.com.br/wp-admin` → **Usuários → Perfil** (teu usuário admin — precisa ser admin pra automação poder embutir o schema FAQ no conteúdo).
2. Rolar até **Senhas de aplicação / Application Passwords**.
3. Nome: `blog-automacao` → **Adicionar nova**.
4. **Copiar a senha exibida** (com os espaços — só aparece uma vez). Guardar pro passo 7.
5. Se a seção não existir, algum plugin de segurança desabilitou — me avisar que eu investigo.

## 2. [MARCELO] Snippet Rank Math no WPCode (~3 min)

1. wp-admin → **Code Snippets → + Add Snippet → Add Your Custom Code → PHP Snippet**.
2. Nome: `SAL — Rank Math REST (blog automacao)`.
3. Colar o conteúdo de `blog/wpcode-rankmath-rest.php` **sem a linha `<?php`** (o WPCode já assume PHP).
4. Insert: **Auto Insert / Run Everywhere** → Save → **Active**.

## 3. [MARCELO] Chave do Pexels (~2 min)

1. https://www.pexels.com/api/ → criar conta gratuita.
2. Copiar **Your API Key** do dashboard. Guardar pro passo 7.
3. Limites do plano free (200 req/h, 20k/mês) dão folga: usamos ~2 requisições/dia.

## 4. VPS — provisionar (~5 min)

**Opção A [CLAUDE executa tudo do 4 ao 8]:** adicionar a chave pública abaixo em `/root/.ssh/authorized_keys` do VPS do Hub (via painel Hostinger ou terminal) e me passar o IP:

```
ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIMRp9KR2x3XWiXmdZr5KDkdfqfiFJbfXP0XlsufLTqWv claude-sal-hub
```

**Opção B [MARCELO]:** rodar você mesmo, da tua máquina (PowerShell):

```powershell
scp "C:\Users\marce\OneDrive\Documents\SAL\Hub\blog\vps\setup-blog-vps.sh" root@IP_DO_VPS:/root/
ssh root@IP_DO_VPS
bash /root/setup-blog-vps.sh
```

O script é idempotente: cria o usuário `salblog`, instala Node 20 + Claude Code CLI, gera a deploy key, clona o repo, instala o gerador de capas e agenda o cron das 08:00 (BRT).

## 5. [MARCELO] Deploy key no GitHub (~2 min)

O setup imprime uma chave pública e para no clone (primeira execução).

1. github.com/salestrategias/hub → **Settings → Deploy keys → Add deploy key**.
2. Título `sal-blog-vps`, colar a chave, **marcar "Allow write access"** (a rotina commita o estado do calendário) → Add.
3. Rodar o setup de novo — segue até o fim.

## 6. [MARCELO] Token da assinatura Claude (~2 min, na TUA máquina)

```powershell
claude setup-token
```

Abre o browser → login na conta do Max → autorizar → o terminal mostra um token `sk-ant-oat01-...`. Copiar. É ele que faz o VPS usar tua assinatura (sem custo de API). Tratar como senha.

## 7. Credenciais no VPS (~3 min)

**[CLAUDE]** na Opção A (me manda os 3 segredos), ou **[MARCELO]**:

```bash
ssh root@IP_DO_VPS
nano /home/salblog/blog-automacao.env   # CLAUDE_CODE_OAUTH_TOKEN=sk-ant-oat01-...
nano /home/salblog/hub/blog/.env        # WP_USER, WP_APP_PASSWORD, PEXELS_API_KEY, STATUS
```

Obs.: `blog/.env` é gitignored — não sincroniza via git; preenche direto no VPS.

## 8. Teste de ponta a ponta (~5 min)

```bash
sudo -u salblog /home/salblog/hub/blog/vps/rodar-artigo.sh
tail -f /home/salblog/logs/blog-$(date +%F).log
```

O 1º artigo sai como **rascunho**: revisar em wp-admin → Posts → Rascunhos (texto, capa, meta do Rank Math, schema FAQ). O 2º também é rascunho; do 3º em diante publica direto (`STATUS=publish`).

## 9. [CLAUDE] Virada

Teste aprovado → me avisa → eu desativo a rotina local `blog-sal-artigo-diario` (senão publica em dobro) e o VPS assume sozinho às 08:00.
