"""Unit tests for jolpica_service against a mocked httpx transport.

api.jolpi.ca is reachable from this sandbox (unlike OpenF1), but these
tests still mock the transport so they stay deterministic and don't
depend on live upstream data drifting between runs.
"""

from __future__ import annotations

from collections.abc import Callable

import httpx
import pytest

from app.services import jolpica_service
from app.services.jolpica_service import (
    JolpicaUnavailable,
    JolpicaUpstreamError,
    get_race_classification,
    get_sepang_schedule,
    get_standings,
)

_RealAsyncClient = httpx.AsyncClient

SAMPLE_RACE = {
    "season": "2026",
    "round": "16",
    "raceName": "Bahrain Grand Prix in Malaysia",
    "Circuit": {
        "circuitId": "sepang",
        "circuitName": "Sepang International Circuit",
    },
    "date": "2026-10-04",
    "time": "07:00:00Z",
    "FirstPractice": {"date": "2026-10-02", "time": "04:30:00Z"},
    "SecondPractice": {"date": "2026-10-02", "time": "08:00:00Z"},
    "ThirdPractice": {"date": "2026-10-03", "time": "04:30:00Z"},
    "Qualifying": {"date": "2026-10-03", "time": "08:00:00Z"},
}


def _patch_client(
    monkeypatch: pytest.MonkeyPatch, handler: Callable[[httpx.Request], httpx.Response]
) -> None:
    def factory(**kwargs: object) -> httpx.AsyncClient:
        return _RealAsyncClient(transport=httpx.MockTransport(handler), **kwargs)

    monkeypatch.setattr(httpx, "AsyncClient", factory)


@pytest.fixture(autouse=True)
def _clear_caches() -> None:
    jolpica_service._schedule_cache.clear()
    jolpica_service._standings_cache.clear()
    yield
    jolpica_service._schedule_cache.clear()
    jolpica_service._standings_cache.clear()


@pytest.mark.asyncio
async def test_sepang_schedule_maps_sessions_to_myt(monkeypatch: pytest.MonkeyPatch) -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        assert "/2026/circuits/sepang/races/" in str(request.url)
        return httpx.Response(
            200,
            json={"MRData": {"RaceTable": {"Races": [SAMPLE_RACE]}}},
        )

    _patch_client(monkeypatch, handler)

    schedule = await get_sepang_schedule()
    assert schedule.season == "2026"
    assert schedule.round == "16"
    assert schedule.circuit_id == "sepang"
    assert schedule.source == "jolpica"
    by_session = {item.session: item for item in schedule.sessions}
    assert by_session["FP1"].start == "2026-10-02T12:30:00+08:00"
    assert by_session["FP1"].end == "2026-10-02T13:30:00+08:00"
    assert by_session["Race"].start == "2026-10-04T15:00:00+08:00"
    assert by_session["Race"].end == "2026-10-04T17:00:00+08:00"


@pytest.mark.asyncio
async def test_sepang_schedule_is_cached(monkeypatch: pytest.MonkeyPatch) -> None:
    calls = 0

    def handler(request: httpx.Request) -> httpx.Response:
        nonlocal calls
        calls += 1
        return httpx.Response(
            200,
            json={"MRData": {"RaceTable": {"Races": [SAMPLE_RACE]}}},
        )

    _patch_client(monkeypatch, handler)

    await get_sepang_schedule()
    await get_sepang_schedule()
    assert calls == 1


@pytest.mark.asyncio
async def test_sepang_schedule_empty_is_unavailable(monkeypatch: pytest.MonkeyPatch) -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, json={"MRData": {"RaceTable": {"Races": []}}})

    _patch_client(monkeypatch, handler)

    with pytest.raises(JolpicaUnavailable):
        await get_sepang_schedule()


@pytest.mark.asyncio
async def test_sepang_schedule_upstream_error(monkeypatch: pytest.MonkeyPatch) -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(503, text="unavailable")

    _patch_client(monkeypatch, handler)

    with pytest.raises(JolpicaUpstreamError):
        await get_sepang_schedule()


@pytest.mark.asyncio
async def test_standings_parses_drivers_and_constructors(monkeypatch: pytest.MonkeyPatch) -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        path = request.url.path
        if path.endswith("/driverstandings/"):
            return httpx.Response(
                200,
                json={
                    "MRData": {
                        "StandingsTable": {
                            "StandingsLists": [
                                {
                                    "season": "2025",
                                    "round": "24",
                                    "DriverStandings": [
                                        {
                                            "position": "1",
                                            "points": "423",
                                            "wins": "7",
                                            "Driver": {
                                                "driverId": "norris",
                                                "givenName": "Lando",
                                                "familyName": "Norris",
                                            },
                                            "Constructors": [{"name": "McLaren"}],
                                        }
                                    ],
                                }
                            ]
                        }
                    }
                },
            )
        if path.endswith("/constructorstandings/"):
            return httpx.Response(
                200,
                json={
                    "MRData": {
                        "StandingsTable": {
                            "StandingsLists": [
                                {
                                    "season": "2025",
                                    "round": "24",
                                    "ConstructorStandings": [
                                        {
                                            "position": "1",
                                            "points": "833",
                                            "wins": "14",
                                            "Constructor": {
                                                "constructorId": "mclaren",
                                                "name": "McLaren",
                                            },
                                        }
                                    ],
                                }
                            ]
                        }
                    }
                },
            )
        raise AssertionError(f"unexpected path {path}")

    _patch_client(monkeypatch, handler)

    standings = await get_standings()
    assert standings.season == "2025"
    assert standings.round == "24"
    assert standings.drivers[0].driver_id == "norris"
    assert standings.drivers[0].points == 423.0
    assert standings.constructors[0].constructor_id == "mclaren"
    assert standings.constructors[0].points == 833.0


