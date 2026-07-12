"""Parse fetched web documents with lxml.

Some SERP targets return XML (e.g. legal feeds). The HTML parser still extracts
usable text, but BeautifulSoup warns — suppress that single warning locally.
"""
import warnings

from bs4 import BeautifulSoup, XMLParsedAsHTMLWarning


def parse_html(html: str) -> BeautifulSoup:
    with warnings.catch_warnings():
        warnings.filterwarnings("ignore", category=XMLParsedAsHTMLWarning)
        return BeautifulSoup(html or "", "lxml")
