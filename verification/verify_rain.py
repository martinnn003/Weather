"""How close each forecast model came to the rain measured at Bulgaria's weather stations.

Observations are the stations' own SYNOP reports, through Ogimet (ogimet.com, no key):
the 12-hour totals that Bulgarian stations send at 06 and 18 UTC. Station positions are
WMO OSCAR's. Forecasts are Open-Meteo's Previous Runs API, asked for each station's
coordinates. Every forecast is scored on the same 12-hour windows as every other one,
for each lead day from 0 (the latest run, what the site shows for "now") to 5.

    python verification/verify_rain.py [--days 60] [--end YYYY-MM-DD] [--max-elevation 1500]

The tables are printed and written to verification/results/rain_*.csv.
"""
import argparse
import json
import sys
import textwrap
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import date, datetime, timedelta
from pathlib import Path

import numpy as np
import pandas as pd

HERE = Path(__file__).resolve().parent
CACHE = HERE / "cache"
RESULTS = HERE / "results"

OSCAR = "https://oscar.wmo.int/surface/rest/api/search/station?territoryName=BGR"
OGIMET = "https://www.ogimet.com/cgi-bin/getsynop"
PREVIOUS_RUNS = "https://previous-runs-api.open-meteo.com/v1/forecast"
# Bulgaria's WMO blocks; 150-154 are Romania's.
BLOCKS = ["155", "156", "157"]

# The ids as Open-Meteo's documentation spells them, and how the tables name them.
MODELS = {"ecmwf_ifs": "ECMWF IFS", "dwd_icon_global": "ICON Global",
          "dwd_icon_eu": "ICON-EU", "ncep_gfs_global": "GFS",
          "ukmo_global_deterministic_10km": "UKMO", "meteofrance_arpege_europe": "ARPEGE"}
# 0 is the plain variable: each hour from the newest run that had it. N is the value
# forecast N × 24 hours before the hour it is for.
LEADS = range(0, 6)
WINDOW = 12  # hours that one SYNOP total covers
WET = 0.2  # mm: a window with this much or more is a wet one
HEAVY = 5.0  # mm: and with this much, a properly wet one
BOOTSTRAP = 2000
SITE = "сайтът сега"


# The ways of choosing the rain that are compared, by lead day. The site today takes
# ECMWF's alone. Option 1 takes ICON Global's over the first four days (hours 0-96 from
# local midnight; lead 4 straddles the seam and is counted as ECMWF's), as the sky and
# temperature already are. Option 2 is the median of every model present for the hour.
def schemes(table, lead):
    out = {}
    if "ECMWF IFS" in table:
        out[SITE] = table["ECMWF IFS"]
    if lead <= 3 and "ICON Global" in table:
        out["вариант 1: ICON Global"] = table["ICON Global"]
    elif "ECMWF IFS" in table:
        out["вариант 1: ICON Global"] = table["ECMWF IFS"]
    models = table[[m for m in MODELS.values() if m in table]]
    if models.shape[1] >= 3:
        out["вариант 2: медиана"] = models.median(axis=1, skipna=False)
        out["средно на моделите"] = models.mean(axis=1, skipna=False)
        # What src/merge.js ships: the mean to a tenth an hour, as the site prints it.
        out["средно, по 0.1 mm"] = out["средно на моделите"].round(1)
    return out


def fetch(url, attempts=4):
    """The body at `url`, asked again a few times after a server's passing failure."""
    request = urllib.request.Request(url, headers={"User-Agent": "ClaudeWeather verification"})
    for attempt in range(attempts):
        try:
            with urllib.request.urlopen(request, timeout=180) as response:
                return response.read()
        except urllib.error.HTTPError as error:
            if error.code < 500 and error.code != 429 or attempt == attempts - 1:
                raise
        except OSError:
            if attempt == attempts - 1:
                raise
        time.sleep(5 * 2 ** attempt)


def cached(name, url, keep=True):
    """`url`'s body, kept in cache/ under `name` once it is final."""
    path = CACHE / name
    if path.exists():
        return path.read_bytes()
    body = fetch(url)
    if keep:
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(body)
    return body


