// GIF 로딩 화면 처리
window.addEventListener('load', function() {
  // 로딩 사운드 재생
  const loadingAudio = document.getElementById('loadingAudio');
  
  // 사용자 상호작용 없이 오디오 재생을 시도 (일부 브라우저에서 제한될 수 있음)
  const playLoadingAudio = () => {
    loadingAudio.play().catch(error => {
      console.log('Loading audio autoplay prevented:', error);
      // 오디오 재생이 차단된 경우, 사용자 클릭 시 재생하도록 설정
      document.addEventListener('click', () => {
        loadingAudio.play().catch(e => console.log('Audio play failed:', e));
      }, { once: true });
    });
  };
  
  // 오디오 로드 완료 후 재생
  if (loadingAudio.readyState >= 2) {
    playLoadingAudio();
  } else {
    loadingAudio.addEventListener('canplay', playLoadingAudio, { once: true });
  }
  
  // 접근성 기능 초기화
  initAccessibilityFeatures();
  
  // PWA 설치 프롬프트 처리
  let deferredPrompt;
  
  window.addEventListener('beforeinstallprompt', (e) => {
    console.log('PWA: Install prompt available');
    e.preventDefault();
    deferredPrompt = e;
    
    // PWA 설치 버튼 표시 (선택사항)
    showInstallButton();
  });
  
  // PWA 설치 완료 감지
  window.addEventListener('appinstalled', (evt) => {
    console.log('PWA: App installed successfully');
    log('앱이 성공적으로 설치되었습니다!');
  });
  
  // Service Worker 등록
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js')
      .then(registration => {
        console.log('PWA: Service Worker registered', registration);
      })
      .catch(error => {
        console.log('PWA: Service Worker registration failed', error);
      });
  }
  
  // 4초 후에 로딩 화면 숨기고 메인 콘텐츠 표시
  setTimeout(function() {
    // 로딩 오디오 정지
    const loadingAudio = document.getElementById('loadingAudio');
    if (loadingAudio) {
      loadingAudio.pause();
      loadingAudio.currentTime = 0;
    }
    
    document.getElementById('loadingScreen').classList.add('hidden');
    document.getElementById('main-content').classList.add('show');
    // 메인 콘텐츠에 포커스 설정 (스크린 리더 사용자를 위해)
    document.getElementById('main-content').focus();
  }, 8000); // 8초 동안 GIF와 오디오 재생
});

// 접근성 기능 초기화
function initAccessibilityFeatures() {
  // 접근성 패널 토글
  const accessibilityToggle = document.getElementById('accessibilityToggle');
  const accessibilityPanel = document.getElementById('accessibilityPanel');
  const closeAccessibility = document.querySelector('.close-accessibility');
  
  // 저장된 접근성 설정 로드
  loadAccessibilitySettings();
  
  accessibilityToggle.addEventListener('click', function() {
    const isOpen = accessibilityPanel.classList.contains('open');
    if (isOpen) {
      closeAccessibilityPanel();
    } else {
      openAccessibilityPanel();
    }
  });
  
  closeAccessibility.addEventListener('click', closeAccessibilityPanel);
  
  // ESC 키로 패널 닫기
  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape' && accessibilityPanel.classList.contains('open')) {
      closeAccessibilityPanel();
    }
  });
  
  // 접근성 설정 이벤트 리스너
  document.getElementById('fontSize').addEventListener('change', function() {
    applyFontSize(this.value);
    saveAccessibilitySetting('fontSize', this.value);
  });
  
  document.getElementById('contrast').addEventListener('change', function() {
    applyContrast(this.value);
    saveAccessibilitySetting('contrast', this.value);
  });
  
  document.getElementById('reduceMotion').addEventListener('change', function() {
    applyReducedMotion(this.checked);
    saveAccessibilitySetting('reduceMotion', this.checked);
  });
  
  document.getElementById('screenReader').addEventListener('change', function() {
    applyScreenReaderMode(this.checked);
    saveAccessibilitySetting('screenReader', this.checked);
  });
  
  // 언어 선택 버튼 이벤트
  document.querySelectorAll('.language-btn').forEach(btn => {
    btn.addEventListener('click', function() {
      const lang = this.getAttribute('data-lang');
      setLanguage(lang);
      
      // 활성 상태 업데이트
      document.querySelectorAll('.language-btn').forEach(b => b.classList.remove('active'));
      this.classList.add('active');
      
      saveAccessibilitySetting('language', lang);
    });
  });
}

