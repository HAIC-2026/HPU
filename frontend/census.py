import os
import json
import urllib.request
from urllib.parse import urlencode

from dotenv import load_dotenv

load_dotenv()


def get_district_data(chamber, district):
    """Retrieve population and income data from Census."""

    if chamber not in ("house", "senate"):
        raise ValueError("Invalid chamber.")

    district = int(district)

    if not 1 <= district <= (51 if chamber == "house" else 25):
        raise ValueError("Invalid district number.")

    geography = (
        "state legislative district (lower chamber)"
        if chamber == "house"
        else "state legislative district (upper chamber)"
    )

    params = {
        "get": (
            "NAME,"
            "B01003_001E,B01003_001M,"
            "B19013_001E,B19013_001M"
        ),
        "for": f"{geography}:{district:03d}",
        "in": "state:15",
        "key": os.getenv("CENSUS_API_KEY"),
    }

    url = (
        "https://api.census.gov/data/2024/acs/acs5?"
        + urlencode(params)
    )

    with urllib.request.urlopen(url, timeout=15) as response:
        data = json.load(response)

    if len(data) < 2:
        raise ValueError("No Census data found.")

    return dict(zip(data[0], data[1]))