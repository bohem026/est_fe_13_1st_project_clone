const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const axios = require('axios');

// 리소스를 저장할 디렉토리 설정
const IMAGE_DIR = path.join(__dirname, 'image');
const VIDEO_DIR = path.join(__dirname, 'video');

// 폴더가 없으면 생성
if (!fs.existsSync(IMAGE_DIR)) fs.mkdirSync(IMAGE_DIR, { recursive: true });
if (!fs.existsSync(VIDEO_DIR)) fs.mkdirSync(VIDEO_DIR, { recursive: true });

// 파일 다운로드 함수
async function downloadFile(url, downloadPath) {
    try {
        const response = await axios({
            method: 'GET',
            url: url,
            responseType: 'stream',
            timeout: 10000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            }
        });
        
        const writer = fs.createWriteStream(downloadPath);
        response.data.pipe(writer);
        
        return new Promise((resolve, reject) => {
            writer.on('finish', resolve);
            writer.on('error', reject);
        });
    } catch (error) {
        console.error(`[다운로드 실패] ${url} : ${error.message}`);
    }
}

(async () => {
    // 브라우저 실행 (headless: false로 설정하면 크롤링 과정을 눈으로 볼 수 있습니다)
    const browser = await chromium.launch({ headless: false });
    const context = await browser.newContext({
        viewport: { width: 1280, height: 800 }
    });
    const page = await context.newPage();

    console.log('🕵️‍♂️ 네트워크 모니터링 및 크롤링 시작...');

    // 다운로드 중복 방지를 위한 Set
    const downloadedUrls = new Set();

    // 네트워크 요청/응답 가로채기 (네트워크 탭 감지 방식)
    page.on('response', async (response) => {
        const url = response.url();
        const contentType = response.headers()['content-type'] || '';
        
        if (downloadedUrls.has(url)) return;

        // 1. 이미지 감지 (.png, .jpg, .jpeg, .svg, .webp 등)
        if (contentType.startsWith('image/') || /\.(jpg|jpeg|png|svg|webp|gif)/i.test(url)) {
            downloadedUrls.add(url);
            const ext = url.split('.').pop().split('?')[0] || 'png';
            const filename = `img_${Date.now()}_${Math.floor(Math.random() * 1000)}.${ext}`;
            const savePath = path.join(IMAGE_DIR, filename);
            
            console.log(`📸 이미지 발견: ${url}`);
            await downloadFile(url, savePath);
        }

        // 2. 영상 파일 감지 (.mp4, .webm 등)
        if (contentType.startsWith('video/') || /\.(mp4|webm|mov)/i.test(url)) {
            downloadedUrls.add(url);
            const ext = url.split('.').pop().split('?')[0] || 'mp4';
            const filename = `video_${Date.now()}_${Math.floor(Math.random() * 1000)}.${ext}`;
            const savePath = path.join(VIDEO_DIR, filename);
            
            console.log(`🎬 영상 발견: ${url}`);
            await downloadFile(url, savePath);
        }
    });

    // 대상 페이지 이동
    await page.goto('https://estbootcamp.co.kr/', { waitUntil: 'networkidle' });

    // 지연 로딩(Lazy Load) 이미지와 리소스를 깨우기 위해 천천히 끝까지 스크롤 다운
    console.log('📜 동적 리소스 로드를 위해 스크롤을 내립니다...');
    await page.evaluate(async () => {
        await new Promise((resolve) => {
            let totalHeight = 0;
            const distance = 100;
            const timer = setInterval(() => {
                const scrollHeight = document.body.scrollHeight;
                window.scrollBy(0, distance);
                totalHeight += distance;

                if (totalHeight >= scrollHeight) {
                    clearInterval(timer);
                    resolve();
                }
            }, 100); // 0.1초마다 100px씩 스크롤
        });
    });

    // 추가적인 네트워크 다운로드를 위해 잠시 대기
    await page.waitForTimeout(5000);

    // iframe(유튜브 등 외부 임베드 영상) 주소 체크용 로그
    const iframes = await page.locator('iframe').all();
    if (iframes.length > 0) {
        console.log('\n📺 [참고] 외부 플랫폼(유튜브/비메오 등) 임베드 영상 링크:');
        for (const iframe of iframes) {
            const src = await iframe.getAttribute('src');
            if (src) console.log(` - ${src}`);
        }
    }

    console.log('\n✅ 크롤링 작업이 완료되었습니다.');
    await browser.close();
})();