function openAccessibilityPanel() {
  const panel = document.getElementById('accessibilityPanel');
  panel.classList.add('open');
  panel.setAttribute('aria-hidden', 'false');
  // 첫 번째 컨트롤에 포커스
  panel.querySelector('select').focus();
}

function closeAccessibilityPanel() {
  const panel = document.getElementById('accessibilityPanel');
  panel.classList.remove('open');
  panel.setAttribute('aria-hidden', 'true');
  // 토글 버튼으로 포커스 복귀
  document.getElementById('accessibilityToggle').focus();
}

function applyFontSize(size) {
  document.body.classList.remove('large-text', 'xlarge-text');
  if (size === 'large') {
    document.body.classList.add('large-text');
  } else if (size === 'xlarge') {
    document.body.classList.add('xlarge-text');
  }
}

function applyContrast(contrast) {
  document.body.classList.remove('high-contrast');
  if (contrast === 'high') {
    document.body.classList.add('high-contrast');
  }
}

function applyReducedMotion(enabled) {
  if (enabled) {
    document.documentElement.style.setProperty('--animation-duration', '0.01ms');
    document.documentElement.style.setProperty('--transition-duration', '0.01ms');
  } else {
    document.documentElement.style.removeProperty('--animation-duration');
    document.documentElement.style.removeProperty('--transition-duration');
  }
}

function applyScreenReaderMode(enabled) {
  document.body.classList.toggle('screen-reader-mode', enabled);
  
  // 스크린 리더 모드에서 추가 설명 제공
  if (enabled) {
    announceToScreenReader('스크린 리더 모드가 활성화되었습니다. 추가 설명이 제공됩니다.');
  }
}

