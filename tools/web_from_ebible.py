"""Convert the World English Bible (eBible.org "engwebp_vpl.txt") into data/web.json.

data/web.json uses the same shape as data/cuv.json so tools/pipeline.js reads both:
  {"translation": ..., "books": [{"id", "name", "abbr", "en", "chapters": [[verse, ...], ...]}]}
Book ids match cuv.json, so content/ references work in both languages.

Usage (once, when updating the English text):
  curl -LO https://ebible.org/Scriptures/engwebp_vpl.zip && unzip engwebp_vpl.zip
  python3 tools/web_from_ebible.py engwebp_vpl.txt
"""
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

# eBible code, name used in references ("Psalm 23", not "Psalms 23"), short form (cuv.json supplies the ids, in the same order)
BOOKS = [
    ("GEN", "Genesis", "Gen"), ("EXO", "Exodus", "Exod"), ("LEV", "Leviticus", "Lev"), ("NUM", "Numbers", "Num"),
    ("DEU", "Deuteronomy", "Deut"), ("JOS", "Joshua", "Josh"), ("JDG", "Judges", "Judg"), ("RUT", "Ruth", "Ruth"),
    ("1SA", "1 Samuel", "1 Sam"), ("2SA", "2 Samuel", "2 Sam"), ("1KI", "1 Kings", "1 Kgs"), ("2KI", "2 Kings", "2 Kgs"),
    ("1CH", "1 Chronicles", "1 Chr"), ("2CH", "2 Chronicles", "2 Chr"), ("EZR", "Ezra", "Ezra"), ("NEH", "Nehemiah", "Neh"),
    ("EST", "Esther", "Esth"), ("JOB", "Job", "Job"), ("PSA", "Psalm", "Ps"), ("PRO", "Proverbs", "Prov"),
    ("ECC", "Ecclesiastes", "Eccl"), ("SOL", "Song of Songs", "Song"), ("ISA", "Isaiah", "Isa"), ("JER", "Jeremiah", "Jer"),
    ("LAM", "Lamentations", "Lam"), ("EZE", "Ezekiel", "Ezek"), ("DAN", "Daniel", "Dan"), ("HOS", "Hosea", "Hos"),
    ("JOE", "Joel", "Joel"), ("AMO", "Amos", "Amos"), ("OBA", "Obadiah", "Obad"), ("JON", "Jonah", "Jonah"),
    ("MIC", "Micah", "Mic"), ("NAH", "Nahum", "Nah"), ("HAB", "Habakkuk", "Hab"), ("ZEP", "Zephaniah", "Zeph"),
    ("HAG", "Haggai", "Hag"), ("ZEC", "Zechariah", "Zech"), ("MAL", "Malachi", "Mal"), ("MAT", "Matthew", "Matt"),
    ("MAR", "Mark", "Mark"), ("LUK", "Luke", "Luke"), ("JOH", "John", "John"), ("ACT", "Acts", "Acts"),
    ("ROM", "Romans", "Rom"), ("1CO", "1 Corinthians", "1 Cor"), ("2CO", "2 Corinthians", "2 Cor"), ("GAL", "Galatians", "Gal"),
    ("EPH", "Ephesians", "Eph"), ("PHI", "Philippians", "Phil"), ("COL", "Colossians", "Col"), ("1TH", "1 Thessalonians", "1 Thess"),
    ("2TH", "2 Thessalonians", "2 Thess"), ("1TI", "1 Timothy", "1 Tim"), ("2TI", "2 Timothy", "2 Tim"), ("TIT", "Titus", "Titus"),
    ("PHM", "Philemon", "Phlm"), ("HEB", "Hebrews", "Heb"), ("JAM", "James", "Jas"), ("1PE", "1 Peter", "1 Pet"),
    ("2PE", "2 Peter", "2 Pet"), ("1JO", "1 John", "1 John"), ("2JO", "2 John", "2 John"), ("3JO", "3 John", "3 John"),
    ("JUD", "Jude", "Jude"), ("REV", "Revelation", "Rev"),
]


def main(vpl_path):
    cuv = json.loads((ROOT / "data/cuv.json").read_text(encoding="utf-8"))
    ids = [b["id"] for b in cuv["books"]]
    assert len(ids) == len(BOOKS) == 66
    verses = {code: {} for code, _, _ in BOOKS}
    line_re = re.compile(r"^(\w{3}) (\d+):(\d+) (.*)$")
    for line in Path(vpl_path).read_text(encoding="utf-8").splitlines():
        m = line_re.match(line.strip())
        if not m or m.group(1) not in verses:
            continue
        code, ch, v, text = m.group(1), int(m.group(2)), int(m.group(3)), m.group(4).strip()
        verses[code].setdefault(ch, {})[v] = text
    books = []
    for bid, (code, name, abbr) in zip(ids, BOOKS):
        chs = verses[code]
        assert chs, f"no verses for {code}"
        chapters = []
        for ch in range(1, max(chs) + 1):
            vs = chs.get(ch, {})
            chapters.append([vs.get(v, "") for v in range(1, max(vs or {0: 0}) + 1)])
        books.append({"id": bid, "name": name, "abbr": abbr, "en": name, "chapters": chapters})
    out = {"translation": "World English Bible (Public Domain)", "books": books}
    (ROOT / "data/web.json").write_text(json.dumps(out, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(f"wrote data/web.json: {sum(len(c) for b in books for c in b['chapters'])} verses")


if __name__ == "__main__":
    main(sys.argv[1])
