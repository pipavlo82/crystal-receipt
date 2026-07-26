#!/usr/bin/env python3
"""Re-runnable blind-diff harness (non-production, non-reference).

Runs the frozen + post-correction Python detectors, and (if `bun` is installed)
the frozen TypeScript detector, against the pinned witness vectors, diffing each
derived admission_result against the vector's expected output.

Expected: frozen-Python 15/16 (historical co-late-terminal residual),
post-correction-Python 16/16, TypeScript 16/16.
"""
import json, os, shutil, subprocess, sys, tempfile
HERE = os.path.dirname(os.path.abspath(__file__))
VEC  = os.path.normpath(os.path.join(HERE, "..", "fixtures",
                                     "unanchored-issuance-witness-v0", "vectors"))
ORDER = ["a","b","c","d","e","f","g1","g2","h","i","j","k1","k2",
         "co-equivocation-prefix","co-late-terminal-after-overdue","co-multiple-violations"]

def py(det, vec):
    return json.loads(subprocess.check_output([sys.executable, os.path.join(HERE, det), vec]))

def ts_all():
    if not shutil.which("bun"):
        return None
    tmp = tempfile.mkdtemp(); os.makedirs(os.path.join(tmp, "vectors"))
    shutil.copy(os.path.join(HERE, "detector.ts"), tmp)
    for n in ORDER:
        shutil.copy(os.path.join(VEC, n + ".json"), os.path.join(tmp, "vectors"))
    out = subprocess.check_output(["bun", "detector.ts", "emit"], cwd=tmp)
    shutil.rmtree(tmp); return json.loads(out)

def main():
    ts = ts_all()
    fz = pc = tp = 0
    print(f"{'vector':34} frozen-py  post-py   ts")
    print("-"*62)
    for n in ORDER:
        v = json.load(open(os.path.join(VEC, n + ".json")))
        exp, cid = v["expected"]["admission_result"], v["case_id"]
        vf = os.path.join(VEC, n + ".json")
        f = (py("detector.py", vf) == exp)
        p = (py("detector-postcorrection.py", vf) == exp)
        t = (ts[cid] == exp) if ts is not None else None
        fz += f; pc += p; tp += (t is True)
        ts_s = ("PASS" if t else "FAIL") if t is not None else "skip(no bun)"
        print(f"{n:34} {'PASS' if f else 'FAIL':10}{'PASS' if p else 'FAIL':9} {ts_s}")
    print("-"*62)
    print(f"frozen-py {fz}/16 (historical; 15/16 expected — co-late-terminal residual)")
    print(f"post-correction-py {pc}/16")
    print(f"frozen-ts {tp}/16" if ts is not None else "frozen-ts skipped (install bun to run)")

if __name__ == "__main__":
    main()
