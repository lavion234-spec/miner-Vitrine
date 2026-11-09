import os
from datetime import datetime, timedelta, timezone

from dotenv import load_dotenv
from jose import JWTError, jwt
from pwdlib import PasswordHash

load_dotenv()
password_hash = PasswordHash.recommended()
SECRET_KEY = os.getenv("SECRET_KEY")
if os.getenv("APP_ENV", "development").lower() == "production" and not SECRET_KEY:
    raise RuntimeError("SECRET_KEY precisa ser configurada em producao")
SECRET_KEY = SECRET_KEY or "development-only-change-this-secret-before-deploying"
ALGORITHM = "HS256"


def hash_password(password: str) -> str:
    return password_hash.hash(password)


def verify_password(password: str, hashed: str) -> bool:
    return password_hash.verify(password, hashed)


def create_access_token(subject: str) -> str:
    expires = datetime.now(timezone.utc) + timedelta(hours=12)
    return jwt.encode({"sub": subject, "exp": expires}, SECRET_KEY, algorithm=ALGORITHM)


def read_access_token(token: str) -> str | None:
    try:
        return jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM]).get("sub")
    except JWTError:
        return None