// 현재 언어 상태 저장
let currentLanguage = 'ko';

// 언어 시스템 초기화
function initializeLanguageSystem() {
  // localStorage에서 저장된 언어 설정 로드
  const savedLanguage = JSON.parse(localStorage.getItem('accessibility_language') || '"ko"');
  currentLanguage = savedLanguage;
  
  // 초기 언어 적용 (DOM이 준비되기 전이므로 간단히)
  document.documentElement.lang = savedLanguage === 'ko' ? 'ko' : 'en';
}

// GIF 로딩 화면 처리
window.addEventListener('load', function() {
  // 로딩 사운드 제거 - 더 이상 사용하지 않음
  
  // 언어 시스템 초기화 (가장 먼저)
  initializeLanguageSystem();
  
  // 접근성 기능 초기화
  initAccessibilityFeatures();
  

  
  // 시스템 상태 업데이트 시작
  startSystemStatusUpdates();
  
  // 해시 변경 이벤트 처리
  initHashNavigation();
  
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
  
  // 로딩 화면 즉시 표시하고, 2초 후에 메인 콘텐츠와 네비게이션 바 표시
  setTimeout(function() {    
    document.getElementById('loadingScreen').classList.add('hidden');
    document.getElementById('main-content').classList.add('show');
    // 네비게이션 바 표시 (hidden 클래스 제거)
    document.getElementById('mainNav').classList.remove('hidden');
    // 접근성 버튼 표시 (인트로 후)
    document.getElementById('accessibilityToggle').classList.remove('hidden');
    // 메인 콘텐츠에 포커스 설정 (스크린 리더 사용자를 위해)
    document.getElementById('main-content').focus();
  }, 2000); // 2초 동안만 GIF 표시 (더 빠르게 표시)
  
  // WebSocket 자막 연결 초기화
  connectWebSocket();
  
  // 페이지 종료 시 즉시 정리
  window.addEventListener('beforeunload', function(e) {
    if (isStreaming || pc) {
      // WebRTC 연결 즉시 정리
      cleanupWebRTC();
      
      // 서버에 즉시 정리 요청 (백그라운드에서 확실히 전송)
      navigator.sendBeacon('/reset', new Blob([''], { type: 'application/json' }));
    }
  });
  
  // 페이지 숨김/탭 전환 시에도 즉시 정리
  document.addEventListener('visibilitychange', function() {
    if (document.visibilityState === 'hidden' && (isStreaming || pc)) {
      log('페이지 숨김 - 스트림 즉시 정리');
      cleanupWebRTC();
      
      // sendBeacon으로 확실한 전송 보장
      navigator.sendBeacon('/reset', new Blob([''], { type: 'application/json' }));
    }
  });
  
  // 브라우저 창 포커스 잃을 때도 정리 (추가 안전장치)
  window.addEventListener('blur', function() {
    if (isStreaming || pc) {
      // 일정 시간 후에도 포커스가 없으면 정리
      setTimeout(function() {
        if (document.visibilityState === 'hidden' && (isStreaming || pc)) {
          log('창 포커스 없음 - 스트림 정리');
          cleanupWebRTC();
          navigator.sendBeacon('/reset', new Blob([''], { type: 'application/json' }));
        }
      }, 2000); // 2초 후 확인
    }
  });
});

