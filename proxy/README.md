# JFlow CORS Proxy

FastAPI-based CORS proxy to bypass JIIT Portal restrictions.

## Local Development

```bash
cd proxy
pip install -r requirements.txt
python main.py
```

Runs on `http://localhost:8000`

## Deploy to Render

1. Create a new **Web Service** on [Render](https://render.com)
2. Connect your repo
3. Set:
   - **Root Directory**: `proxy`
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `uvicorn main:app --host 0.0.0.0 --port $PORT`
4. Add environment variable:
   - `ALLOWED_ORIGINS`: `http://localhost:3000,https://your-production-domain.com`

## Usage

Once deployed, update your `.env.local`:

```
NEXT_PUBLIC_CORS_PROXY_URL=https://your-proxy.onrender.com
```
