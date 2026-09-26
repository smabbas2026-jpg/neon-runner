# ============================================================
# STREET RUNNER // CYBER HIGHWAY
# Python + HTML
# No Flask
# Standard Library HTTP Server
# ============================================================

from http.server import HTTPServer, BaseHTTPRequestHandler
import os
import mimetypes
import threading
import time
import webbrowser
from urllib.parse import urlparse

# ============================================================
# GAME SETTINGS
# ============================================================

START_SPEED = 3.0
MAX_SPEED = 14.5
ACCELERATION = 0.075

game_speed = START_SPEED
start_time = time.time()

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

# Pure CSS mockup visual scene (available via ?view=css)
HTML_PURE_CSS = r"""<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Street Runner // Cyber Highway (Pure CSS Mode)</title>
<style>
* { box-sizing: border-box; margin: 0; padding: 0; }
html, body { width: 100%; height: 100%; overflow: hidden; background: #050713; font-family: Arial, sans-serif; }
.game { position: relative; width: 100vw; height: 100vh; overflow: hidden; background: linear-gradient(to bottom, #050719 0%, #10183d 42%, #20294a 62%, #11131d 100%); }
.moon { position: absolute; width: 90px; height: 90px; top: 8%; right: 12%; border-radius: 50%; background: #e9f8ff; box-shadow: 0 0 25px #fff, 0 0 60px #00d9ff, 0 0 120px #147bff; opacity: .9; }
.star { position: absolute; width: 3px; height: 3px; border-radius: 50%; background: white; box-shadow: 0 0 8px white; }
.far-city { position: absolute; bottom: 40%; left: 0; width: 300%; height: 35%; display: flex; align-items: flex-end; gap: 12px; animation: farCity 24s linear infinite; }
.far-building { position: relative; flex-shrink: 0; width: 90px; background: linear-gradient(90deg, #0e1328, #202746, #0b1022); border: 1px solid #26375d; }
.far-building::after { content: ""; position: absolute; inset: 12px; background: repeating-linear-gradient(90deg, #00d9ff 0 5px, transparent 5px 20px), repeating-linear-gradient(0deg, #ffd84d 0 5px, transparent 5px 25px); opacity: .3; }
.city { position: absolute; left: 0; bottom: 23%; width: 300%; height: 50%; display: flex; align-items: flex-end; gap: 22px; animation: mainCity 10s linear infinite; }
.building { position: relative; flex-shrink: 0; width: 145px; background: linear-gradient(90deg, #12162b, #292f52, #11152a); border-left: 2px solid #27375e; border-right: 2px solid #27375e; box-shadow: inset 0 0 30px #0008; }
.building.small { height: 180px; }
.building.medium { height: 260px; }
.building.tall { height: 350px; }
.building.tower { width: 180px; height: 420px; }
.building::before { content: ""; position: absolute; top: 20px; left: 20px; right: 20px; bottom: 20px; background: repeating-linear-gradient(90deg, #00eaff 0 7px, transparent 7px 25px), repeating-linear-gradient(0deg, #ffd84d 0 7px, transparent 7px 30px); opacity: .4; filter: drop-shadow(0 0 5px #00eaff); }
.antenna { position: absolute; width: 4px; height: 60px; top: -60px; left: 50%; background: #606981; }
.antenna::after { content: ""; position: absolute; width: 12px; height: 12px; left: -4px; top: 0; border-radius: 50%; background: #ff315f; box-shadow: 0 0 15px #ff315f; animation: blink .9s infinite alternate; }
.house { position: relative; flex-shrink: 0; width: 145px; height: 125px; background: linear-gradient(90deg, #242641, #39385b); }
.house::before { content: ""; position: absolute; left: 0; top: -70px; border-left: 72px solid transparent; border-right: 72px solid transparent; border-bottom: 70px solid #493258; }
.house::after { content: ""; position: absolute; bottom: 0; left: 55px; width: 35px; height: 65px; background: #111426; border: 2px solid #00eaff; }
.house-window { position: absolute; top: 32px; width: 28px; height: 28px; background: #ffd75c; box-shadow: 0 0 15px #ffd75c; }
.hw-left { left: 18px; }
.hw-right { right: 18px; }
.sign { position: relative; flex-shrink: 0; width: 125px; height: 52px; margin-bottom: 180px; display: flex; justify-content: center; align-items: center; color: #ff36d4; font-size: 17px; font-weight: bold; letter-spacing: 2px; background: #190a23; border: 3px solid #ff36d4; box-shadow: 0 0 12px #ff36d4, inset 0 0 15px #ff36d455; }
.sign::after { content: ""; position: absolute; width: 5px; height: 180px; top: 50px; background: #596179; }
.streetlight { position: relative; flex-shrink: 0; width: 12px; height: 255px; background: #383d51; }
.streetlight::before { content: ""; position: absolute; width: 70px; height: 8px; top: 0; left: -30px; background: #41475c; border-radius: 10px; }
.streetlight::after { content: ""; position: absolute; width: 30px; height: 18px; top: -8px; left: -20px; border-radius: 50%; background: #fff1a0; box-shadow: 0 0 20px #fff1a0, 0 0 50px #ffd95a; }
.sidewalk { position: absolute; bottom: 19%; left: 0; width: 300%; height: 5%; background: repeating-linear-gradient(90deg, #37394c 0 80px, #252738 80px 84px); border-top: 3px solid #00eaff; animation: sidewalkMove 4s linear infinite; }
.road { position: absolute; left: 0; bottom: 0; width: 300%; height: 20%; background: linear-gradient(#191b28, #07080d); animation: roadMove 3.5s linear infinite; }
.road::before { content: ""; position: absolute; left: 0; top: 48%; width: 300%; height: 7px; background: repeating-linear-gradient(90deg, white 0 100px, transparent 100px 190px); opacity: .65; }
.road::after { content: ""; position: absolute; top: 0; left: 0; width: 100%; height: 5px; background: #00eaff; box-shadow: 0 0 15px #00eaff; }
.people { position: absolute; left: 0; bottom: 22%; width: 300%; height: 100px; display: flex; align-items: flex-end; gap: 130px; animation: peopleMove 8s linear infinite; }
.person { position: relative; flex-shrink: 0; width: 30px; height: 65px; border-radius: 50% 50% 10% 10%; background: linear-gradient(#eab094 0 25%, #00d9ff 25% 70%, #191c2e 70%); filter: drop-shadow(0 0 5px #00eaff); }
.person::before { content: ""; position: absolute; top: -23px; left: 5px; width: 20px; height: 20px; border-radius: 50%; background: #e9b18f; }
.cars { position: absolute; left: 0; bottom: 11%; width: 300%; height: 80px; display: flex; align-items: center; gap: 220px; animation: carsMove 6s linear infinite; }
.car { position: relative; flex-shrink: 0; width: 120px; height: 42px; border-radius: 20px 20px 8px 8px; background: linear-gradient(#ff245f, #761637); box-shadow: 0 0 20px #ff245f66; }
.car::before { content: ""; position: absolute; width: 60px; height: 24px; left: 30px; top: -20px; border-radius: 25px 25px 0 0; background: #1c2137; border: 2px solid #ff245f; }
.wheel { position: absolute; bottom: -12px; width: 23px; height: 23px; border-radius: 50%; background: #030308; border: 4px solid #555c70; }
.wheel.left { left: 15px; }
.wheel.right { right: 15px; }
.player { position: absolute; z-index: 30; left: 50%; bottom: 20%; width: 52px; height: 95px; transform: translateX(-50%); border-radius: 25px 25px 10px 10px; background: linear-gradient(#ffffff 0 20%, #00d9ff 20% 60%, #713cff 60%); box-shadow: 0 0 15px #00eaff, 0 0 40px #00eaff; animation: playerRun .35s infinite alternate; }
.player::before { content: ""; position: absolute; top: -29px; left: 10px; width: 30px; height: 30px; border-radius: 50%; background: #ffd0b0; border: 3px solid #00eaff; box-shadow: 0 0 10px #00eaff; }
.hud { position: absolute; z-index: 100; top: 25px; left: 25px; color: white; text-shadow: 0 0 8px #00eaff; }
.title { color: #00eaff; font-size: 28px; font-weight: bold; margin-bottom: 7px; }
.score { font-size: 18px; }
.speed { position: absolute; z-index: 100; top: 25px; right: 25px; color: #ff36d4; font-weight: bold; text-shadow: 0 0 10px #ff36d4; }
.switch-link { position: absolute; z-index: 100; bottom: 20px; right: 25px; color: #00eaff; text-decoration: none; font-weight: bold; font-size: 14px; background: rgba(0,0,0,0.6); padding: 6px 12px; border-radius: 6px; border: 1px solid #00eaff; }
@keyframes farCity { from { transform: translateX(0); } to { transform: translateX(-50%); } }
@keyframes mainCity { from { transform: translateX(0); } to { transform: translateX(-66.66%); } }
@keyframes sidewalkMove { from { transform: translateX(0); } to { transform: translateX(-33.33%); } }
@keyframes roadMove { from { transform: translateX(0); } to { transform: translateX(-33.33%); } }
@keyframes peopleMove { from { transform: translateX(0); } to { transform: translateX(-33.33%); } }
@keyframes carsMove { from { transform: translateX(0); } to { transform: translateX(-33.33%); } }
@keyframes playerRun { from { transform: translateX(-50%) translateY(0); } to { transform: translateX(-50%) translateY(-7px); } }
@keyframes blink { from { opacity: .25; } to { opacity: 1; } }
@media(max-width:700px) { .moon { width: 60px; height: 60px; } .building { width: 100px; } .building.tower { width: 130px; } .sign { width: 95px; font-size: 13px; } .title { font-size: 21px; } }
</style>
</head>
<body>
<div class="game">
    <div class="moon"></div>
    <div class="star" style="left:5%;top:15%;"></div>
    <div class="star" style="left:12%;top:30%;"></div>
    <div class="star" style="left:22%;top:10%;"></div>
    <div class="star" style="left:30%;top:25%;"></div>
    <div class="star" style="left:40%;top:12%;"></div>
    <div class="star" style="left:50%;top:28%;"></div>
    <div class="star" style="left:62%;top:10%;"></div>
    <div class="star" style="left:72%;top:25%;"></div>
    <div class="star" style="left:83%;top:13%;"></div>
    <div class="star" style="left:94%;top:30%;"></div>
    <div class="far-city">
        <div class="far-building" style="height:170px;"></div>
        <div class="far-building" style="height:230px;"></div>
        <div class="far-building" style="height:140px;"></div>
        <div class="far-building" style="height:290px;"></div>
        <div class="far-building" style="height:200px;"></div>
        <div class="far-building" style="height:320px;"></div>
        <div class="far-building" style="height:180px;"></div>
        <div class="far-building" style="height:250px;"></div>
        <div class="far-building" style="height:160px;"></div>
        <div class="far-building" style="height:300px;"></div>
    </div>
    <div class="city">
        <div class="building medium"><div class="antenna"></div></div>
        <div class="building tall"></div>
        <div class="building small"></div>
        <div class="building tower"><div class="antenna"></div></div>
        <div class="house"><div class="house-window hw-left"></div><div class="house-window hw-right"></div></div>
        <div class="sign">NEON</div>
        <div class="building medium"></div>
        <div class="streetlight"></div>
        <div class="house"><div class="house-window hw-left"></div><div class="house-window hw-right"></div></div>
        <div class="building tall"></div>
        <div class="sign">CITY</div>
        <div class="building tower"><div class="antenna"></div></div>
        <div class="streetlight"></div>
        <div class="building medium"></div>
    </div>
    <div class="people">
        <div class="person"></div><div class="person"></div><div class="person"></div>
        <div class="person"></div><div class="person"></div><div class="person"></div>
    </div>
    <div class="sidewalk"></div>
    <div class="cars">
        <div class="car"><div class="wheel left"></div><div class="wheel right"></div></div>
        <div class="car"><div class="wheel left"></div><div class="wheel right"></div></div>
        <div class="car"><div class="wheel left"></div><div class="wheel right"></div></div>
    </div>
    <div class="road"></div>
    <div class="player"></div>
    <div class="hud">
        <div class="title">STREET RUNNER</div>
        <div class="score">SCORE: 000000</div>
    </div>
    <div class="speed">CYBER HIGHWAY</div>
    <a href="/" class="switch-link">▶ PLAY INTERACTIVE GAME</a>
</div>
</body>
</html>
"""

