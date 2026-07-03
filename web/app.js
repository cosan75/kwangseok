/**
 * 텃밭 채소를 부탁해 프론트엔드
 */

class FridgeRecipeApp {
    constructor() {
        this.currentImage = null;
        this.currentRecipe = null;
        this.recognizedIngredients = [];
        this.init();
    }

    init() {
        this.initSettingsModal();
        this.initImageUpload();
        this.initIngredientRecognition();
        this.initRecipeGeneration();
        this.initNearbyRestaurants();
        this.updateUI();
    }

    /**
     * 설정 모달 초기화
     */
    initSettingsModal() {
        const settingsBtn = document.getElementById('settingsBtn');
        const settingsModal = document.getElementById('settingsModal');
        const closeSettingsBtn = document.getElementById('closeSettingsBtn');
        const cancelSettingsBtn = document.getElementById('cancelSettingsBtn');
        const saveApiKeyBtn = document.getElementById('saveApiKeyBtn');
        const apiKeyInput = document.getElementById('apiKeyInput');
        const apiKeyStatus = document.getElementById('apiKeyStatus');
        const modalBackdrop = settingsModal?.querySelector('.modal-backdrop');

        // 저장된 API 키 불러오기
        const savedApiKey = localStorage.getItem('openrouter_api_key');
        if (savedApiKey) {
            apiKeyInput.value = savedApiKey;
        }

        const mapsApiKeyInput = document.getElementById('mapsApiKeyInput');
        const mapsApiKeyStatus = document.getElementById('mapsApiKeyStatus');
        const savedMapsApiKey = localStorage.getItem('google_maps_api_key');
        if (savedMapsApiKey && mapsApiKeyInput) {
            mapsApiKeyInput.value = savedMapsApiKey;
        }

        const openModal = () => {
            settingsModal?.classList.remove('hidden');
            document.body.style.overflow = 'hidden';
        };

        const closeModal = () => {
            settingsModal?.classList.add('hidden');
            document.body.style.overflow = '';
            apiKeyStatus?.classList.add('hidden');
        };

        settingsBtn?.addEventListener('click', openModal);
        closeSettingsBtn?.addEventListener('click', closeModal);
        cancelSettingsBtn?.addEventListener('click', closeModal);
        modalBackdrop?.addEventListener('click', closeModal);

        saveApiKeyBtn?.addEventListener('click', () => {
            const apiKey = apiKeyInput.value.trim();

            if (!apiKey) {
                apiKeyStatus.textContent = '❌ API 키를 입력해주세요.';
                apiKeyStatus.style.color = '#ef4444';
                apiKeyStatus.classList.remove('hidden');
                return;
            }

            if (!apiKey.startsWith('sk-or-v1-')) {
                apiKeyStatus.textContent = '❌ 올바른 OpenRouter API 키 형식이 아닙니다.';
                apiKeyStatus.style.color = '#ef4444';
                apiKeyStatus.classList.remove('hidden');
                return;
            }

            window.fridgeRecipeBackend.setApiKey(apiKey);
            apiKeyStatus.textContent = '✅ API 키가 저장되었습니다!';
            apiKeyStatus.style.color = '#10b981';
            apiKeyStatus.classList.remove('hidden');

            setTimeout(() => {
                closeModal();
            }, 1500);
        });

        apiKeyInput?.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                saveApiKeyBtn?.click();
            }
        });

        mapsApiKeyInput?.addEventListener('change', () => {
            const mapsApiKey = mapsApiKeyInput.value.trim();

            if (!mapsApiKey) {
                localStorage.removeItem('google_maps_api_key');
                return;
            }

            window.fridgeMapsService?.setApiKey(mapsApiKey);
            mapsApiKeyStatus.textContent = '✅ 구글맵 API 키가 저장되었습니다!';
            mapsApiKeyStatus.style.color = '#10b981';
            mapsApiKeyStatus.classList.remove('hidden');
        });
    }

    /**
     * 이미지 업로드 초기화
     */
    initImageUpload() {
        const uploadArea = document.getElementById('uploadArea');
        const imageInput = document.getElementById('imageInput');
        const cameraInput = document.getElementById('cameraInput');
        const selectImageBtn = document.getElementById('selectImageBtn');
        const takePhotoBtn = document.getElementById('takePhotoBtn');
        const imagePreview = document.getElementById('imagePreview');
        const previewImage = document.getElementById('previewImage');
        const removeImageBtn = document.getElementById('removeImageBtn');
        const ingredientsText = document.getElementById('ingredientsText');
        const generateRecipeBtn = document.getElementById('generateRecipeBtn');

        // 파일 선택 버튼
        selectImageBtn?.addEventListener('click', () => {
            imageInput?.click();
        });

        // 사진 찍기 버튼
        takePhotoBtn?.addEventListener('click', () => {
            cameraInput?.click();
        });

        // 사진 촬영 시 바로 업로드
        cameraInput?.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                this.handleImageFile(file);
            }
        });

        // 샘플 이미지 버튼들
        document.querySelectorAll('.sample-image-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const sampleName = btn.dataset.sample;
                this.loadSampleImage(sampleName);
            });
        });

        // 파일 선택 시
        imageInput?.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                this.handleImageFile(file);
            }
        });

        // 드래그 앤 드롭
        uploadArea?.addEventListener('dragover', (e) => {
            e.preventDefault();
            uploadArea.classList.add('drag-active');
        });

        uploadArea?.addEventListener('dragleave', () => {
            uploadArea.classList.remove('drag-active');
        });

        uploadArea?.addEventListener('drop', (e) => {
            e.preventDefault();
            uploadArea.classList.remove('drag-active');
            const file = e.dataTransfer.files[0];
            if (file && file.type.startsWith('image/')) {
                this.handleImageFile(file);
            }
        });

        // 이미지 제거
        removeImageBtn?.addEventListener('click', () => {
            this.currentImage = null;
            this.recognizedIngredients = [];
            imageInput.value = '';
            if (cameraInput) cameraInput.value = '';
            document.querySelector('.upload-placeholder')?.classList.remove('hidden');
            imagePreview?.classList.add('hidden');
            document.getElementById('recognizedIngredientsSection')?.classList.add('hidden');
            this.updateGenerateButton();
        });

        // 재료 입력 시
        ingredientsText?.addEventListener('input', () => {
            this.updateGenerateButton();
        });
    }

    /**
     * 이미지 최적화 (리사이징 및 품질 조정)
     */
    async optimizeImage(imageBase64, maxWidth = 1024, maxHeight = 1024, quality = 0.85) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;

                // 비율 유지하면서 리사이징
                if (width > maxWidth || height > maxHeight) {
                    const ratio = Math.min(maxWidth / width, maxHeight / height);
                    width = Math.floor(width * ratio);
                    height = Math.floor(height * ratio);
                }

                canvas.width = width;
                canvas.height = height;

                const ctx = canvas.getContext('2d');
                // 이미지 품질 향상을 위한 설정
                ctx.imageSmoothingEnabled = true;
                ctx.imageSmoothingQuality = 'high';
                ctx.drawImage(img, 0, 0, width, height);

                // JPEG 형식으로 변환 (용량 감소)
                const optimizedBase64 = canvas.toDataURL('image/jpeg', quality);
                console.log(`이미지 최적화: ${img.width}x${img.height} → ${width}x${height}`);
                console.log(`크기 감소: ${(imageBase64.length / 1024).toFixed(2)}KB → ${(optimizedBase64.length / 1024).toFixed(2)}KB`);
                resolve(optimizedBase64);
            };
            img.onerror = () => reject(new Error('이미지 로드 실패'));
            img.src = imageBase64;
        });
    }

    /**
     * 샘플 이미지 로드
     */
    async loadSampleImage(sampleName) {
        try {
            const response = await fetch(`samples/${sampleName}`);
            const blob = await response.blob();

            // Blob을 base64로 변환
            const reader = new FileReader();
            reader.onload = async (e) => {
                // 이미지 최적화
                const optimizedImage = await this.optimizeImage(e.target.result);
                this.currentImage = optimizedImage;
                this.recognizedIngredients = [];

                const previewImage = document.getElementById('previewImage');
                previewImage.src = this.currentImage;
                document.querySelector('.upload-placeholder')?.classList.add('hidden');
                document.getElementById('imagePreview')?.classList.remove('hidden');

                // 새 이미지 업로드 시 재료 입력창 초기화
                const ingredientsText = document.getElementById('ingredientsText');
                ingredientsText.value = '';

                // 재료 인식 섹션 표시
                const recognizedSection = document.getElementById('recognizedIngredientsSection');
                recognizedSection?.classList.remove('hidden');

                // 재료 인식 안내 표시
                const recognizedContent = document.getElementById('recognizedIngredientsContent');
                recognizedContent.innerHTML = '<p class="recognized-hint">📸 "재료 분석하기" 버튼을 눌러 이미지 속 재료를 인식하세요.</p>';

                this.updateGenerateButton();
            };
            reader.readAsDataURL(blob);
        } catch (error) {
            console.error('샘플 이미지 로드 실패:', error);
            this.showToast('샘플 이미지를 불러올 수 없습니다.', 'error');
        }
    }

    /**
     * 이미지 파일 처리
     */
    handleImageFile(file) {
        const reader = new FileReader();
        reader.onload = async (e) => {
            // 이미지 최적화
            const optimizedImage = await this.optimizeImage(e.target.result);
            this.currentImage = optimizedImage;
            this.recognizedIngredients = [];

            const previewImage = document.getElementById('previewImage');
            previewImage.src = this.currentImage;
            document.querySelector('.upload-placeholder')?.classList.add('hidden');
            document.getElementById('imagePreview')?.classList.remove('hidden');

            // 새 이미지 업로드 시 재료 입력창 초기화
            const ingredientsText = document.getElementById('ingredientsText');
            ingredientsText.value = '';

            // 재료 인식 섹션 표시
            const recognizedSection = document.getElementById('recognizedIngredientsSection');
            recognizedSection?.classList.remove('hidden');

            // 재료 인식 안내 표시
            const recognizedContent = document.getElementById('recognizedIngredientsContent');
            recognizedContent.innerHTML = '<p class="recognized-hint">📸 "재료 분석하기" 버튼을 눌러 이미지 속 재료를 인식하세요.</p>';

            this.updateGenerateButton();
        };
        reader.readAsDataURL(file);
    }

    /**
     * 레시피 생성 버튼 상태 업데이트
     */
    updateGenerateButton() {
        const ingredientsText = document.getElementById('ingredientsText');
        const generateRecipeBtn = document.getElementById('generateRecipeBtn');

        const hasImage = this.currentImage !== null;
        const hasText = ingredientsText?.value.trim().length > 0;
        const hasRecognized = this.recognizedIngredients.length > 0;

        generateRecipeBtn.disabled = !(hasImage || hasText || hasRecognized);
    }

    /**
     * 재료 인식 초기화
     */
    initIngredientRecognition() {
        const analyzeImageBtn = document.getElementById('analyzeImageBtn');

        analyzeImageBtn?.addEventListener('click', () => {
            this.analyzeImage();
        });
    }

    /**
     * 이미지 분석 및 재료 인식
     */
    async analyzeImage() {
        if (!this.currentImage) {
            this.showToast('이미지를 먼저 업로드해주세요.', 'error');
            return;
        }

        const analyzeBtn = document.getElementById('analyzeImageBtn');
        const recognizedContent = document.getElementById('recognizedIngredientsContent');

        // 분석 중 표시
        analyzeBtn.disabled = true;
        analyzeBtn.innerHTML = '<span class="btn-icon">⏳</span> 분석 중...';
        recognizedContent.innerHTML = '<div class="loading-mini"><div class="loading-spinner-small"></div><p>재료를 인식하는 중...</p></div>';

        try {
            const ingredients = await window.fridgeRecipeBackend.recognizeIngredients(this.currentImage);
            this.recognizedIngredients = ingredients;

            if (ingredients.length > 0) {
                // 인식된 재료 표시
                const html = `
                    <div class="recognized-list">
                        ${ingredients.map((ing, index) => `
                            <div class="recognized-item">
                                <span class="recognized-number">${index + 1}</span>
                                <span class="recognized-name">${ing}</span>
                            </div>
                        `).join('')}
                    </div>
                    <p class="recognized-note">💡 이 재료들로 레시피를 추천받거나, 아래에 추가 재료를 입력하세요.</p>
                `;
                recognizedContent.innerHTML = html;

                // 재료를 텍스트 입력창에 업데이트 (항상 새로운 재료로 교체)
                const ingredientsText = document.getElementById('ingredientsText');
                ingredientsText.value = ingredients.join(', ');

                this.showToast(`${ingredients.length}개의 재료를 인식했습니다!`, 'success');
            } else {
                recognizedContent.innerHTML = '<p class="recognized-error">❌ 재료를 인식하지 못했습니다. 다른 사진을 시도해보세요.</p>';
                this.showToast('재료를 인식하지 못했습니다.', 'error');
            }
        } catch (error) {
            console.error('재료 인식 오류:', error);

            // 에러 메시지 분석
            let errorMessage = '❌ 재료 인식에 실패했습니다.';
            let toastMessage = '재료 인식에 실패했습니다.';

            if (error.message.includes('API 키')) {
                errorMessage = '❌ API 키를 설정해주세요.';
                toastMessage = '⚠️ API 키를 설정해주세요.';
            } else if (error.message.includes('처리하지 못했습니다')) {
                errorMessage = '❌ AI가 이 이미지를 처리하지 못했습니다.<br/>💡 더 단순하고 명확한 구도의 텃밭 채소 사진을 업로드해보세요.';
                toastMessage = '이미지를 처리하지 못했습니다. 다른 사진을 시도해보세요.';
            } else if (error.message.includes('크기가 너무')) {
                errorMessage = '❌ 이미지 크기가 너무 큽니다. 작은 이미지를 사용해주세요.';
                toastMessage = '이미지 크기가 너무 큽니다.';
            } else if (error.message.includes('사용량이 많습니다')) {
                errorMessage = '❌ 무료 AI 서버가 현재 사용량이 많습니다.<br/>⏰ 잠시 후 다시 시도해주세요.';
                toastMessage = '서버가 바쁩니다. 잠시 후 다시 시도해주세요.';
            } else {
                errorMessage += ' 잠시 후 다시 시도해주세요.';
            }

            recognizedContent.innerHTML = `<p class="recognized-error">${errorMessage}</p>`;
            this.showToast(toastMessage, 'error');
        } finally {
            analyzeBtn.disabled = false;
            analyzeBtn.innerHTML = '<span class="btn-icon">🔍</span> 재료 분석하기';
            this.updateGenerateButton();
        }
    }

    /**
     * 레시피 생성 초기화
     */
    initRecipeGeneration() {
        const generateRecipeBtn = document.getElementById('generateRecipeBtn');
        const newSearchBtn = document.getElementById('newSearchBtn');

        generateRecipeBtn?.addEventListener('click', () => {
            this.generateRecipe();
        });

        newSearchBtn?.addEventListener('click', () => {
            this.resetSearch();
        });
    }

    /**
     * 레시피 생성
     */
    async generateRecipe() {
        const ingredientsText = document.getElementById('ingredientsText');
        const ingredients = ingredientsText?.value.trim() || '';

        // UI 업데이트
        document.getElementById('loadingSection')?.classList.remove('hidden');
        document.getElementById('recipeResult')?.classList.add('hidden');

        try {
            // 이미지가 있으면 이미지와 함께 전송
            const recipe = await window.fridgeRecipeBackend.generateRecipe(
                ingredients,
                this.currentImage
            );
            this.currentRecipe = {
                ...recipe,
                ingredients: ingredientsText?.value.trim() || '텃밭 채소 재료',
                timestamp: new Date().toISOString()
            };
            this.displayRecipe(this.currentRecipe);
        } catch (error) {
            console.error('레시피 생성 오류:', error);

            // API 키 오류인 경우
            if (error.message.includes('API 키')) {
                this.showToast('⚠️ API 키를 설정해주세요. 설정 버튼을 클릭하세요.', 'warning');
                // 대체 레시피 표시
                const fallbackRecipe = window.fridgeRecipeBackend.getFallbackRecipe(ingredients || '텃밭 채소 재료');
                this.currentRecipe = {
                    ...fallbackRecipe,
                    ingredients: ingredients || '텃밭 채소 재료',
                    timestamp: new Date().toISOString()
                };
                this.displayRecipe(this.currentRecipe);
            } else {
                this.showToast('레시피 생성에 실패했습니다. 다시 시도해주세요.', 'error');
            }
        } finally {
            document.getElementById('loadingSection')?.classList.add('hidden');
        }
    }

    /**
     * 레시피 표시
     */
    displayRecipe(recipe) {
        const recipeContent = document.getElementById('recipeContent');
        const recipeResult = document.getElementById('recipeResult');

        // ingredients와 steps를 배열로 변환
        const ingredients = Array.isArray(recipe.ingredients)
            ? recipe.ingredients
            : [recipe.ingredients];

        const steps = Array.isArray(recipe.steps)
            ? recipe.steps
            : [recipe.steps];

        const html = `
            <div class="recipe-header">
                <h3 class="recipe-dish-name">${recipe.dishName}</h3>
                <div class="recipe-meta">
                    <span class="recipe-badge">⏱️ ${recipe.cookingTime}</span>
                    <span class="recipe-badge">📊 ${recipe.difficulty}</span>
                </div>
            </div>

            <div class="recipe-section">
                <h4 class="recipe-section-title">
                    <span>🥬</span> 재료
                </h4>
                <ul class="recipe-ingredients-list">
                    ${ingredients.map(ing => `<li>${ing}</li>`).join('')}
                </ul>
            </div>

            <div class="recipe-section">
                <h4 class="recipe-section-title">
                    <span>👨‍🍳</span> 조리법
                </h4>
                <ol class="recipe-steps-list">
                    ${steps.map(step => `<li>${step.replace(/^\d+\.\s*/, '')}</li>`).join('')}
                </ol>
            </div>

            <div class="recipe-tip">
                <strong>💡 Tip:</strong> ${recipe.tip}
            </div>
        `;

        recipeContent.innerHTML = html;
        recipeResult?.classList.remove('hidden');
        this.resetNearbyRestaurants();

        // 결과로 스크롤
        recipeResult?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    /**
     * 근처 맛집 찾기 초기화
     */
    initNearbyRestaurants() {
        const findNearbyBtn = document.getElementById('findNearbyBtn');
        findNearbyBtn?.addEventListener('click', () => this.findNearbyRestaurants());
    }

    /**
     * 근처 맛집 섹션 초기 상태로 되돌리기
     */
    resetNearbyRestaurants() {
        const findNearbyBtn = document.getElementById('findNearbyBtn');
        const nearbyResult = document.getElementById('nearbyResult');
        const nearbyMapWrapper = document.getElementById('nearbyMapWrapper');

        if (findNearbyBtn) {
            findNearbyBtn.disabled = false;
            findNearbyBtn.classList.remove('hidden');
            findNearbyBtn.innerHTML = '<span class="btn-icon">🍽️</span> 근처 맛집 찾기';
        }
        nearbyResult?.classList.add('hidden');
        nearbyMapWrapper?.classList.add('hidden');
    }

    /**
     * 레시피와 어울리는 근처 맛집을 구글 지도로 찾기
     */
    async findNearbyRestaurants() {
        const findNearbyBtn = document.getElementById('findNearbyBtn');
        const nearbyResult = document.getElementById('nearbyResult');
        const nearbyMapWrapper = document.getElementById('nearbyMapWrapper');
        const nearbyMapFrame = document.getElementById('nearbyMapFrame');
        const nearbyExternalLink = document.getElementById('nearbyExternalLink');

        if (!this.currentRecipe || !window.fridgeMapsService) return;

        findNearbyBtn.disabled = true;
        findNearbyBtn.innerHTML = '<span class="btn-icon">🔍</span> 맛집 찾는 중...';

        try {
            const { embedUrl, externalUrl } = await window.fridgeMapsService.findNearbyRestaurants(
                this.currentRecipe.dishName
            );

            if (embedUrl) {
                nearbyMapFrame.src = embedUrl;
                nearbyMapWrapper?.classList.remove('hidden');
            } else {
                nearbyMapWrapper?.classList.add('hidden');
            }

            nearbyExternalLink.href = externalUrl;
            nearbyResult?.classList.remove('hidden');
            findNearbyBtn.classList.add('hidden');
        } catch (error) {
            console.error('근처 맛집 찾기 실패:', error);
            this.showToast('근처 맛집을 찾는 중 문제가 발생했습니다.', 'error');
            findNearbyBtn.disabled = false;
            findNearbyBtn.innerHTML = '<span class="btn-icon">🍽️</span> 근처 맛집 찾기';
        }
    }

    /**
     * 검색 초기화
     */
    resetSearch() {
        this.currentImage = null;
        this.currentRecipe = null;

        document.getElementById('imageInput').value = '';
        document.getElementById('cameraInput').value = '';
        document.getElementById('ingredientsText').value = '';
        document.querySelector('.upload-placeholder')?.classList.remove('hidden');
        document.getElementById('imagePreview')?.classList.add('hidden');
        document.getElementById('recipeResult')?.classList.add('hidden');
        document.getElementById('recognizedIngredientsSection')?.classList.add('hidden');
        this.resetNearbyRestaurants();

        this.updateGenerateButton();
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    /**
     * UI 업데이트
     */
    updateUI() {
        this.updateGenerateButton();
    }

    /**
     * 토스트 메시지 표시
     */
    showToast(message, type = 'success') {
        const toast = document.getElementById('successToast');
        const toastMessage = toast?.querySelector('.toast-message');

        if (toastMessage) {
            toastMessage.textContent = message;
        }

        toast?.classList.remove('hidden');

        setTimeout(() => {
            toast?.classList.add('hidden');
        }, 3000);
    }
}

// 앱 초기화
let fridgeRecipeApp;

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        fridgeRecipeApp = new FridgeRecipeApp();
        window.fridgeRecipeApp = fridgeRecipeApp;
    });
} else {
    fridgeRecipeApp = new FridgeRecipeApp();
    window.fridgeRecipeApp = fridgeRecipeApp;
}

console.log('텃밭 채소를 부탁해 앱이 로드되었습니다.');
