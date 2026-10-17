"""How close each forecast model came to what was measured in Sofia.

Observations are Meteostat's (data.meteostat.net, no key), from the station nearest the
city centre, and only the values it marks as measured; forecasts are Open-Meteo's
Previous Runs API, asked for that station's coordinates and height. Every model is scored
for each lead day from 1 to 7 on the same hours (temperature) or days (precipitation) as
every other model that reaches that day, and so are the site's old and new schemes.

    python verification/verify_models.py [--days 60] [--end YYYY-MM-DD]

The tables are printed and written to verification/results/. A variable whose measured
values cover less than MIN_COVERAGE of the period is not scored, and the script then
says why and exits with 2.
"""
import argparse
import io
import json
import math
import sqlite3
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

CENTRE = (42.6977, 23.3219)  # Sofia, Sveta Nedelya Square

# Meteostat fills the hours it has no measurement for with model output, and names the
# provider of every value in a `<column>_source` column. Only these providers measure;
# any other, the forecasts dwd_mosmix and metno_forecast or one this list does not know,
# is left out, so a provider missing here can only cost data, never let a model in.
MEASURED = {"metar", "dwd_poi", "dwd_hourly", "isd_lite", "eccc_hourly", "gsa_hourly",
            "zamg_hourly"}
MIN_COVERAGE = 0.8

PREVIOUS_RUNS = "https://previous-runs-api.open-meteo.com/v1/forecast"
# The ids as Open-Meteo's documentation spells them, and how the tables name them.
MODELS = {"dwd_icon_eu": "ICON-EU", "dwd_icon_global": "ICON Global",
          "ecmwf_ifs": "ECMWF IFS", "ncep_gfs_global": "GFS"}
# `_previous_dayN` is the value forecast N × 24 hours before the hour it is for.
LEADS = range(1, 8)
WET = 0.2  # mm: a day with this much or more is a wet one
TZ = "Europe/Sofia"  # whose days the daily sums are
BOOTSTRAP = 2000


# The site's two schemes, as each model's weight per lead day. The old one was
# Open-Meteo's default here: ICON-EU as far as it reaches, ICON Global after it. The new
# one (src/merge.js) slides temperature from ICON-EU into ECMWF over hours 96-120 counted
# from local midnight, which a day-4 forecast falls inside of whichever run it came from,
# halfway on average; its rain is ECMWF's throughout.
def old_scheme(lead):
    return {"dwd_icon_eu": 1} if lead <= 4 else {"dwd_icon_global": 1}


def new_temperature(lead):
    if lead <= 3:
        return {"dwd_icon_eu": 1}
    return {"dwd_icon_eu": 0.5, "ecmwf_ifs": 0.5} if lead == 4 else {"ecmwf_ifs": 1}


def new_precipitation(lead):
    return {"ecmwf_ifs": 1}


def fetch(url, attempts=4):
    """The body at `url`, asked again a few times after a server's passing failure."""
    request = urllib.request.Request(url, headers={"User-Agent": "ClaudeWeather verification"})
    for attempt in range(attempts):
        try:
            with urllib.request.urlopen(request, timeout=180) as response:
                return response.read()
        except urllib.error.HTTPError as error:
            if error.code < 500 or attempt == attempts - 1:
                raise
        except OSError:  # no answer at all: refused, reset or timed out
            if attempt == attempts - 1:
                raise
        time.sleep(5 * 2 ** attempt)


def km(a, b):
    (lat1, lon1), (lat2, lon2) = ([math.radians(x) for x in p] for p in (a, b))
    h = (math.sin((lat2 - lat1) / 2) ** 2
         + math.cos(lat1) * math.cos(lat2) * math.sin((lon2 - lon1) / 2) ** 2)
    return 2 * 6371 * math.asin(math.sqrt(h))


