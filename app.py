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
except Exception as e:
    print("⚠️ TensorFlow not available:", e)
    tf = None
    load_model = None


# ==============================================
# FLASK SETUP
# ==============================================
app = Flask(__name__)
app.config['SEND_FILE_MAX_AGE_DEFAULT'] = 0


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
# DATABASE INITIALIZATION
# ==============================================
def init_db():
    conn = sqlite3.connect("chess_games.db")
    c = conn.cursor()

    # USERS
    c.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            email TEXT NOT NULL UNIQUE,
            password TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)

    # GAMES
    c.execute("""
        CREATE TABLE IF NOT EXISTS games (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            started_at TEXT,
            ended_at TEXT,
            FOREIGN KEY (user_id) REFERENCES users(id)
        )
    """)

    # MOVES
    c.execute("""
        CREATE TABLE IF NOT EXISTS moves (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            game_id INTEGER NOT NULL,
            move_no INTEGER,
            move TEXT,
            ts TEXT,
            FOREIGN KEY (game_id) REFERENCES games(id)
        )
    """)

    # ✅ FEEDBACK TABLE (NEW)
    c.execute("""
        CREATE TABLE IF NOT EXISTS feedback (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT,
            rating TEXT NOT NULL,
            improvement TEXT NOT NULL,
            suggestions TEXT,
            submitted_at TEXT
        )
    """)

    conn.commit()
    conn.close()


def get_db_connection():
    conn = sqlite3.connect("chess_games.db")
    conn.row_factory = sqlite3.Row
    return conn


# ==============================================
# MOVE LOGGER
# ==============================================
def log_move_db(move):
    try:
        conn = get_db_connection()
        conn.execute(
            "INSERT INTO moves (game_id, move_no, move, ts) VALUES (?, ?, ?, ?)",
            (0, 0, move, datetime.now().isoformat(timespec='seconds'))
        )
        conn.commit()
        conn.close()
    except Exception as e:
        print("⚠️ Move log failed:", e)


@app.route('/log_move', methods=['POST'])
def log_move_route():
    data = request.get_json(force=True)
    move = data.get("move")
    if not move:
        return jsonify({"error": "Empty move"}), 400

    log_move_db(move)
    return jsonify({"ok": True})


# ==============================================
# USER AUTH
# ==============================================
@app.route("/register", methods=["POST"])
def register_user():
    data = request.json
    if not all(k in data for k in ("name", "email", "password")):
        return jsonify({"success": False}), 400

    conn = get_db_connection()
    c = conn.cursor()

    c.execute("SELECT id FROM users WHERE email = ?", (data["email"],))
    if c.fetchone():
        conn.close()
        return jsonify({"success": False, "message": "Email exists"}), 409

    c.execute(
        "INSERT INTO users (name, email, password) VALUES (?, ?, ?)",
        (data["name"], data["email"], generate_password_hash(data["password"]))
    )
    conn.commit()
    conn.close()
    return jsonify({"success": True})


@app.route("/login_user", methods=["POST"])
def login_user():
    data = request.json
    conn = get_db_connection()
    c = conn.cursor()

    c.execute("SELECT id, name, password FROM users WHERE email = ?", (data["email"],))
    user = c.fetchone()
    conn.close()

    if not user or not check_password_hash(user["password"], data["password"]):
        return jsonify({"success": False}), 401

    return jsonify({"success": True, "name": user["name"], "user_id": user["id"]})


# ==============================================
# STOCKFISH API
# ==============================================
@app.route("/predict", methods=["POST"])
def predict():
    data = request.get_json(force=True)
    fen = data.get("fen")
    if not fen:
        return jsonify({"error": "FEN missing"}), 400

    try:
        r = requests.post("https://chess-api.com/v1", json={"fen": fen}, timeout=10)
        return jsonify(r.json())
    except Exception as e:
        return jsonify({"error": str(e)})


# ==============================================
# UI ROUTES
# ==============================================
@app.route("/")
def index():
    return render_template("index.html")


@app.route("/game")
def game():
    return render_template("game.html")


@app.route("/puzzles")
def puzzles():
    return render_template("puzzles.html")


# ==============================================
# FEEDBACK SYSTEM (✅ FIXED)
# ==============================================
@app.route("/feedback")
def feedback_page():
    return render_template("feedback.html")


@app.route("/submit_feedback", methods=["POST"])
def submit_feedback():
    conn = get_db_connection()
    conn.execute("""
        INSERT INTO feedback (name, rating, improvement, suggestions, submitted_at)
        VALUES (?, ?, ?, ?, ?)
    """, (
        request.form.get("name"),
        request.form.get("rating"),
        request.form.get("improvement"),
        request.form.get("suggestions"),
        datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    ))
    conn.commit()
    conn.close()
    return redirect("/admin/feedback")


@app.route("/admin/feedback")
def admin_feedback():
    conn = get_db_connection()
    feedback = conn.execute(
        "SELECT * FROM feedback ORDER BY submitted_at DESC"
    ).fetchall()
    conn.close()
    return render_template("admin_feedback.html", feedback=feedback)


# ==============================================
# START SERVER
# ==============================================
if __name__ == "__main__":
    init_db()
    app.run(debug=True, host="127.0.0.1", port=5000)
