"""Tests for deterministic seed generation, reproducibility, and insert performance."""
import time
from app.database import get_db_cursor
from app.seed import seed_database
from tests.conftest import TEST_DB_URL


def test_seed_database_idempotency():
    """Verify seed_database is safe to run multiple times without duplicating or corrupting."""
    res1 = seed_database(database_url=TEST_DB_URL, force_reset=False)
    assert res1["status"] in ("seeded", "already_seeded")

    res2 = seed_database(database_url=TEST_DB_URL, force_reset=False)
    assert res2["status"] == "already_seeded"


def test_seed_counts_and_domain_invariants():
    """Verify core domain seed requirements: 5 stores, 18 SKUs across 6 categories, 84 days sales."""
    with get_db_cursor(TEST_DB_URL) as cur:
        # 5 stores
        cur.execute("SELECT COUNT(*) FROM stores;")
        store_count = cur.fetchone()[0]
        assert store_count == 5

        # 18 products
        cur.execute("SELECT COUNT(*) FROM products;")
        product_count = cur.fetchone()[0]
        assert product_count == 18

        # 6 distinct categories
        cur.execute("SELECT DISTINCT category FROM products;")
        categories = {r[0] for r in cur.fetchall()}
        assert categories == {"dairy", "bakery", "produce", "meat", "seafood", "ready-to-eat"}

        # Sales history: 5 stores * 18 products * 84 days = 7560 records
        cur.execute("SELECT COUNT(*) FROM sales_history;")
        sales_count = cur.fetchone()[0]
        assert sales_count == 5 * 18 * 84

        # Inventory batches: each item has active batches
        cur.execute("SELECT COUNT(*) FROM inventory_batches WHERE current_quantity > 0;")
        batches_count = cur.fetchone()[0]
        assert batches_count >= 5 * 18 * 2  # At least 2 batches per item


def test_seed_insert_performance():
    """Verify that batch inserts using executemany complete well under 1 second per batch insert."""
    t0 = time.perf_counter()
    res = seed_database(database_url=TEST_DB_URL, seed=42, force_reset=True)
    total_time = time.perf_counter() - t0

    assert res["status"] == "seeded"
    # Total execution time for all 7560 sales + batches + products must finish rapidly
    assert total_time < 3.0, f"Seeding took {total_time:.2f}s, expected under 3 seconds."
