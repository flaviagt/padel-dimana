# utils/agent.py
import os
import openai
import json

# Use OPENAI_API_KEY from environment variables
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
if OPENAI_API_KEY:
    openai.api_key = OPENAI_API_KEY

def analyze_slots_with_ai(prompt, all_slots):
    """
    Uses GPT to analyze slot data based on user intent (e.g., cheapest, earliest, 2hr block).
    Returns a dict {"result": [...]} or {"error": "...", "result": []}
    """
    system_prompt = """
    You are a scheduling assistant for padel courts. Based only on the provided availability data and user request, give clear and logical suggestions. Each slot is 1 hour long.
    Only use data provided. If user asks to book or asks things like "how to play padel?" or "where is best court?" return only [].

    You're capable of evaluating things like:
    - when is the earliest available slot that fits user constraints
    - cheapest slots this week
    - back-to-back durations (e.g. 2 or 3 hours), find start times that is n:00 and n+1:00 

    NEVER INVENT DATA. If no valid option is found, return blank.

    Return **only** a valid JSON list of slot objects like:
    [{"court": "Court 1", "venue": "Casablanca", "date": "2025-07-20", "start": "18:00", "price": 250000}]

    If nothing matches, return []
    """

    try:
        # Build messages
        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": f"User Prompt: {prompt}\n\nAvailable Data: {json.dumps(all_slots)}"}
        ]

        # Use ChatCompletion (OpenAI python package). Adjust model if needed.
        response = openai.ChatCompletion.create(
            model="gpt-4o-mini",
            messages=messages,
            temperature=0.2,
            max_tokens=800
        )

        content = response.choices[0].message['content'].strip()
        # Extract JSON array from response
        json_start = content.find("[")
        json_end = content.rfind("]") + 1
        if json_start == -1 or json_end == -1:
            raise ValueError("No JSON list found in GPT response.")

        json_str = content[json_start:json_end]
        parsed = json.loads(json_str)
        return {"result": parsed}

    except Exception as e:
        print(f"[Agent Error] {e}")
        return {"error": str(e), "result": []}
