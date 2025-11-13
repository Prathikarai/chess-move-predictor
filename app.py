import os
import requests
import sqlite3
from datetime import datetime
from flask import Flask, render_template, request, jsonify, send_from_directory
import importlib

# ==============================================
# SAFE TENSORFLOW / KERAS IMPORT
# ==============================================
tf = None
load_model = None

try:
    tf = importlib.import_module("tensorflow")
    keras_module = importlib.import_module("tensorflow.keras.models")
    load_model = getattr(keras_module, "load_model", None)

    if tf is not None:
        print("✅ TensorFlow version:", tf.__version__)
    else:
        print("⚠️ TensorFlow not available.")

except ModuleNotFoundError:
    print("⚠️ TensorFlow not installed — using API/Offline modes only.")
except Exception as e:
    print("⚠️ TensorFlow import failed:", str(e))
    tf = None
    load_model = None

# ==============================================
# FLASK APP SETUP
# ==============================================
app = Flask(__name__)
app.config['SEND_FILE_MAX_AGE_DEFAULT'] = 0  # Disable cache during development

# ==============================================
# FAVICON ROUTE (to prevent 404 errors)
# ==============================================
@app.route('/favicon.ico')
def favicon():
    return send_from_directory(
        os.path.join(app.root_path, 'static'),
        'favicon.ico',
        mimetype='image/vnd.microsoft.icon'
    )

# ==============================================
# SQLITE DATABASE SETUP
# ==============================================
def init_db():
    conn = sqlite3.connect('chess_games.db')
    c = conn.cursor()
    c.execute('''CREATE TABLE IF NOT EXISTS moves(
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        ts TEXT,
        move TEXT
    )''')
    conn.commit()
    conn.close()

def log_move_db(move: str):
    """Store a move with timestamp."""
    try:
        conn = sqlite3.connect('chess_games.db')
        c = conn.cursor()
        c.execute(
            "INSERT INTO moves(ts, move) VALUES(?, ?)",
            (datetime.now().isoformat(timespec='seconds'), move)
        )
        conn.commit()
    except Exception as e:
        print("⚠️ DB insert failed:", e)
    finally:
        conn.close()

@app.route('/log_move', methods=['POST'])
def log_move_route():
    """Frontend logs player moves here."""
    data = request.get_json(force=True)
    move = (data or {}).get('move', '')
    if not move:
        return jsonify({'ok': False, 'error': 'empty move'}), 400
    log_move_db(move)
    return jsonify({'ok': True})

# ==============================================
# ONLINE STOCKFISH API
# ==============================================
def get_stockfish_move(fen: str, depth: int = 12):
    """Query Stockfish API for best move."""
    url = "https://stockfish.online/api/s/v2.php"
    params = {"fen": fen, "depth": depth}
    try:
        resp = requests.get(url, params=params, timeout=8)
        resp.raise_for_status()
        data = resp.json()
        if not isinstance(data, dict):
            return {"error": "Invalid response from Stockfish API"}

        if data.get("success"):
            bm = data.get("bestmove", "")
            if isinstance(bm, str) and " " in bm:
                bm = bm.split()[-1]
            continuation = data.get("continuation", "")
            cont_list = continuation.split() if isinstance(continuation, str) else (
                continuation if isinstance(continuation, list) else []
            )
            return {
                "bestmove": bm,
                "evaluation": data.get("evaluation"),
                "continuation": cont_list
            }
        return {"error": data.get("error", "Stockfish API unsuccessful")}

    except requests.exceptions.RequestException as e:
        print("[ERROR] Stockfish API request failed:", e)
        return {"error": f"Stockfish API request failed: {e}"}
    except Exception as e:
        print("[ERROR] Unexpected Stockfish API error:", e)
        return {"error": f"Stockfish API error: {e}"}

# ==============================================
# FLASK ROUTES
# ==============================================
@app.route('/')
def index():
    return render_template('index.html')

@app.route('/game')
def game():
    return render_template('game.html')

@app.route('/predict', methods=['POST'])
def predict():
    """Online move prediction using Stockfish API."""
    try:
        data = request.get_json(force=True)
        fen = data.get('fen', '')
        depth = int(data.get('depth', 12))
        if not fen:
            return jsonify({'error': 'FEN missing'}), 400

        result = get_stockfish_move(fen, depth=depth)
        return jsonify(result)

    except Exception as e:
        print("[ERROR] /predict failed:", e)
        return jsonify({
            'error': 'Server error during prediction',
            'detail': str(e)
        }), 500

# ==============================================
# LOCAL MODEL (TensorFlow)
# ==============================================
LOCAL_MODEL_PATH = 'chess_model.keras'
local_model = None

if load_model and os.path.exists(LOCAL_MODEL_PATH):
    try:
        local_model = load_model(LOCAL_MODEL_PATH)
        print("✅ Local model loaded successfully!")
    except Exception as e:
        print("⚠️ Local model load failed:", e)
else:
    print("ℹ️ Local model not found or TensorFlow unavailable — skipping.")

def fen_to_features_stub(fen: str):
    """Convert FEN to model input (stub). Replace later with real preprocessing."""
    import numpy as np
    return np.zeros((1, 64), dtype='float32')

@app.route('/predict_local', methods=['POST'])
def predict_local():
    """Local TensorFlow/Keras model prediction route."""
    if local_model is None:
        return jsonify({'error': 'Local model not available'})
    try:
        data = request.get_json(force=True)
        fen = data.get('fen', '')
        if not fen:
            return jsonify({'error': 'FEN missing'}), 400

        x = fen_to_features_stub(fen)
        pred = local_model.predict(x, verbose=0)

        # Placeholder: you’ll later map model outputs to actual UCI moves
        bestmove = "e2e4"
        evaluation = float(getattr(pred, "max", lambda: 0.0)())

        return jsonify({'bestmove': bestmove, 'evaluation': evaluation})
    except Exception as e:
        print("[ERROR] /predict_local failed:", e)
        return jsonify({'error': 'Local model error', 'detail': str(e)}), 500

# ==============================================
# RUN SERVER
# ==============================================
if __name__ == '__main__':
    init_db()
    app.run(debug=True, host='127.0.0.1', port=5000)
