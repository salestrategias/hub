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

def wp_post(path, body):
    r = subprocess.run(
        ['curl', '-s', '-u', auth, '-X', 'POST', base + path,
         '-H', 'Content-Type: application/json', '-d', json.dumps(body)],
        capture_output=True, text=True)
    return json.loads(r.stdout)

for name in ['estoque', 'sazonalidade']:
    res = wp_post('/wp-json/wp/v2/tags', {"name": name})
    print(name, '->', res.get('id'), res.get('code'))
