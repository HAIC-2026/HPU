
import json
import os
import logging
import re

from django.shortcuts import render
from django.http import JsonResponse
from django.views.decorators.http import require_POST
from django.views.decorators.csrf import ensure_csrf_cookie

from dotenv import load_dotenv
from groq import Groq

from .census import get_district_data
from .district_lookup import lookup_districts


load_dotenv()

logger = logging.getLogger(__name__)


# Homepage
@ensure_csrf_cookie
def home(request):
    return render(request, "frontend/index.html")


# Detect House or Senate district in a user's question
def detect_district(message):
    """Find a House or Senate district mentioned in a question."""

    match = re.search(
        r"\b(house|senate)\s+(?:district\s+)?(\d{1,2})\b",
        message,
        re.IGNORECASE
    )

    if not match:
        return None

    chamber = match.group(1).lower()
    district = int(match.group(2))

    maximum = 51 if chamber == "house" else 25

    if not 1 <= district <= maximum:
        return None

    return chamber, district


# Detect latitude and longitude in a user's question
def detect_coordinates(message):
    """Find coordinates written as latitude X, longitude Y."""

    match = re.search(
        r"\blatitude\s*[:=]?\s*(-?\d+(?:\.\d+)?)"
        r"\s*,?\s*longitude\s*[:=]?\s*(-?\d+(?:\.\d+)?)\b",
        message,
        re.IGNORECASE
    )

    if not match:
        return None

    latitude = float(match.group(1))
    longitude = float(match.group(2))

    if not (-90 <= latitude <= 90 and -180 <= longitude <= 180):
        return None

    return latitude, longitude


# Groq chatbot
@require_POST
def chat(request):
    try:
        data = json.loads(request.body)

        message = data.get("message", "")

        if not isinstance(message, str) or not message.strip():
            return JsonResponse(
                {"error": "Please enter a message."},
                status=400
            )

        message = message.strip()

        # Identify districts from coordinates when provided
        coordinates = detect_coordinates(message)
        location_districts = None

        if coordinates:
            latitude, longitude = coordinates

            try:
                location_districts = lookup_districts(
                    latitude,
                    longitude
                )
            except Exception:
                logger.exception("GIS district lookup failed")

        # Identify the district mentioned in the question
        district_info = detect_district(message)
        census_data = None
        census_error = False

        # Retrieve official Census data
        if district_info:
            chamber, district_number = district_info

            try:
                census_data = get_district_data(
                    chamber,
                    district_number
                )
            except Exception:
                logger.exception("Census API request failed")
                census_error = True

        # Check Groq API key
        api_key = os.getenv("GROQ_API_KEY")

        if not api_key:
            logger.error("GROQ_API_KEY is not configured")
            return JsonResponse(
                {"error": "AI service is not configured."},
                status=503
            )

        # Prepare verified Census information for Groq
        census_context = ""

        if census_data:
            census_context = (
                "\n\nVerified Census data for the requested district:\n"
                f"{json.dumps(census_data, indent=2)}\n"
                "Source: U.S. Census Bureau, "
                "2024 American Community Survey 5-Year Estimates.\n"
                "Geography: 2024 state legislative district.\n"
                "B01003_001E = total population estimate.\n"
                "B01003_001M = population margin of error.\n"
                "B19013_001E = median household income "
                "estimate in dollars.\n"
                "B19013_001M = income margin of error "
                "in dollars.\n"
                "Margins of error use the 90% confidence level.\n"
                "Use these values when answering relevant questions. "
                "Include the source, year, and margin of error. "
                "Do not invent additional statistics."
            )

        elif census_error:
            census_context = (
                "\n\nThe Census API could not be reached. "
                "Explain that current verified district statistics "
                "are temporarily unavailable. "
                "Do not guess numerical values."
            )

        # Prepare verified GIS district information for Groq
        location_context = ""

        if location_districts:
            location_context = (
                "\n\nVerified geographic district lookup:\n"
                f"Latitude: {latitude}\n"
                f"Longitude: {longitude}\n"
                f"State House District: "
                f"{location_districts['house_district']}\n"
                f"State Senate District: "
                f"{location_districts['senate_district']}\n"
                "Source: State of Hawaiʻi GIS Program, "
                "2022 legislative district boundaries.\n"
                "Use these district numbers when answering "
                "the user's location-based question. "
                "If a district is None, explain that it "
                "could not be uniquely identified. "
                "Do not guess missing district numbers."
            )

        elif coordinates:
            location_context = (
                "\n\nA geographic district lookup was attempted "
                "but verified results are unavailable. "
                "Do not guess district numbers."
            )

        # Connect to Groq
        client = Groq(api_key=api_key)

        response = client.chat.completions.create(
            model="openai/gpt-oss-120b",
            messages=[
                {
                    "role": "system",
                    "content": (
                        "You are Know Your District, a helpful "
                        "assistant for understanding Hawaiʻi's "
                        "legislative districts. "
                        "Explain information clearly and accurately. "
                        "Use verified Census data provided in the "
                        "conversation when answering statistical "
                        "questions. "
                        "Use verified GIS results when identifying "
                        "districts from coordinates. "
                        "Always identify the source, year, and "
                        "geography of reported statistics. "
                        "Include margins of error when available. "
                        "Do not invent demographic statistics, "
                        "district boundaries, or official sources. "
                        "If verified data is unavailable, explain "
                        "that you cannot confirm specific values. "
                        "Do not claim to have independently "
                        "searched government websites."
                    )
                },
                {
                    "role": "user",
                    "content": (
                        message
                        + census_context
                        + location_context
                    )
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
        logger.exception("Chatbot request failed")

        return JsonResponse(
            {
                "error": (
                    "Unable to process your request. "
                    "Please try again."
                )
            },
            status=502
        )
