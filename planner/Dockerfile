FROM python:3.13-slim
WORKDIR /srv
# The lock file pins every package, so the image and the code-use record always agree.
COPY requirements.lock .
RUN pip install --no-cache-dir -r requirements.lock
COPY main.py routing.py ./
EXPOSE 8000
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
