/**
 * Vercel 서버리스 함수 - 클라이언트 공개 설정
 * 구글맵 API 키처럼 도메인 제한으로 보호되는 공개용 키를 전달합니다.
 */

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    return res.status(200).json({
        googleMapsApiKey: process.env.GOOGLE_MAPS_API_KEY || null,
    });
}
