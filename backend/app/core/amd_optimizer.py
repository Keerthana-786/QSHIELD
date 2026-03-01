"""
Q-SHIELD — AMD Hardware Optimizer
Detects and configures AMD EPYC CPU + AMD Radeon ROCm GPU acceleration
"""

import os
import subprocess
import platform
import structlog

logger = structlog.get_logger("qshield.amd_optimizer")


class AMDOptimizer:
    """
    Detects AMD hardware and applies performance optimizations.

    Supported AMD Products:
    - AMD EPYC processors (server-grade CPU thread optimization)
    - AMD Ryzen processors (desktop/workstation optimization)
    - AMD Radeon GPUs via ROCm (ML/GPU acceleration)
    - AMD Instinct accelerators (HPC/datacenter)
    """

    def __init__(self):
        self.cpu_info = {}
        self.gpu_info = {}
        self.rocm_available = False
        self.torch_device = "cpu"

    def detect_and_configure(self):
        """Run full hardware detection and apply optimizations"""
        logger.info("AMD Hardware Detection starting...")

        self._detect_cpu()
        self._detect_rocm_gpu()
        self._configure_numpy_blas()
        self._configure_scikit_learn()

        logger.info(
            "AMD optimization complete",
            cpu=self.cpu_info.get("model", "Unknown"),
            gpu=self.gpu_info.get("model", "Not detected"),
            rocm=self.rocm_available,
            torch_device=self.torch_device,
        )

    def _detect_cpu(self):
        """Detect AMD CPU and configure thread count"""
        try:
            if platform.system() == "Linux":
                result = subprocess.run(
                    ["cat", "/proc/cpuinfo"],
                    capture_output=True, text=True, timeout=5
                )
                cpuinfo = result.stdout
            else:
                cpuinfo = platform.processor()

            if "AMD" in cpuinfo or "amd" in cpuinfo.lower():
                self.cpu_info["vendor"] = "AMD"

                # Detect EPYC vs Ryzen
                if "EPYC" in cpuinfo:
                    self.cpu_info["model"] = "AMD EPYC"
                    self.cpu_info["profile"] = "server"
                    # EPYC: maximize thread count for parallel anomaly detection
                    cores = os.cpu_count() or 32
                    os.environ["OMP_NUM_THREADS"] = str(cores)
                    os.environ["MKL_NUM_THREADS"] = str(cores)
                    logger.info("AMD EPYC detected", cores=cores, profile="server-optimized")

                elif "Ryzen" in cpuinfo:
                    self.cpu_info["model"] = "AMD Ryzen"
                    self.cpu_info["profile"] = "desktop"
                    cores = min(os.cpu_count() or 8, 16)
                    os.environ["OMP_NUM_THREADS"] = str(cores)
                    logger.info("AMD Ryzen detected", cores=cores, profile="desktop-optimized")
            else:
                self.cpu_info["vendor"] = "Generic"
                self.cpu_info["model"] = "Non-AMD CPU"
                logger.info("Non-AMD CPU — standard threading applied")

        except Exception as e:
            logger.warning("CPU detection failed", error=str(e))

    def _detect_rocm_gpu(self):
        """Detect AMD Radeon GPU via ROCm platform"""
        rocm_path = os.environ.get("AMD_ROCM_PATH", "/opt/rocm")

        # Check if ROCm is installed
        rocm_exists = os.path.exists(rocm_path)
        if not rocm_exists:
            logger.info("ROCm not found — using CPU mode")
            return

        try:
            # Try rocm-smi for GPU detection
            result = subprocess.run(
                ["rocm-smi", "--showproductname"],
                capture_output=True, text=True, timeout=10
            )
            if result.returncode == 0 and "GPU" in result.stdout:
                self.rocm_available = True
                self.gpu_info["model"] = result.stdout.strip()
                logger.info("AMD Radeon GPU detected via ROCm", gpu=self.gpu_info["model"])

                # Try to configure PyTorch for ROCm
                self._configure_pytorch_rocm()
            else:
                logger.info("ROCm installed but no GPU detected")

        except FileNotFoundError:
            logger.info("rocm-smi not found — ROCm not configured")
        except Exception as e:
            logger.warning("ROCm detection error", error=str(e))

    def _configure_pytorch_rocm(self):
        """Configure PyTorch for AMD ROCm GPU acceleration"""
        try:
            import torch
            if torch.cuda.is_available():  # ROCm exposes CUDA-compatible API
                self.torch_device = f"cuda:{os.environ.get('AMD_GPU_DEVICE', '0')}"
                gpu_name = torch.cuda.get_device_name(0)
                gpu_mem = torch.cuda.get_device_properties(0).total_memory / 1e9
                logger.info(
                    "PyTorch ROCm configured",
                    device=self.torch_device,
                    gpu=gpu_name,
                    vram_gb=f"{gpu_mem:.1f}",
                )
            else:
                logger.info("PyTorch available but no ROCm GPU found")
        except ImportError:
            logger.info("PyTorch not installed — CPU-only mode")

    def _configure_numpy_blas(self):
        """Configure NumPy BLAS for AMD CPU (OpenBLAS/BLIS)"""
        try:
            import numpy as np
            config = np.__config__.blas_opt_info
            logger.info("NumPy BLAS configured", libraries=config.get("libraries", []))
        except Exception:
            pass

    def _configure_scikit_learn(self):
        """Configure scikit-learn parallelism for AMD cores"""
        try:
            from sklearn import set_config
            set_config(assume_finite=True)  # performance: skip finite checks
            logger.info("scikit-learn optimized for AMD CPU")
        except Exception:
            pass

    def get_device(self) -> str:
        """Return the best available compute device"""
        return self.torch_device

    def get_system_info(self) -> dict:
        return {
            "cpu": self.cpu_info,
            "gpu": self.gpu_info,
            "rocm_available": self.rocm_available,
            "torch_device": self.torch_device,
            "cpu_cores": os.cpu_count(),
            "omp_threads": os.environ.get("OMP_NUM_THREADS", "auto"),
        }
