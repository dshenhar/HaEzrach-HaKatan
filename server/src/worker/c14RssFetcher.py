import feedparser
import requests

def fetch_c14_feed():
    url = "https://www.c14.co.il/feed/"

    proxy = "5.78.130.46:12016"
    a = 5

    proxies = {
        "http": f"http://{proxy}",
        "https": f"http://{proxy}",
    }

    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                      "AppleWebKit/537.36 (KHTML, like Gecko) "
                      "Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9,he;q=0.8",
        "Referer": "https://www.c14.co.il/",
        "Connection": "keep-alive",
    }
    resp = requests.get(url, headers=headers, proxies=proxies, timeout=10)
    resp.raise_for_status()
    return feedparser.parse(resp.text)

if __name__ == "__main__":
    feed = fetch_c14_feed()
    for entry in feed.entries[:5]:
        print(entry.title, entry.link)
