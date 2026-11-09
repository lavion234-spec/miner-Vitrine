from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session

from app.database import Base
from app.models import MiningRun, Product
from app.services.miner import run_demo_mining, score_product


def test_score_excludes_unavailable_criteria():
    score, confidence = score_product({"current_price": 25.0, "commission_rate": None, "original_price": None, "rating": None, "sales_count": None})

    assert score == 0
    assert confidence == 0


def test_score_confidence_tracks_available_criteria():
    score, confidence = score_product({"current_price": 50.0, "commission_rate": 12.0, "original_price": None, "rating": None, "sales_count": None})

    assert score == 100
    assert confidence == 25


def test_demo_mining_persists_and_deduplicates(tmp_path):
    engine = create_engine(f"sqlite:///{tmp_path / 'miner-test.db'}")
    Base.metadata.create_all(engine)

    with Session(engine) as database:
        first_run = run_demo_mining(database)
        second_run = run_demo_mining(database)

        assert first_run["found"] == 8
        assert first_run["new"] == 8
        assert second_run["found"] == 8
        assert second_run["new"] == 0
        assert len(database.scalars(select(Product)).all()) == 8
        assert database.scalar(select(Product.score).where(Product.score >= 80)) is not None
        assert len(database.scalars(select(MiningRun)).all()) == 2

    engine.dispose()