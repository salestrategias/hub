import subprocess, json

env = {}
with open('.env') as f:
    for line in f:
        line = line.strip()
        if not line or line.startswith('#') or '=' not in line:
            continue
        k, v = line.split('=', 1)
        env[k] = v
base = env['WP_URL']
user = env['WP_USER']
pw = env['WP_APP_PASSWORD']
status = env['STATUS']
auth = user + ':' + pw

with open('fila-local/_draft-tmp/media_ids.json') as f:
    media = json.load(f)

content = open('fila-local/_draft-tmp/content.html', encoding='utf-8').read()

title = "Quando Começar a Preparar a Black Friday 2026: o Cronograma de 12 Semanas"
excerpt = "Descubra quando começar a preparar a Black Friday 2026 (27/11): cronograma de 12 semanas, do estoque ao e-mail. Comece agora e chegue pronto para vender."
rank_math_title = "Quando Começar a Preparar a Black Friday 2026: Guia"
rank_math_description = excerpt
slug = "quando-comecar-preparar-black-friday"

post = {
    "title": title,
    "slug": slug,
    "content": content,
    "excerpt": excerpt,
    "categories": [14],
    "tags": [76, 77, 67, 63, 142, 143],
    "status": status,
    "featured_media": media["featured_media"],
    "meta": {
        "rank_math_title": rank_math_title,
        "rank_math_description": rank_math_description,
        "rank_math_focus_keyword": "quando começar a preparar black friday",
        "rank_math_facebook_image": media["social_url"],
        "rank_math_facebook_image_id": media["social_media_id"],
    }
}

with open('fila-local/_draft-tmp/post_body.json', 'w', encoding='utf-8') as f:
    json.dump(post, f, ensure_ascii=False)

r = subprocess.run(
    ['curl', '-s', '-u', auth, '-X', 'POST', base + '/wp-json/wp/v2/posts',
     '-H', 'Content-Type: application/json',
     '--data-binary', '@fila-local/_draft-tmp/post_body.json'],
    capture_output=True, text=True)

print(r.stdout)
with open('fila-local/_draft-tmp/publish_response.json', 'w', encoding='utf-8') as f:
    f.write(r.stdout)
