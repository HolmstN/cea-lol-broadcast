import pathlib, base64
b64 = pathlib.Path(r"C:/Users/Holms/repos/cea-lol-broadcast/_match_b64.txt").read_text()
tsx = base64.b64decode(b64).decode("utf-8")
pathlib.Path(r"C:/Users/Holms/repos/cea-lol-broadcast/src/views/MatchView.tsx").write_text(tsx, encoding="utf-8")
print("written", len(tsx), "chars")
