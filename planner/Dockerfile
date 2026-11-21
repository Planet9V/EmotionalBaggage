FROM python:3.13-slim
WORKDIR /srv
# The lock file pins every package, so the image and the code-use record always agree.
# Graphviz draws the harness. WireViz (GPL-3.0) is run as a separate program by harness.py, never imported.
# OpenSCAD runs YAPP_Box (POST /enclosure/yapp). It is a separate process, never linked into the planner.
RUN apt-get update \
    && apt-get install -y --no-install-recommends graphviz openscad \
    && rm -rf /var/lib/apt/lists/*
COPY requirements.lock .
RUN pip install --no-cache-dir -r requirements.lock
COPY main.py routing.py impact.py harness.py enclosure.py ./
COPY vendor ./vendor
EXPOSE 8000
# HOST and PORT can be set by the host platform. A platform whose private network is IPv6 (Railway) needs HOST=::
ENV HOST=0.0.0.0 PORT=8000
CMD ["sh", "-c", "exec uvicorn main:app --host \"$HOST\" --port \"$PORT\""]