def stations(max_elevation):
    """Bulgaria's operational synoptic stations up to `max_elevation` m, by WMO index.
    The peaks are left out by default: the site is read for towns, and a summit's rain
    gauge in wind and snow measures something else."""
    data = json.loads(cached("oscar_bgr.json", OSCAR))["stationSearchResults"]
    found = {}
    for s in data:
        ids = [w["wigosStationIdentifier"] for w in s.get("wigosStationIdentifiers", [])]
        wmo = [i[-5:] for i in ids if i.startswith("0-20000-0-15")]
        if not wmo or s.get("stationStatusCode") not in ("operational", "partlyOperational"):
            continue
        if (s.get("elevation") or 0) > max_elevation:
            continue
        found[wmo[0]] = dict(name=s["name"].split(" (")[0].rstrip(" *").title(),
                             lat=s["latitude"], lon=s["longitude"], elevation=s.get("elevation"))
    return found


def rrr(code):
    """SYNOP's RRR in mm: 990 is a trace, 991-999 tenths, the rest whole millimetres."""
    if not code.isdigit():
        return None
    n = int(code)
    if n == 990:
        return 0.0
    return (n - 990) / 10 if n > 990 else float(n)


def twelve_hours(report):
    """The report's 12-hour precipitation in mm, or None when it does not give one.
    The 6RRRt group of section 1 is read when iR says it is there; iR 3 means none fell."""
    body = report.split("333")[0].replace("=", " ").split()
    if len(body) < 5 or body[0] != "AAXX":
        return None
    ir = body[3][0]
    if ir == "3":
        return 0.0
    if ir not in "01":
        return None
    seen = 0
    for group in body[5:]:  # after Nddff; the groups run in order of their first digit
        if len(group) != 5 or group[0] < str(seen):
            continue
        seen = int(group[0])
        if group[0] == "6":
            return rrr(group[1:4]) if group[4] == "2" else None
        if group[0] > "6":
            break
    return None


def observations(ids, start, end):
    """Each station's 12-hour totals at 06 and 18 UTC, as a frame of window end × station."""
    rows = []
    day = start
    while day <= end + timedelta(days=1):
        last = min(day + timedelta(days=9), end + timedelta(days=1))
        final = last < datetime.utcnow().date()
        for block in BLOCKS:
            query = urllib.parse.urlencode({"block": block, "begin": f"{day:%Y%m%d}0600",
                                            "end": f"{last:%Y%m%d}1800"})
            name = f"ogimet/{block}_{day:%Y%m%d}_{last:%Y%m%d}.txt"
            fresh = not (CACHE / name).exists()
            text = cached(name, f"{OGIMET}?{query}", keep=final).decode("latin-1")
            if fresh:
                time.sleep(3)  # Ogimet asks to be used gently
            for line in text.splitlines():
                parts = line.split(",", 6)
                if len(parts) < 7 or parts[0] not in ids or parts[4] not in ("06", "18"):
                    continue
                if parts[5] != "00":
                    continue
                stamp = pd.Timestamp(int(parts[1]), int(parts[2]), int(parts[3]), int(parts[4]))
                rows.append((stamp, parts[0], twelve_hours(parts[6])))
        day = last + timedelta(days=1)
    frame = pd.DataFrame(rows, columns=["end", "station", "mm"])
    frame = frame.drop_duplicates(["end", "station"], keep="last")
    return frame.pivot(index="end", columns="station", values="mm").astype(float)


def forecasts(station, sid, start, end):
    """Every model's hourly forecast for every lead day, as columns (model, lead), UTC."""
    variables = ["precipitation"] + [f"precipitation_previous_day{n}" for n in LEADS if n]
    query = urllib.parse.urlencode({
        "latitude": station["lat"], "longitude": station["lon"],
        "hourly": ",".join(variables), "models": ",".join(MODELS),
        "start_date": start - timedelta(days=1), "end_date": end + timedelta(days=1),
        "timezone": "GMT"})
    final = end < datetime.utcnow().date()  # a past day's forecasts no longer change
    body = cached(f"forecasts/{sid}_{start}_{end}.json", f"{PREVIOUS_RUNS}?{query}", keep=final)
    hourly = json.loads(body)["hourly"]
    index = pd.to_datetime(hourly["time"])
    columns = {}
    for model in MODELS:
        for lead, variable in zip(LEADS, variables):
            values = hourly.get(f"{variable}_{model}")
            if values is not None:
                columns[(MODELS[model], lead)] = pd.Series(values, index=index, dtype=float)
    return pd.DataFrame(columns)


