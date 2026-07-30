# =============================================================================
# Yap-to-Tale — Production Dockerfile
# =============================================================================
# Uses python:3.12-slim for a minimal, secure base image (~45MB vs ~350MB full).
# Runs gunicorn as the production WSGI server instead of Flask's dev server.
# =============================================================================

# ---------------------------------------------------------------------------
# Stage: Production Image
# ---------------------------------------------------------------------------
FROM python:3.12-slim

# ---- Security Best Practice ------------------------------------------------
# Create a non-root user to run the application. Running containers as root
# is a security anti-pattern and is flagged by most container scanners.
RUN groupadd --system appgroup && \
    useradd --system --gid appgroup --create-home appuser

# ---- System Dependencies ---------------------------------------------------
# Install only the minimal OS packages needed (none currently), and clean up
# the apt cache to keep the image lean.
RUN apt-get update && \
    apt-get install -y --no-install-recommends && \
    rm -rf /var/lib/apt/lists/*

# ---- Working Directory ------------------------------------------------------
WORKDIR /app

# ---- Python Dependencies ----------------------------------------------------
# Copy requirements first to leverage Docker's layer caching. If requirements
# haven't changed, Docker will reuse this layer and skip pip install.
COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# ---- Application Code -------------------------------------------------------
# Copy the entire application source into the container.
COPY app/ .

# ---- Switch to Non-Root User ------------------------------------------------
USER appuser

# ---- Port Exposure -----------------------------------------------------------
# Expose port 5000 for the gunicorn WSGI server. This is metadata only;
# actual port mapping is handled at runtime (docker run -p / K8s service).
EXPOSE 5000

# ---- Health Check ------------------------------------------------------------
# Optional: Docker-level health check to verify the container is responsive.
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:5000/health')" || exit 1

# ---- Entrypoint --------------------------------------------------------------
# Launch gunicorn with:
#   - 4 worker processes (2*CPU + 1 is a common heuristic)
#   - Binding to 0.0.0.0:5000 so it's accessible from outside the container
#   - 120-second timeout for long-running Bedrock/Polly calls
CMD ["gunicorn", \
     "--workers", "4", \
     "--bind", "0.0.0.0:5000", \
     "--timeout", "120", \
     "--access-logfile", "-", \
     "--error-logfile", "-", \
     "app:app"]
