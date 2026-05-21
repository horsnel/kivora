FROM cloudflare/sandbox-base:latest

# Install common packages for Kivora users
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    python3-pip \
    python3-venv \
    nodejs \
    npm \
    curl \
    wget \
    git \
    && rm -rf /var/lib/apt/lists/*

# Install Python packages
RUN pip3 install --no-cache-dir --break-system-packages \
    numpy \
    scipy \
    sympy \
    pandas \
    matplotlib \
    requests \
    beautifulsoup4 \
    Pillow

# Set working directory
WORKDIR /workspace
