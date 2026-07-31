"""Extract a local, page-level index from the hackathon PDF.

The generated JSON stays local. It is used to select page contexts and to
produce deterministic page citations in the Node backend.
"""

import json
from pathlib import Path
from typing import List
from pypdf import PdfReader

ROOT = Path(__file__).resolve().parents[1]
PDF = ROOT.parents[1] / "data" / "vlearn-pack" / "slides" / "d1-slide-hackathon.pdf"
OUTPUT = ROOT / "data" / "slide-index.json"


def keywords(text: str) -> List[str]:
    words = []
    for word in text.lower().replace("\n", " ").split():
        clean = "".join(char for char in word if char.isalnum())
        if len(clean) >= 4 and clean not in words:
            words.append(clean)
    return words[:28]


reader = PdfReader(str(PDF))
pages = []
for number, page in enumerate(reader.pages, start=1):
    text = " ".join((page.extract_text() or "").split())
    title = text.split(".")[0][:120] if text else f"Trang {number}"
    pages.append({"page": number, "title": title, "text": text, "keywords": keywords(text)})

OUTPUT.write_text(
    json.dumps({"document": PDF.name, "pageCount": len(pages), "pages": pages}, ensure_ascii=False, indent=2),
    encoding="utf-8",
)
print(f"Wrote {len(pages)} pages to {OUTPUT}")
