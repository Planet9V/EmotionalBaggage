FROM python:3.13-slim
WORKDIR /srv
# The lock file pins every package, so the image and the code-use record always agree.
# Graphviz draws the harness. WireViz (GPL-3.0) is run as a separate program by harness.py, never imported.
RUN apt-get update \
    && apt-get install -y --no-install-recommends graphviz \
    && rm -rf /var/lib/apt/lists/*
COPY requirements.lock .
RUN pip install --no-cache-dir -r requirements.lock
COPY main.py routing.py impact.py harness.py ./
EXPOSE 8000
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
