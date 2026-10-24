import uvicorn
import os
import sys

# Ensure project root is in sys.path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8050))
    print(f"Starting Emitara Terminal on http://localhost:{port}")
    uvicorn.run("app.main:app", host="127.0.0.1", port=port, reload=False)
