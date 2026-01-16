"""
CORS Proxy for JFlow - Bypasses JIIT Portal CORS restrictions
Deploy to Render, Railway, or any Python hosting service
"""

import os
import logging
from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware
import httpx

# Setup logging - minimal output
logging.basicConfig(level=logging.WARNING)
logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)

app = FastAPI(title="JFlow CORS Proxy")

# Configure CORS
ALLOWED_ORIGINS = os.getenv(
    "ALLOWED_ORIGINS",
    "http://localhost:3000,http://127.0.0.1:3000,https://j-flow.vercel.app/"
).split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
)

# JIIT Portal base URL
JIIT_BASE_URL = "https://webportal.jiit.ac.in:6011/StudentPortalAPI"

@app.get("/")
async def root():
    return {"status": "ok", "message": "JFlow CORS Proxy"}

@app.head("/")
async def monitor():
    return 1

@app.get("/health")
async def health():
    return {"status": "healthy"}

@app.api_route("/proxy/{path:path}", methods=["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"])
async def proxy(path: str, request: Request):
    target_url = f"{JIIT_BASE_URL}/{path}"
    
    # Get request body
    body = await request.body()
    
    # Forward essential headers
    headers = {
        "Content-Type": request.headers.get("content-type", "application/json"),
        "Accept": request.headers.get("accept", "*/*"),
        "User-Agent": request.headers.get("user-agent", "Mozilla/5.0"),
    }
    
    # Add app-specific headers (authorization, localname, etc.)
    for key, value in request.headers.items():
        key_lower = key.lower()
        if key_lower not in ("host", "origin", "referer", "content-length", 
                              "connection", "accept-encoding", "accept-language",
                              "sec-fetch-dest", "sec-fetch-mode", "sec-fetch-site",
                              "sec-ch-ua", "sec-ch-ua-mobile", "sec-ch-ua-platform",
                              "content-type", "accept", "user-agent"):
            headers[key] = value
    
    # Request with retry logic
    max_retries = 3
    last_error = None
    
    for attempt in range(max_retries):
        try:
            async with httpx.AsyncClient(verify=False, timeout=60.0) as client:
                response = await client.request(
                    method=request.method,
                    url=target_url,
                    headers=headers,
                    content=body,
                    params=dict(request.query_params),
                )
                
                # Only log path and status
                status_icon = "✓" if response.status_code == 200 else "✗"
                logger.info(f"{status_icon} {request.method} /{path} → {response.status_code}")
                
                # Forward response headers
                response_headers = {}
                for key, value in response.headers.items():
                    if key.lower() not in ("content-encoding", "transfer-encoding", "content-length"):
                        response_headers[key] = value
                
                return Response(
                    content=response.content,
                    status_code=response.status_code,
                    headers=response_headers,
                )
        except httpx.RequestError as e:
            last_error = e
            logger.warning(f"Retry {attempt + 1}/{max_retries}: {path}")
            if attempt < max_retries - 1:
                import asyncio
                await asyncio.sleep(1 * (attempt + 1))
                continue
    
    logger.error(f"Failed after {max_retries} retries: {path}")
    return Response(
        content=f'{{"error": "Proxy error: {str(last_error)}"}}',
        status_code=502,
        headers={"Content-Type": "application/json"},
    )

if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 8000))
    print(f"🚀 Proxy running on http://0.0.0.0:{port}")
    print(f"   Forwarding to: {JIIT_BASE_URL}")
    uvicorn.run(app, host="0.0.0.0", port=port, log_level="warning")
