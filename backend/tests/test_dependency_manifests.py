"""The backend declares its runtime dependencies twice: `pyproject.toml`
(which Vercel installs from whenever the file exists) and
`requirements.txt` (which local setup in the README uses).

They drifted once, and it took production down: `anthropic` was added to
requirements.txt only, every local check passed because it was installed
by hand, and the deployed function then failed to import at all — every
route returned 500, not just the one that needed the package. This test
exists so the two lists can't silently disagree again.
"""

import re
import tomllib
from pathlib import Path

BACKEND = Path(__file__).resolve().parents[1]


def _normalise(spec: str) -> str:
    # Package names compare case-insensitively with - and _ interchangeable.
    name, _, rest = spec.strip().partition("==")
    name = re.sub(r"[-_.]+", "-", name.split("[")[0]).lower()
    extras = spec[spec.find("[") : spec.find("]") + 1] if "[" in spec else ""
    return f"{name}{extras}=={rest}" if rest else f"{name}{extras}"


def _pyproject_deps() -> set[str]:
    data = tomllib.loads((BACKEND / "pyproject.toml").read_text())
    return {_normalise(d) for d in data["project"]["dependencies"]}


def _parse_requirements(text: str) -> set[str]:
    # pip allows trailing "  # note" on a requirement line; drop it so an
    # annotated pin still compares equal to the bare one in pyproject.
    lines = (line.split("#", 1)[0].strip() for line in text.splitlines())
    return {_normalise(line) for line in lines if line and not line.startswith("-")}


def _requirements_deps() -> set[str]:
    return _parse_requirements((BACKEND / "requirements.txt").read_text())


def test_pyproject_and_requirements_declare_the_same_runtime_dependencies():
    pyproject = _pyproject_deps()
    requirements = _requirements_deps()
    assert pyproject == requirements, (
        "backend/pyproject.toml and backend/requirements.txt disagree.\n"
        f"  only in pyproject.toml:   {sorted(pyproject - requirements)}\n"
        f"  only in requirements.txt: {sorted(requirements - pyproject)}\n"
        "Vercel installs from pyproject.toml, so anything missing there is "
        "missing in production."
    )


def test_every_runtime_dependency_is_pinned():
    # Unpinned deps make "passed CI" and "what got deployed" two different
    # sets of versions.
    for dep in _pyproject_deps():
        assert "==" in dep, f"{dep} is not pinned to an exact version"


def test_requirements_parsing_ignores_comments_options_and_blank_lines():
    text = (
        "# runtime\n"
        "FastAPI==0.115.12  # pinned for the Vercel runtime\n"
        "\n"
        "-r other.txt\n"
        "uvicorn[standard]==0.34.0\n"
    )
    assert _parse_requirements(text) == {"fastapi==0.115.12", "uvicorn[standard]==0.34.0"}