@pytest.mark.asyncio
async def test_standings_cache_respects_ttl(monkeypatch: pytest.MonkeyPatch) -> None:
    calls = 0

    def handler(request: httpx.Request) -> httpx.Response:
        nonlocal calls
        calls += 1
        path = request.url.path
        if path.endswith("/driverstandings/"):
            return httpx.Response(
                200,
                json={
                    "MRData": {
                        "StandingsTable": {
                            "StandingsLists": [
                                {
                                    "season": "2026",
                                    "round": "5",
                                    "DriverStandings": [
                                        {
                                            "position": "1",
                                            "points": "100",
                                            "wins": "2",
                                            "Driver": {
                                                "driverId": "norris",
                                                "givenName": "Lando",
                                                "familyName": "Norris",
                                            },
                                            "Constructors": [{"name": "McLaren"}],
                                        }
                                    ],
                                }
                            ]
                        }
                    }
                },
            )
        return httpx.Response(
            200,
            json={
                "MRData": {
                    "StandingsTable": {
                        "StandingsLists": [
                            {
                                "season": "2026",
                                "round": "5",
                                "ConstructorStandings": [
                                    {
                                        "position": "1",
                                        "points": "180",
                                        "wins": "3",
                                        "Constructor": {"constructorId": "mclaren", "name": "McLaren"},
                                    }
                                ],
                            }
                        ]
                    }
                }
            },
        )

    _patch_client(monkeypatch, handler)

    clock = [1000.0]
    monkeypatch.setattr(jolpica_service.time, "monotonic", lambda: clock[0])

    await get_standings()
    assert calls == 2  # one call each for drivers + constructors

    # Still within the TTL — served from cache, no new requests.
    clock[0] += 60
    await get_standings()
    assert calls == 2

    # Past the TTL — refetches.
    clock[0] += jolpica_service._STANDINGS_CACHE_TTL_SECONDS
    await get_standings()
    assert calls == 4


SAMPLE_RESULTS_RACE = {
    "season": "2026",
    "round": "16",
    "Results": [
        {
            "position": "1",
            "points": "25",
            "status": "Finished",
            "Driver": {"driverId": "norris", "givenName": "Lando", "familyName": "Norris"},
            "Constructor": {"constructorId": "mclaren", "name": "McLaren"},
            "FastestLap": {"rank": "2"},
        },
        {
            "position": "2",
            "points": "18",
            "status": "Finished",
            "Driver": {"driverId": "piastri", "givenName": "Oscar", "familyName": "Piastri"},
            "Constructor": {"constructorId": "mclaren", "name": "McLaren"},
            "FastestLap": {"rank": "1"},
        },
        {
            "position": "3",
            "points": "15",
            "status": "Finished",
            "Driver": {
                "driverId": "max_verstappen",
                "givenName": "Max",
                "familyName": "Verstappen",
            },
            "Constructor": {"constructorId": "red_bull", "name": "Red Bull"},
        },
        {
            "position": "20",
            "points": "0",
            "status": "Retired",
            "Driver": {"driverId": "perez", "givenName": "Sergio", "familyName": "Pérez"},
            "Constructor": {"constructorId": "cadillac", "name": "Cadillac"},
        },
    ],
}

SAMPLE_QUALIFYING_RACE = {
    "season": "2026",
    "round": "16",
    "QualifyingResults": [
        {
            "position": "1",
            "Driver": {"driverId": "piastri", "givenName": "Oscar", "familyName": "Piastri"},
        },
        {
            "position": "2",
            "Driver": {"driverId": "norris", "givenName": "Lando", "familyName": "Norris"},
        },
    ],
}


@pytest.mark.asyncio
async def test_race_classification_parses_results_and_pole(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        path = request.url.path
        if path.endswith("/results/"):
            return httpx.Response(
                200, json={"MRData": {"RaceTable": {"Races": [SAMPLE_RESULTS_RACE]}}}
            )
        if path.endswith("/qualifying/"):
            return httpx.Response(
                200, json={"MRData": {"RaceTable": {"Races": [SAMPLE_QUALIFYING_RACE]}}}
            )
        raise AssertionError(f"unexpected path {path}")

    _patch_client(monkeypatch, handler)

    classification = await get_race_classification()
    assert classification.is_final is True
    assert classification.pole_family_name == "Piastri"
    assert [row.driver_family_name for row in classification.results] == [
        "Norris",
        "Piastri",
        "Verstappen",
        "Pérez",
    ]
    assert classification.results[1].fastest_lap_rank == 1
    assert classification.results[3].status == "Retired"


@pytest.mark.asyncio
async def test_race_classification_not_final_before_race_runs(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, json={"MRData": {"RaceTable": {"Races": []}}})

    _patch_client(monkeypatch, handler)

    classification = await get_race_classification()
    assert classification.is_final is False
    assert classification.results == []
    assert classification.pole_family_name is None


@pytest.mark.asyncio
async def test_race_classification_upstream_error(monkeypatch: pytest.MonkeyPatch) -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(503, text="unavailable")

    _patch_client(monkeypatch, handler)

    with pytest.raises(JolpicaUpstreamError):
        await get_race_classification()
