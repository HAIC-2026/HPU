import geopandas as gpd
from shapely.geometry import Point
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent


def lookup_districts(latitude, longitude):
    point = Point(float(longitude), float(latitude))

    house = gpd.read_file(
        BASE_DIR / "data" / "house22.shp.zip"
    ).to_crs("EPSG:4326")

    senate = gpd.read_file(
        BASE_DIR / "data" / "senate22.shp.zip"
    ).to_crs("EPSG:4326")

    house_match = house[house.geometry.covers(point)]
    senate_match = senate[senate.geometry.covers(point)]

    return {
        "house_district": (
            int(house_match.iloc[0]["House_ID"])
            if len(house_match) == 1 else None
        ),
        "senate_district": (
            int(senate_match.iloc[0]["Sen_ID"])
            if len(senate_match) == 1 else None
        ),
    }