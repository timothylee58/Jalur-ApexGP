# Ambient audio for the landing page

Place a looping track here as:

```
ambient.mp3
```

Served at `/audio/ambient.mp3`. The mute toggle only appears when this file
exists (HEAD request succeeds). Prefer ~1–3 MB, royalty-free / original only.
OGG or WebM also work if you change `AUDIO_SRC` in `AmbientAudio.tsx`.