// 언어 설정 객체
const translations = {
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
    'HD 1280x960': 'HD 1280x960',
    'Viewers': '시청자',
    'Quality': '화질',
    'Stream Console': '스트리밍 콘솔',
    
    // 설정 섹션
    'Stream Settings': '스트리밍 설정',
    'Video Quality': '비디오 화질',
    'Frame Rate': '프레임율',
    'Audio': '오디오',
    'HD (1280x960)': 'HD (1280x960)',
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
    'Strong': '강함',
    
    // 도움말 섹션
    'Help & Support': '도움말 및 지원',
    'Quick Start': '빠른 시작',
    'Troubleshooting': '문제 해결',
    'Device Info': '디바이스 정보',
    'Click "Start Stream" to begin broadcasting. The wearable camera will automatically connect and start streaming.': '"스트림 시작"을 클릭하여 방송을 시작하세요. 웨어러블 카메라가 자동으로 연결되어 스트리밍을 시작합니다.',
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
    'HD 1280x960': 'HD 1280x960',
    'Viewers': 'Viewers',
    'Quality': 'Quality',
    'Stream Console': 'Stream Console',
    
    // 설정 섹션
    'Stream Settings': 'Streaming Settings',
    'Video Quality': 'Video Quality',
    'Frame Rate': 'Frame Rate',
    'Audio': 'Audio',
    'HD (1280x960)': 'HD (1280x960)',
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

// 언어 설정 함수
function setLanguage(lang) {
  const elements = document.querySelectorAll('[data-translate]');
  elements.forEach(element => {
    const key = element.getAttribute('data-translate');
    if (translations[lang] && translations[lang][key]) {
      element.textContent = translations[lang][key];
    }
  });
  
  // 특별한 경우들 처리
  updateSpecialElements(lang);
  
  // HTML lang 속성 업데이트
  document.documentElement.lang = lang;
}

function getCurrentLanguage() {
  return JSON.parse(localStorage.getItem('accessibility_language') || '"ko"');
}

function updateSpecialElements(lang) {
  // 버튼 텍스트 업데이트
  const streamBtn = document.getElementById('viewCamera');
  const btnText = streamBtn.querySelector('.btn-text');
  if (btnText) {
    if (isStreaming) {
      btnText.textContent = translations[lang]['Stop Stream'] || 'Stop Stream';
    } else {
      btnText.textContent = translations[lang]['Start Stream'] || 'Start Stream';
    }
  }
  
  // 접근성 패널 닫기 버튼
  const closeBtn = document.querySelector('.close-accessibility');
  if (closeBtn) {
    closeBtn.textContent = translations[lang]['닫기'];
  }
}

function announceToScreenReader(message) {
  const announcement = document.createElement('div');
  announcement.setAttribute('aria-live', 'polite');
  announcement.setAttribute('aria-atomic', 'true');
  announcement.className = 'sr-only';
  announcement.textContent = message;
  
  document.body.appendChild(announcement);
  
  // 메시지 후 제거
  setTimeout(() => {
    document.body.removeChild(announcement);
  }, 1000);
}

function saveAccessibilitySetting(key, value) {
  localStorage.setItem(`accessibility_${key}`, JSON.stringify(value));
}

function loadAccessibilitySettings() {
  // 글자 크기
  const fontSize = JSON.parse(localStorage.getItem('accessibility_fontSize') || '"normal"');
  document.getElementById('fontSize').value = fontSize;
  applyFontSize(fontSize);
  
  // 대비
  const contrast = JSON.parse(localStorage.getItem('accessibility_contrast') || '"normal"');
  document.getElementById('contrast').value = contrast;
  applyContrast(contrast);
  
  // 애니메이션 줄이기
  const reduceMotion = JSON.parse(localStorage.getItem('accessibility_reduceMotion') || 'false');
  document.getElementById('reduceMotion').checked = reduceMotion;
  applyReducedMotion(reduceMotion);
  
  // 스크린 리더 모드
  const screenReader = JSON.parse(localStorage.getItem('accessibility_screenReader') || 'false');
  document.getElementById('screenReader').checked = screenReader;
  applyScreenReaderMode(screenReader);
  
  // 언어 설정
  const language = JSON.parse(localStorage.getItem('accessibility_language') || '"ko"');
  setLanguage(language);
  document.querySelectorAll('.language-btn').forEach(btn => {
    btn.classList.toggle('active', btn.getAttribute('data-lang') === language);
  });
}

// PWA 설치 버튼 표시 함수
function showInstallButton() {
  // 설치 버튼을 헤더에 추가 (선택사항)
  const installBtn = document.createElement('button');
  installBtn.textContent = '앱 설치';
  installBtn.className = 'install-btn';
  installBtn.style.cssText = `
    background: #00d4ff;
    color: white;
    border: none;
    padding: 8px 16px;
    border-radius: 20px;
    font-size: 12px;
    cursor: pointer;
    margin-left: 10px;
  `;
  
  installBtn.addEventListener('click', async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      console.log(`PWA: User response to install prompt: ${outcome}`);
      deferredPrompt = null;
      installBtn.remove();
    }
  });
  
  document.querySelector('.nav-brand').appendChild(installBtn);
}

// 스트리밍 상태 관리
let isStreaming = false;

