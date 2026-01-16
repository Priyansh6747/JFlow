"""
CORS Proxy for JFlow - Bypasses JIIT Portal CORS restrictions
Deploy to Render, Railway, or any Python hosting service
"""

import os
import logging
import traceback
from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware
import httpx

# Setup logging - DEBUG level for troubleshooting prod issues
logging.basicConfig(
    level=logging.DEBUG,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)
logger.setLevel(logging.DEBUG)

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
    return {"status": "ok", "message": "JFlow CORS Proxy", "target": JIIT_BASE_URL}

@app.head("/")
async def monitor():
    return Response(status_code=200)


@app.get("/health")
async def health():
    return {"status": "healthy", "target": JIIT_BASE_URL}

@app.api_route("/proxy/{path:path}", methods=["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"])
async def proxy(path: str, request: Request):
    target_url = f"{JIIT_BASE_URL}/{path}"
    
    # Get request body
    body = await request.body()
    
    logger.info(f"📥 INCOMING REQUEST: {request.method} /{path}")
    logger.debug(f"   Target URL: {target_url}")
    logger.debug(f"   Request body length: {len(body)} bytes")
    logger.debug(f"   Request body preview: {body[:500] if body else b'(empty)'}") 
    
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
    
    logger.debug(f"   Forwarding headers: {headers}")
    
    # Request with retry logic
    max_retries = 3
    last_error = None
    
    for attempt in range(max_retries):
        try:
            logger.info(f"🔄 Attempt {attempt + 1}/{max_retries} to {target_url}")
            
            async with httpx.AsyncClient(verify=False, timeout=60.0) as client:
                response = await client.request(
                    method=request.method,
                    url=target_url,
                    headers=headers,
                    content=body,
                    params=dict(request.query_params),
                )
                
                # Detailed response logging
                status_icon = "✅" if response.status_code == 200 else "❌"
                logger.info(f"{status_icon} UPSTREAM RESPONSE: {response.status_code}")
                logger.info(f"   Response content length: {len(response.content)} bytes")
                logger.debug(f"   Response headers: {dict(response.headers)}")
                logger.debug(f"   Response body preview: {response.content[:1000] if response.content else b'(empty)'}")
                
                # Check for empty response - this is the bug indicator
                if len(response.content) == 0:
                    logger.warning(f"⚠️ EMPTY RESPONSE from upstream for {path}")
                
                # Forward response headers
                response_headers = {}
                for key, value in response.headers.items():
                    if key.lower() not in ("content-encoding", "transfer-encoding", "content-length"):
                        response_headers[key] = value
                
                logger.info(f"📤 RETURNING: status={response.status_code}, content_length={len(response.content)}")
                
                return Response(
                    content=response.content,
                    status_code=response.status_code,
                    headers=response_headers,
                )
                
        except httpx.ConnectError as e:
            last_error = e
            logger.error(f"🔌 CONNECTION ERROR on attempt {attempt + 1}: {e}")
            logger.error(f"   Full traceback: {traceback.format_exc()}")
        except httpx.TimeoutException as e:
            last_error = e
            logger.error(f"⏱️ TIMEOUT on attempt {attempt + 1}: {e}")
        except httpx.RequestError as e:
            last_error = e
            logger.error(f"🚫 REQUEST ERROR on attempt {attempt + 1}: {type(e).__name__}: {e}")
            logger.error(f"   Full traceback: {traceback.format_exc()}")
        except Exception as e:
            last_error = e
            logger.error(f"💥 UNEXPECTED ERROR on attempt {attempt + 1}: {type(e).__name__}: {e}")
            logger.error(f"   Full traceback: {traceback.format_exc()}")
            
        if attempt < max_retries - 1:
            import asyncio
            wait_time = 1 * (attempt + 1)
            logger.info(f"   Waiting {wait_time}s before retry...")
            await asyncio.sleep(wait_time)
            continue
    
    error_msg = f'{{"error": "Proxy error after {max_retries} retries: {str(last_error)}"}}'
    logger.error(f"💀 FINAL FAILURE for {path}: {last_error}")
    return Response(
        content=error_msg,
        status_code=502,
        headers={"Content-Type": "application/json"},
    )

if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 8000))
    print(f"🚀 Proxy running on http://0.0.0.0:{port}")
    print(f"   Forwarding to: {JIIT_BASE_URL}")
    uvicorn.run(app, host="0.0.0.0", port=port, log_level="warning")
