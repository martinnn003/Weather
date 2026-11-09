"""How well the forecast models call fog at Bulgaria's weather stations.

Observed fog is what the stations' SYNOP reports, every three hours, say through Ogimet:
visibility under 1 km with nothing falling (fog, not rain or snow thick enough to hide the
view). The station list and the Ogimet download are verify_rain.py's. Forecast fog is a
model's weather code 45 or 48 for the same hour, from Open-Meteo's Previous Runs API, for
each lead day from 0 (the newest run) to 5; visibility under 1 km is scored too, where the
archive keeps it (every model's newest run, and UKMO's at every lead).

    python verification/verify_fog.py [--days 60] [--end YYYY-MM-DD] [--max-elevation 1500]

Fog is rare, so the scores are about the foggy hours alone: of the hours with fog, how many
the forecast caught (POD); of the hours it called fog, how many had none (FAR); the hits over
hits, misses and false alarms together (CSI, 0 to 100, the one number to rank by); and how
often it calls fog against how often there is fog (bias, 1 is right). "±3 h" counts a call
within three hours either side as a hit, since a model that has fog at 06:00 for fog that
came at 05:00 has the morning right. Tables go to verification/results/fog_*.csv.
"""
import argparse
import json
import sys
import textwrap
import time
import urllib.parse
from datetime import date, datetime, timedelta

from pathlib import Path

import numpy as np
import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parent))  # also under python -I
import verify_rain as vr  # noqa: E402

MODELS = vr.MODELS
LEADS = range(0, 6)
VISIBILITY_NOW = ["ecmwf_ifs", "dwd_icon_eu", "ncep_gfs_global", "ukmo_global_deterministic_10km"]
UKMO = "ukmo_global_deterministic_10km"
FOG_CODES = (45, 48)
FOG_KM = 1.0
SITE = "сайтът (ICON Global, от ден 5 ECMWF)"
PLAN = "ICON Global + поне още 1 модел"
BOOTSTRAP = 2000


def visibility_km(vv):
    """SYNOP's VV in km, or None."""
    if not vv.isdigit():
        return None
    n = int(vv)
    if n <= 50:
        return n / 10
    if 56 <= n <= 80:
        return n - 50.0
    if 81 <= n <= 89:
        return 30 + 5 * (n - 80.0)
    return {90: 0.0, 91: 0.05, 92: 0.2, 93: 0.5, 94: 1, 95: 2, 96: 4, 97: 10, 98: 20, 99: 50}.get(n)


def reading(report):
    """(visibility in km, whether something else hides the view) from one SYNOP report."""
    body = report.split("333")[0].replace("=", " ").split()
    if len(body) < 5 or body[0] != "AAXX" or len(body[3]) != 5:
        return None, None
    km = visibility_km(body[3][3:5])
    ix = body[3][1]
    ww = None
    seen = 0
    for group in body[5:]:
        if len(group) != 5 or group[0] < str(seen):
            continue
        seen = int(group[0])
        if group[0] == "7":
            ww = int(group[1:3]) if group[1:3].isdigit() else None
            break
        if group[0] > "7":
            break
    # Whether something other than fog or mist hides the view: rain or snow, or haze, smoke
    # and dust, which are dry and would pass for mist under --fog-km 5.
    if ww is None:
        other = False  # no weather group: nothing of note, or not observed
    elif ix in "4567":
        other = ww >= 40 or ww in (4, 5)  # automatic stations' table: 40 and up all fall
    else:
        other = ww >= 50 or 4 <= ww <= 9
    return km, other