// Navigation functionality
document.addEventListener('DOMContentLoaded', function() {
  // Show navigation after loading screen
  setTimeout(function() {
    document.getElementById('mainNav').classList.remove('hidden');
  }, 8000); // 8초 후 네비게이션 표시
  
  // Navigation toggle for mobile
  const navToggle = document.getElementById('navToggle');
  const navMenu = document.getElementById('navMenu');
  
  navToggle.addEventListener('click', function() {
    const isExpanded = navMenu.classList.contains('active');
    navMenu.classList.toggle('active');
    navToggle.classList.toggle('active');
    
    // ARIA 상태 업데이트
    navToggle.setAttribute('aria-expanded', !isExpanded);
  });
  
  // Navigation links
  const navLinks = document.querySelectorAll('.nav-link');
  const contentSections = document.querySelectorAll('.content-section');
  
  navLinks.forEach(link => {
    link.addEventListener('click', function(e) {
      e.preventDefault();
      
      // Remove active class from all links and sections
      navLinks.forEach(l => {
        l.classList.remove('active');
        l.removeAttribute('aria-current');
      });
      contentSections.forEach(s => s.classList.remove('active'));
      
      // Add active class to clicked link
      this.classList.add('active');
      this.setAttribute('aria-current', 'page');
      
      // Show corresponding section
      const sectionId = this.getAttribute('data-section') + 'Section';
      const targetSection = document.getElementById(sectionId);
      targetSection.classList.add('active');
      
      // 섹션 제목에 포커스 (스크린 리더 사용자를 위해)
      const heading = targetSection.querySelector('h1, h2');
      if (heading) {
        heading.focus();
      }
      
      // Close mobile menu
      navMenu.classList.remove('active');
      navToggle.classList.remove('active');
      navToggle.setAttribute('aria-expanded', 'false');
      
      // 스크린 리더에 섹션 변경 알림
      announceToScreenReader(`${this.textContent} 섹션으로 이동했습니다.`);
    });
  });
  
  // 키보드 네비게이션 지원
  document.addEventListener('keydown', function(e) {
    // Alt + 숫자키로 빠른 네비게이션
    if (e.altKey && e.key >= '1' && e.key <= '4') {
      e.preventDefault();
      const index = parseInt(e.key) - 1;
      const navLink = navLinks[index];
      if (navLink) {
        navLink.click();
      }
    }
  });
  
  // Video Quality 설정 초기화 및 이벤트 리스너
  initVideoQualitySettings();
});

// 비디오 품질 설정 관리
function initVideoQualitySettings() {
  const videoQualitySelect = document.getElementById('videoQuality');
  const streamQualityDisplay = document.querySelector('.stream-quality');
  
  // 저장된 설정 로드
  const savedQuality = localStorage.getItem('videoQuality') || 'hd';
  videoQualitySelect.value = savedQuality;
  updateQualityDisplay(savedQuality);
  
  // 품질 변경 이벤트 리스너
  videoQualitySelect.addEventListener('change', function() {
    const selectedQuality = this.value;
    updateQualityDisplay(selectedQuality);
    localStorage.setItem('videoQuality', selectedQuality);
    
    // 스크린 리더에 변경 알림
    const qualityText = getQualityDisplayText(selectedQuality);
    announceToScreenReader(`비디오 품질이 ${qualityText}로 변경되었습니다.`);
    
    log(`Video quality changed to: ${qualityText}`);
  });
  
  // 페이지 로드 시 초기 화질 설정 적용
  const initialQuality = localStorage.getItem('videoQuality') || 'hd';
  updateQualityDisplay(initialQuality);
}

function updateQualityDisplay(quality) {
  const streamQualityDisplay = document.querySelector('.stream-quality');
  const qualityText = getQualityDisplayText(quality);
  
  if (streamQualityDisplay) {
    streamQualityDisplay.textContent = qualityText;
    streamQualityDisplay.setAttribute('data-translate', qualityText);
  }
  
  // 스트림 통계의 Quality 값도 업데이트
  const statQualityValue = document.querySelector('.quality-stat');
  if (statQualityValue) {
    const shortQuality = getShortQualityText(quality);
    statQualityValue.textContent = shortQuality;
    statQualityValue.setAttribute('data-translate', shortQuality);
  }
}

function getQualityDisplayText(quality) {
  const qualityMap = {
    'hd': 'HD 1280x960',
    'fhd': 'FHD 1920x1080',
    '4k': '4K 3840x2160'
  };
  
  return qualityMap[quality] || 'HD 1280x960';
}

function getShortQualityText(quality) {
  const shortQualityMap = {
    'hd': 'HD',
    'fhd': 'FHD', 
    '4k': '4K'
  };
  
  return shortQualityMap[quality] || 'HD';
}
// 원래 WebRTC 코드
let pc = new RTCPeerConnection({
  iceServers: [
    {
      urls: 'stun:stun.l.google.com:19302'
    }
  ]
})
let log = msg => {
  const timestamp = new Date().toLocaleTimeString();
  document.getElementById('logs').innerHTML += `[${timestamp}] ${msg}<br>`;
  
  // 스크린 리더에 로그 알림
  announceToScreenReader(`로그: ${msg}`);
  // 자동 스크롤
  const logsElement = document.getElementById('logs');
  logsElement.scrollTop = logsElement.scrollHeight;
}

