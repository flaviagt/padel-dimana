# utils/AYO_utils.py
import requests
from datetime import datetime, time, timedelta

import os

# Use environment variables (set these in Vercel)
ayo_url = os.getenv("AYO_URL")

venues = {
    "Casablanca": {
        "venue_id": os.getenv("CASABLANCA_ID"),
        "courts": ["Court 1", "Court 2", "Premier Court 3", "Premier Court 4"]
    },
    "The Six Point Club": {
        "venue_id": os.getenv("TSPC_ID"),
        "courts": ["Mazda Court", "Sierra Court", "Fhundred Court"]
    },
    "Padel Co.": {
        "venue_id": os.getenv("PADELCO_ID"),
        "courts": ["Pink Court 1", "Blue Court 2", "Blue Court 3", "Blue Court 4"]
    },
    "BDG Padel Club": {
        "venue_id": os.getenv("BPC_ID"),
        "courts": ["Bela Court", "Diaz Court"]
    },
    "Papadelulu": {
        "venue_id": os.getenv("PAPADELULU_ID"),
        "courts": ["Court 1", "Court 2"]
    },
    "Padel Up" :{
        "venue_id": os.getenv("PADELUP_ID"),
        "courts": ["Lapang A", "Lapang B", "Lapang C", "Lapang D"]
    },
    "Court 45" : {
        "venue_id": os.getenv("COURT45_ID"),
        "courts": ["The Court 45"]
    }
}

def is_time_in_range(slot_start, user_earliest, user_latest):
    slot_time = datetime.strptime(slot_start, "%H:%M:%S").time()
    earliest = datetime.strptime(user_earliest, "%H:%M").time() if user_earliest else time(0, 0)
    latest = datetime.strptime(user_latest, "%H:%M").time() if user_latest else time(23, 59)
    return earliest <= slot_time <= latest

def get_availibility_ayo(location, start_date, end_date, earliest_hour=None, latest_hour=None):
    """
    Returns a flat list of available slots with filtering.
    Each entry includes: date, venue, court, start, end, price.
    """
    if location not in venues:
        raise ValueError(f"Unknown location: {location}")

    court_dict = venues[location]
    venue_id = court_dict["venue_id"]

    flat_results = []

    date_cursor = start_date
    while date_cursor <= end_date:
        try:
            response = requests.get(
                ayo_url,
                params={"venue_id": venue_id, "date": date_cursor.isoformat()},
                timeout=10
            )
            response.raise_for_status()
            data = response.json()

            for field in data.get("fields", []):
                court_name = field.get("field_name")
                total_avail = field.get("total_available_slots", 0)
                if court_name in court_dict["courts"] and total_avail > 0:
                    for slot in field.get("slots", []):
                        if slot.get("is_available") and is_time_in_range(slot["start_time"], earliest_hour, latest_hour) and total_avail > 0:
                            flat_results.append({
                                "date": slot["date"],
                                "venue": location,
                                "court": court_name,
                                "start": slot["start_time"],
                                "end": slot["end_time"],
                                "price": slot.get("price", 0)
                            })
                            total_avail -= 1

        except Exception as e:
            # Logging is recommended; in serverless print goes to function logs
            print(f"❌ Error fetching data for {location} on {date_cursor}: {e}")

        date_cursor += timedelta(days=1)

    return flat_results