def observations(ids, start, end):
    """Fog (1), none (0) or unknown (NaN) at every station's reports, as UTC hour × station."""
    rows = []
    day = start
    while day <= end + timedelta(days=1):
        last = min(day + timedelta(days=9), end + timedelta(days=1))
        final = last < datetime.utcnow().date()
        for block in vr.BLOCKS:
            query = urllib.parse.urlencode({"block": block, "begin": f"{day:%Y%m%d}0600",
                                            "end": f"{last:%Y%m%d}1800"})
            name = f"ogimet/{block}_{day:%Y%m%d}_{last:%Y%m%d}.txt"
            fresh = not (vr.CACHE / name).exists()
            text = vr.cached(name, f"{vr.OGIMET}?{query}", keep=final).decode("latin-1")
            if fresh:
                time.sleep(3)
            for line in text.splitlines():
                parts = line.split(",", 6)
                if len(parts) < 7 or parts[0] not in ids or parts[5] != "00":
                    continue
                if int(parts[4]) % 3:
                    continue
                km, other = reading(parts[6])
                fog = np.nan if km is None else float(km < FOG_KM and not other)
                stamp = pd.Timestamp(int(parts[1]), int(parts[2]), int(parts[3]), int(parts[4]))
                rows.append((stamp, parts[0], fog))
        day = last + timedelta(days=1)
    frame = pd.DataFrame(rows, columns=["time", "station", "fog"])
    frame = frame.drop_duplicates(["time", "station"], keep="last")
    return frame.pivot(index="time", columns="station", values="fog").astype(float)


def forecasts(station, sid, start, end):
    """Each model's fog calls, hourly and UTC, as columns (name, lead): 1, 0 or NaN."""
    codes = ["weather_code"] + [f"weather_code_previous_day{n}" for n in LEADS if n]
    ukmo = [f"visibility_previous_day{n}" for n in LEADS if n]
    query = urllib.parse.urlencode({
        "latitude": station["lat"], "longitude": station["lon"],
        "hourly": ",".join(codes + ["visibility"] + ukmo), "models": ",".join(MODELS),
        "start_date": start - timedelta(days=1), "end_date": end + timedelta(days=1),
        "timezone": "GMT"})
    final = end < datetime.utcnow().date()  # a past day's forecasts no longer change
    name = f"fog_forecasts/{sid}_{start}_{end}.json"
    fresh = not (vr.CACHE / name).exists()
    hourly = json.loads(vr.cached(name, f"{vr.PREVIOUS_RUNS}?{query}", keep=final))["hourly"]
    if fresh:
        print(f"  свалено: {station['name']}", flush=True)
        time.sleep(1)
    index = pd.to_datetime(hourly["time"])
    series = lambda key: pd.Series(hourly.get(key), index=index, dtype=float)
    columns = {}
    for model, label in MODELS.items():
        for lead, variable in zip(LEADS, codes):
            values = series(f"{variable}_{model}")
            if values.notna().any():
                columns[(f"{label}: код", lead)] = values.isin(FOG_CODES).astype(float).where(values.notna())
        visibility = {0: f"visibility_{model}"}
        if model == UKMO:
            visibility.update({lead: f"{v}_{model}" for lead, v in zip(LEADS[1:], ukmo)})
        for lead, key in visibility.items():
            values = series(key)
            if values.notna().any():
                columns[(f"{label}: видимост", lead)] = (values < FOG_KM * 1000).astype(float).where(values.notna())
    return pd.DataFrame(columns)


def candidates(fc, lead):
    """The forecasts for one lead day, and the site's own and a few that might replace it."""
    table = {name: fc[(name, l)] for name, l in fc.columns if l == lead}
    site_model = "ICON Global: код" if lead <= 4 else "ECMWF IFS: код"
    if site_model in table:
        table[SITE] = table[site_model]
    if "ICON Global: код" in table:
        icon = table["ICON Global: код"]
        rest = pd.DataFrame({k: v for k, v in table.items() if k.endswith(": код")
                             and k not in (SITE, "ICON Global: код")})
        if rest.shape[1] >= 3:
            backed = (rest.sum(axis=1) >= 1).astype(float).where(rest.notna().sum(axis=1) >= 3)
            table[PLAN] = (icon * backed).where(icon.notna() & backed.notna())
    calls = pd.DataFrame({k: v for k, v in table.items() if k.endswith(": код") and k != SITE})
    if calls.shape[1] >= 4:
        counted = calls.sum(axis=1).where(calls.notna().sum(axis=1) >= 4)
        table["2+ модела с код мъгла"] = (counted >= 2).astype(float).where(counted.notna())
        table["3+ модела с код мъгла"] = (counted >= 3).astype(float).where(counted.notna())
    return pd.DataFrame(table)


