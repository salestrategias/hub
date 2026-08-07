import re

html = open("/tmp/verify_post.html", encoding="utf-8").read()

print("=== title tag ===")
m = re.search(r"<title>(.*?)</title>", html, re.S)
print(m.group(1).strip() if m else "NOT FOUND")

print("=== H1 count/content ===")
h1s = re.findall(r"<h1[^>]*>(.*?)</h1>", html, re.S)
print(len(h1s), [re.sub('<[^>]+>','',h).strip() for h in h1s])

print("=== meta description ===")
m = re.search(r'<meta name="description" content="([^"]*)"', html)
print(m.group(1) if m else "NOT FOUND")

print("=== og:image ===")
m = re.search(r'<meta property="og:image" content="([^"]*)"', html)
print(m.group(1) if m else "NOT FOUND")

print("=== TOC ===")
print("rank-math-toc occurrences:", html.count("rank-math-toc"))

print("=== tables/lists ===")
print("tables:", html.count("<table"))
print("ul:", html.count("<ul"), "ol:", html.count("<ol"))

print("=== schema FAQPage count ===")
print("FAQPage occurrences:", html.count('"@type":"FAQPage"') + html.count('"@type": "FAQPage"'))
print("Article/NewsArticle occurrences:", html.count('"@type":"Article"') + html.count('"@type":"NewsArticle"'))

print("=== schema escaped check ===")
print("Has literal <script type=\"application/ld+json\">:", '<script type="application/ld+json">' in html)
print("Has escaped &lt;script (bad sign):", "&lt;script" in html)

print("=== accent check (sample words) ===")
for w in ["conversão", "não", "é", "página", "bloqueação" ]:
    print(w, "->", w in html)

print("=== mojibake check ===")
print("Has 'Ã' pattern (bad sign):", "Ã©" in html or "Ã£" in html or "Â" in html)
