import os
import requests
import sqlite3
from datetime import datetime
from flask import Flask, render_template, request, jsonify, send_from_directory, Response, redirect
import importlib
from werkzeug.security import generate_password_hash, check_password_hash

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
    print("⚠️ TensorFlow not installed — using API mode only.")
except Exception as e:
    print("⚠️ TensorFlow import failed:", str(e))
    tf = None
    load_model = None


# ==============================================
# FLASK SETUP
# ==============================================
app = Flask(__name__)
app.config['SEND_FILE_MAX_AGE_DEFAULT'] = 0  # No cache during development


# ==============================================
# FAVICON
# ==============================================
@app.route('/favicon.ico')
def favicon():
    return send_from_directory(
        os.path.join(app.root_path, 'static'),
        'favicon.ico',
        mimetype='image/vnd.microsoft.icon'
    )


# ==============================================
# DATABASES: CHESS MOVES + USERS TABLE
# ==============================================
def init_db():
    """Create move log table."""
    conn = sqlite3.connect('chess_games.db')
    c = conn.cursor()
    c.execute('''CREATE TABLE IF NOT EXISTS moves(
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        ts TEXT,
        move TEXT
    )''')
    conn.commit()
    conn.close()


def init_user_db():
    """Create users table."""
    conn = sqlite3.connect("chess_games.db")
    c = conn.cursor()
    c.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            email TEXT NOT NULL UNIQUE,
            password TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
    """)
    conn.commit()
    conn.close()


def log_move_db(move: str):
    """Save chess move with timestamp."""
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
    data = request.get_json(force=True)
    move = (data or {}).get('move', '')
    if not move:
        return jsonify({'ok': False, 'error': 'empty move'}), 400
    log_move_db(move)
    return jsonify({'ok': True})


# ==============================================
# USER AUTH APIs (Sign Up + Login)
# ==============================================
@app.route("/register", methods=["POST"])
def register_user():
    data = request.json
    name = data.get("name")
    email = data.get("email")
    password = data.get("password")

    if not name or not email or not password:
        return jsonify({"success": False, "message": "All fields required"}), 400

    conn = sqlite3.connect("chess_games.db")
    c = conn.cursor()

    c.execute("SELECT id FROM users WHERE email = ?", (email,))
    existing = c.fetchone()

    if existing:
        conn.close()
        return jsonify({"success": False, "message": "Email already exists"}), 409

    hashed_pw = generate_password_hash(password)

    c.execute("INSERT INTO users (name, email, password) VALUES (?, ?, ?)",
              (name, email, hashed_pw))
    conn.commit()
    conn.close()

    return jsonify({"success": True, "message": "Account created successfully!"}), 200


@app.route("/login_user", methods=["POST"])
def login_user():
    data = request.json
    email = data.get("email")
    password = data.get("password")

    conn = sqlite3.connect("chess_games.db")
    c = conn.cursor()

    c.execute("SELECT id, name, password FROM users WHERE email = ?", (email,))
    user = c.fetchone()
    conn.close()

    if not user:
        return jsonify({"success": False, "message": "Email not registered"}), 404

    user_id, name, hashed_pw = user

    if not check_password_hash(hashed_pw, password):
        return jsonify({"success": False, "message": "Incorrect password"}), 401

    return jsonify({
        "success": True,
        "message": "Login successful!",
        "name": name
    }), 200


# ==============================================
# STOCKFISH API (ONLINE MOVE PREDICTION)
# ==============================================
def get_stockfish_move(fen: str, depth: int = 12):
    url = "https://stockfish.online/api/s/v2.php"
    params = {"fen": fen, "depth": depth}
    try:
        resp = requests.get(url, params=params, timeout=8)
        resp.raise_for_status()
        data = resp.json()

        if data.get("success"):
            best = data.get("bestmove", "")
            if " " in best:
                best = best.split()[-1]

            continuation = data.get("continuation", "")
            cont_list = continuation.split() if isinstance(continuation, str) else []

            return {
                "bestmove": best,
                "evaluation": data.get("evaluation"),
                "continuation": cont_list
            }
        return {"error": data.get("error", "Stockfish API unsuccessful")}
    except Exception as e:
        print("[ERROR] Stockfish request failed:", e)
        return {"error": str(e)}


@app.route('/predict', methods=['POST'])
def predict():
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
        return jsonify({'error': 'Server error', 'detail': str(e)}), 500


# ==============================================
# LOCAL TENSORFLOW MODEL (OPTIONAL)
# ==============================================
LOCAL_MODEL_PATH = 'chess_model.keras'
local_model = None

if load_model and os.path.exists(LOCAL_MODEL_PATH):
    try:
        local_model = load_model(LOCAL_MODEL_PATH)
        print("✅ Local model loaded!")
    except Exception as e:
        print("⚠️ Local model failed:", e)
else:
    print("ℹ️ No local model found")


def fen_to_features_stub(fen: str):
    import numpy as np
    return np.zeros((1, 64), dtype='float32')


@app.route('/predict_local', methods=['POST'])
def predict_local():
    if local_model is None:
        return jsonify({'error': 'Local model not available'})

    try:
        data = request.get_json(force=True)
        fen = data.get('fen', '')

        if not fen:
            return jsonify({'error': 'FEN missing'}), 400

        x = fen_to_features_stub(fen)
        pred = local_model.predict(x, verbose=0)

        bestmove = "e2e4"
        evaluation = float(getattr(pred, "max", lambda: 0.0)())

        return jsonify({'bestmove': bestmove, 'evaluation': evaluation})

    except Exception as e:
        print("[ERROR] TF model failed:", e)
        return jsonify({'error': 'Local model error', 'detail': str(e)}), 500


# ==============================================
# ⭐ NEW: LICHESS PUZZLE STREAM API
# ==============================================
@app.route("/api/puzzle")
def get_puzzle():
    try:
        url = "https://lichess.org/api/puzzle/stream"
        r = requests.get(url, stream=True)

        for line in r.iter_lines():
            if line:
                return Response(line, mimetype="application/json")

    except Exception as e:
        return jsonify({"error": "Puzzle API failed", "detail": str(e)}), 500


# ==============================================
# ⭐ PUZZLES PAGE ROUTE
# ==============================================
@app.route("/puzzles")
def puzzles():
    return render_template("puzzles.html")


# ==============================================
# FLASK ROUTES (UI PAGES)
# ==============================================
@app.route('/')
def index():
    return render_template('index.html')


@app.route('/game')
def game():
    return render_template('game.html')


# ==============================================
# ⭐ FEEDBACK SYSTEM (NEW)
# ==============================================
feedback_list = []

@app.route('/feedback')
def feedback_page():
    return render_template('feedback.html')

@app.route('/submit_feedback', methods=['POST'])
def submit_feedback():
    entry = {
        "name": request.form.get("name"),
        "rating": request.form.get("rating"),
        "improvement": request.form.get("improvement"),
        "suggestions": request.form.get("suggestions")
    }
    feedback_list.append(entry)
    return redirect('/admin/feedback')

@app.route('/admin/feedback')
def admin_feedback():
    return render_template('admin_feedback.html', feedback=feedback_list)


# ==============================================
# START SERVER
# ==============================================
if __name__ == '__main__':
    init_db()
    init_user_db()
    app.run(debug=True, host='127.0.0.1', port=5000)
