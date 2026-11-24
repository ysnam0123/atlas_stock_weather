"""vcp-screener를 FMP 대신 Atlas의 일봉(price_bars)으로 돌린다.

FMP 무료 플랜은 여러 종목 시세를 한 번에 받는 요청(batch quote)을 막아서 스킬이 그대로는 돌지 않는다.
스킬의 판정 로직(추세 템플릿, VCP 탐지, 점수)은 그대로 쓰고, 데이터를 받는 클라이언트만 바꿔 끼운다.
네트워크 요청은 하지 않는다.

    python vcp_local.py --bars <bars.json> --output-dir <dir> [screen_vcp.py 옵션...]

bars.json: {"bars": {"SPY": [{"date", "open", "high", "low", "close", "volume"}, ...오래된 순], ...},
            "names": {"AAPL": "Apple Inc.", ...}}
유니버스는 bars에 있는 종목(SPY 제외)이다. 시가총액·섹터는 없어서 보고서에 0·Unknown으로 나온다 (점수에는 안 쓰인다).
"""

from __future__ import annotations

import json
import os
import sys

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
VCP_DIR = os.path.join(ROOT, "vendor", "claude-trading-skills", "skills", "vcp-screener", "scripts")
sys.path.insert(0, VCP_DIR)

import screen_vcp  # noqa: E402
from coverage_client import CoverageFMPClient  # noqa: E402

YEAR = 252
AVG_VOLUME_DAYS = 50


def load(path: str) -> tuple[dict[str, list[dict]], dict[str, str]]:
    with open(path, encoding="utf-8") as f:
        data = json.load(f)
    return data["bars"], data.get("names", {})


def to_quote(symbol: str, rows: list[dict], name: str | None) -> dict | None:
    """오래된 순 일봉 → FMP quote 모양 (price, yearHigh, yearLow, avgVolume, date)"""
    if not rows:
        return None
    year = rows[-YEAR:]
    recent = rows[-AVG_VOLUME_DAYS:]
    last = rows[-1]
    return {
        "symbol": symbol,
        "name": name or symbol,
        "price": last["close"],
        "yearHigh": max(r["high"] for r in year),
        "yearLow": min(r["low"] for r in year),
        "avgVolume": sum(r["volume"] for r in recent) / len(recent),
        "volume": last["volume"],
        "date": last["date"],
    }


def make_client(bars: dict[str, list[dict]], names: dict[str, str]):
    class LocalClient(CoverageFMPClient):
        """FMP 클라이언트와 같은 메서드를 Atlas 일봉으로 채운다"""

        def __init__(self, api_key=None):  # noqa: ARG002 - 키를 쓰지 않는다
            self.cache = {}
            self.api_calls_made = 0
            self.rate_limit_reached = False
            self.coverage_failures = {}
            self._coverage_attempts = []
            self._disabled_endpoints = set()
            self._endpoint_failures = {}
            self._last_error = None

        def get_quote(self, symbols: str):
            out = [to_quote(s, bars.get(s, []), names.get(s)) for s in symbols.split(",")]
            return [q for q in out if q] or None

        def get_batch_quotes(self, symbols):
            return {q["symbol"]: q for q in (self.get_quote(",".join(symbols)) or [])}

        def get_historical_prices(self, symbol: str, days: int = 365):
            rows = bars.get(symbol)
            if not rows:
                self.coverage_failures[("historical", symbol)] = "missing_data"
                return None
            newest_first = [{**r, "adjClose": r["close"]} for r in reversed(rows[-days:])]
            return {"symbol": symbol, "historical": newest_first}

        def get_sp500_constituents(self):
            return None

    return LocalClient


def main() -> None:
    argv = sys.argv[1:]
    if "--bars" not in argv:
        print("ERROR: --bars <bars.json> 가 필요해요", file=sys.stderr)
        sys.exit(2)
    i = argv.index("--bars")
    path = argv[i + 1]
    rest = argv[:i] + argv[i + 2 :]

    bars, names = load(path)
    universe = sorted(s for s in bars if s != "SPY")
    if not universe:
        print("ERROR: 일봉이 있는 종목이 없어요", file=sys.stderr)
        sys.exit(1)

    screen_vcp.FMPClient = make_client(bars, names)
    # 스킬은 키가 없으면 시작하지 않는다. 쓰지 않는 자리표시 값만 넘긴다
    sys.argv = ["screen_vcp.py", "--api-key", "local", "--universe", *universe, *rest]
    screen_vcp.main()


if __name__ == "__main__":
    main()
