"""Gemini explanations only (never numbers). Template fallback labelled in Demo Mode."""
from __future__ import annotations
import os

def explain(store_id, sku, prod, forecast, risk, primary, options) -> str:
    key = os.getenv("GEMINI_API_KEY","")
    template = (
        f"{prod.get('name', sku)} at {store_id}: {risk['reason']} "
        f"Forecast ~{sum(forecast['forecast_mean'][:7]):.0f} units /7d (80% interval shown). "
        f"Recommended: {primary['action']} x{primary.get('quantity', 0)} — {primary.get('detail', '')} "
        f"(lowest expected loss ${primary.get('expected_loss', 0):.2f} among {len(options)} feasible options)."
    )
    if not key:
        return template
    try:
        import httpx
        model = os.getenv("GEMINI_MODEL","gemini-1.5-flash")
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={key}"
        prompt = ("Summarize for a grocery planner in 3 sentences, no new numbers, from: "+template)
        r = httpx.post(url, json={"contents":[{"parts":[{"text":prompt}]}]}, timeout=15)
        if r.status_code==200:
            txt = r.json()["candidates"][0]["content"]["parts"][0]["text"]
            return txt + " [Gemini explanation; numbers from engine]"
        return template + f" [Gemini fallback: HTTP {r.status_code}]"
    except Exception as e:
        return template + f" [Gemini unavailable: {e}]"
