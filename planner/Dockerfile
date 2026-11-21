FROM python:3.13-slim
WORKDIR /srv
# The lock file pins every package, so the image and the code-use record always agree.
# OpenSCAD runs YAPP_Box (POST /enclosure/yapp). It is a separate process, never linked into the planner.
RUN apt-get update && apt-get install -y --no-install-recommends openscad && rm -rf /var/lib/apt/lists/*
COPY requirements.lock .
RUN pip install --no-cache-dir -r requirements.lock
COPY main.py routing.py enclosure.py ./
COPY vendor ./vendor
EXPOSE 8000
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
