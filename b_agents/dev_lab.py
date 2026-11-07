"""Shopper Lab demo: run 1 (no lessons) -> seed 2 observed rates -> run 2 (with lessons).

    python -m b_agents.dev_lab --fixture

Uses the lab fixture (1 product, 4 variants) and segment stats from the fixture DB.
Run 2 reuses run 1's personas so the only change is what memory taught them.
Writes b_agents/.dev/lab1.json and lab2.json; prints the ranking change and lessons_used.
"""
from __future__ import annotations

import argparse
import json
import time
from pathlib import Path

from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parent.parent / ".env")

from b_agents import lab_fixture, lab_pipeline, memory  # noqa: E402

DEV = Path(__file__).resolve().parent / ".dev"
# Simulated real-world results, set relative to run 1's predictions so the demo shows a
# known calibration error: lab overrates street/lifestyle for At risk by 21%, and
# underrates the studio shot overall by 15%.
OBSERVED = [(3, "At risk", 1 / 1.21), (2, None, 1 / 0.85)]


def ranking(result: dict) -> dict[int, dict]:
    return {v["variant_id"]: v for v in result["variants"]}


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--fixture", action="store_true", help="use the lab fixture (the only source until seed_lab.py)")
    ap.parse_args()

    DEV.mkdir(exist_ok=True)
    started = time.time()
    memory.reset()
    memory.seed_brand()
    ctx = {"lab_run_id": "l_001", "variant_set_id": lab_fixture.VARIANT_SET_ID, "product": lab_fixture.PRODUCT,
           "variants": lab_fixture.VARIANTS, "segments": lab_fixture.load_segments()}

    print("\n===== lab run 1 (no lessons) =====")
    run1 = lab_pipeline.run(ctx)
    (DEV / "lab1.json").write_text(json.dumps(run1, indent=2))

    print("\n===== permission check =====")
    try:
        memory.read("shopper", "customers", "who are the at risk customers?")
        print("[demo] shopper read customers: ALLOWED (this should never happen)")
    except PermissionError as e:
        print(f"[demo] shopper -> customers refused: PermissionError: {e}")

    print("\n===== seeding observed rates =====")
    r1 = ranking(run1)
    for vid, segment, factor in OBSERVED:
        predicted = r1[vid]["by_segment"][segment] if segment else r1[vid]["score"]
        rec = memory.record_observed(vid, round(predicted * factor, 4), "simulated_stripe", segment=segment)
        print(f"  variant {vid} ({r1[vid]['label']}) {segment or 'overall'}: predicted {rec['predicted']:.3f}, "
              f"observed {rec['observed']:.3f} -> {rec['text'].split(' (')[0]}")

    print("\n===== lab run 2 (same personas, with lessons) =====")
    run2 = lab_pipeline.run({**ctx, "lab_run_id": "l_002"})
    (DEV / "lab2.json").write_text(json.dumps(run2, indent=2))

    r2 = ranking(run2)
    print("\n===== ranking change (run 1 -> run 2) =====")
    print(f"  {'variant':<20} {'rank':>9} {'score':>15} {'At risk':>15}")
    for vid in sorted(r1, key=lambda v: r2[v]["rank"]):
        a, b = r1[vid], r2[vid]
        print(f"  {a['label']:<20} {a['rank']:>4} -> {b['rank']:<3} {a['score']:>6.3f} -> {b['score']:<6.3f} "
              f"{a['by_segment']['At risk']:>6.3f} -> {b['by_segment']['At risk']:<6.3f}")
    for name, r in (("run 1", run1), ("run 2", run2)):
        w = r["winner"]
        print(f"  {name} winner: {w['label']} (+{w['lift_pct']}% vs runner-up, {w['call']})  "
              f"time {r['analyst_runtime_s']}s  sources {r['analyst_sources']}")
    print("\nlessons_used in run 2:")
    for x in run2["lessons_used"]:
        print(f"  - {x}")
    print(f"lessons_learned in run 2: {run2['lessons_learned']}")
    print(f"calibration: {run2['calibration']}   costs run 2: {run2['costs']}")
    print(f"\nsaved {DEV / 'lab1.json'} and {DEV / 'lab2.json'}  (total {time.time() - started:.0f}s)")


if __name__ == "__main__":
    main()