def spread(calls):
    """A call at any hour within three hours either side."""
    return calls.rolling(7, center=True, min_periods=1).max()


def scores(o, f, f_near, o_near):
    hits = ((f == 1) & (o == 1)).sum()
    misses = ((f == 0) & (o == 1)).sum()
    false = ((f == 1) & (o == 0)).sum()
    near_hits = ((f_near == 1) & (o == 1)).sum()
    near_false = ((f == 1) & (o_near == 0)).sum()
    observed, called = hits + misses, hits + false
    ratio = lambda a, b: a / b * 100 if b else np.nan
    return dict(observed=observed, called=called, hits=hits,
                pod=ratio(hits, observed), far=ratio(false, called),
                csi=ratio(hits, hits + misses + false), bias=called / observed if observed else np.nan,
                pod_3h=ratio(near_hits, observed), far_3h=ratio(near_false, called),
                csi_3h=ratio(near_hits, observed + near_false))


def csi_difference(sample, a, b, seed=1):
    """`a`'s CSI minus `b`'s, with a 95% interval from resampling whole days."""
    days = sample.index.get_level_values("time").normalize()
    parts = []
    for name in (a, b):
        f, o = sample[name], sample["obs"]
        parts.append(pd.DataFrame({"hit": (f == 1) & (o == 1), "miss": (f == 0) & (o == 1),
                                   "false": (f == 1) & (o == 0)}).groupby(days).sum())
    per = pd.concat(parts, axis=1, keys=["a", "b"]).fillna(0)
    rng = np.random.default_rng(seed)
    pick = rng.integers(0, len(per), (BOOTSTRAP, len(per)))

    def csi(frame):
        v = frame.to_numpy()[pick].sum(axis=1)
        return v[:, 0] / np.maximum(v.sum(axis=1), 1) * 100

    drawn = csi(per["a"]) - csi(per["b"])
    whole = lambda x: x["hit"].sum() / max(x.to_numpy().sum(), 1) * 100
    low, high = np.percentile(drawn, [2.5, 97.5])
    return whole(per["a"]) - whole(per["b"]), low, high


TITLES = {"csi": "CSI, 0-100 (по-високо е по-добре)",
          "pod": "% от часовете с мъгла, в които прогнозата е дала мъгла",
          "far": "% от прогнозите за мъгла, при които мъгла не е имало",
          "bias": "колко пъти дава мъгла / колко пъти я има (1 е вярно)",
          "csi_3h": "CSI, с допуск ±3 ч",
          "pod_3h": "% от часовете с мъгла, хванати до 3 ч преди или след",
          "far_3h": "% от прогнозите за мъгла без мъгла в рамките на ±3 ч"}


