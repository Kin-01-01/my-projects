import sys, zipfile, re
import xml.etree.ElementTree as ET

NS = {'w': 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'}

def para_text(p):
    parts = []
    for node in p.iter():
        tag = node.tag.split('}')[-1]
        if tag == 't':
            parts.append(node.text or '')
        elif tag == 'tab':
            parts.append('\t')
        elif tag == 'br':
            parts.append('\n')
    return ''.join(parts)

def dump(path):
    with zipfile.ZipFile(path) as z:
        xml = z.read('word/document.xml')
    root = ET.fromstring(xml)
    body = root.find('w:body', NS)
    out = []
    for el in body:
        tag = el.tag.split('}')[-1]
        if tag == 'p':
            out.append(para_text(el))
        elif tag == 'tbl':
            for row in el.findall('w:tr', NS):
                cells = []
                for cell in row.findall('w:tc', NS):
                    cells.append(' '.join(para_text(p) for p in cell.findall('w:p', NS)).strip())
                out.append('|TBL| ' + ' || '.join(cells))
    return out

if __name__ == '__main__':
    ps = dump(sys.argv[1])
    for i, t in enumerate(ps):
        print(f'[{i:04d}] {t}')