def windows(hourly, ends):
    """12-hour sums ending at `ends`. An hour's value is the rain of the hour before its
    time, so the window ending at 06 sums the hours stamped 19:00 to 06:00. A window with
    any hour missing is missing."""
    rolled = hourly.rolling(WINDOW, min_periods=WINDOW).sum()
    return rolled.reindex(ends)


def score(sample, names):
    rows = []
    o = sample["obs"]
    for name in names:
        f = sample[name]
        wet_o, wet_f = o >= WET, f >= WET
        rows.append(dict(
            forecast=name, windows=len(sample),
            correct=((wet_f == wet_o).mean() * 100),
            pod=(wet_f & wet_o).sum() / max(wet_o.sum(), 1) * 100,
            far=(wet_f & ~wet_o).sum() / max(wet_f.sum(), 1) * 100,
            pod_heavy=((f >= HEAVY) & (o >= HEAVY)).sum() / max((o >= HEAVY).sum(), 1) * 100,
            mae=(f - o).abs().mean(), bias=(f - o).mean(),
            total_ratio=f.sum() / max(o.sum(), 0.1)))
    return rows


def difference(sample, a, b, loss, seed=1):
    """`a`'s mean loss minus `b`'s, with a 95% interval from resampling whole windows:
    every station's total for one window errs together, so the window is the unit."""
    d = loss(sample[a], sample["obs"]) - loss(sample[b], sample["obs"])
    per = d.groupby(level="end").agg(["sum", "count"]).to_numpy()
    pick = np.random.default_rng(seed).integers(0, len(per), (BOOTSTRAP, len(per)))
    drawn = per[pick]
    low, high = np.percentile(drawn[..., 0].sum(1) / drawn[..., 1].sum(1), [2.5, 97.5])
    return d.mean(), low, high


LOSSES = {"mae": lambda f, o: (f - o).abs(),
          "miss_rate": lambda f, o: ((f >= WET) != (o >= WET)) * 100.0}

TITLES = {"correct": f"% познати прозорци вали/не вали (праг {WET} mm за 12 ч)",
          "pod": "% от валежните прозорци, в които моделът е дал дъжд",
          "far": "% от прогнозите за дъжд, при които не е валяло (фалшива тревога)",
          "pod_heavy": f"% от прозорците с {HEAVY:g}+ mm, в които и моделът е дал {HEAVY:g}+ mm",
          "mae": "MAE, mm за 12 ч",
          "bias": "bias, mm за 12 ч (+ значи твърде много дъжд)",
          "total_ratio": "общо прогнозиран / общо измерен валеж"}


