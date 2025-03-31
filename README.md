## Setup environment and run project

Minimal instructions for working web server.

All commands should be run from the source code root directory. Only runs on linux.

1. Install [uv](https://docs.astral.sh/uv/getting-started/installation/)

2. Install environment

```
uv venv .venv
./venv/bin/activate
uv pip install -r requirements.txt
```

3. Run the web server

```
python -m operateShutters -a
```

3. View the website

http://localhost:8080



[Full instructions for setting up with Somfy blinds](README_FULL.md)
