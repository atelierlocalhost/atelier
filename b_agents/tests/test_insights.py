from b_agents import insights


def test_segments_match_fixture(fixture_db):
    path, labels = fixture_db
    customers, orders = insights.load_frames(path)
    rfm = insights.compute_rfm(customers, orders)
    rfm["intended"] = rfm.index.map(labels)
    # The fixture's lapsed, previously frequent buyers must all land in At risk.
    at_risk = rfm[rfm.intended == "At risk"]
    assert (at_risk.segment == "At risk").all()
    assert (rfm[rfm.intended == "New"].segment == "New").all()
    assert (rfm[rfm.intended == "Hibernating"].segment == "Hibernating").all()
    assert rfm.churn_risk.sum() == len(at_risk)


def test_rfm_math(fixture_db):
    path, _ = fixture_db
    customers, orders = insights.load_frames(path)
    rfm = insights.compute_rfm(customers, orders)
    assert rfm.frequency.sum() == len(orders)
    assert abs(rfm.monetary.sum() - orders.amount.sum()) < 1e-6
    for col in "RFM":
        assert set(rfm[col]) == {1, 2, 3, 4, 5}
        assert rfm[col].value_counts().max() == len(rfm) // 5  # 80 customers -> 16 per quintile
    # most recent customers get R=5
    assert rfm.loc[rfm.recency_days.idxmin(), "R"] == 5


def test_summary_avg_spend(fixture_db):
    path, _ = fixture_db
    customers, orders = insights.load_frames(path)
    rfm = insights.compute_rfm(customers, orders)
    stats = insights.summarize(rfm)
    assert sum(s["count"] for s in stats["segments"]) == len(rfm)
    for s in stats["segments"]:
        expected = rfm[rfm.segment == s["name"]].monetary.mean()
        assert abs(s["avg_spend"] - round(expected, 2)) < 0.01
    assert "email" not in str(stats).lower()  # aggregates only, no PII
