from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from app.database import Base, get_db
from app.main import app


def test_manual_offer_draft_is_hidden_until_published(tmp_path):
    engine = create_engine(f"sqlite:///{tmp_path / 'store-test.db'}")
    Base.metadata.create_all(engine)

    def override_get_db():
        with Session(engine) as database:
            yield database

    app.dependency_overrides[get_db] = override_get_db
    try:
        with TestClient(app) as client:
            setup = client.post("/api/auth/setup", json={"username": "storeadmin", "password": "Secure-Store-Password-1"})
            assert setup.status_code == 200
            headers = {"Authorization": f"Bearer {setup.json()['access_token']}"}

            assert client.get("/api/admin/manual-offers").status_code == 401
            assert client.get("/api/store/offers").json() == []

            offer_data = {
                "name": "Luminaria de leitura",
                "description": "Luz ajustavel para mesa de trabalho.",
                "category": "Casa e cozinha",
                "current_price": 49.9,
                "original_price": 69.9,
                "commission_rate": 8.0,
                "image_url": "https://images.example.com/luminaria.jpg",
                "affiliate_url": "https://s.shopee.com.br/affiliate-example",
                "publication_status": "draft",
            }
            created = client.post("/api/admin/manual-offers", json=offer_data, headers=headers)
            assert created.status_code == 201, created.text
            offer_id = created.json()["id"]
            assert created.json()["estimated_commission_per_sale"] == 3.99
            assert created.json()["commission_rate"] == 8.0
            assert client.get("/api/offers", headers=headers).json() == []
            assert client.get("/api/store/offers").json() == []

            published = client.put(
                f"/api/admin/manual-offers/{offer_id}",
                json={**offer_data, "publication_status": "published"},
                headers=headers,
            )
            assert published.status_code == 200, published.text
            public_offers = client.get("/api/store/offers")
            assert public_offers.status_code == 200
            assert len(public_offers.json()) == 1
            assert public_offers.json()[0]["affiliate_url"] == offer_data["affiliate_url"]
            assert "commission_rate" not in public_offers.json()[0]
            assert "estimated_commission_per_sale" not in public_offers.json()[0]
            assert "source" not in public_offers.json()[0]
            assert "score" not in public_offers.json()[0]

            invalid = client.post(
                "/api/admin/manual-offers",
                json={**offer_data, "name": "Link invalido", "affiliate_url": "https://example.com/not-affiliate", "publication_status": "published"},
                headers=headers,
            )
            assert invalid.status_code == 422

            missing_link = client.post(
                "/api/admin/manual-offers",
                json={**offer_data, "name": "Oferta sem link", "affiliate_url": None, "publication_status": "published"},
                headers=headers,
            )
            assert missing_link.status_code == 422
    finally:
        app.dependency_overrides.clear()
        engine.dispose()