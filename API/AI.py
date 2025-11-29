# api/ai.py
from utils.agent import analyze_slots_with_ai
import json

def handler(request):
    try:
        body = request.get("body") or {}
        # If body is a JSON string, try to parse it
        if isinstance(body, str):
            try:
                body = json.loads(body)
            except:
                body = {}

        prompt = body.get("prompt")
        slots = body.get("slots", [])

        if not prompt:
            return {"statusCode": 400, "body": json.dumps({"error": "missing prompt"})}

        result = analyze_slots_with_ai(prompt, slots)

        return {
            "statusCode": 200,
            "headers": {"Content-Type": "application/json"},
            "body": json.dumps(result)
        }

    except Exception as e:
        print("AI handler error:", e)
        return {"statusCode": 500, "body": json.dumps({"error": str(e)})}
