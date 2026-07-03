/**
 * 텃밭 채소를 부탁해 - 로컬 개발 서버
 * web/ 정적 파일 제공 + /api/recipe 엔드포인트 처리
 */

import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// .env 파일 로드
function loadEnv() {
    const envPath = path.join(__dirname, '.env');
    if (fs.existsSync(envPath)) {
        const lines = fs.readFileSync(envPath, 'utf-8').split('\n');
        for (const line of lines) {
            const trimmed = line.trim();
            if (trimmed && !trimmed.startsWith('#')) {
                const [key, ...rest] = trimmed.split('=');
                process.env[key.trim()] = rest.join('=').trim();
            }
        }
    }
}

loadEnv();

const PORT = 3000;
const WEB_DIR = path.join(__dirname, 'web');

const MIME_TYPES = {
    '.html': 'text/html; charset=utf-8',
    '.css':  'text/css; charset=utf-8',
    '.js':   'application/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.jpg':  'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png':  'image/png',
    '.svg':  'image/svg+xml',
    '.ico':  'image/x-icon',
};

async function handleRecipeAPI(req, res) {
    if (req.method === 'OPTIONS') {
        res.writeHead(200, {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type',
        });
        res.end();
        return;
    }

    if (req.method !== 'POST') {
        res.writeHead(405, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Method not allowed' }));
        return;
    }

    let body = '';
    for await (const chunk of req) body += chunk;
    const { prompt, imageBase64 } = JSON.parse(body);

    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey || apiKey === 'your_api_key_here') {
        res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({
            error: '.env 파일에 OPENROUTER_API_KEY를 설정해주세요.'
        }));
        return;
    }

    let content;
    if (imageBase64) {
        content = [
            { type: 'text', text: prompt },
            { type: 'image_url', image_url: { url: imageBase64 } }
        ];
    } else {
        content = prompt;
    }

    try {
        const apiRes = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
                'HTTP-Referer': 'http://localhost:3000',
                'X-Title': 'Fridge Recipe App'
            },
            body: JSON.stringify({
                model: 'google/gemini-3-flash-preview',
                messages: [{ role: 'user', content }],
                max_tokens: 2000,
                temperature: 0.7,
                top_p: 0.9,
            })
        });

        const data = await apiRes.json();

        if (!apiRes.ok) {
            res.writeHead(apiRes.status, { 'Content-Type': 'application/json; charset=utf-8' });
            res.end(JSON.stringify({ error: `AI API 오류: ${apiRes.status}`, details: data }));
            return;
        }

        const text = data?.choices?.[0]?.message?.content || '';
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ success: !!text, content: text }));

    } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ error: err.message }));
    }
}

function handleConfigAPI(req, res) {
    const googleMapsApiKey = process.env.GOOGLE_MAPS_API_KEY || null;
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ googleMapsApiKey }));
}

function serveStatic(req, res) {
    let urlPath = req.url.split('?')[0];
    if (urlPath === '/') urlPath = '/index.html';

    const filePath = path.join(WEB_DIR, urlPath);

    // 경로 탈출 방지
    if (!filePath.startsWith(WEB_DIR)) {
        res.writeHead(403);
        res.end('Forbidden');
        return;
    }

    fs.readFile(filePath, (err, data) => {
        if (err) {
            res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
            res.end('파일을 찾을 수 없습니다.');
            return;
        }
        const ext = path.extname(filePath);
        res.writeHead(200, { 'Content-Type': MIME_TYPES[ext] || 'application/octet-stream' });
        res.end(data);
    });
}

const server = http.createServer(async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');

    if (req.url.startsWith('/api/recipe')) {
        await handleRecipeAPI(req, res);
    } else if (req.url.startsWith('/api/config')) {
        handleConfigAPI(req, res);
    } else {
        serveStatic(req, res);
    }
});

server.listen(PORT, () => {
    console.log(`\n🥬 텃밭 채소를 부탁해 서버 실행 중`);
    console.log(`   http://localhost:${PORT}\n`);

    const hasKey = process.env.OPENROUTER_API_KEY && process.env.OPENROUTER_API_KEY !== 'your_api_key_here';
    if (!hasKey) {
        console.log(`⚠️  API 키 없음 — .env 파일에 OPENROUTER_API_KEY를 추가하거나`);
        console.log(`   앱 내 ⚙️ 설정 버튼에서 직접 입력하세요.\n`);
    } else {
        console.log(`✅ OPENROUTER_API_KEY 감지됨 — 서버 사이드 API 활성화\n`);
    }
});
