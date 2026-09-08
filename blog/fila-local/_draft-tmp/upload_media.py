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
auth = user + ':' + pw

title = "Quando Começar a Preparar a Black Friday 2026: o Cronograma de 12 Semanas"

def upload(path, filename):
    r = subprocess.run(
        ['curl', '-s', '-u', auth, '-X', 'POST', base + '/wp-json/wp/v2/media',
         '-H', 'Content-Disposition: attachment; filename="' + filename + '"',
         '-H', 'Content-Type: image/png',
         '--data-binary', '@' + path],
        capture_output=True, text=True)
    return json.loads(r.stdout)

def update_meta(media_id):
    r = subprocess.run(
        ['curl', '-s', '-u', auth, '-X', 'POST', base + '/wp-json/wp/v2/media/' + str(media_id),
         '-H', 'Content-Type: application/json',
         '-d', json.dumps({"alt_text": title, "title": title})],
        capture_output=True, text=True)
    return json.loads(r.stdout)

destacada = upload('capa/destacada-quando-comecar-preparar-black-friday.png', 'capa-quando-comecar-preparar-black-friday.png')
print('destacada id:', destacada.get('id'), destacada.get('source_url'))
update_meta(destacada['id'])

social = upload('capa/social-quando-comecar-preparar-black-friday.png', 'capa-social-quando-comecar-preparar-black-friday.png')
print('social id:', social.get('id'), social.get('source_url'))
update_meta(social['id'])

with open('fila-local/_draft-tmp/media_ids.json', 'w') as f:
    json.dump({
        'featured_media': destacada['id'],
        'social_media_id': social['id'],
        'social_url': social['source_url'],
    }, f)
