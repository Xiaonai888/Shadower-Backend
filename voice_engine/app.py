from __future__ import annotations

import asyncio
import io
import os
import subprocess
import tempfile
import threading
from pathlib import Path

import soundfile as sf
import torch
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.responses import Response
from openvoice.api import ToneColorConverter
from transformers import AutoTokenizer, VitsModel

MODEL_ROOT = Path(os.getenv("VOICE_MODEL_ROOT", "voice_engine/models")).resolve()
MMS_MODEL_DIR = MODEL_ROOT / "mms-khm"
OPENVOICE_DIR = MODEL_ROOT / "openvoice" / "checkpoints" / "converter"
MAX_AUDIO_BYTES = 25 * 1024 * 1024
MAX_TEXT_LENGTH = 250

app = FastAPI(title="Shadower Khmer Voice Engine", version="1.0.0")

_model_lock = threading.Lock()
_generation_lock = asyncio.Lock()
_tokenizer: AutoTokenizer | None = None
_tts_model: VitsModel | None = None
_converter: ToneColorConverter | None = None


def get_device() -> str:
    return "cuda" if torch.cuda.is_available() else "cpu"


def load_models() -> tuple[AutoTokenizer, VitsModel, ToneColorConverter]:
    global _tokenizer, _tts_model, _converter

    if _tokenizer is not None and _tts_model is not None and _converter is not None:
        return _tokenizer, _tts_model, _converter

    with _model_lock:
        if _tokenizer is None:
            _tokenizer = AutoTokenizer.from_pretrained(
                MMS_MODEL_DIR,
                local_files_only=True,
            )

        if _tts_model is None:
            _tts_model = VitsModel.from_pretrained(
                MMS_MODEL_DIR,
                local_files_only=True,
            ).to(get_device())
            _tts_model.eval()

        if _converter is None:
            _converter = ToneColorConverter(
                str(OPENVOICE_DIR / "config.json"),
                device=get_device(),
                enable_watermark=False,
            )
            _converter.load_ckpt(str(OPENVOICE_DIR / "checkpoint.pth"))

    return _tokenizer, _tts_model, _converter


def convert_reference_audio(source_path: Path, output_path: Path) -> None:
    result = subprocess.run(
        [
            "ffmpeg",
            "-hide_banner",
            "-loglevel",
            "error",
            "-y",
            "-i",
            str(source_path),
            "-ac",
            "1",
            "-ar",
            "22050",
            "-af",
            (
                "highpass=f=70,"
                "lowpass=f=10000,"
                "silenceremove=start_periods=1:"
                "start_duration=0.05:start_threshold=-50dB"
            ),
            str(output_path),
        ],
        capture_output=True,
        text=True,
        timeout=120,
        check=False,
    )

    if result.returncode != 0 or not output_path.exists():
        raise RuntimeError(
            result.stderr.strip() or "Unable to prepare the reference audio."
        )


def create_base_khmer_audio(
    text: str,
    output_path: Path,
    tokenizer: AutoTokenizer,
    model: VitsModel,
) -> None:
    inputs = tokenizer(text, return_tensors="pt")
    inputs = {name: value.to(get_device()) for name, value in inputs.items()}

    with torch.inference_mode():
        waveform = model(**inputs).waveform

    audio = waveform.squeeze().detach().float().cpu().numpy()
    peak = float(abs(audio).max()) if audio.size else 0.0

    if peak > 1.0:
        audio = audio / peak

    sf.write(
        output_path,
        audio,
        model.config.sampling_rate,
        format="WAV",
        subtype="PCM_16",
    )


def clone_voice(
    base_audio_path: Path,
    reference_audio_path: Path,
    output_path: Path,
    converter: ToneColorConverter,
) -> None:
    source_embedding = converter.extract_se(str(base_audio_path))
    target_embedding = converter.extract_se(str(reference_audio_path))

    converter.convert(
        audio_src_path=str(base_audio_path),
        src_se=source_embedding,
        tgt_se=target_embedding,
        output_path=str(output_path),
        tau=0.3,
        message="Shadower",
    )


def run_generation(text: str, raw_reference_path: Path) -> bytes:
    tokenizer, tts_model, converter = load_models()

    with tempfile.TemporaryDirectory(prefix="shadower-khmer-") as temp_dir:
        work_dir = Path(temp_dir)
        reference_path = work_dir / "reference-22050.wav"
        base_path = work_dir / "khmer-base.wav"
        output_path = work_dir / "khmer-clone.wav"

        convert_reference_audio(raw_reference_path, reference_path)
        create_base_khmer_audio(text, base_path, tokenizer, tts_model)
        clone_voice(base_path, reference_path, output_path, converter)

        if not output_path.exists() or output_path.stat().st_size == 0:
            raise RuntimeError("The voice engine created an empty audio file.")

        return output_path.read_bytes()


@app.get("/health")
def health() -> dict[str, object]:
    return {
        "ok": True,
        "device": get_device(),
        "modelsLoaded": all(
            model is not None for model in (_tokenizer, _tts_model, _converter)
        ),
    }


@app.post("/generate")
async def generate(
    text: str = Form(...),
    reference_audio: UploadFile = File(...),
) -> Response:
    clean_text = text.strip()
    suffix = Path(reference_audio.filename or "reference.ogg").suffix or ".ogg"

    if not clean_text:
        raise HTTPException(status_code=400, detail="Khmer text is required.")

    if len(clean_text) > MAX_TEXT_LENGTH:
        raise HTTPException(
            status_code=400,
            detail=f"Use no more than {MAX_TEXT_LENGTH} characters for this test.",
        )

    reference_bytes = await reference_audio.read(MAX_AUDIO_BYTES + 1)

    if not reference_bytes:
        raise HTTPException(status_code=400, detail="Reference audio is empty.")

    if len(reference_bytes) > MAX_AUDIO_BYTES:
        raise HTTPException(
            status_code=400,
            detail="Reference audio cannot exceed 25 MB.",
        )

    async with _generation_lock:
        try:
            with tempfile.TemporaryDirectory(prefix="shadower-input-") as temp_dir:
                reference_path = Path(temp_dir) / f"reference{suffix}"
                reference_path.write_bytes(reference_bytes)
                audio_bytes = await asyncio.to_thread(
                    run_generation,
                    clean_text,
                    reference_path,
                )

            return Response(
                content=audio_bytes,
                media_type="audio/wav",
                headers={"Cache-Control": "no-store"},
            )
        except subprocess.TimeoutExpired as error:
            raise HTTPException(
                status_code=504,
                detail="Reference audio preparation took too long.",
            ) from error
        except Exception as error:
            print(f"Khmer engine error: {error}", flush=True)
            raise HTTPException(
                status_code=500,
                detail=f"Khmer generation failed: {error}",
            ) from error