// 접근성 기능 초기화
function initAccessibilityFeatures() {
  // 접근성 패널 토글
  const accessibilityToggle = document.getElementById('accessibilityToggle');
  const accessibilityPanel = document.getElementById('accessibilityPanel');
  const closeAccessibilityX = document.querySelector('.close-accessibility-x');
  
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
  
  // X 버튼으로 패널 닫기
  if (closeAccessibilityX) {
    closeAccessibilityX.addEventListener('click', closeAccessibilityPanel);
  }
  
  // 패널 외부 클릭시 닫기
  document.addEventListener('click', function(e) {
    const isClickInsidePanel = accessibilityPanel.contains(e.target);
    const isToggleButton = accessibilityToggle.contains(e.target);
    
    if (!isClickInsidePanel && !isToggleButton && accessibilityPanel.classList.contains('open')) {
      closeAccessibilityPanel();
    }
  });
  
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
      
      // 현재 언어와 같으면 무시
      if (getCurrentLanguage() === lang) {
        return;
      }
      
      setLanguage(lang);
      saveAccessibilitySetting('language', lang);
      
      // 언어 변경 알림 (스크린 리더용)
      const langName = lang === 'ko' ? '한국어' : 'English';
      announceToScreenReader(`언어가 ${langName}로 변경되었습니다`);
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

// 언어 설정 함수
function setLanguage(lang) {
  // 유효한 언어인지 확인
  if (!translations[lang]) {
    console.warn(`Language ${lang} not supported, using Korean as fallback`);
    lang = 'ko';
  }
  
  currentLanguage = lang;
  
  const elements = document.querySelectorAll('[data-translate]');
  elements.forEach(element => {
    const key = element.getAttribute('data-translate');
    if (translations[lang] && translations[lang][key]) {
      element.textContent = translations[lang][key];
    } else if (translations['ko'][key]) {
      // 번역이 없으면 한국어로 폴백
      element.textContent = translations['ko'][key];
    }
  });
  
  // 특별한 경우들 처리
  updateSpecialElements(lang);
  
  // HTML lang 속성 업데이트
  document.documentElement.lang = lang === 'ko' ? 'ko' : 'en';
  
  // 언어 버튼 상태 업데이트
  updateLanguageButtonStates(lang);
}

function getCurrentLanguage() {
  return currentLanguage;
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
  if (streamBtn) {
    // 현재 스트리밍 상태에 맞게 UI 업데이트
    updateUIForStreamingState(isStreaming);
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
  // 초기 언어 설정 (중복 호출 방지를 위해 직접 설정)
  currentLanguage = language;
  setLanguage(language);
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

// UI 업데이트를 위한 중앙 함수
function updateUIForStreamingState(streamingActive) {
  isStreaming = streamingActive; // 전역 플래그 업데이트

  const btn = document.getElementById('viewCamera');
  const btnText = btn.querySelector('.btn-text');
  const btnIcon = btn.querySelector('.btn-icon');
  const videoPlayer = document.getElementById('remoteVideo');
  const subtitleBox = document.getElementById('subtitleBox');
  const currentLang = getCurrentLanguage();

  if (streamingActive) {
    // 스트리밍 활성화 상태 UI
    btnText.textContent = translations[currentLang]['Stop Stream'] || 'Stop Stream';
    btnIcon.innerHTML = '⏹';
    btn.style.background = 'linear-gradient(135deg, #ff4444 0%, #cc0000 100%)';
    btn.setAttribute('aria-label', '스트리밍 중지');
    updateStreamStatus('스트리밍이 활성화되었습니다');
    
    // 자막 오버레이 준비 (내용은 나중에 표시됨)
    if (subtitleBox) {
      // 자막은 실제 내용이 도착할 때 표시됨
      subtitleBox.style.display = 'none';
    }
  } else {
    // 스트리밍 비활성화 상태 UI
    btnText.textContent = translations[currentLang]['Start Stream'] || 'Start Stream';
    btnIcon.innerHTML = '▶';
    btn.style.background = 'linear-gradient(135deg, #ff0080 0%, #ff8c00 100%)';
    btn.setAttribute('aria-label', '스트리밍 시작');
    updateStreamStatus('스트리밍이 비활성화되었습니다');
    
    // 스트리밍 중지 시 자막 오버레이 숨기기
    if (subtitleBox) {
      subtitleBox.style.display = 'none';
      clearTimeout(subtitleTimeout);  // 자막 타이머 해제
    }

    // 비디오 플레이어를 초기 placeholder 상태로 되돌림
    videoPlayer.innerHTML = `<div class="video-placeholder"><p data-translate="Click "Start Stream" to begin live broadcast">${translations[currentLang]['Click "Start Stream" to begin live broadcast']}</p></div>`;
  }
}

// PeerConnection 초기화 함수
function initializePeerConnection() {
  // 기본 WebRTC 설정
  const config = {
    iceServers: [{
      urls: ['stun:stun.l.google.com:19302']
    }],
    iceCandidatePoolSize: 10,
    bundlePolicy: 'max-bundle',
    rtcpMuxPolicy: 'require',
    iceTransportPolicy: 'all'
  };

  const newPc = new RTCPeerConnection(config);

  newPc.ontrack = function (event) {
    var el = document.createElement(event.track.kind);
    el.srcObject = event.streams[0];
    el.autoplay = true;
    el.controls = false;

    if (event.track.kind === 'video') {
      // 비디오 placeholder 제거하고 영상 추가
      const videoPlayer = document.getElementById('remoteVideo');
      videoPlayer.innerHTML = '';
      videoPlayer.appendChild(el);
      log('Video stream connected successfully');
    } else if (event.track.kind === 'audio') {
      // 오디오 요소 추가 (비디오 컨테이너에)
      const videoPlayer = document.getElementById('remoteVideo');
      videoPlayer.appendChild(el);
      log('Audio stream connected successfully');
    }
    
    updateStreamStatus('스트리밍이 연결되었습니다');
  };

  newPc.oniceconnectionstatechange = e => {
    log(`ICE Connection state: ${newPc.iceConnectionState}`);
    
    // 연결 상태에 따라 UI 업데이트 함수 호출
    if (newPc.iceConnectionState === 'connected') {
      updateUIForStreamingState(true); // 스트리밍 시작됨
      log('✓ ICE Connection established successfully');
      
      // 연결 성공 시 통계 정보 출력
      setTimeout(() => {
        logConnectionStats();
      }, 1000);
      
    } else if (newPc.iceConnectionState === 'checking') {
      log('ICE connectivity checks in progress...');
      
    } else if (newPc.iceConnectionState === 'disconnected') {
      log('⚠ Connection disconnected - immediate cleanup');
      updateUIForStreamingState(false);
      // 즉시 서버 리소스 정리 요청
      fetch('/reset', {method: 'POST'}).catch(() => {});
      
    } else if (newPc.iceConnectionState === 'failed') {
      log('❌ ICE Connection failed - attempting restart');
      
      // 간단한 재시도 로직
      setTimeout(() => {
        log('Restarting ICE to recover connection...');
        newPc.restartIce();
      }, 1000);
      
      // 5초 후에도 실패하면 완전 중단
      setTimeout(() => {
        if (newPc.iceConnectionState === 'failed') {
          log('❌ Connection restart failed - giving up');
          updateUIForStreamingState(false);
          fetch('/reset', {method: 'POST'}).catch(() => {});
          
          showErrorMessage('스트리밍 연결에 실패했습니다. 네트워크 연결을 확인해주세요.');
        }
      }, 5000);
      
    } else if (newPc.iceConnectionState === 'closed') {
      log('Connection closed');
      updateUIForStreamingState(false); // 스트리밍 중지됨
      // 서버에 즉시 정리 요청
      fetch('/reset', {method: 'POST'}).catch(() => {});
    }
  };
  
  // ICE candidate 로깅
  newPc.onicecandidate = event => {
    if (event.candidate) {
      const c = event.candidate;
      log(`ICE candidate: ${c.type} ${c.address}:${c.port}`);
      
      // 내부망 연결 가능성 체크
      if (c.type === 'host' && c.address.match(/^192\.168\.|^10\.|^172\.(1[6-9]|2\d|3[01])\./)) {
        log(`✓ LAN connection possible via ${c.address}`);
      }
    } else {
      log('ICE gathering completed');
    }
  };
  
  // ICE gathering state 모니터링
  newPc.onicegatheringstatechange = () => {
    log(`ICE gathering state: ${newPc.iceGatheringState}`);
  };
  
  // 연결 상태 감시
  newPc.onconnectionstatechange = () => {
    log(`Connection state changed: ${newPc.connectionState}`);
  };

  // Offer to receive both video and audio tracks
  newPc.addTransceiver('video', {'direction': 'recvonly'});
  newPc.addTransceiver('audio', {'direction': 'recvonly'});
  newPc.createOffer().then(d => newPc.setLocalDescription(d)).catch(log);

  return newPc;
}

// WebSocket 연결 및 자막 처리
let wsReconnectAttempts = 0;
const maxReconnectAttempts = 5;

function connectWebSocket() {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const wsUrl = `${protocol}//${window.location.host}/ws`;
  
  ws = new WebSocket(wsUrl);
  
  ws.onopen = function() {
    log('WebSocket connected for subtitles');
    announceToScreenReader('자막 서비스가 연결되었습니다');
    wsReconnectAttempts = 0; // 연결 성공 시 재연결 시도 횟수 리셋
  };
  
  ws.onmessage = function(event) {
    try {
      const subtitleData = JSON.parse(event.data);
      updateSubtitleOverlay(subtitleData);
    } catch (error) {
      console.error('Error parsing subtitle data:', error);
    }
  };
  
  ws.onclose = function(event) {
    if (event.wasClean) {
      log('WebSocket closed cleanly');
      return;
    }
    
    if (wsReconnectAttempts < maxReconnectAttempts) {
      wsReconnectAttempts++;
      const delay = Math.min(1000 * Math.pow(2, wsReconnectAttempts - 1), 10000); // 지수 백오프, 최대 10초
      log(`WebSocket disconnected. Reconnecting in ${delay/1000}s... (attempt ${wsReconnectAttempts}/${maxReconnectAttempts})`);
      
      setTimeout(() => {
        connectWebSocket();
      }, delay);
    } else {
      log('WebSocket reconnection failed after maximum attempts');
      announceToScreenReader('자막 서비스 재연결에 실패했습니다');
    }
  };
  
  ws.onerror = function(error) {
    console.error('WebSocket error:', error);
    log('WebSocket connection error');
  };
}

function updateSubtitleOverlay(subtitleData) {
  const subtitleBox = document.getElementById('subtitleBox');
  const emoji = document.getElementById('subtitleEmoji');
  const langCode = document.getElementById('subtitleLangCode');
  const timestamp = document.getElementById('subtitleTimestamp');
  const text = document.getElementById('subtitleText');
  
  // 스트리밍 중이 아니면 자막을 표시하지 않음
  if (!subtitleBox || !subtitleData.text.trim() || !isStreaming) {
    return;
  }
  
  // 자막 데이터 업데이트
  emoji.textContent = subtitleData.emoji || '🙂';
  langCode.textContent = subtitleData.lang_code || 'KR';
  timestamp.textContent = `${subtitleData.timestamp.toFixed(1)}s`;
  text.textContent = subtitleData.text;
  
  // 자막 박스 표시 (스트리밍 중인 경우에만)
  if (isStreaming) {
    subtitleBox.style.display = 'block';
    subtitleBox.classList.remove('fade-out');
  }
  
  // 기존 타이머 클리어
  if (subtitleTimeout) {
    clearTimeout(subtitleTimeout);
  }
  
  // 최종 자막인 경우 5초 후 숨기기, 부분 자막인 경우 3초 후 숨기기
  const hideDelay = subtitleData.is_final ? 5000 : 3000;
  
  subtitleTimeout = setTimeout(() => {
    hideSubtitleOverlay();
  }, hideDelay);
  
  // 스크린 리더에 자막 알림
  if (subtitleData.is_final) {
    announceToScreenReader(`자막: ${subtitleData.text}`);
  }
}

function hideSubtitleOverlay() {
  const subtitleBox = document.getElementById('subtitleBox');
  if (subtitleBox) {
    subtitleBox.classList.add('fade-out');
    
    // 애니메이션 완료 후 숨기기
    setTimeout(() => {
      subtitleBox.style.display = 'none';
      subtitleBox.classList.remove('fade-out');
    }, 300);
  }
}

// Navigation functionality
document.addEventListener('DOMContentLoaded', function() {
  // PeerConnection 초기화
  pc = initializePeerConnection();
  
  // WebSocket 연결
  connectWebSocket();
  
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
      
      // 상태 탭인 경우 시스템 상태 업데이트
      if (this.getAttribute('data-section') === 'status') {
        updateSystemStatus();
      }
      
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
    'hd': 'HD 1280x720',
    'fhd': 'FHD 1920x1080',
    '4k': '4K 3840x2160'
  };
  
  return qualityMap[quality] || 'HD 1280x720';
}

function getShortQualityText(quality) {
  const shortQualityMap = {
    'hd': 'HD',
    'fhd': 'FHD', 
    '4k': '4K'
  };
  
  return shortQualityMap[quality] || 'HD';
}

// 전역 변수 선언
let pc;
let ws;
let subtitleTimeout;

let log = msg => {
  const timestamp = new Date().toLocaleTimeString();
  document.getElementById('logs').innerHTML += `[${timestamp}] ${msg}<br>`;
  
  // 스크린 리더에 로그 알림
  announceToScreenReader(`로그: ${msg}`);
  // 자동 스크롤
  const logsElement = document.getElementById('logs');
  logsElement.scrollTop = logsElement.scrollHeight;
}

function updateStreamStatus(message) {
  const statusElement = document.getElementById('stream-status');
  statusElement.textContent = message;
}

// 사용자에게 오류 메시지 표시
function showErrorMessage(message) {
  // 콘솔에 로그 기록
  log('ERROR: ' + message);
  
  // 스트림 상태 업데이트
  updateStreamStatus(message);
  
  // 경고 알림 표시
  const errorBox = document.createElement('div');
  errorBox.className = 'error-message';
  errorBox.textContent = message;
  
  // 기존 에러 메시지가 있다면 제거
  const existingError = document.querySelector('.error-message');
  if (existingError) {
    existingError.remove();
  }
  
  // 비디오 플레이어 컨테이너에 에러 메시지 표시
  const videoContainer = document.querySelector('.video-container');
  if (videoContainer) {
    videoContainer.appendChild(errorBox);
  }
  
  // 화면 읽기 기능을 위한 알림
  announceToScreenReader(message);
  
  // 5초 후 메시지 자동 제거
  setTimeout(() => {
    if (errorBox.parentNode) {
      errorBox.classList.add('fade-out');
      setTimeout(() => errorBox.remove(), 500);
    }
  }, 5000);
}

document.getElementById('viewCamera').addEventListener('click', function() {
  if (isStreaming) {
    log('스트리밍 즉시 중지...');
    announceToScreenReader('스트리밍을 즉시 중지합니다');

    // 상태를 즉시 변경하여 추가 요청 방지
    isStreaming = false;
    
    // 버튼 클릭 시 UI를 즉시 "스트리밍 시작" 상태로 업데이트
    updateUIForStreamingState(false);
    
    // WebRTC 연결과 포트를 즉시 정리
    cleanupWebRTC();
    
    // 서버에 즉시 강제 리셋 요청 (POST 방식으로)
    fetch('/reset', { 
      method: 'POST',
      keepalive: true,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ force: true })
    }).catch(err => console.log('Reset request sent:', err));
    
    // sendBeacon으로도 추가 안전장치
    navigator.sendBeacon('/reset', new Blob(['{"force":true}'], { type: 'application/json' }));
    
    // 새로운 연결을 위한 PC 객체 즉시 준비
    pc = initializePeerConnection();
    log('스트리밍이 즉시 중지되고 포트가 해제되었습니다');
    
    return;
  }
  
  // 스트리밍이 아직 활성화되지 않은 경우, 이전 세션을 정리하고 새로 초기화
  if (pc) {
    cleanupWebRTC();
    pc = initializePeerConnection();
    // 약간의 지연을 두고 연결 시작
    setTimeout(startStreaming, 300);
  } else {
    startStreaming();
  }
});

// WebRTC 연결 정리를 위한 함수
function cleanupWebRTC() {
  if (!pc) return;
  
  try {
    log('즉시 WebRTC 연결 정리 시작...');
    
    // 모든 트랙과 미디어 스트림 즉시 정리
    const senders = pc.getSenders();
    senders.forEach(sender => {
      if (sender.track) {
        sender.track.stop();
      }
    });
    
    const receivers = pc.getReceivers();
    receivers.forEach(receiver => {
      if (receiver.track) {
        receiver.track.stop();
      }
    });
    
    // 모든 이벤트 리스너 제거
    pc.oniceconnectionstatechange = null;
    pc.ontrack = null;
    pc.onicecandidate = null;
    pc.onconnectionstatechange = null;
    pc.ondatachannel = null;
    pc.onicegatheringstatechange = null;
    pc.onsignalingstatechange = null;
    
    // 연결 즉시 종료
    pc.close();
    pc = null;
    
    // 비디오 엘리먼트 정리
    const videoPlayer = document.getElementById('remoteVideo');
    if (videoPlayer) {
      const videoElements = videoPlayer.querySelectorAll('video');
      const audioElements = videoPlayer.querySelectorAll('audio');
      
      videoElements.forEach(el => {
        el.srcObject = null;
        el.load();
        el.remove();
      });
      
      audioElements.forEach(el => {
        el.srcObject = null;
        el.load();
        el.remove();
      });
      
      // 비디오 플레이어 초기화
      videoPlayer.innerHTML = '<div class="video-placeholder"><p data-translate="Click &quot;Start Stream&quot; to begin live broadcast">Click "Start Stream" to begin live broadcast</p></div>';
    }
    
    // 서버에 즉시 리셋 요청 (포트 해제)
    fetch('/reset', {
      method: 'POST',
      keepalive: true // 페이지가 닫혀도 요청 완료 보장
    }).catch(e => console.log('Reset request sent:', e));
    
    // 상태 초기화
    isStreaming = false;
    updateUIForStreamingState(false);
    
    log('WebRTC 연결과 포트가 즉시 정리되었습니다');
  } catch (e) {
    console.error('Error cleaning up WebRTC:', e);
    // 에러가 발생해도 서버 리셋은 시도
    fetch('/reset', { method: 'POST', keepalive: true }).catch(() => {});
  }
}

// 스트리밍 시작 함수
function startStreaming() {
  log('Initiating streaming connection...');
  announceToScreenReader('스트리밍 연결을 시작합니다');
  
  // ICE 후보 수집이 완료될 때까지 대기
  if (pc.iceGatheringState === 'gathering') {
    log('Waiting for ICE gathering to complete...');
    pc.addEventListener('icegatheringstatechange', function handler() {
      if (pc.iceGatheringState === 'complete') {
        pc.removeEventListener('icegatheringstatechange', handler);
        sendOfferToServer();
      }
    });
  } else {
    sendOfferToServer();
  }
}

function sendOfferToServer() {
  fetch('/post', {
      method: 'POST',
      // 현재 pc.localDescription을 사용
      body: btoa(JSON.stringify(pc.localDescription))
  })
  .then(response => {
    if (!response.ok) {
      // HTTP 에러 발생 시
      return response.text().then(errText => {
        throw new Error(errText || `Server error: ${response.status}`);
      });
    }
    return response.text();
  })
  .then(data => {
    log('Received response from server');
    try {
      const answer = new RTCSessionDescription(JSON.parse(atob(data)));
      return pc.setRemoteDescription(answer);
    } catch (err) {
      throw new Error('Invalid server response: ' + err.message);
    }
  })
  .then(() => {
    log('Remote description set successfully');
    // 연결 상태 모니터링 시작
    monitorConnectionHealth();
  })
  .catch(error => {
    let errorMsg;
    
    // 특정 에러 메시지 처리
    if (error.message.includes('Stream already in progress')) {
      errorMsg = '다른 사용자가 이미 스트리밍 중입니다. 나중에 다시 시도하세요.';
    } else if (error.message.includes('UDP port') && error.message.includes('already in use')) {
      errorMsg = '서버 포트가 사용 중입니다. 잠시 후 다시 시도하세요.';
    } else if (error.message.includes('NetworkError') || error.message.includes('Failed to fetch')) {
      errorMsg = '서버에 연결할 수 없습니다. 네트워크 연결을 확인하세요.';
    } else {
      errorMsg = `스트리밍 시작 오류: ${error.message}`;
    }
    
    // 에러 표시 및 로깅
    showErrorMessage(errorMsg);
    log(`Error: ${error.message}`);
    announceToScreenReader(`오류가 발생했습니다: ${errorMsg}`);
    console.error('Error:', error);
    
    // UI 상태 초기화
    updateUIForStreamingState(false);
  });
}

// 연결 통계 로깅
function logConnectionStats() {
  if (!pc) return;
  
  pc.getStats().then(stats => {
    stats.forEach((report) => {
      if (report.type === 'candidate-pair' && report.state === 'succeeded') {
        log(`✓ Active connection established via candidate pair`);
        
        // 로컬/리모트 후보 정보 찾기
        const localCandidate = Array.from(stats.values()).find(r => 
          r.type === 'local-candidate' && r.id === report.localCandidateId
        );
        const remoteCandidate = Array.from(stats.values()).find(r => 
          r.type === 'remote-candidate' && r.id === report.remoteCandidateId
        );
        
        if (localCandidate && remoteCandidate) {
          log(`  Local: ${localCandidate.candidateType} ${localCandidate.address}:${localCandidate.port}`);
          log(`  Remote: ${remoteCandidate.candidateType} ${remoteCandidate.address}:${remoteCandidate.port}`);
          log(`  Protocol: ${localCandidate.protocol?.toUpperCase() || 'UDP'}`);
        }
      }
    });
  });
}

// 연결 실패 원인 분석
async function analyzeConnectionFailure() {
  if (!pc) return '알 수 없는 오류';
  
  try {
    const stats = await pc.getStats();
    let hasHostCandidate = false;
    let hasServerReflexive = false;
    let failedPairs = 0;
    
    stats.forEach((report) => {
      if (report.type === 'local-candidate') {
        if (report.candidateType === 'host') hasHostCandidate = true;
        if (report.candidateType === 'srflx') hasServerReflexive = true;
      }
      if (report.type === 'candidate-pair' && report.state === 'failed') {
        failedPairs++;
      }
    });
    
    // 원인 분석
    if (!hasHostCandidate) {
      return '로컬 네트워크 후보를 찾을 수 없습니다. 네트워크 설정을 확인하세요.';
    } else if (!hasServerReflexive) {
      return 'STUN 서버에 연결할 수 없습니다. 방화벽 설정을 확인하세요.';
    } else if (failedPairs > 0) {
      return `${failedPairs}개의 연결 시도가 실패했습니다. NAT 설정을 확인하세요.`;
    } else {
      return '네트워크 연결 문제가 발생했습니다.';
    }
  } catch (error) {
    return '연결 상태를 분석할 수 없습니다.';
  }
}

// 연결 상태 건강도 모니터링
function monitorConnectionHealth() {
  const isLocalNetwork = window.location.hostname.match(/^192\.168\.|^10\.|^172\.(1[6-9]|2\d|3[01])\.|^localhost$|^127\./);
  const checkInterval = isLocalNetwork ? 5000 : 10000; // 내부망에서는 더 자주 체크
  
  const healthCheckInterval = setInterval(() => {
    if (!pc || pc.connectionState === 'closed') {
      clearInterval(healthCheckInterval);
      return;
    }
    
    // 연결 통계 확인
    pc.getStats().then(stats => {
      let hasActiveConnection = false;
      let localCandidateType = 'unknown';
      let remoteCandidateType = 'unknown';
      
      stats.forEach((report) => {
        if (report.type === 'candidate-pair' && report.state === 'succeeded') {
          hasActiveConnection = true;
          
          // 후보 타입 확인
          const localCandidate = Array.from(stats.values()).find(r => 
            r.type === 'local-candidate' && r.id === report.localCandidateId
          );
          const remoteCandidate = Array.from(stats.values()).find(r => 
            r.type === 'remote-candidate' && r.id === report.remoteCandidateId
          );
          
          if (localCandidate) localCandidateType = localCandidate.candidateType;
          if (remoteCandidate) remoteCandidateType = remoteCandidate.candidateType;
        }
      });
      
      if (!hasActiveConnection && pc.iceConnectionState !== 'connected') {
        log('⚠ No active connection found - connection may have issues');
        
        // 내부망에서 연결 문제 시 빠른 재연결 시도
        if (isLocalNetwork && pc.iceConnectionState === 'disconnected') {
          log('🔄 Attempting quick reconnection for local network...');
          // ICE restart 시도
          pc.restartIce();
        }
      } else if (hasActiveConnection) {
        log(`✓ Connection healthy [${localCandidateType} -> ${remoteCandidateType}]`);
      }
    });
  }, checkInterval);
}

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
});



