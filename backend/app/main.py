import os
from datetime import datetime, timezone
from urllib.parse import urlparse
from uuid import uuid4

from fastapi import Depends, FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel, Field, field_validator, model_validator
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from .database import get_db
from .models import AdminUser, MiningRun, PriceHistory, Product
from .security import create_access_token, hash_password, read_access_token, verify_password
from .services.miner import run_demo_mining

app = FastAPI(title="Shopee Affiliate Miner API", version="0.1.0")
frontend_origins = os.getenv("FRONTEND_ORIGINS", os.getenv("FRONTEND_ORIGIN", "http://localhost:5173,http://localhost:5174"))
app.add_middleware(CORSMiddleware, allow_origins=[origin.strip() for origin in frontend_origins.split(",") if origin.strip()], allow_credentials=True, allow_methods=["*"], allow_headers=["*"])
bearer = HTTPBearer(auto_error=False)


class Credentials(BaseModel):
    username: str = Field(min_length=3, max_length=80)
    password: str = Field(min_length=12, max_length=128)


class ManualOfferInput(BaseModel):
    name: str = Field(min_length=3, max_length=240)
    description: str | None = Field(default=None, max_length=2000)
    category: str = Field(min_length=2, max_length=100)
    current_price: float = Field(gt=0)
    original_price: float | None = Field(default=None, gt=0)
    commission_rate: float | None = Field(default=None, ge=0, le=100)
    image_url: str | None = None
    affiliate_url: str | None = None
    publication_status: str = Field(default="draft", pattern="^(draft|published|archived)$")

    @field_validator("affiliate_url")
    @classmethod
    def validate_affiliate_url(cls, value: str | None) -> str | None:
        if value is None or not value.strip():
            return None
        parsed = urlparse(value.strip())
        host = (parsed.hostname or "").lower()
        is_shopee = host == "shope.ee" or host == "shopee.com.br" or host.endswith(".shopee.com.br")
        if parsed.scheme != "https" or not is_shopee or parsed.username or parsed.password:
            raise ValueError("Informe um link HTTPS do dominio Shopee gerado para afiliados.")
        return value.strip()

    @field_validator("image_url")
    @classmethod
    def validate_image_url(cls, value: str | None) -> str | None:
        if value is None or not value.strip():
            return None
        parsed = urlparse(value.strip())
        if parsed.scheme != "https" or not parsed.hostname:
            raise ValueError("A imagem precisa usar uma URL HTTPS valida.")
        return value.strip()

    @model_validator(mode="after")
    def validate_publication(self):
        if self.original_price is not None and self.original_price <= self.current_price:
            raise ValueError("O preco anterior precisa ser maior que o preco atual.")
        if self.publication_status == "published" and not self.affiliate_url:
            raise ValueError("Adicione o link de afiliado antes de publicar a oferta.")
        return self


def require_admin(credentials: HTTPAuthorizationCredentials | None = Depends(bearer), database: Session = Depends(get_db)) -> AdminUser:
    subject = read_access_token(credentials.credentials) if credentials else None
    if not subject:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Autenticacao necessaria")
    user = database.scalar(select(AdminUser).where(AdminUser.username == subject))
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Sessao invalida")
    return user


@app.get("/api/health")
def health():
    return {"status": "ok", "mode": os.getenv("SHOPEE_MODE", "demo")}


@app.get("/api/auth/status")
def auth_status(database: Session = Depends(get_db)):
    return {"setup_required": database.scalar(select(func.count(AdminUser.id))) == 0}


@app.post("/api/auth/setup")
def setup_admin(payload: Credentials, database: Session = Depends(get_db)):
    if database.scalar(select(func.count(AdminUser.id))) != 0:
        raise HTTPException(status_code=409, detail="A configuracao inicial ja foi concluida")
    user = AdminUser(username=payload.username, password_hash=hash_password(payload.password))
    database.add(user)
    database.commit()
    return {"access_token": create_access_token(user.username), "token_type": "bearer", "username": user.username}


@app.post("/api/auth/login")
def login(payload: Credentials, database: Session = Depends(get_db)):
    user = database.scalar(select(AdminUser).where(AdminUser.username == payload.username))
    if not user or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Usuario ou senha incorretos")
    return {"access_token": create_access_token(user.username), "token_type": "bearer", "username": user.username}


@app.get("/api/dashboard")
def dashboard(_: AdminUser = Depends(require_admin), database: Session = Depends(get_db)):
    products = list(database.scalars(select(Product).where(Product.source == "demo").order_by(Product.score.desc())).all())
    runs = list(database.scalars(select(MiningRun).order_by(MiningRun.started_at.desc()).limit(6)).all())
    return {
        "products_found": len(products),
        "recommended": sum(product.score >= 80 for product in products),
        "published": 0,
        "pending": sum(product.score >= 80 for product in products),
        "estimated_commission": round(sum((product.current_price * (product.commission_rate or 0) / 100) for product in products), 2),
        "demo": os.getenv("SHOPEE_MODE", "demo").lower() != "production",
        "runs": [{"id": run.id, "date": run.started_at, "found": run.found_count, "new": run.new_count, "source": run.source} for run in runs],
        "category_counts": [{"name": name, "value": count} for name, count in database.execute(select(Product.category, func.count(Product.id)).where(Product.source == "demo").group_by(Product.category)).all()],
    }


