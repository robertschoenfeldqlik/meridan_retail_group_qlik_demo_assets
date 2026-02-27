# =============================================================================
# MCG Demo Simulators — Docker Image
# =============================================================================
# Multi-purpose image containing all 3 data simulators:
#   - postgres_simulator.py  : WMS CDC event generation
#   - kafka_iot_simulator.py : IoT cold-chain sensor data
#   - salesforce_simulator.py: CRM/order data generation
#
# Usage:
#   docker build -t mcg-simulators .
#   docker run mcg-simulators python postgres_simulator.py --help
#   docker run mcg-simulators python kafka_iot_simulator.py --help
# =============================================================================

FROM python:3.12-slim

LABEL maintainer="MCG Demo Team"
LABEL description="Meridian Commerce Group data simulators for Qlik Cloud demo"

WORKDIR /app

# Install system dependencies for psycopg2
RUN apt-get update && \
    apt-get install -y --no-install-recommends libpq-dev gcc && \
    rm -rf /var/lib/apt/lists/*

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy all simulator scripts
COPY *.py .

# Default: show help
CMD ["python", "--version"]
