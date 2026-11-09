from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from ..models import MiningRun, PriceHistory, Product

DEMO_PRODUCTS = [
    {"external_id": "demo-home-001", "name": "Organizador modular de cozinha", "category": "Casa e cozinha", "current_price": 39.90, "original_price": 59.90, "commission_rate": 8.0, "rating": 4.8, "sales_count": 1240},
    {"external_id": "demo-tech-002", "name": "Luminaria LED de mesa articulada", "category": "Eletronicos", "current_price": 54.90, "original_price": 74.90, "commission_rate": 7.5, "rating": 4.7, "sales_count": 830},
    {"external_id": "demo-beauty-003", "name": "Escova secadora compacta", "category": "Beleza", "current_price": 89.90, "original_price": 119.90, "commission_rate": 9.0, "rating": 4.6, "sales_count": 2100},
    {"external_id": "demo-fashion-004", "name": "Bolsa transversal minimalista", "category": "Moda", "current_price": 46.50, "original_price": 65.00, "commission_rate": 10.0, "rating": 4.9, "sales_count": 540},
    {"external_id": "demo-game-005", "name": "Suporte ajustavel para headset", "category": "Games e informatica", "current_price": 32.90, "original_price": 42.90, "commission_rate": 6.0, "rating": 4.5, "sales_count": 390},
    {"external_id": "demo-home-006", "name": "Kit de potes hermeticos (5 pecas)", "category": "Casa e cozinha", "current_price": 49.90, "original_price": 69.90, "commission_rate": 8.5, "rating": 4.8, "sales_count": 1760},
    {"external_id": "demo-tech-007", "name": "Carregador USB-C 30W", "category": "Eletronicos", "current_price": 42.00, "original_price": None, "commission_rate": 5.0, "rating": 4.7, "sales_count": 3200},
    {"external_id": "demo-beauty-008", "name": "Espelho compacto com iluminacao", "category": "Beleza", "current_price": 37.90, "original_price": 49.90, "commission_rate": 9.0, "rating": None, "sales_count": None},
]


def score_product(data: dict) -> tuple[int, int]:
    weights = {"commission_rate": 25, "discount": 20, "rating": 20, "sales_count": 15, "appeal": 10, "price_stability": 10}
    values = {
        "commission_rate": min(float(data["commission_rate"]) / 10, 1) if data.get("commission_rate") is not None else None,
        "discount": min(max((float(data.get("original_price") or 0) - float(data["current_price"])) / (float(data.get("original_price") or 1)), 0) / 0.3, 1) if data.get("original_price") else None,
        "rating": min(float(data["rating"]) / 5, 1) if data.get("rating") is not None else None,
        "sales_count": min(float(data["sales_count"]) / 1000, 1) if data.get("sales_count") is not None else None,
        "appeal": None,
        "price_stability": None,
    }
    available_weight = sum(weights[key] for key, value in values.items() if value is not None)
    score = round(sum(weights[key] * value for key, value in values.items() if value is not None) / available_weight * 100) if available_weight else 0
    confidence = round(available_weight / sum(weights.values()) * 100)
    return score, confidence


def run_demo_mining(database: Session) -> dict:
    added = 0
    for product_data in DEMO_PRODUCTS:
        existing = database.scalar(select(Product).where(Product.external_id == product_data["external_id"]))
        score, confidence = score_product(product_data)
        if existing:
            existing.score = score
            existing.confidence = confidence
            existing.updated_at = datetime.now(timezone.utc)
            continue
        product = Product(**product_data, score=score, confidence=confidence, demo=True)
        database.add(product)
        database.flush()
        database.add(PriceHistory(product_id=product.id, price=product.current_price))
        added += 1

    run = MiningRun(source="demo", status="completed", found_count=len(DEMO_PRODUCTS), new_count=added,
                    message="Dados ficticios de demonstracao. Nenhuma consulta foi feita a Shopee.",
                    completed_at=datetime.now(timezone.utc))
    database.add(run)
    database.commit()
    return {"found": len(DEMO_PRODUCTS), "new": added, "run_id": run.id, "source": "demo"}