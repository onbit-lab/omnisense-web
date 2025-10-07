// 언어 시스템 관리
// 현재 언어 상태 저장 - window 객체에 할당
window.currentLanguage = 'ko';

// 언어 설정 객체 - window 객체에 할당
window.translations = {
  ko: {
    // 네비게이션
    'Streaming': '스트리밍',
    'Settings': '설정',
    'Status': '상태',
    'Help': '도움말',
    
    // 메인 제목
    'OMNISENSE 실시간 스트리밍': 'OMNISENSE 실시간 스트리밍',
    'Click "Start Stream" to begin live broadcast': '"스트리밍 시작"을 클릭하여 실시간 방송을 시작하세요',
    'Start Stream': '스트리밍 시작',
    'Stop Stream': '스트리밍 중지',
    'HD 1280x720': 'HD 1280x720',
    'Viewers': '시청자',
    'Quality': '화질',
    'Stream Console': '스트리밍 콘솔',
    
    // 설정 섹션
    'Stream Settings': '스트리밍 설정',
    'Video Quality': '비디오 화질',
    'Frame Rate': '프레임율',
    'Audio': '오디오',
    'HD (1280x720)': 'HD (1280x720)',
    'FHD (1920x1080)': 'FHD (1920x1080)',
    '4K (3840x2160)': '4K (3840x2160)',
    '30 FPS': '30 FPS',
    '60 FPS': '60 FPS',
    '높은 화질은 더 많은 대역폭을 사용합니다': '높은 화질은 더 많은 대역폭을 사용합니다',
    '높은 프레임율은 더 부드러운 영상을 제공합니다': '높은 프레임율은 더 부드러운 영상을 제공합니다',
    '오디오 스트리밍을 활성화/비활성화합니다': '오디오 스트리밍을 활성화/비활성화합니다',
    
    // 상태 섹션
    'Device Status': '디바이스 상태',
    'Battery': '배터리',
    'Signal': '신호',
    'Temperature': '온도',
    'Storage': '저장공간',
    
    // 도움말 섹션
    'Help & Support': '도움말 및 지원',
    'Quick Start': '빠른 시작',
    'Troubleshooting': '문제 해결',
    'Device Info': '디바이스 정보',
    'Click "Start Stream" to begin broadcasting. The wearable camera will automatically connect and start streaming.': '"스트리밍 시작"을 클릭하여 방송을 시작하세요. 웨어러블 카메라가 자동으로 연결되어 스트리밍을 시작합니다.',
    'Check camera connection': '카메라 연결 확인',
    'Verify network connectivity': '네트워크 연결 확인',
    'Restart device if needed': '필요시 디바이스 재시작',
    'RADXA CM5 Wearable Streaming Device': 'RADXA CM5 웨어러블 스트리밍 디바이스',
    'Firmware: v1.0.0': '펌웨어: v1.0.0',
    'WebRTC Enabled': 'WebRTC 지원',
    
    // 접근성 패널
    '접근성 설정': '접근성 설정',
    '글자 크기': '글자 크기',
    '대비': '대비',
    '보통': '보통',
    '크게': '크게',
    '매우 크게': '매우 크게',
    '높음': '높음',
    '애니메이션 줄이기': '애니메이션 줄이기',
    '스크린 리더 모드': '스크린 리더 모드',
    '닫기': '닫기'
  },
  en: {
    // 네비게이션
    'Streaming': 'Streaming',
    'Settings': 'Settings',
    'Status': 'Status',
    'Help': 'Help',
    
    // 메인 제목
    'OMNISENSE 실시간 스트리밍': 'OMNISENSE Live Streaming',
    'Click "Start Stream" to begin live broadcast': 'Click "Start Stream" to begin live broadcast',
    'Start Stream': 'Start Stream',
    'Stop Stream': 'Stop Stream',
    'HD 1280x720': 'HD 1280x720',
    'Viewers': 'Viewers',
    'Quality': 'Quality',
    'Stream Console': 'Stream Console',
    
    // 설정 섹션
    'Stream Settings': 'Streaming Settings',
    'Video Quality': 'Video Quality',
    'Frame Rate': 'Frame Rate',
    'Audio': 'Audio',
    'HD (1280x720)': 'HD (1280x720)',
    'FHD (1920x1080)': 'FHD (1920x1080)',
    '4K (3840x2160)': '4K (3840x2160)',
    '30 FPS': '30 FPS',
    '60 FPS': '60 FPS',
    '높은 화질은 더 많은 대역폭을 사용합니다': 'Higher quality uses more bandwidth',
    '높은 프레임율은 더 부드러운 영상을 제공합니다': 'Higher frame rate provides smoother video',
    '오디오 스트리밍을 활성화/비활성화합니다': 'Enable/disable audio streaming',
    
    // 상태 섹션
    'Device Status': 'Device Status',
    'Battery': 'Battery',
    'Signal': 'Signal',
    'Temperature': 'Temperature',
    'Storage': 'Storage',
    'Strong': 'Strong',
    
    // 도움말 섹션
    'Help & Support': 'Help & Support',
    'Quick Start': 'Quick Start',
    'Troubleshooting': 'Troubleshooting',
    'Device Info': 'Device Info',
    'Click "Start Stream" to begin broadcasting. The wearable camera will automatically connect and start streaming.': 'Click "Start Stream" to begin broadcasting. The wearable camera will automatically connect and start streaming.',
    'Check camera connection': 'Check camera connection',
    'Verify network connectivity': 'Verify network connectivity',
    'Restart device if needed': 'Restart device if needed',
    'RADXA CM5 Wearable Streaming Device': 'RADXA CM5 Wearable Streaming Device',
    'Firmware: v1.0.0': 'Firmware: v1.0.0',
    'WebRTC Enabled': 'WebRTC Enabled',
    
    // 접근성 패널
    '접근성 설정': 'Accessibility Settings',
    '글자 크기': 'Font Size',
    '대비': 'Contrast',
    '보통': 'Normal',
    '크게': 'Large',
    '매우 크게': 'Extra Large',
    '높음': 'High',
    '애니메이션 줄이기': 'Reduce Motion',
    '스크린 리더 모드': 'Screen Reader Mode',
    '닫기': 'Close'
  }
};

