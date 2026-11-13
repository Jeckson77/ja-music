FROM python:3.12-slim
WORKDIR /app
COPY server.py /app/server.py
EXPOSE 10000
CMD ["python","server.py"]