def station_db():
    """Meteostat's station database, 30 MB, downloaded again once it is a month old."""
    path = CACHE / "stations.db"
    if not path.exists() or time.time() - path.stat().st_mtime > 30 * 86400:
        CACHE.mkdir(parents=True, exist_ok=True)
        part = path.with_suffix(".part")
        part.write_bytes(fetch("https://data.meteostat.net/stations.db"))
        part.replace(path)
    return path


def nearest_station(db_file, start):
    """The station nearest the centre whose measured temperature reaches into the period."""
    db = sqlite3.connect(db_file)
    marks = ",".join("?" * len(MEASURED))
    rows = db.execute(f"""
        select s.id, coalesce(n.name, s.id), s.latitude, s.longitude, s.elevation
        from stations s left join names n on n.station = s.id and n.language = 'en'
        where s.latitude is not null and s.id in (
          select station from inventory
          where parameter = 'temp' and provider in ({marks}) and "end" >= ?)""",
        [*MEASURED, start.isoformat()]).fetchall()
    db.close()
    stations = [dict(id=i, name=name, lat=lat, lon=lon, elevation=elevation,
                     km=km(CENTRE, (lat, lon))) for i, name, lat, lon, elevation in rows]
    return min(stations, key=lambda s: s["km"])


def observations(station, hours):
    """The station's hourly record on `hours`, which are UTC, as Meteostat keeps them."""
    frames = [pd.read_csv(io.BytesIO(fetch(f"https://data.meteostat.net/hourly/{year}/{station}.csv.gz")),
                          compression="gzip")
              for year in sorted(set(hours.year))]
    record = pd.concat(frames)
    record.index = pd.to_datetime(record[["year", "month", "day", "hour"]])
    return record[~record.index.duplicated()].reindex(hours)


def measured(record, column):
    """The column's measured values; the model's fill-ins and the gaps are NaN."""
    return record[column].where(record[f"{column}_source"].isin(MEASURED))


def forecasts(variable, station, start, end):
    """Every model's forecast of `variable` for every lead day, as columns (model, lead)."""
    query = urllib.parse.urlencode({
        "latitude": station["lat"], "longitude": station["lon"],
        "elevation": station["elevation"],
        "hourly": ",".join(f"{variable}_previous_day{lead}" for lead in LEADS),
        "models": ",".join(MODELS), "start_date": start, "end_date": end, "timezone": "GMT"})
    hourly = json.loads(fetch(f"{PREVIOUS_RUNS}?{query}"))["hourly"]
    index = pd.to_datetime(hourly["time"])
    return pd.DataFrame({
        (model, lead): pd.Series(hourly.get(f"{variable}_previous_day{lead}_{model}"),
                                 index=index, dtype=float)
        for model in MODELS for lead in LEADS})


def candidates(fc, lead, schemes):
    """The models that forecast this lead day at all, and the schemes made of them."""
    there = [m for m in MODELS if fc[(m, lead)].notna().any()]
    table = {MODELS[m]: fc[(m, lead)] for m in there}
    for name, weights in schemes.items():
        mix = weights(lead)
        if set(mix) <= set(there):
            table[name] = sum(w * fc[(m, lead)] for m, w in mix.items())
    return pd.DataFrame(table)


def daily(hourly):
    """Local-day sums, a day counted only with every one of its hours there. An hour's sum
    is of the hour before its time, so it is dated by the hour it began."""
    local = hourly.copy()
    local.index = (hourly.index - pd.Timedelta(hours=1)).tz_localize("UTC").tz_convert(TZ)
    days = local.groupby(local.index.date)
    sums = days.sum().where(days.count().eq(days.size(), axis=0))
    sums.index = pd.to_datetime(sums.index)
    return sums.iloc[1:-1]  # the first and last local days stick out of the UTC period


