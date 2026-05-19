import pathlib, base64, sys

target = pathlib.Path(r'C:\Users\Holms\repos\cea-lol-broadcast\src\views\StreamerView.tsx')

# Read base64 content from a companion file
b64 = pathlib.Path(r'C:\Users\Holms\repos\cea-lol-broadcast\_streamer.b64').read_text()
content = base64.b64decode(b64).decode('utf-8')
target.write_text(content, encoding='utf-8')
print(f'wrote {len(content)} chars')
