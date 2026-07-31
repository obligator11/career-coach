import os
from dotenv import load_dotenv
import psycopg2
import redis

load_dotenv()

# Test Postgres
conn = psycopg2.connect(os.environ["DATABASE_URL"])
print("Postgres OK:", conn.status == 1)
conn.close()

# Test Redis
r = redis.from_url(os.environ["REDIS_URL"])
print("Redis OK:", r.ping())