def score_temperature(obs, fc, schemes):
    rows, samples = [], {}
    for lead in LEADS:
        table = candidates(fc, lead, schemes)
        sample = table.assign(obs=obs).dropna()
        samples[lead] = sample
        for name in table.columns:
            error = sample[name] - sample["obs"]
            rows.append(dict(lead_day=lead, forecast=name, hours=len(sample),
                             days=sample.index.normalize().nunique(),
                             mae=error.abs().mean(), bias=error.mean()))
    losses = {"mae": lambda f, o: (f - o).abs()}
    return pd.DataFrame(rows), samples, losses


def score_precipitation(obs, fc, schemes):
    rows, samples = [], {}
    for lead in LEADS:
        table = candidates(fc, lead, schemes)
        sample = daily(table.assign(obs=obs)).dropna()
        samples[lead] = sample
        for name in table.columns:
            f, o = sample[name], sample["obs"]
            rows.append(dict(lead_day=lead, forecast=name, days=len(sample),
                             hit_rate=((f >= WET) == (o >= WET)).mean() * 100,
                             mae=(f - o).abs().mean(), bias=(f - o).mean()))
    # Misses rather than hits, so that for both measures less is better.
    losses = {"mae": lambda f, o: (f - o).abs(),
              "miss_rate": lambda f, o: ((f >= WET) != (o >= WET)) * 100.0}
    return pd.DataFrame(rows), samples, losses


def difference(sample, a, b, loss, seed=1):
    """`a`'s mean loss minus `b`'s on the same sample, with a 95% interval from resampling
    whole days, since a day's hours err together rather than one by one."""
    d = loss(sample[a], sample["obs"]) - loss(sample[b], sample["obs"])
    per_day = d.groupby(d.index.date).agg(["sum", "count"]).to_numpy()
    pick = np.random.default_rng(seed).integers(0, len(per_day), (BOOTSTRAP, len(per_day)))
    drawn = per_day[pick]
    low, high = np.percentile(drawn[..., 0].sum(1) / drawn[..., 1].sum(1), [2.5, 97.5])
    return d.mean(), low, high


def pairs(schemes):
    """What each of the three questions compares, by lead day: (question, lead, a, b)."""
    new, old = schemes["нова схема"], schemes["стара схема"]
    for lead in LEADS:
        if new(lead) != old(lead):
            yield "1 смяната", lead, "нова схема", "стара схема"
    for lead in LEADS:
        yield "2 само GFS", lead, "GFS", "нова схема"
    for lead in LEADS:
        yield "3 шевът", lead, "ECMWF IFS", "ICON-EU"


def compare(samples, losses, schemes):
    rows = []
    for question, lead, a, b in pairs(schemes):
        sample = samples[lead]
        if a not in sample or b not in sample:
            continue
        for metric, loss in losses.items():
            diff, low, high = difference(sample, a, b, loss)
            rows.append(dict(question=question, lead_day=lead, a=a, b=b, metric=metric,
                             a_minus_b=diff, ci_low=low, ci_high=high, n=len(sample)))
    return pd.DataFrame(rows)


VARIABLES = {
    "temperature_2m": dict(column="temp", title="Температура, почасово, °C", unit="°C",
                           score=score_temperature, metrics=["mae", "bias"], count="hours",
                           schemes={"стара схема": old_scheme, "нова схема": new_temperature}),
    "precipitation": dict(column="prcp", title="Валеж, дневни суми, mm", unit="mm",
                          score=score_precipitation, metrics=["hit_rate", "mae", "bias"],
                          count="days",
                          schemes={"стара схема": old_scheme, "нова схема": new_precipitation}),
}
METRIC_TITLES = {"mae": "MAE (средна абсолютна грешка)",
                 "bias": "bias (прогноза - измерено; + значи твърде високо)",
                 "hit_rate": f"% познати дни вали/не вали (праг {WET} mm)"}


def by_lead(scores, value, order):
    table = scores.pivot(index="forecast", columns="lead_day", values=value)
    return table.reindex([name for name in order if name in table.index])


