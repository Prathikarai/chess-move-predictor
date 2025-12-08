from gtts import gTTS

try:
    tts = gTTS("Check!", lang="en", slow=False)
    tts.save("check.mp3")
    print("✔ check.mp3 created successfully!")
except Exception as e:
    print("Error generating audio:", e)
