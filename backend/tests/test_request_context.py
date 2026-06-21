from starlette.datastructures import Headers

from app.services.request_context import detect_browser, detect_country


def test_country_detection_supports_hosting_provider_headers():
    assert detect_country(Headers({"x-vercel-ip-country": "ca"})) == "CA"
    assert detect_country(Headers({"cloudfront-viewer-country": "DE"})) == "DE"
    assert detect_country(Headers({"cf-ipcountry": "XX"})) is None


def test_browser_detection_handles_common_browsers_and_bots():
    assert detect_browser("Mozilla/5.0 Chrome/126.0.0.0 Safari/537.36") == "Chrome 126"
    assert detect_browser("Mozilla/5.0 Version/17.5 Mobile/15E148 Safari/604.1") == "Safari 17"
    assert detect_browser("Googlebot/2.1") == "Bot"