@app.get("/api/offers")
def offers(min_score: int = 0, category: str | None = None, search: str | None = None,
           _: AdminUser = Depends(require_admin), database: Session = Depends(get_db)):
    query = select(Product).where(Product.source == "demo", Product.score >= min_score).order_by(Product.score.desc())
    if category:
        query = query.where(Product.category == category)
    if search:
        query = query.where(Product.name.ilike(f"%{search}%"))
    products = database.scalars(query).all()
    return [{"id": product.id, "name": product.name, "category": product.category, "current_price": product.current_price,
             "original_price": product.original_price, "commission_rate": product.commission_rate, "rating": product.rating,
             "sales_count": product.sales_count, "score": product.score, "confidence": product.confidence, "demo": product.demo,
             "source": product.source, "publication_status": product.publication_status,
             "affiliate_url": product.affiliate_url} for product in products]


def serialize_manual_offer(product: Product) -> dict:
    return {
        "id": product.id,
        "name": product.name,
        "description": product.description,
        "category": product.category,
        "current_price": product.current_price,
        "original_price": product.original_price,
        "commission_rate": product.commission_rate,
        "estimated_commission_per_sale": round(product.current_price * product.commission_rate / 100, 2) if product.commission_rate is not None else None,
        "image_url": product.image_url,
        "affiliate_url": product.affiliate_url,
        "publication_status": product.publication_status,
        "created_at": product.created_at,
        "published_at": product.published_at,
    }


@app.get("/api/admin/manual-offers")
def list_manual_offers(_: AdminUser = Depends(require_admin), database: Session = Depends(get_db)):
    products = database.scalars(select(Product).where(Product.source == "manual").order_by(Product.created_at.desc())).all()
    return [serialize_manual_offer(product) for product in products]


@app.post("/api/admin/manual-offers", status_code=status.HTTP_201_CREATED)
def create_manual_offer(payload: ManualOfferInput, _: AdminUser = Depends(require_admin), database: Session = Depends(get_db)):
    published_at = datetime.now(timezone.utc) if payload.publication_status == "published" else None
    product = Product(
        external_id=f"manual-{uuid4().hex}",
        name=payload.name,
        description=payload.description,
        category=payload.category,
        current_price=payload.current_price,
        original_price=payload.original_price,
        commission_rate=payload.commission_rate,
        image_url=payload.image_url,
        affiliate_url=payload.affiliate_url,
        publication_status=payload.publication_status,
        published_at=published_at,
        source="manual",
        demo=False,
        score=0,
        confidence=0,
    )
    database.add(product)
    database.flush()
    database.add(PriceHistory(product_id=product.id, price=product.current_price))
    database.commit()
    database.refresh(product)
    return serialize_manual_offer(product)


@app.put("/api/admin/manual-offers/{product_id}")
def update_manual_offer(product_id: int, payload: ManualOfferInput, _: AdminUser = Depends(require_admin), database: Session = Depends(get_db)):
    product = database.scalar(select(Product).where(Product.id == product_id, Product.source == "manual"))
    if not product:
        raise HTTPException(status_code=404, detail="Oferta manual nao encontrada")
    if product.current_price != payload.current_price:
        database.add(PriceHistory(product_id=product.id, price=payload.current_price))
    product.name = payload.name
    product.description = payload.description
    product.category = payload.category
    product.current_price = payload.current_price
    product.original_price = payload.original_price
    product.commission_rate = payload.commission_rate
    product.image_url = payload.image_url
    product.affiliate_url = payload.affiliate_url
    product.publication_status = payload.publication_status
    product.published_at = product.published_at or datetime.now(timezone.utc) if payload.publication_status == "published" else None
    database.commit()
    database.refresh(product)
    return serialize_manual_offer(product)


@app.get("/api/store/offers")
def public_store_offers(database: Session = Depends(get_db)):
    products = database.scalars(
        select(Product)
        .where(
            Product.source == "manual",
            Product.publication_status == "published",
            Product.affiliate_url.is_not(None),
        )
        .order_by(Product.published_at.desc())
    ).all()
    return [{
        "id": product.id,
        "name": product.name,
        "description": product.description,
        "category": product.category,
        "current_price": product.current_price,
        "original_price": product.original_price,
        "image_url": product.image_url,
        "affiliate_url": product.affiliate_url,
        "published_at": product.published_at,
    } for product in products]


@app.post("/api/mining/run")
def mine(_: AdminUser = Depends(require_admin), database: Session = Depends(get_db)):
    if os.getenv("SHOPEE_MODE", "demo").lower() != "demo":
        raise HTTPException(status_code=409, detail="O adaptador Shopee oficial ainda nao foi configurado com documentacao aprovada.")
    return run_demo_mining(database)


@app.get("/api/integrations")
def integrations(_: AdminUser = Depends(require_admin)):
    return {
        "shopee": {"mode": os.getenv("SHOPEE_MODE", "demo"), "status": "demo", "approved": False, "last_sync": None},
        "telegram": {"configured": bool(os.getenv("TELEGRAM_BOT_TOKEN") and os.getenv("TELEGRAM_CHAT_ID")), "status": "not_configured"},
        "whatsapp": {"mode": "manual_only"},
    }


@app.get("/api/runs")
def runs(_: AdminUser = Depends(require_admin), database: Session = Depends(get_db)):
    items = database.scalars(select(MiningRun).order_by(MiningRun.started_at.desc()).limit(50)).all()
    return [{"id": item.id, "status": item.status, "source": item.source, "found": item.found_count,
             "new": item.new_count, "message": item.message, "started_at": item.started_at} for item in items]