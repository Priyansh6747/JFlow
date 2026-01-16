/**
 * Next.js API route to proxy requests to JIIT Portal
 * Replaces the separate Python proxy server
 */

const JIIT_BASE_URL = "https://webportal.jiit.ac.in:6011/StudentPortalAPI";

// Headers to skip forwarding
const SKIP_REQUEST_HEADERS = new Set([
    'host', 'origin', 'referer', 'content-length',
    'connection', 'accept-encoding', 'accept-language',
    'sec-fetch-dest', 'sec-fetch-mode', 'sec-fetch-site',
    'sec-ch-ua', 'sec-ch-ua-mobile', 'sec-ch-ua-platform'
]);

const SKIP_RESPONSE_HEADERS = new Set([
    'content-encoding', 'transfer-encoding', 'content-length'
]);

async function proxyRequest(request, { params }) {
    const path = (await params).path?.join('/') || '';
    const targetUrl = `${JIIT_BASE_URL}/${path}`;

    console.log(`📥 PROXY: ${request.method} /${path}`);
    console.log(`   → ${targetUrl}`);

    // Build forwarded headers
    const headers = {
        'Content-Type': request.headers.get('content-type') || 'application/json',
        'Accept': request.headers.get('accept') || '*/*',
        'User-Agent': request.headers.get('user-agent') || 'Mozilla/5.0',
    };

    // Forward app-specific headers (authorization, etc.)
    for (const [key, value] of request.headers.entries()) {
        if (!SKIP_REQUEST_HEADERS.has(key.toLowerCase()) &&
            !['content-type', 'accept', 'user-agent'].includes(key.toLowerCase())) {
            headers[key] = value;
        }
    }

    console.log(`   Headers:`, Object.keys(headers));

    // Get request body if present
    let body = null;
    if (request.method !== 'GET' && request.method !== 'HEAD') {
        try {
            body = await request.text();
            console.log(`   Body length: ${body?.length || 0}`);
            if (body) console.log(`   Body preview: ${body.substring(0, 200)}...`);
        } catch (e) {
            console.log(`   No body`);
        }
    }

    // Build query string
    const url = new URL(request.url);
    const queryString = url.search;
    const fullTargetUrl = targetUrl + queryString;

    // Retry logic
    const maxRetries = 3;
    let lastError = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            console.log(`🔄 Attempt ${attempt}/${maxRetries}`);

            const fetchOptions = {
                method: request.method,
                headers,
                // Node.js fetch doesn't support 'rejectUnauthorized' directly
                // But Next.js serverless should handle SSL fine
            };

            if (body && request.method !== 'GET' && request.method !== 'HEAD') {
                fetchOptions.body = body;
            }

            const response = await fetch(fullTargetUrl, fetchOptions);

            console.log(`✅ UPSTREAM: ${response.status}`);

            // Get response body
            const responseBody = await response.arrayBuffer();
            console.log(`   Response length: ${responseBody.byteLength} bytes`);

            if (responseBody.byteLength > 0 && responseBody.byteLength < 2000) {
                const textPreview = new TextDecoder().decode(responseBody);
                console.log(`   Response preview: ${textPreview.substring(0, 500)}`);
            }

            // Build response headers
            const responseHeaders = new Headers();
            for (const [key, value] of response.headers.entries()) {
                if (!SKIP_RESPONSE_HEADERS.has(key.toLowerCase())) {
                    responseHeaders.set(key, value);
                }
            }

            // Add CORS headers
            responseHeaders.set('Access-Control-Allow-Origin', '*');
            responseHeaders.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
            responseHeaders.set('Access-Control-Allow-Headers', '*');

            console.log(`📤 RETURNING: ${response.status}, ${responseBody.byteLength} bytes`);

            return new Response(responseBody, {
                status: response.status,
                headers: responseHeaders,
            });

        } catch (error) {
            lastError = error;
            console.error(`❌ Attempt ${attempt} failed:`, error.message);

            if (attempt < maxRetries) {
                await new Promise(r => setTimeout(r, 1000 * attempt));
            }
        }
    }

    console.error(`💀 All retries failed for /${path}:`, lastError);

    return new Response(
        JSON.stringify({ error: `Proxy error: ${lastError?.message || 'Unknown error'}` }),
        {
            status: 502,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
            },
        }
    );
}

// Handle CORS preflight
export async function OPTIONS(request) {
    return new Response(null, {
        status: 204,
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
            'Access-Control-Allow-Headers': '*',
            'Access-Control-Max-Age': '86400',
        },
    });
}

export async function GET(request, context) {
    return proxyRequest(request, context);
}

export async function POST(request, context) {
    return proxyRequest(request, context);
}

export async function PUT(request, context) {
    return proxyRequest(request, context);
}

export async function DELETE(request, context) {
    return proxyRequest(request, context);
}

export async function PATCH(request, context) {
    return proxyRequest(request, context);
}
