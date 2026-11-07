# Owned by Person A. Lives at repo root because Tinfoil requires it.
FROM python:3.12-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
ENV PYTHONUNBUFFERED=1 TELEMETRY_DISABLED=1
EXPOSE 8080
CMD ["uvicorn", "a_platform.main:app", "--host", "0.0.0.0", "--port", "8080"]
