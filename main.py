# ============================================================
# STREET RUNNER // CYBER HIGHWAY
# Python + HTML
# Entry Point
# ============================================================

import server

if __name__ == "__main__":
    import threading
    import time
    import webbrowser

    server_thread = threading.Thread(
        target=server.start_server,
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
            elapsed = time.time() - server.start_time
            server.game_speed = min(
                server.START_SPEED + elapsed * server.ACCELERATION,
                server.MAX_SPEED
            )
            time.sleep(0.1)

    except KeyboardInterrupt:
        print("")
        print("Street Runner stopped.")
