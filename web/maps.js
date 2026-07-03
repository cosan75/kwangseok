/**
 * 텃밭 채소를 부탁해 - 구글 지도 연동
 * 레시피와 어울리는 근처 맛집을 구글 지도로 찾아줍니다.
 */

class FridgeMapsService {
    constructor() {
        this.configUrl = '/api/config';
        this.serverApiKey = null;
        this.serverApiKeyFetched = false;
    }

    /**
     * 구글맵 API 키 가져오기 (로컬 저장 > 서버 설정 순)
     */
    async getApiKey() {
        if (typeof localStorage !== 'undefined') {
            const storedKey = localStorage.getItem('google_maps_api_key');
            if (storedKey) return storedKey;
        }

        if (!this.serverApiKeyFetched) {
            this.serverApiKeyFetched = true;
            try {
                const res = await fetch(this.configUrl);
                if (res.ok) {
                    const data = await res.json();
                    this.serverApiKey = data.googleMapsApiKey || null;
                }
            } catch (error) {
                console.warn('구글맵 서버 설정을 불러오지 못했습니다:', error);
            }
        }

        return this.serverApiKey;
    }

    /**
     * API 키 저장 (로컬 개발/사용자 설정용)
     */
    setApiKey(apiKey) {
        if (typeof localStorage !== 'undefined') {
            localStorage.setItem('google_maps_api_key', apiKey);
        }
    }

    /**
     * 사용자 현재 위치 가져오기 (실패 시 null)
     */
    getUserLocation() {
        return new Promise((resolve) => {
            if (!('geolocation' in navigator)) {
                resolve(null);
                return;
            }
            navigator.geolocation.getCurrentPosition(
                (position) => resolve({
                    lat: position.coords.latitude,
                    lng: position.coords.longitude,
                }),
                () => resolve(null),
                { timeout: 5000 }
            );
        });
    }

    /**
     * 구글 지도 Embed API용 검색 URL (지도 미리보기)
     */
    buildEmbedUrl(apiKey, query, coords) {
        const params = new URLSearchParams({ key: apiKey, q: query });
        if (coords) {
            params.set('center', `${coords.lat},${coords.lng}`);
            params.set('zoom', '15');
        }
        return `https://www.google.com/maps/embed/v1/search?${params.toString()}`;
    }

    /**
     * 새 탭에서 구글 지도를 여는 검색 URL (API 키 불필요)
     */
    buildExternalSearchUrl(query, coords) {
        const params = new URLSearchParams({ api: '1', query });
        if (coords) {
            params.set('query', `${query} @${coords.lat},${coords.lng}`);
        }
        return `https://www.google.com/maps/search/?${params.toString()}`;
    }

    /**
     * 레시피 요리명 기반 근처 맛집 정보 구성
     */
    async findNearbyRestaurants(dishName) {
        const query = `${dishName} 맛집`;
        const [apiKey, coords] = await Promise.all([
            this.getApiKey(),
            this.getUserLocation(),
        ]);

        return {
            query,
            coords,
            embedUrl: apiKey ? this.buildEmbedUrl(apiKey, query, coords) : null,
            externalUrl: this.buildExternalSearchUrl(query, coords),
        };
    }
}

const fridgeMapsService = new FridgeMapsService();

if (typeof window !== 'undefined') {
    window.FridgeMapsService = FridgeMapsService;
    window.fridgeMapsService = fridgeMapsService;
}
