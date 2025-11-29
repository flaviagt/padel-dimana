# api/availability.py
# Vercel serverless handler pattern: def handler(request)
# request is a dict-like object with 'method', 'query', 'body'

from utils.AYO_utils import get_availibility_ayo
from datetime import datetime, timedelta
import json

def handler(request):
    try:
        query = request.get("query", {}) or {}
        # Expect query params: locations (comma separated), start, end, earliest, latest
        locations = query.get("locations") or query.get("location") or ""
        start = query.get("start")
        end = query.get("end")
        earliest = query.get("earliest")
        latest = query.get("latest")

        if not locations or not start or not end:
            return {"statusCode": 400, "body": json.dumps({"error": "missing parameters"})}

        # Parse dates (YYYY-MM-DD)
        start_date = datetime.fromisoformat(start).date()
        end_date = datetime.fromisoformat(end).date()

        # Safety: don't allow > 28 days per request in serverless
        if (end_date - start_date).days > 28:
            return {"statusCode": 400, "body": json.dumps({"error": "max range is 28 days"})}

        all_slots = []
        for loc in [l.strip() for l in locations.split(",") if l.strip()]:
            slots = get_availibility_ayo(loc, start_date, end_date, earliest, latest)
            all_slots.extend(slots)

        return {
            "statusCode": 200,
            "headers": {"Content-Type": "application/json"},
            "body": json.dumps({"slots": all_slots})
        }

    except Exception as e:
        print("Availability error:", e)
        return {"statusCode": 500, "body": json.dumps({"error": str(e)})}
