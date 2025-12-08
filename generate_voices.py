from gtts import gTTS

voices = {
    "checkmate": "Checkmate! Game over.",
    "stalemate": "Stalemate! Neither side can win.",
    "illegal": "Illegal move. Try again.",
    "white_move": "White to move.",
    "black_move": "Black to move.",
    "ai_move": "AI has played its move."
}

for name, text in voices.items():
    tts = gTTS(text, lang="en", slow=False)
    filename = f"{name}.mp3"
    tts.save(filename)
    print(f"✔ Generated {filename}")
