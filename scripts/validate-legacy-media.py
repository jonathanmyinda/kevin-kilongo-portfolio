"""Decode only the known legacy import. Not a general upload security pipeline."""
import json, sys
from pathlib import Path
from PIL import Image
from pypdf import PdfReader

manifest = json.loads(Path(sys.argv[1]).read_text(encoding='utf-8'))
for entry in manifest['files']:
    path = Path(entry['source'])
    if entry['mime'] == 'application/pdf':
        doc = PdfReader(path)
        if doc.is_encrypted or not len(doc.pages):
            raise ValueError('PDF illisible ou chiffré')
        # This is the existing reviewed portfolio, not an untrusted new PDF upload.
        for page in doc.pages:
            _ = page.mediabox
    else:
        with Image.open(path) as image:
            image.verify()
        with Image.open(path) as image:
            image.load()
            if image.width * image.height > 30000000:
                raise ValueError('Dimensions excessives')
            if (entry['width'], entry['height']) != image.size:
                raise ValueError('Dimensions déclarées différentes du fichier : ' + str(path))
            entry['width'], entry['height'] = image.size
print(json.dumps({'validated': len(manifest['files']), 'scope': 'existing-reviewed-legacy-files'}))
