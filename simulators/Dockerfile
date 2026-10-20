# =============================================================================
# MCG Demo Simulators — Docker Image
# =============================================================================
# Multi-purpose image containing all 3 data simulators plus the seeder:
#   - postgres_simulator.py   : WMS CDC event generation
#   - kafka_iot_simulator.py  : IoT cold-chain sensor data
#   - mysql_crm_simulator.py  : Meridian CRM inserts, updates and deletes
#   - seed_data.py            : one-shot initial load for both databases
#
# Usage:
#   podman build -t mcg-simulators .
#   podman run mcg-simulators python postgres_simulator.py --help
#   podman run mcg-simulators python kafka_iot_simulator.py --help
# =============================================================================

FROM python:3.12-slim

LABEL maintainer="MCG Demo Team"
LABEL description="Meridian Commerce Group data simulators for Qlik Cloud demo"

WORKDIR /app

# Python buffers stdout when it isn't a TTY, so the simulators' progress output
# sits in the buffer indefinitely and `logs` shows nothing for a container that
# is in fact working. Unbuffer it so container logs are usable for diagnosis.
ENV PYTHONUNBUFFERED=1

# Install system dependencies for psycopg2
RUN apt-get update && \
    apt-get install -y --no-install-recommends libpq-dev gcc && \
    rm -rf /var/lib/apt/lists/*

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy all simulator scripts, the shared reference data module, and the CRM
# schema the seeder applies.
COPY *.py .
COPY *.sql .

# Default: show help
CMD ["python", "--version"]
