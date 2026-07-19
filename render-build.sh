#!/usr/bin/env bash
set -euo pipefail

npm install

python3 -m venv .voice-venv
source .voice-venv/bin/activate

python -m pip install --upgrade pip setuptools wheel
python -m pip install \
  torch==2.1.2 \
  --index-url https://download.pytorch.org/whl/cpu
python -m pip install -r voice_engine/requirements.txt
python -m pip install \
  --no-deps \
  git+https://github.com/myshell-ai/OpenVoice.git@74a1d147b17a8c3092dd5430504bd83ef6c7eb23

HF_HUB_DISABLE_XET=1 python voice_engine/download_models.py
