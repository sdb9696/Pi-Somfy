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

If you are reviewing the latest code changes then you may need to run a development version of the website. See step 4b. Otherwise:

http://localhost:8080

4. (b) Development website

To run the latest development website (that has not been built to the build directory) you will need the long term support version of node installed. Then:

```
cd frontend
npm install
npm run dev
```

Then start the server as per step 3 (in a different terminal), and go to:

http://localhost:5173


5. Run the tests

N.B. the tests will briefly spin up a local flask web server, if 8080 is not available they could fail.

```
uv run pytest
```

[Full instructions for setting up with Somfy blinds](README_FULL.md)
