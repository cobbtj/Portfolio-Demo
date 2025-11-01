# backend/nyc_api.py

import os
import requests
import pandas as pd
from typing import List, Dict
from datetime import datetime, timedelta

BOROUGH_MAP = {
    "1": "Manhattan",
    "2": "Bronx",
    "3": "Brooklyn",
    "4": "Queens",
    "5": "Staten Island",
}
borough_map_reverse = {v: k for k, v in BOROUGH_MAP.items()}

class NYCSalesApi:
    BASE_URL = "https://data.cityofnewyork.us/resource"
    DATASET_ID = os.getenv("NYC_SALES_DATASET_ID", "usep-8jbt")

    def __init__(self):
        self.session = requests.Session()
        self.session.headers.update({"User-Agent": "NYC-Sales-Dashboard/1.0"})
    
    
    def get_neighborhood_breakdown(self, borough: str, months: int = 12):
        cutoff_dt = datetime.now() - timedelta(days=30 * months)

        url = f"{self.BASE_URL}/{self.DATASET_ID}.json"
        params = {
            "$select": "neighborhood, sale_price, sale_date",
            "$where": f"sale_price > 0 AND borough='{borough_map_reverse.get(borough)}'",
            "$limit": 20000  # neighborhoods usually smaller volume — no pagination needed here
        }

        resp = self.session.get(url, params=params, timeout=30)
        resp.raise_for_status()
        rows = resp.json()
        if not rows:
            return []

        filtered = []
        for r in rows:
            raw_date = r.get("sale_date")
            if not raw_date:
                continue
            try:
                sale_dt = datetime.fromisoformat(raw_date.replace("Z", ""))
            except:
                continue
            if sale_dt < cutoff_dt:
                continue

            price_raw = r.get("sale_price")
            if not price_raw or price_raw == "0":
                continue
            try:
                price = float(price_raw)
            except:
                continue

            nhood = r.get("neighborhood") or "Unknown"
            filtered.append({"neighborhood": nhood, "sale_price": price})

        if not filtered:
            return []

        df = pd.DataFrame(filtered)
        agg = (
            df.groupby("neighborhood")["sale_price"]
            .agg(median_value="median", avg_value="mean", count="count")
            .round(2)
            .reset_index()
            .sort_values("median_value", ascending=False)
        )

        return agg.to_dict("records")



    def get_recent_sales_by_borough(self, months: int = 12, pages: int = 5) -> List[Dict]:
        cutoff_dt = datetime.now() - timedelta(days=30 * months)

        collected = []
        step = 20000

        for i in range(pages):
            offset = i * step
            url = f"{self.BASE_URL}/{self.DATASET_ID}.json"
            params = {
                "$select": "borough, sale_price, sale_date",
                "$where": "sale_price > 0",
                "$limit": step,
                "$offset": offset
            }

            resp = self.session.get(url, params=params, timeout=30)
            resp.raise_for_status()
            rows = resp.json()
            if not rows:
                break  # no more pages

            page_filtered = []
            for r in rows:
                raw_date = r.get("sale_date")
                if not raw_date:
                    continue
                try:
                    sale_dt = datetime.fromisoformat(raw_date.replace("Z", ""))
                except Exception:
                    continue

                # STRICT cutoff
                if sale_dt < cutoff_dt:
                    continue

                price_raw = r.get("sale_price")
                if not price_raw or price_raw == "0":
                    continue

                try:
                    price = float(price_raw)
                except Exception:
                    continue

                code = str(r.get("borough"))
                name = BOROUGH_MAP.get(code, code)
                page_filtered.append({
                    "borough": name,
                    "sale_price": price
                })

            # CHECK-ALL rule: if entire page had no valid rows, we stop
            if not page_filtered:
                break

            collected.extend(page_filtered)

        if not collected:
            return []

        df = pd.DataFrame(collected)
        agg = (
            df.groupby("borough")["sale_price"]
            .agg(median_value="median", avg_value="mean", count="count")
            .round(2)
            .reset_index()
            .sort_values("median_value", ascending=False)
        )

        result = agg.to_dict("records")
        if result:
            result[0]["last_updated"] = datetime.now().isoformat()
        return result



# Global instance (name matches import in main.py)
nyc_api = NYCSalesApi()