def report(spec, scores, comparisons):
    order = [*MODELS.values(), *spec["schemes"]]
    count = scores.groupby("lead_day")[spec["count"]].first()
    unit = "часа" if spec["count"] == "hours" else "дни"
    print(f"  Сравнени {unit}, по ден напред: "
          + ", ".join(f"{lead}: {n}" for lead, n in count.items()))
    for metric in spec["metrics"]:
        print(f"\n  {METRIC_TITLES[metric]}, по ден напред")
        table = by_lead(scores, metric, order).round(1 if metric == "hit_rate" else 2)
        print(textwrap.indent(table.to_string(na_rep="-"), "  "))
    print("\n  Разлики (A - B; отрицателно значи, че A е по-добрият), 95% интервал по дни:")
    for _, r in comparisons.iterrows():
        mark = "" if r.ci_low > 0 or r.ci_high < 0 else "   (в рамките на шума)"
        print(f"  въпрос {r.question:<10} ден {r.lead_day}  {r.a:>10} - {r.b:<11} "
              f"{r.metric:<9} {r.a_minus_b:+6.2f}  [{r.ci_low:+.2f}, {r.ci_high:+.2f}]{mark}")


def main():
    parser = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    parser.add_argument("--days", type=int, default=60)
    parser.add_argument("--end", type=date.fromisoformat,
                        help="the last day, UTC; yesterday if not given")
    args = parser.parse_args()
    sys.stdout.reconfigure(errors="replace")

    end = args.end or datetime.utcnow().date() - timedelta(days=1)
    start = end - timedelta(days=args.days - 1)
    hours = pd.date_range(start, end + timedelta(days=1), freq="h", inclusive="left")

    station = nearest_station(station_db(), start)
    print(f"Станция: Meteostat {station['id']} ({station['name']}), "
          f"{station['lat']:.4f} N {station['lon']:.4f} E, {station['elevation']} m, "
          f"{station['km']:.1f} km от центъра")
    print(f"Период: {start} - {end}, {args.days} дни, {len(hours)} часа (UTC)")
    record = observations(station["id"], hours)
    RESULTS.mkdir(parents=True, exist_ok=True)

    stopped = []
    for variable, spec in VARIABLES.items():
        column = spec["column"]
        obs = measured(record, column)
        coverage = obs.notna().mean()
        origins = record[f"{column}_source"].fillna("няма").value_counts()
        print(f"\n== {spec['title']}")
        print(f"  Реално измерени: {obs.notna().sum()} от {len(obs)} часа ({coverage:.1%}); "
              "източници: " + ", ".join(f"{k} {v}" for k, v in origins.items()))
        if coverage < MIN_COVERAGE:
            print(f"  СПРЯНО: под {MIN_COVERAGE:.0%} реални наблюдения, "
                  "моделите не се оценяват по тази величина.")
            stopped.append(variable)
            continue

        fc = forecasts(variable, station, start, end)
        print("  Дни с прогноза, по модел и ден напред:")
        days_with = fc.notna().groupby(fc.index.date).any().sum().unstack()
        days_with.index = [MODELS[m] for m in days_with.index]
        print(textwrap.indent(days_with.to_string(), "    "))

        scores, samples, losses = spec["score"](obs, fc, spec["schemes"])
        comparisons = compare(samples, losses, spec["schemes"])
        report(spec, scores, comparisons)
        scores.insert(0, "station", station["id"])
        scores.insert(1, "start", start)
        scores.insert(2, "end", end)
        scores.to_csv(RESULTS / f"{variable}.csv", index=False, encoding="utf-8-sig")
        comparisons.to_csv(RESULTS / f"{variable}_differences.csv", index=False,
                           encoding="utf-8-sig")

    print(f"\nCSV: {RESULTS}")
    if stopped:
        print("Не са оценени поради липса на реални наблюдения: " + ", ".join(stopped))
        return 2
    return 0


if __name__ == "__main__":
    sys.exit(main())
