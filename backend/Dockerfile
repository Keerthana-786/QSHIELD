# ─────────────────────────────────────────────────────────────
# Q-SHIELD Backend — AMD ROCm / CPU Optimized
# Supports: AMD EPYC (CPU), AMD Radeon (ROCm GPU)
# ─────────────────────────────────────────────────────────────

# Stage 1: Base — choose rocm for AMD GPU hosts, else standard
ARG BASE_IMAGE=python:3.11-slim
FROM ${BASE_IMAGE} AS base

# AMD ROCm alternative base (uncomment for GPU hosts):
# FROM rocm/pytorch:rocm5.7_ubuntu22.04_py3.10_pytorch_2.0.1 AS base

LABEL maintainer="Q-SHIELD Security Platform"
LABEL description="Quantum-Inspired Phishing Detection Backend"
LABEL amd.optimized="true"

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV PYTHONPATH=/app

# AMD EPYC CPU thread optimization
ENV OMP_NUM_THREADS=32
ENV MKL_NUM_THREADS=32
ENV OPENBLAS_NUM_THREADS=32

# AMD ROCm settings (activated when GPU available)
ENV AMD_ROCM_PATH=/opt/rocm
ENV HSA_OVERRIDE_GFX_VERSION=10.3.0

WORKDIR /app

RUN apt-get update && apt-get install -y \
    gcc g++ make \
    libpq-dev \
    curl wget \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# Download NLTK data for email NLP
RUN python -c "import nltk; nltk.download('punkt'); nltk.download('stopwords'); nltk.download('averaged_perceptron_tagger')"

COPY . .

# Stage 2: Production
FROM base AS production

RUN addgroup --system qshield && adduser --system --group qshield
USER qshield

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "4", "--loop", "uvloop"]