// 언어 시스템 초기화 - window 객체에 할당
window.initializeLanguageSystem = function() {
  // localStorage에서 저장된 언어 설정 로드
  const savedLanguage = JSON.parse(localStorage.getItem('accessibility_language') || '"ko"');
  window.currentLanguage = savedLanguage;
  
  // 초기 언어 적용 (DOM이 준비되기 전이므로 간단히)
  document.documentElement.lang = savedLanguage === 'ko' ? 'ko' : 'en';
}

// 언어 설정 함수 - window 객체에 할당
window.setLanguage = function(lang) {
  // 유효한 언어인지 확인
  if (!window.translations[lang]) {
    console.warn(`Language ${lang} not supported, using Korean as fallback`);
    lang = 'ko';
  }
  
  window.currentLanguage = lang;
  
  const elements = document.querySelectorAll('[data-translate]');
  elements.forEach(element => {
    const key = element.getAttribute('data-translate');
    if (window.translations[lang] && window.translations[lang][key]) {
      element.textContent = window.translations[lang][key];
    } else {
      console.warn(`Translation not found for key: ${key} in language: ${lang}`);
    }
  });
  
  // 특별한 경우들 처리
  updateSpecialElements(lang);
  
  // HTML lang 속성 업데이트
  document.documentElement.lang = lang === 'ko' ? 'ko' : 'en';
  
  // 언어 버튼 상태 업데이트
  updateLanguageButtonStates(lang);
  
  // 언어 설정 저장
  localStorage.setItem('accessibility_language', JSON.stringify(lang));
}

window.getCurrentLanguage = function() {
  return window.currentLanguage;
}

function updateLanguageButtonStates(lang) {
  document.querySelectorAll('.language-btn').forEach(btn => {
    const isActive = btn.getAttribute('data-lang') === lang;
    btn.classList.toggle('active', isActive);
    btn.setAttribute('aria-pressed', isActive.toString());
  });
}

function updateSpecialElements(lang) {
  // 버튼 텍스트 업데이트
  const streamBtn = document.getElementById('viewCamera');
  if (streamBtn && typeof window.updateUIForStreamingState === 'function') {
    // 현재 스트리밍 상태에 맞게 UI 업데이트
    window.updateUIForStreamingState(window.isStreaming || false);
  }
  
  // 접근성 패널 닫기 버튼
  const closeBtn = document.querySelector('.close-accessibility');
  if (closeBtn) {
    closeBtn.textContent = window.translations[lang]['닫기'];
  }
}

// Export functions for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    initializeLanguageSystem: window.initializeLanguageSystem,
    setLanguage: window.setLanguage,
    getCurrentLanguage: window.getCurrentLanguage,
    translations: window.translations
  };
}
