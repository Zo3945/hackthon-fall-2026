#!/usr/bin/env python3
"""Turns the raw Blue CoLab CSVs into public/data/pond.json (one row per hour).

Alan = sensors in the pond, Odin = weather station. We drop impossible values,
remove sensor spikes, fill short gaps and leave long gaps empty.
"""
import csv, glob, json, math, os, statistics, sys
from collections import defaultdict
from datetime import datetime, timedelta, timezone

RAW = os.path.join(os.path.dirname(__file__), "..", "data", "raw", "extract")
OUT = os.path.join(os.path.dirname(__file__), "..", "public", "data", "pond.json")
DAYS = int(sys.argv[1]) if len(sys.argv) > 1 else 120

WATER = {"Temp": (0, 40), "DOpct": (1, 200), "Turb": (0.05, 1000), "pH": (4, 10), "Cond": (50, 3000)}
WEATHER = {"Rain": None, "WindSpeed": (0, 150), "AirTemp": (-30, 45), "LightningStrikes": (0, 5000), "WindDir": (0, 360)}


def mean_direction(degrees):
    """Average directions on a circle: 350 and 10 should give north, not south."""
    x = sum(math.sin(math.radians(d)) for d in degrees)
    y = sum(math.cos(math.radians(d)) for d in degrees)
    return math.degrees(math.atan2(x, y)) % 360


def hour_key(ts):
    # "2026-01-01 00:15:00.000 -0500" -> that hour in UTC
    dt = datetime.strptime(ts, "%Y-%m-%d %H:%M:%S.%f %z").astimezone(timezone.utc)
    return dt.replace(minute=0, second=0, microsecond=0)


def read_hourly(files, cols, limits, agg):
    buckets = defaultdict(lambda: defaultdict(list))
    for f in files:
        with open(f, newline="") as fh:
            for row in csv.DictReader(fh):
                try:
                    k = hour_key(row["time"])
                except (ValueError, KeyError):
                    continue
                for c in cols:
                    v = row.get(c, "")
                    if v in ("", None):
                        continue
                    try:
                        x = float(v)
                    except ValueError:
                        continue
                    lim = limits.get(c)
                    if lim and not (lim[0] <= x <= lim[1]):
                        continue
                    buckets[k][c].append(x)
    out = {}
    for k, d in buckets.items():
        out[k] = {c: (agg[c](v)) for c, v in d.items() if v}
    return out


def unstick(vals, hours=6, tolerance=0.15):
    """Oxygen always moves during the day, so 6 flat hours = stuck sensor. Blank them."""
    res = list(vals)
    for i in range(len(vals) - hours + 1):
        w = vals[i:i + hours]
        if all(v is not None for v in w) and max(w) - min(w) <= tolerance:
            for k in range(i, i + hours):
                res[k] = None
    return res


def despike(vals, win=5, k=4.0, floor=0.0):
    """Blank out readings way off from their neighbors (sensor glitches)."""
    n = len(vals)
    res = list(vals)
    for i in range(n):
        if vals[i] is None:
            continue
        w = [v for v in vals[max(0, i - win): i + win + 1] if v is not None]
        if len(w) < 4:
            continue
        med = statistics.median(w)
        mad = statistics.median([abs(v - med) for v in w]) or 1e-9
        if abs(vals[i] - med) > max(k * 1.4826 * mad * 3, floor):
            res[i] = None
    return res


def fill_short(vals, max_gap=6):
    """Draw a straight line across short gaps. Long gaps stay empty."""
    n = len(vals)
    res = list(vals)
    i = 0
    while i < n:
        if res[i] is None:
            j = i
            while j < n and res[j] is None:
                j += 1
            if i > 0 and j < n and (j - i) <= max_gap:
                a, b = res[i - 1], res[j]
                for t in range(i, j):
                    res[t] = a + (b - a) * (t - i + 1) / (j - i + 1)
            i = j
        else:
            i += 1
    return res


def main():
    mean = lambda v: sum(v) / len(v)
    water = read_hourly(sorted(glob.glob(f"{RAW}/alan/alan/alan 20*.csv")),
                        list(WATER), WATER, {c: mean for c in WATER})
    weather = read_hourly(sorted(glob.glob(f"{RAW}/odin/odin/odin 202[456].csv")),
                          list(WEATHER), WEATHER,
                          {"Rain": sum, "WindSpeed": mean, "AirTemp": mean, "LightningStrikes": sum, "WindDir": mean_direction})
    end = max(water)
    start = end - timedelta(days=DAYS)
    hours = []
    t = start.replace(minute=0)
    while t <= end:
        hours.append(t)
        t += timedelta(hours=1)

    cols = {}
    floors = {"Temp": 1.5, "DOpct": 15, "Turb": 40, "pH": 0.35, "Cond": 120}
    for c in WATER:
        raw = [water.get(h, {}).get(c) for h in hours]
        if c == "DOpct":
            raw = unstick(raw)
        cols[c] = fill_short(despike(raw, floor=floors[c]))
    for c in ("Rain", "WindSpeed", "AirTemp"):
        raw = [weather.get(h, {}).get(c) for h in hours]
        cols[c] = fill_short(raw, 12) if c != "Rain" else [0 if v is None else v for v in raw]
    # lightning strikes per hour (0 if none)
    cols["Lightning"] = [weather.get(h, {}).get("LightningStrikes") or 0 for h in hours]
    # where the wind comes from, 0 = north
    cols["WindDir"] = [weather.get(h, {}).get("WindDir") for h in hours]

    def r(v, d=2):
        return None if v is None else round(v, d)

    data = {
        "station": "Alan, Choate Pond, Pace University Pleasantville",
        "source": "Blue CoLab flat files (github.com/bluecolab/data-repo)",
        "start": hours[0].isoformat(),
        "stepHours": 1,
        "columns": ["Temp", "DOpct", "Turb", "pH", "Cond", "Rain", "WindSpeed", "AirTemp", "Lightning", "WindDir"],
        "rows": [[r(cols[c][i], 3 if c == "pH" else 2) for c in
                  ["Temp", "DOpct", "Turb", "pH", "Cond", "Rain", "WindSpeed", "AirTemp", "Lightning", "WindDir"]]
                 for i in range(len(hours))],
    }
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "w") as f:
        json.dump(data, f, separators=(",", ":"))
    print(f"{len(hours)} hours, {hours[0]} .. {hours[-1]}")
    for i, c in enumerate(data["columns"]):
        v = [row[i] for row in data["rows"] if row[i] is not None]
        miss = 100 * (1 - len(v) / len(hours))
        print(f"{c:10s} min {min(v):8.2f} max {max(v):8.2f} missing {miss:4.1f}%")
    print("size KB:", os.path.getsize(OUT) // 1024)


if __name__ == "__main__":
    main()
