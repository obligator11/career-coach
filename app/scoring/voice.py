from kokoro_onnx import Kokoro

_kokoro = None


def get_kokoro():
    global _kokoro
    if _kokoro is None:
        _kokoro = Kokoro("app/voice_models/kokoro-v1.0.onnx", "app/voice_models/voices-v1.0.bin")
    return _kokoro


def generate_speech(text: str, voice: str = "af_sky") -> bytes:
    """Generate speech audio from text, returns raw WAV bytes."""
    kokoro = get_kokoro()
    samples, sample_rate = kokoro.create(text, voice=voice, speed=1.0, lang="en-us")

    import io
    import soundfile as sf
    buffer = io.BytesIO()
    sf.write(buffer, samples, sample_rate, format="WAV")
    buffer.seek(0)
    return buffer.read()