## Setup environment and run project

Minimal instructions for working web server.

All commands should be run from the source code root directory. Only runs on linux.

1. Install [uv](https://docs.astral.sh/uv/getting-started/installation/)

2. Install environment

```
uv sync
```

3. Run the web server

```
uv run pi-somfy -a
```

4. View the website

http://localhost:8080

5. Run the tests

N.B. the tests will briefly spin up a local flask web server, if 8080 is not available they could fail.

```
uv run pytest
```

[Full instructions for setting up with Somfy blinds](README_FULL.md)
