FROM python:3.10-slim

# (Optional) Some Debian/Ubuntu libraries that OpenCV might need at runtime:
RUN apt-get update && apt-get install -y libgl1 libglib2.0-0

WORKDIR /app

COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY backend/ .

EXPOSE 8000
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