pc.ontrack = function (event) {
  var el = document.createElement(event.track.kind)
  el.srcObject = event.streams[0]
  el.autoplay = true
  el.controls = false

  // 비디오 placeholder 제거
  const videoPlayer = document.getElementById('remoteVideo');
  videoPlayer.innerHTML = '';
  document.getElementById('remoteVideo').appendChild(el)
  
  log('Video stream connected successfully');
  
  // 스트리밍 상태 업데이트
  updateStreamStatus('스트리밍이 연결되었습니다');
}

pc.oniceconnectionstatechange = e => {
  log(`Connection state: ${pc.iceConnectionState}`);
  
  // 버튼 상태 업데이트
  const btn = document.getElementById('viewCamera');
  const btnText = btn.querySelector('.btn-text');
  const btnIcon = btn.querySelector('.btn-icon');
  
  if (pc.iceConnectionState === 'connected') {
    isStreaming = true;
    btnText.textContent = getCurrentLanguage() === 'ko' ? '스트리밍 중지' : 'Stop Stream';
    btnIcon.textContent = '⏹';
    btn.style.background = 'linear-gradient(135deg, #ff4444 0%, #cc0000 100%)';
    btn.setAttribute('aria-label', '스트리밍 중지');
    updateStreamStatus('스트리밍이 활성화되었습니다');
  } else if (pc.iceConnectionState === 'disconnected' || pc.iceConnectionState === 'failed') {
    isStreaming = false;
    btnText.textContent = getCurrentLanguage() === 'ko' ? '스트리밍 시작' : 'Start Stream';
    btnIcon.textContent = '▶';
    btn.style.background = 'linear-gradient(135deg, #ff0080 0%, #ff8c00 100%)';
    btn.setAttribute('aria-label', '스트리밍 시작');
    updateStreamStatus('스트리밍이 비활성화되었습니다');
  }
}

function updateStreamStatus(message) {
  const statusElement = document.getElementById('stream-status');
  statusElement.textContent = message;
}

// Offer to receive 1 video track
pc.addTransceiver('video', {'direction': 'recvonly'})
pc.createOffer().then(d => pc.setLocalDescription(d)).catch(log)

document.getElementById('viewCamera').addEventListener('click', function() {
  if (isStreaming) {
    // 스트리밍 중지 로직 (실제로는 페이지 새로고침으로 연결 종료)
    log('Stopping streaming...');
    announceToScreenReader('스트리밍을 중지합니다');
    location.reload();
    return;
  }
  
  log('Initiating streaming connection...');
  announceToScreenReader('스트리밍 연결을 시작합니다');
  
  fetch('/post', {
      method: 'POST',
      body: btoa(JSON.stringify(pc.localDescription))
  })
  .then(response => response.text())
  .then(data => {
    log('Received response from server');
    pc.setRemoteDescription(new RTCSessionDescription(JSON.parse(atob(data))))
  })
  .catch(error => {
    log(`Error: ${error.message}`);
    announceToScreenReader(`오류가 발생했습니다: ${error.message}`);
    console.error('Error:', error);
  });
});

// Stream Console 토글 기능
function toggleLogs() {
  const logsContent = document.getElementById('logs');
  const logsHeader = document.querySelector('.logs-header');
  const logsArrow = document.querySelector('.logs-arrow');
  
  const isCollapsed = logsContent.classList.contains('collapsed');
  
  if (isCollapsed) {
    // 펼치기
    logsContent.classList.remove('collapsed');
    logsArrow.classList.remove('collapsed');
    logsArrow.textContent = '▼';
    logsHeader.setAttribute('aria-expanded', 'true');
    announceToScreenReader('스트림 콘솔이 펼쳐졌습니다');
  } else {
    // 접기
    logsContent.classList.add('collapsed');
    logsArrow.classList.add('collapsed');
    logsArrow.textContent = '▶';
    logsHeader.setAttribute('aria-expanded', 'false');
    announceToScreenReader('스트림 콘솔이 접혔습니다');
  }
}

// 키보드 접근성 지원
document.querySelector('.logs-header').addEventListener('keydown', function(e) {
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault();
    toggleLogs();
  }
}
)