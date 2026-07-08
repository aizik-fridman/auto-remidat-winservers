# ==========================================
# Stage 1: Build the Frontend React/Vite SPA
# ==========================================
FROM node:20-alpine AS frontend-builder

WORKDIR /app/frontend

# Copy dependency files first for caching
COPY frontend/package.json frontend/package-lock.json ./

# Install dependencies
RUN npm ci

# Copy the rest of the frontend source code
COPY frontend/ ./

# Build the SPA (generates /app/frontend/dist)
RUN npm run build

# ==========================================
# Stage 2: Create the Python Runtime Image
# ==========================================
FROM python:3.11-slim AS runtime

# Set environment variables
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PORT=8000 \
    PROMETHEUS_YML_PATH=/app/prometheus.yml

WORKDIR /app

# Install security updates and dependencies if any are needed (e.g. clean setup)
RUN apt-get update && apt-get install -y --no-install-recommends \
    # Add any runtime package dependencies here if needed (e.g. libssl for NTML or build tools if compiling)
    && rm -rf /var/lib/apt/lists/*

# Create a non-privileged user to run the app
RUN groupadd -g 10001 appuser && \
    useradd -u 10001 -g appuser -m -s /sbin/nologin appuser

# Copy dependency files first for caching
COPY backend/requirements.txt ./backend/requirements.txt

# Install backend dependencies
RUN pip install --no-cache-dir -r backend/requirements.txt

# Copy built frontend assets from builder stage
COPY --from=frontend-builder --chown=appuser:appuser /app/frontend/dist ./frontend/dist

# Copy backend source code
COPY --chown=appuser:appuser backend/ ./backend/

# Copy default prometheus.yml configuration from host
COPY --chown=appuser:appuser prometheus.yml ./prometheus.yml

# Switch to the non-root user
USER appuser

# Expose the application port
EXPOSE 8000

# Health check using python's built-in urllib (does not require curl/wget)
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/api/health')" || exit 1

# Run the FastAPI server using Uvicorn
# We run from /app/backend to match the paths expected by main.py
WORKDIR /app/backend
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
