from pathlib import Path

from huggingface_hub import snapshot_download

MODEL_ROOT = Path("voice_engine/models").resolve()
MMS_DIR = MODEL_ROOT / "mms-khm"
OPENVOICE_DIR = MODEL_ROOT / "openvoice"

MMS_DIR.mkdir(parents=True, exist_ok=True)
OPENVOICE_DIR.mkdir(parents=True, exist_ok=True)

snapshot_download(
    repo_id="facebook/mms-tts-khm",
    local_dir=MMS_DIR,
    allow_patterns=[
        "config.json",
        "model.safetensors",
        "special_tokens_map.json",
        "tokenizer_config.json",
        "vocab.json",
    ],
)

snapshot_download(
    repo_id="myshell-ai/OpenVoice",
    local_dir=OPENVOICE_DIR,
    allow_patterns=[
        "checkpoints/converter/config.json",
        "checkpoints/converter/checkpoint.pth",
    ],
)
