import base64
import json
import mimetypes
import requests

WP_URL = "https://www.salestrategias.com.br"
WP_USER = "marcelofreitas"
WP_APP_PASSWORD = "NLSl JmyD XCqB hf9O UBDo spen"

auth = base64.b64encode(f"{WP_USER}:{WP_APP_PASSWORD}".encode()).decode()
HEADERS = {"Authorization": f"Basic {auth}"}

TITLE = "WhatsApp Marketing sem Ser Bloqueado: Regras e Boas Práticas para Lojas"


def upload_media(path, filename, alt_text):
    with open(path, "rb") as f:
        data = f.read()
    mime = mimetypes.guess_type(filename)[0] or "image/png"
    headers = dict(HEADERS)
    headers["Content-Disposition"] = f'attachment; filename="{filename}"'
    headers["Content-Type"] = mime
    r = requests.post(f"{WP_URL}/wp-json/wp/v2/media", headers=headers, data=data)
    r.raise_for_status()
    media = r.json()
    media_id = media["id"]
    # set alt_text/title
    r2 = requests.post(
        f"{WP_URL}/wp-json/wp/v2/media/{media_id}",
        headers=HEADERS,
        json={"alt_text": alt_text, "title": alt_text},
    )
    r2.raise_for_status()
    return media_id, media["source_url"]


def get_or_create_tag(name):
    r = requests.get(
        f"{WP_URL}/wp-json/wp/v2/tags",
        headers=HEADERS,
        params={"search": name, "per_page": 20},
    )
    r.raise_for_status()
    for t in r.json():
        if t["name"].strip().lower() == name.strip().lower():
            return t["id"], False
    r2 = requests.post(f"{WP_URL}/wp-json/wp/v2/tags", headers=HEADERS, json={"name": name})
    r2.raise_for_status()
    return r2.json()["id"], True


if __name__ == "__main__":
    featured_id, featured_url = upload_media(
        "blog/capa/destacada-whatsapp-marketing-sem-ser-bloqueado.png",
        "destacada-whatsapp-marketing-sem-ser-bloqueado.png",
        TITLE,
    )
    social_id, social_url = upload_media(
        "blog/capa/social-whatsapp-marketing-sem-ser-bloqueado.png",
        "social-whatsapp-marketing-sem-ser-bloqueado.png",
        TITLE,
    )
    print("FEATURED:", featured_id, featured_url)
    print("SOCIAL:", social_id, social_url)

    tag_names = ["WhatsApp", "WhatsApp Business", "CRM", "Retenção de Clientes"]
    tags = {}
    for name in tag_names:
        tid, created = get_or_create_tag(name)
        tags[name] = (tid, created)
        print(f"TAG {name}: id={tid} created={created}")

    with open("blog/fila-local/.publish_ids.json", "w") as f:
        json.dump(
            {
                "featured_id": featured_id,
                "featured_url": featured_url,
                "social_id": social_id,
                "social_url": social_url,
                "tags": {k: v[0] for k, v in tags.items()},
            },
            f,
        )