// 시스템 상태 업데이트 시작
function startSystemStatusUpdates() {
  // 즉시 한 번 업데이트
  updateSystemStatus();
  
  // 30초마다 시스템 상태 업데이트
  setInterval(updateSystemStatus, 30000);
}

// 시스템 상태 업데이트
async function updateSystemStatus() {
  try {
    const response = await fetch('/status');
    if (response.ok) {
      const status = await response.json();
      
      // DOM 요소 업데이트
      const batteryValue = document.querySelector('.status-card:nth-child(1) .status-value');
      const signalValue = document.querySelector('.status-card:nth-child(2) .status-value');
      const tempValue = document.querySelector('.status-card:nth-child(3) .status-value');
      const storageValue = document.querySelector('.status-card:nth-child(4) .status-value');
      
      if (batteryValue) batteryValue.textContent = status.battery;
      if (signalValue) signalValue.textContent = status.signal;
      if (tempValue) tempValue.textContent = status.temperature;
      if (storageValue) storageValue.textContent = status.storage;
      
      log('시스템 상태 업데이트 완료');
    } else {
      log('시스템 상태 업데이트 실패: ' + response.status);
    }
  } catch (error) {
    log('시스템 상태 업데이트 오류: ' + error.message);
  }
}

// 해시 네비게이션 초기화
function initHashNavigation() {
  // 페이지 로드 시 해시 확인
  handleHashChange();
  
  // 해시 변경 이벤트 리스너
  window.addEventListener('hashchange', handleHashChange);
}

// 해시 변경 처리
function handleHashChange() {
  const hash = window.location.hash.substring(1); // #을 제거
  if (hash) {
    navigateToSection(hash);
  }
}

// 섹션으로 이동
function navigateToSection(sectionName) {
  const navLinks = document.querySelectorAll('.nav-link');
  const contentSections = document.querySelectorAll('.content-section');
  
  // 모든 링크와 섹션에서 active 클래스 제거
  navLinks.forEach(link => {
    link.classList.remove('active');
    link.removeAttribute('aria-current');
  });
  contentSections.forEach(section => section.classList.remove('active'));
  
  // 해당 섹션의 링크와 콘텐츠 활성화
  const targetLink = document.querySelector(`.nav-link[data-section="${sectionName}"]`);
  const targetSection = document.getElementById(sectionName + 'Section');
  
  if (targetLink && targetSection) {
    targetLink.classList.add('active');
    targetLink.setAttribute('aria-current', 'page');
    targetSection.classList.add('active');
    
    // 상태 탭인 경우 시스템 상태 업데이트
    if (sectionName === 'status') {
      updateSystemStatus();
    }
    
    // 스크린 리더에 알림
    announceToScreenReader(`${targetLink.textContent} 섹션으로 이동했습니다.`);
  }
}