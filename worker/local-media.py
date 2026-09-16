import argparse, json, os, re, shutil, subprocess, sys, wave
from pathlib import Path

def require(module, install):
    try: return __import__(module)
    except Exception as exc: raise RuntimeError(f"Missing {module}. Install the local worker requirements: {install}") from exc

def wav_duration(path):
    with wave.open(str(path), "rb") as audio: return audio.getnframes() / audio.getframerate()

def _word_timings(text, timings, duration):
    words=text.strip().split()
    groups=[]; current=[]
    for timing in timings:
        if str(timing.phoneme).isspace():
            if current: groups.append(current); current=[]
        else: current.append(timing)
    if current: groups.append(current)
    if len(groups)==len(words):
        return [{"text":word,"start":max(0.0,float(group[0].start)),"end":min(duration,max(float(group[-1].end),float(group[0].start)+0.01))} for word,group in zip(words,groups)]
    # Numbers, acronyms, and punctuation can cause eSpeak to add token boundaries.
    # Keep exact approved words while distributing them over the measured speech
    # interval. This fallback is deterministic and never exceeds the WAV duration.
    start=max(0.0,float(timings[0].start)) if timings else 0.0
    end=min(duration,float(timings[-1].end)) if timings else duration
    weights=[max(1,len(re.sub(r"[^\w]","",word))) for word in words]
    total=sum(weights) or 1; cursor=start; result=[]
    for index,(word,weight) in enumerate(zip(words,weights)):
        next_cursor=end if index==len(words)-1 else start+(end-start)*sum(weights[:index+1])/total
        result.append({"text":word,"start":cursor,"end":max(cursor+0.01,next_cursor)})
        cursor=next_cursor
    return result

def speech(text, output, timing_output, voice):
    require("kokoro_onnx", "pip install -r worker/media-requirements.txt")
    import soundfile as sf
    from kokoro_onnx import Kokoro
    model=Path(os.environ.get("KOKORO_MODEL",Path(__file__).resolve().parents[1] / "work" / "local-media" / "models" / "kokoro-v1.0.onnx"))
    voices=Path(os.environ.get("KOKORO_VOICES",model.with_name("voices-v1.0.bin")))
    if not model.is_file() or not voices.is_file(): raise RuntimeError("Set KOKORO_MODEL and KOKORO_VOICES to the downloaded Kokoro ONNX model files.")
    engine=Kokoro(str(model),str(voices)); samples,sample_rate,timings=engine.create_timed(text,voice=voice,speed=float(os.environ.get("KOKORO_SPEED","1.0")),lang="en-us")
    if not len(samples): raise RuntimeError("Kokoro returned no audio.")
    sf.write(output,samples,sample_rate,subtype="PCM_16")
    duration=len(samples)/sample_rate
    timing_output.write_text(json.dumps({"sourceText":text,"engine":"kokoro-onnx-duration","words":_word_timings(text,timings,duration)}),encoding="utf-8")

def animate(image, audio, output_dir, final):
    sad=Path(os.environ.get("SADTALKER_DIR", ""))
    inference=sad / "inference.py"
    if not inference.is_file(): raise RuntimeError("Set SADTALKER_DIR to a complete local SadTalker checkout with downloaded checkpoints.")
    results=output_dir / "sadtalker-results"; results.mkdir(parents=True, exist_ok=True)
    python=os.environ.get("SADTALKER_PYTHON",sys.executable)
    command=[python,str(inference),"--driven_audio",str(audio),"--source_image",str(image),"--result_dir",str(results),"--still","--preprocess","full","--size","256"]
    if os.environ.get("LOCAL_MEDIA_DEVICE", "cpu").lower()=="cpu": command.append("--cpu")
    subprocess.run(command,cwd=sad,check=True)
    videos=sorted(results.rglob("*.mp4"),key=lambda p:p.stat().st_mtime,reverse=True)
    if not videos: raise RuntimeError("SadTalker returned no MP4 file.")
    shutil.copy2(videos[0],final)

def render(task_file, output_dir):
    task=json.loads(task_file.read_text(encoding="utf-8")); output_dir.mkdir(parents=True,exist_ok=True)
    repo=Path(__file__).resolve().parents[1]; presenter=(repo / task["presenterAsset"]).resolve()
    if repo not in presenter.parents or not presenter.is_file(): raise RuntimeError("The approved presenter image is unavailable.")
    audio=output_dir / "voice.wav"; video=output_dir / "presenter.mp4"; timing=output_dir / "alignment.json"
    speech(task["script"],audio,timing,task["voice"]["id"]); animate(presenter,audio,output_dir,video)

def main():
    parser=argparse.ArgumentParser(); parser.add_argument("action",choices=["render"]); parser.add_argument("--task",type=Path,required=True); parser.add_argument("--output",type=Path,required=True); args=parser.parse_args()
    try: render(args.task,args.output)
    except Exception as exc: print(str(exc),file=sys.stderr); raise SystemExit(1)

if __name__=="__main__": main()
