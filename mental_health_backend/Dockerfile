# Public API container (e.g. Render, Fly, Railway). Build context: this directory.
FROM python:3.11-slim-bookworm

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PORT=8000

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Bake NLTK data into the image so chatbot first use does not download corpora at runtime.
RUN python -c "\
import nltk; \
for p in ('punkt', 'stopwords', 'wordnet', 'omw-1.4'): \
    nltk.download(p, quiet=True); \
try: \
    nltk.download('punkt_tab', quiet=True); \
except Exception: \
    pass"

COPY . .

RUN chmod +x docker-entrypoint.sh

EXPOSE 8000

# Render sets PORT; local Docker defaults to 8000
ENTRYPOINT ["./docker-entrypoint.sh"]
