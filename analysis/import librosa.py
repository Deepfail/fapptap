import librosa

y, sr = librosa.load("..\\media_samples\\song.mp3")
tempo, beats = librosa.beat.beat_track(y=y, sr=sr)
print(f"Tempo: {tempo}")
print("Beat frames:", beats[:10])
