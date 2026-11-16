import requests
from bs4 import BeautifulSoup
from urllib.parse import urljoin

DBEDT_URL = "https://dbedt.hawaii.gov/economic/databook/db2025/"


def get_dbedt_datasets():
    """Find Excel datasets published on the DBEDT Data Book page."""

    response = requests.get(DBEDT_URL, timeout=20)
    response.raise_for_status()

    soup = BeautifulSoup(response.text, "html.parser")
    datasets = []

    for link in soup.find_all("a", href=True):
        url = urljoin(DBEDT_URL, link["href"])

        if url.lower().split("?")[0].endswith((".xlsx", ".xls")):
            datasets.append({
                "name": link.get_text(" ", strip=True),
                "url": url,
            })

    return datasets
