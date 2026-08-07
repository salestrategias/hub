import base64
import json
import requests

WP_URL = "https://www.salestrategias.com.br"
WP_USER = "marcelofreitas"
WP_APP_PASSWORD = "NLSl JmyD XCqB hf9O UBDo spen"

auth = base64.b64encode(f"{WP_USER}:{WP_APP_PASSWORD}".encode()).decode()
HEADERS = {"Authorization": f"Basic {auth}", "Content-Type": "application/json"}

ids = json.load(open("blog/fila-local/.publish_ids.json"))
content = open("blog/fila-local/.draft-whatsapp-marketing-sem-ser-bloqueado.html", encoding="utf-8").read()

TITLE = "WhatsApp Marketing sem Ser Bloqueado: Regras e Boas Práticas para Lojas"
SLUG = "whatsapp-marketing-sem-ser-bloqueado"
EXCERPT = "O que evita bloqueio no WhatsApp da loja: regras de opt-in, limite de mensagens e quality rating explicados com fonte oficial da documentação da Meta."
RM_TITLE = "WhatsApp Marketing sem Ser Bloqueado: Guia para Lojas"
RM_DESC = "Entenda por que o WhatsApp bloqueia número comercial, os limites de mensagem da Meta e como fazer opt-in certo para vender sem risco de banir a conta da loja."
FOCUS_KEYWORD = "whatsapp marketing sem ser bloqueado"

tags = ids["tags"]
tag_ids = list(tags.values())

payload = {
    "title": TITLE,
    "slug": SLUG,
    "content": content,
    "excerpt": EXCERPT,
    "categories": [14],
    "tags": tag_ids,
    "status": "publish",
    "featured_media": ids["featured_id"],
    "meta": {
        "rank_math_title": RM_TITLE,
        "rank_math_description": RM_DESC,
        "rank_math_focus_keyword": FOCUS_KEYWORD,
        "rank_math_facebook_image": ids["social_url"],
        "rank_math_facebook_image_id": ids["social_id"],
    },
}

r = requests.post(f"{WP_URL}/wp-json/wp/v2/posts", headers=HEADERS, data=json.dumps(payload))
print("STATUS:", r.status_code)
try:
    data = r.json()
except Exception:
    print(r.text[:2000])
    raise
print(json.dumps({k: data.get(k) for k in ["id", "link", "status", "slug"]}, ensure_ascii=False))
print("META RETURNED:", data.get("meta"))
if r.status_code >= 400:
    print(json.dumps(data, ensure_ascii=False, indent=2))
