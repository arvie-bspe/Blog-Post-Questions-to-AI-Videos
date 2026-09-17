import argparse, json, math, os, re, shutil, subprocess, sys
from pathlib import Path


def require(module, install):
    try:
        return __import__(module)
    except Exception as exc:
        raise RuntimeError(f"Missing {module}. Install the Railway LiteAvatar worker requirements: {install}") from exc


def _word_timings(text, timings, duration):
    words = text.strip().split()
    groups, current = [], []
    for timing in timings:
        if str(timing.phoneme).isspace():
            if current:
                groups.append(current)
                current = []
        else:
            current.append(timing)
    if current:
        groups.append(current)
    if len(groups) == len(words):
        return [{"text": word, "start": max(0.0, float(group[0].start)), "end": min(duration, max(float(group[-1].end), float(group[0].start) + 0.01))} for word, group in zip(words, groups)]
    start = max(0.0, float(timings[0].start)) if timings else 0.0
    end = min(duration, float(timings[-1].end)) if timings else duration
    weights = [max(1, len(re.sub(r"[^\w]", "", word))) for word in words]
    total, cursor, result, used = sum(weights) or 1, start, [], 0
    for index, (word, weight) in enumerate(zip(words, weights)):
        used += weight
        next_cursor = end if index == len(words) - 1 else start + (end - start) * used / total
        result.append({"text": word, "start": cursor, "end": max(cursor + 0.01, next_cursor)})
        cursor = next_cursor
    return result


def speech(text, voice_output, avatar_output, timing_output, voice):
    require("kokoro_onnx", "pip install -r worker/liteavatar-requirements.txt")
    require("soundfile", "pip install -r worker/liteavatar-requirements.txt")
    import soundfile as sf
    from kokoro_onnx import Kokoro
    from scipy.signal import resample_poly

    model = Path(os.environ.get("KOKORO_MODEL", ""))
    voices = Path(os.environ.get("KOKORO_VOICES", ""))
    if not model.is_file() or not voices.is_file():
        raise RuntimeError("Set KOKORO_MODEL and KOKORO_VOICES to the bundled Kokoro ONNX files.")
    engine = Kokoro(str(model), str(voices))
    samples, sample_rate, timings = engine.create_timed(text, voice=voice, speed=float(os.environ.get("KOKORO_SPEED", "1.0")), lang="en-us")
    if not len(samples):
        raise RuntimeError("Kokoro returned no audio.")
    sf.write(voice_output, samples, sample_rate, subtype="PCM_16")
    # LiteAvatar's original CPU feature extractor treats headerless input as
    # 16 kHz. Feed it an explicit 16 kHz copy while retaining the native
    # Kokoro WAV for final assembly.
    divisor = math.gcd(int(sample_rate), 16000)
    avatar_samples = resample_poly(samples, 16000 // divisor, int(sample_rate) // divisor)
    sf.write(avatar_output, avatar_samples, 16000, subtype="PCM_16")
    duration = len(samples) / sample_rate
    timing_output.write_text(json.dumps({"sourceText": text, "engine": "kokoro-onnx-duration", "words": _word_timings(text, timings, duration)}), encoding="utf-8")


def profile_path(key):
    if not re.fullmatch(r"[a-z0-9][a-z0-9-]{1,63}", str(key or "")):
        raise RuntimeError("The LiteAvatar profile key is invalid.")
    root = Path(os.environ.get("LITEAVATAR_PROFILES_DIR", "")).resolve()
    profile = (root / key).resolve()
    if root not in profile.parents:
        raise RuntimeError("The LiteAvatar profile path is outside the configured profile directory.")
    if (profile / "preload").is_dir():
        profile = profile / "preload"
    required = ["bg_video.mp4", "face_box.txt", "neutral_pose.npy", "net_encode.pt", "net_decode.pt", "ref_frames"]
    missing = [name for name in required if not (profile / name).exists()]
    if missing:
        raise RuntimeError("LiteAvatar profile is incomplete: " + ", ".join(missing))
    return profile


def animate(profile, audio, output_dir, final):
    lite = Path(os.environ.get("LITEAVATAR_DIR", "")).resolve()
    script = lite / "lite_avatar.py"
    if not script.is_file():
        raise RuntimeError("Set LITEAVATAR_DIR to the pinned LiteAvatar source directory.")
    required_weights = [lite / "weights" / "model_1.onnx", lite / "weights" / "speech_paraformer-large_asr_nat-zh-cn-16k-common-vocab8404-pytorch" / "model.pb"]
    if not all(path.is_file() for path in required_weights):
        raise RuntimeError("The LiteAvatar CPU model weights are incomplete.")
    result = output_dir / "liteavatar-result"
    result.mkdir(parents=True, exist_ok=True)
    child_env = os.environ.copy()
    child_env.setdefault("OMP_NUM_THREADS", "2")
    child_env.setdefault("MKL_NUM_THREADS", "2")
    child_env.setdefault("ORT_NUM_THREADS", "2")
    subprocess.run([sys.executable, str(script), "--data_dir", str(profile), "--audio_file", str(audio), "--result_dir", str(result)], cwd=lite, env=child_env, check=True)
    rendered = result / "test_demo.mp4"
    if not rendered.is_file():
        raise RuntimeError("LiteAvatar did not create test_demo.mp4.")
    shutil.copy2(rendered, final)


def render(task_file, output_dir):
    task = json.loads(task_file.read_text(encoding="utf-8"))
    output_dir.mkdir(parents=True, exist_ok=True)
    voice, avatar_audio = output_dir / "voice.wav", output_dir / "avatar-input.wav"
    video, timing = output_dir / "presenter.mp4", output_dir / "alignment.json"
    profile = profile_path(task.get("profileKey"))
    speech(task["script"], voice, avatar_audio, timing, task["voice"]["id"])
    animate(profile, avatar_audio, output_dir, video)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("action", choices=["render"])
    parser.add_argument("--task", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    try:
        render(args.task, args.output)
    except Exception as exc:
        print(str(exc), file=sys.stderr)
        raise SystemExit(1)


if __name__ == "__main__":
    main()
