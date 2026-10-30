"""Read-only capture of SITE123 sources. Downloads stay outside public/."""
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from hashlib import sha256
from html.parser import HTMLParser
from pathlib import Path
from urllib.request import Request, urlopen
from urllib.parse import urljoin
import json
import re

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'docs/content/site-reference'
BASE = 'https://6a3c46bee53b4.site123.me/'
PAGES = [('accueil', ''), ('a-propos', '%C3%80-propos'), ('perspectives', 'perspectives'), ('services', 'services'), ('rendez-vous', 'prise-de-rendez-vous'), ('contact', 'contact'), ('portfolio', 'portfolio'), ('portfolio-detail', 'portfolio/portfolio')]

def save_json(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')

def fetch(url):
    with urlopen(Request(url, headers={'User-Agent': 'Mozilla/5.0 (compatible; PortfolioContentAudit/1.0)'}), timeout=45) as response:
        return response.read(), response.status, response.url, dict(response.headers)

class PageParser(HTMLParser):
    def __init__(self):
        super().__init__(); self.skip = 0; self.text = []; self.links = []; self.media = []
    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if tag in ['script', 'style']: self.skip += 1
        if tag == 'a' and a.get('href'): self.links.append(a)
        if tag in ['img', 'video', 'source', 'iframe']: self.media.append({'tag': tag, **a})
    def handle_endtag(self, tag):
        if tag in ['script', 'style']: self.skip = max(0, self.skip-1)
    def handle_data(self, data):
        if not self.skip and data.strip(): self.text.append(data.strip())

def capture_page(item):
    name, path = item; url = urljoin(BASE, path)
    try:
        data, status, final, headers = fetch(url)
        folder = OUT/'source/pages'; folder.mkdir(parents=True, exist_ok=True)
        (folder/f'{name}.html').write_bytes(data)
        text = data.decode('utf-8', errors='replace'); parser = PageParser(); parser.feed(text)
        (folder/f'{name}.txt').write_text('\n'.join(parser.text)+'\n', encoding='utf-8')
        record = {'page': name, 'url': url, 'finalUrl': final, 'status': status, 'retrievedAt': datetime.now(timezone.utc).isoformat(), 'bytes': len(data), 'sha256': sha256(data).hexdigest(), 'localHtml': str((folder/f'{name}.html').relative_to(ROOT)).replace('\\','/'), 'links': parser.links, 'mediaElements': parser.media}
        save_json(folder/f'{name}.json', record)
        return {k:v for k,v in record.items() if k not in ['links','mediaElements']}
    except Exception as error: return {'page': name, 'url': url, 'error': str(error)}

if __name__ == '__main__':
    with ThreadPoolExecutor(max_workers=4) as pool: pages = list(pool.map(capture_page, PAGES))
    save_json(OUT/'source/page-capture.json', pages)
    print(json.dumps(pages, ensure_ascii=True, indent=2))
