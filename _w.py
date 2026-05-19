# player-stats writer
html = open(__file__).read().split("HTMLSTART")[1].split("HTMLEND")[0]
open("C:/Users/Holms/repos/cea-lol-broadcast/overlays/player-stats.html","w",encoding="utf-8").write(html)
print("Written",len(html))
# HTMLSTART
