import pytest

from b_agents import lab_fixture, lab_pipeline, memory, persona_gen


def test_shopper_cannot_read_customers():
    with pytest.raises(PermissionError):
        memory.read("shopper", "customers", "anything")
    with pytest.raises(PermissionError):
        memory.read_records("shopper", "customers")


@pytest.mark.parametrize("agent,dataset,mode,allowed", [
    ("shopper", "lab_outcomes", "read", True),
    ("shopper", "brand", "read", True),
    ("shopper", "persona:p01", "read", True),
    ("shopper", "lab_outcomes", "write", False),
    ("shopper", "calibration", "read", False),
    ("lab_analyst", "lab_outcomes", "write", True),
    ("lab_analyst", "calibration", "write", True),
    ("lab_analyst", "persona:p07", "write", True),
    ("lab_analyst", "calibration", "read", True),
    ("lab_analyst", "customers", "read", False),
    ("persona_gen", "customers", "read", True),
    ("persona_gen", "lab_outcomes", "write", False),
    ("strategy", "lab_outcomes", "read", True),
    ("strategy", "calibration", "read", True),
    ("social", "lab_outcomes", "read", True),
    ("social", "calibration", "read", False),
    ("social", "persona:p01", "read", False),
])
def test_lab_permissions(agent, dataset, mode, allowed):
    def attempt():
        if mode == "read":
            memory.read_records(agent, dataset)
        else:
            memory.write(agent, dataset, {"text": "x"})
    if allowed:
        attempt()
    else:
        with pytest.raises(PermissionError):
            attempt()


def test_bad_persona_dataset_name():
    with pytest.raises(ValueError):
        memory.read_records("shopper", "persona:")


def test_record_observed_calibration():
    memory.write("lab_analyst", "calibration", {
        "type": "prediction", "lab_run_id": "l_001", "variant_id": 3, "label": "On model, street",
        "style": "lifestyle", "score": 0.20, "by_segment": {"At risk": 0.121}})
    rec = memory.record_observed(3, 0.10, "stripe", segment="At risk")
    assert rec["error_pct"] == 21.0
    lessons = memory.read("shopper", "lab_outcomes", "lifestyle")
    assert lessons == ["lab overrates lifestyle for At risk by 21%"]
    rec2 = memory.record_observed(3, 0.25, "stripe")  # overall 0.20 vs 0.25 -> underrates by 20%
    assert rec2["error_pct"] == -20.0
    assert memory.calibration_summary() == {"mean_abs_error_pct": 20.5, "n_observed": 2}
    with pytest.raises(ValueError):
        memory.record_observed(9, 0.1, "stripe")


def test_pipeline_two_runs_learns(fixture_db):
    ctx = {"lab_run_id": "l_001", "variant_set_id": "vs_01", "product": lab_fixture.PRODUCT,
           "variants": lab_fixture.VARIANTS, "segments": lab_fixture.load_segments(fixture_db[0])}
    run1 = lab_pipeline.run(ctx)
    assert run1["lessons_used"] == [] and run1["calibration"] == {"mean_abs_error_pct": 0.0, "n_observed": 0}
    assert len(memory.read_records("system", "persona:p01")) == 1  # persona memory written
    assert len([r for r in memory.read_records("system", "calibration") if r["type"] == "prediction"]) == 4
    memory.record_observed(3, 0.1, "test", segment="At risk")
    run2 = lab_pipeline.run({**ctx, "lab_run_id": "l_002", "personas": ctx["personas"]})
    assert run2["lessons_used"] and any("overrates lifestyle" in x for x in run2["lessons_used"])
    assert run2["calibration"]["n_observed"] == 1
    assert run1["analyst_sources"]["persona_gen"] == "fallback"  # no key in tests
    assert run2["analyst_sources"]["persona_gen"] == "reused"