def main():
    parser = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    parser.add_argument("--days", type=int, default=60)
    parser.add_argument("--end", type=date.fromisoformat, help="the last day; yesterday if not given")
    parser.add_argument("--max-elevation", type=int, default=1500)
    args = parser.parse_args()
    sys.stdout.reconfigure(errors="replace")

    end = args.end or datetime.utcnow().date() - timedelta(days=1)
    start = end - timedelta(days=args.days - 1)
    places = stations(args.max_elevation)
    print(f"Станции: {len(places)} (до {args.max_elevation} m): "
          + ", ".join(p["name"] for p in places.values()))
    print(f"Период: {start} - {end}, {args.days} дни; прозорци по 12 ч, завършващи в 06 и 18 UTC")

    obs = observations(set(places), start, end)
    ends = pd.date_range(f"{start} 06:00", f"{end} 18:00", freq="12h")
    obs = obs.reindex(ends)
    have = obs.notna().mean()
    print(f"Измерени 12-часови суми: {int(obs.notna().sum().sum())} от {obs.size}; "
          f"станции без поне половината: "
          + (", ".join(places[s]["name"] for s in have.index if have[s] < 0.5) or "няма"))
    measured_wet = (obs >= WET).sum().sum()
    print(f"Валежни прозорци (>= {WET} mm): {measured_wet}; с {HEAVY:g}+ mm: "
          f"{(obs >= HEAVY).sum().sum()}; общо измерено {obs.sum().sum():.0f} mm")

    frames = {lead: [] for lead in LEADS}
    for sid, place in places.items():
        if sid not in obs or obs[sid].notna().mean() < 0.5:
            continue
        fc = forecasts(place, sid, start, end)
        for lead in LEADS:
            hourly = pd.DataFrame({m: fc[(m, lead)] for m in MODELS.values() if (m, lead) in fc})
            hourly = hourly.loc[:, hourly.notna().any()]
            table = pd.DataFrame(schemes(hourly, lead)).join(hourly)
            sums = windows(table, ends).assign(obs=obs[sid])
            sums.index = pd.MultiIndex.from_product([sums.index, [sid]], names=["end", "station"])
            frames[lead].append(sums)

    RESULTS.mkdir(parents=True, exist_ok=True)
    all_scores, all_diffs, per_station = [], [], []
    for lead in LEADS:
        sample = pd.concat(frames[lead])
        sample = sample.loc[:, sample.notna().any()].dropna()
        names = [c for c in sample.columns if c != "obs"]
        for row in score(sample, names):
            all_scores.append(dict(lead_day=lead, **row))
        for name in names:
            if name == SITE:
                continue
            for metric, loss in LOSSES.items():
                diff, low, high = difference(sample, name, SITE, loss)
                all_diffs.append(dict(lead_day=lead, a=name, b=SITE, metric=metric,
                                      a_minus_b=diff, ci_low=low, ci_high=high, n=len(sample)))
        if lead == 1:
            for sid, part in sample.groupby(level="station"):
                for row in score(part, names):
                    per_station.append(dict(station=places[sid]["name"], **row))

    scores = pd.DataFrame(all_scores)
    diffs = pd.DataFrame(all_diffs)
    order = [SITE, "вариант 1: ICON Global", "вариант 2: медиана", "средно на моделите",
             "средно, по 0.1 mm",
             *MODELS.values()]
    count = scores.groupby("lead_day")["windows"].first()
    print("\nСравнени прозорци (станция × 12 ч), по ден напред: "
          + ", ".join(f"{lead}: {n}" for lead, n in count.items()))
    print("Ден 0 = най-новата прогноза за часа (каквото сайтът показва за \"сега\"); "
          "ден N = прогнозата отпреди N × 24 ч.")
    for metric, title in TITLES.items():
        table = scores.pivot(index="forecast", columns="lead_day", values=metric)
        table = table.reindex([n for n in order if n in table.index])
        print(f"\n  {title}, по ден напред")
        print(textwrap.indent(table.round(2 if metric in ("mae", "bias", "total_ratio") else 1)
                              .to_string(na_rep="-"), "  "))

    print(f"\n  Разлики спрямо \"{SITE}\" (A - сайтът; отрицателно значи, че A е по-добрият), "
          "95% интервал:")
    for _, r in diffs.iterrows():
        if not r.a.startswith(("вариант", "средно")):
            continue
        mark = "" if r.ci_low > 0 or r.ci_high < 0 else "   (в рамките на шума)"
        print(f"  ден {r.lead_day}  {r.a:<24} {r.metric:<9} {r.a_minus_b:+6.2f}  "
              f"[{r.ci_low:+.2f}, {r.ci_high:+.2f}]{mark}")

    stations_table = pd.DataFrame(per_station)
    pivot = stations_table.pivot(index="station", columns="forecast", values="mae")
    print("\n  MAE по станции, ден 1 (mm за 12 ч)")
    print(textwrap.indent(pivot[[n for n in order if n in pivot]].round(2).to_string(), "  "))

    for frame, name in ((scores, "rain_scores"), (diffs, "rain_differences"),
                        (stations_table, "rain_by_station")):
        frame.insert(0, "start", start)
        frame.insert(1, "end", end)
        frame.to_csv(RESULTS / f"{name}.csv", index=False, encoding="utf-8-sig")
    print(f"\nCSV: {RESULTS}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