# ============================================================
# SIMPLE PYTHON HTTP SERVER
# ============================================================

class GameServer(BaseHTTPRequestHandler):

    def log_message(self, format, *args):
        # Clean terminal logging
        pass

    def do_GET(self):
        parsed = urlparse(self.path)
        req_path = parsed.path

        # If user explicitly asks for the pure CSS demo view
        if parsed.query and "view=css" in parsed.query:
            self.send_response(200)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.send_header("Cache-Control", "no-cache")
            self.end_headers()
            self.wfile.write(HTML_PURE_CSS.encode("utf-8"))
            return

        # Main route serves index.html (the fully playable game)
        if req_path == "/" or req_path == "/index.html":
            file_path = os.path.join(BASE_DIR, "index.html")
            if os.path.exists(file_path):
                self.send_response(200)
                self.send_header("Content-Type", "text/html; charset=utf-8")
                self.send_header("Cache-Control", "no-cache, no-store, must-revalidate")
                self.send_header("Pragma", "no-cache")
                self.send_header("Expires", "0")
                self.end_headers()
                with open(file_path, "rb") as f:
                    self.wfile.write(f.read())
                return

        # Serve static assets (css, js, assets, manifest)
        clean_path = req_path.lstrip("/\\")
        file_path = os.path.join(BASE_DIR, clean_path)

        if os.path.isfile(file_path):
            mime_type, _ = mimetypes.guess_type(file_path)
            if not mime_type:
                if file_path.endswith(".js"):
                    mime_type = "application/javascript"
                elif file_path.endswith(".css"):
                    mime_type = "text/css"
                elif file_path.endswith(".json"):
                    mime_type = "application/json"
                else:
                    mime_type = "application/octet-stream"

            self.send_response(200)
            self.send_header("Content-Type", f"{mime_type}; charset=utf-8" if "text" in mime_type or "javascript" in mime_type or "json" in mime_type else mime_type)
            self.send_header("Cache-Control", "no-cache, no-store, must-revalidate")
            self.send_header("Pragma", "no-cache")
            self.send_header("Expires", "0")
            self.end_headers()
            with open(file_path, "rb") as f:
                self.wfile.write(f.read())
            return

        # Fallback 404
        self.send_response(404)
        self.send_header("Content-Type", "text/plain; charset=utf-8")
        self.end_headers()
        self.wfile.write(b"404 Not Found")

# ============================================================
# START SERVER
# ============================================================

def start_server():
    server = HTTPServer(("127.0.0.1", 8000), GameServer)

    print("")
    print("============================================")
    print(" STREET RUNNER // CYBER HIGHWAY")
    print("============================================")
    print("")
    print("Game running at:")
    print("http://127.0.0.1:8000")
    print("")
    print("Press CTRL+C to stop.")
    print("")

    server.serve_forever()

# ============================================================
# RUN
# ============================================================

if __name__ == "__main__":
    server_thread = threading.Thread(
        target=start_server,
        daemon=True
    )
    server_thread.start()

    time.sleep(1)

    try:
        webbrowser.open("http://127.0.0.1:8000")
    except Exception:
        pass

    try:
        while True:
            # Gradually increase game speed.
            elapsed = time.time() - start_time
            game_speed = min(
                START_SPEED + elapsed * ACCELERATION,
                MAX_SPEED
            )
            time.sleep(0.1)

    except KeyboardInterrupt:
        print("")
        print("Street Runner stopped.")
