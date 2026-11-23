# Deploy ke Railway: tanpa dependency, hanya Python standar
FROM python:3.12-slim
ENV PYTHONUNBUFFERED=1 BK_NO_BROWSER=1 BK_TUNNEL=0
WORKDIR /app
COPY . .
CMD ["python", "-u", "baso_kuliner.py"]
