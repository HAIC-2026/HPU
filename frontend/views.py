
import json
import os
import logging

from django.shortcuts import render
from django.http import JsonResponse
from django.views.decorators.http import require_POST
from django.views.decorators.csrf import ensure_csrf_cookie

from dotenv import load_dotenv
from groq import Groq


load_dotenv()

logger = logging.getLogger(__name__)


# Homepage
@ensure_csrf_cookie
def home(request):
    return render(request, "frontend/index.html")


# Groq chatbot
@require_POST
def chat(request):
    try:
        data = json.loads(request.body)

        message = data.get("message", "").strip()

        if not isinstance(message, str) or not message:
            return JsonResponse(
                {"error": "Please enter a message."},
                status=400
            )

        api_key = os.getenv("GROQ_API_KEY")

        if not api_key:
            logger.error("GROQ_API_KEY is not configured")
            return JsonResponse(
                {"error": "AI service is not configured."},
                status=503
            )

        client = Groq(api_key=api_key)

        response = client.chat.completions.create(
            model="openai/gpt-oss-120b",
            messages=[
                {
                    "role": "system",
                    "content": (
                        "You are Know Your District, a helpful "
                        "assistant for understanding Hawaii's "
                        "legislative districts. "
                        "Explain information clearly and accurately. "
                        "Do not invent demographic statistics, "
                        "district boundaries, or official sources. "
                        "If verified district data has not been "
                        "provided, explain that you cannot confirm "
                        "specific statistics yet."
                    )
                },
                {
                    "role": "user",
                    "content": message
                }
            ],
            temperature=0.3,
            max_completion_tokens=1024
        )

        reply = response.choices[0].message.content

        return JsonResponse({
            "reply": reply or "No response generated."
        })

    except (json.JSONDecodeError, UnicodeDecodeError):
        return JsonResponse(
            {"error": "Invalid message format."},
            status=400
        )

    except Exception:
        logger.exception("Groq API request failed")

        return JsonResponse(
            {"error": "Unable to contact the AI service. Please try again."},
            status=502
        )