def main():
    parser = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    parser.add_argument("--days", type=int, default=60)
    parser.add_argument("--end", type=date.fromisoformat, help="the last day; yesterday if not given")
    parser.add_argument("--max-elevation", type=int, default=1500)
    parser.add_argument("--fog-km", type=float, default=1.0,
                        help="what counts as fog: 1 km, fog proper; 5 km, mist as well")
    args = parser.parse_args()
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    global FOG_KM
    FOG_KM = args.fog_km
    suffix = "" if FOG_KM == 1 else f"_{FOG_KM:g}km"

    end = args.end or datetime.utcnow().date() - timedelta(days=1)
    start = end - timedelta(days=args.days - 1)
    places = vr.stations(args.max_elevation)
    obs = observations(set(places), start, end)
    times = pd.date_range(start, end + timedelta(days=1), freq="3h", inclusive="left")
    obs = obs.reindex(times)
    print(f"Станции: {obs.notna().any().sum()} с наблюдения; период {start} - {end}, наблюдения на 3 ч")
    print(f"Наблюдения: {int(obs.notna().sum().sum())}; с мъгла (видимост < {FOG_KM:g} км, без валеж и сухи мътилки): "
          f"{int((obs == 1).sum().sum())}")
    local = obs.copy()
    local.index = local.index.tz_localize("UTC").tz_convert("Europe/Sofia").hour
    by_hour = (local == 1).groupby(level=0).sum().sum(axis=1)
    print("Мъгла по местен час: " + ", ".join(f"{h:02d}: {n}" for h, n in by_hour.items()))

    frames = {lead: [] for lead in LEADS}
    for sid, place in places.items():
        if sid not in obs or obs[sid].notna().mean() < 0.3:
            continue
        fc = forecasts(place, sid, start, end)
        o_near = obs[sid].reindex(fc.index)  # every hour, the reports only at theirs
        o_near = o_near.rolling(7, center=True, min_periods=1).max().where(
            o_near.rolling(7, center=True, min_periods=1).count() > 0)
        for lead in LEADS:
            table = candidates(fc, lead)
            near = spread(table)
            part = table.reindex(times).add_suffix("")
            part = part.assign(obs=obs[sid])
            for name in table.columns:
                part[f"{name}~"] = near[name].reindex(times)
            part["obs~"] = o_near.reindex(times)
            part.index = pd.MultiIndex.from_product([part.index, [sid]], names=["time", "station"])
            frames[lead].append(part)

    rows, diffs = [], []
    for lead in LEADS:
        sample = pd.concat(frames[lead])
        names = [c for c in sample.columns if not c.endswith("~") and c != "obs"]
        for name in names:
            s = sample[[name, f"{name}~", "obs", "obs~"]].dropna(subset=[name, "obs"])
            if not len(s):
                continue
            rows.append(dict(lead_day=lead, forecast=name, hours=len(s),
                             **scores(s["obs"], s[name], s[f"{name}~"], s["obs~"])))
        for name in names:
            if name == SITE or name not in sample:
                continue
            s = sample[[name, SITE, "obs"]].dropna()
            if len(s) and (s["obs"] == 1).sum():
                diff, low, high = csi_difference(s, name, SITE)
                diffs.append(dict(lead_day=lead, a=name, b=SITE, csi_a_minus_b=diff,
                                  ci_low=low, ci_high=high, n=len(s)))

    table = pd.DataFrame(rows)
    differences = pd.DataFrame(diffs)
    order = [SITE, PLAN, "2+ модела с код мъгла", "3+ модела с код мъгла",
             *[f"{m}: код" for m in MODELS.values()], *[f"{m}: видимост" for m in MODELS.values()]]
    print("\nДен 0 = най-новата прогноза за часа; ден N = прогнозата отпреди N × 24 ч.")
    print("Брой часове с мъгла / с прогноза за мъгла, ден 1: " + ", ".join(
        f"{r.forecast} {int(r.called)}" for r in table[table.lead_day == 1].itertuples())
        + f"; измерени {int(table[table.lead_day == 1].observed.max())}")
    for metric, title in TITLES.items():
        pivot = table.pivot(index="forecast", columns="lead_day", values=metric)
        pivot = pivot.reindex([n for n in order if n in pivot.index])
        print(f"\n  {title}, по ден напред")
        print(textwrap.indent(pivot.round(2 if metric == "bias" else 1).to_string(na_rep="-"), "  "))
    print(f"\n  CSI спрямо \"{SITE}\" (A - сайтът; положително значи, че A е по-добрият), 95% интервал:")
    for r in differences.itertuples():
        mark = "" if r.ci_low > 0 or r.ci_high < 0 else "   (в рамките на шума)"
        print(f"  ден {r.lead_day}  {r.a:<32} {r.csi_a_minus_b:+6.1f}  [{r.ci_low:+.1f}, {r.ci_high:+.1f}]{mark}")

    vr.RESULTS.mkdir(parents=True, exist_ok=True)
    for frame, name in ((table, f"fog_scores{suffix}"), (differences, f"fog_differences{suffix}")):
        frame.insert(0, "start", start)
        frame.insert(1, "end", end)
        frame.to_csv(vr.RESULTS / f"{name}.csv", index=False, encoding="utf-8-sig")
    print(f"\nCSV: {vr.RESULTS}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
