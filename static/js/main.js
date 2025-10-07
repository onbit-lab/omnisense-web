// 메인 진입점 - 모든 모듈 통합 및 초기화

// 전역 변수
window.isStreaming = false;
let deferredPrompt;

// 페이지 로드 시 초기화
window.addEventListener('load', function() {
  initializeLanguageSystem();
  initAccessibilityFeatures();
  startSystemStatusUpdates();
  initHashNavigation();
  
  // PWA 설치 프롬프트 처리
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    showInstallButton(deferredPrompt);
  });
  
  window.addEventListener('appinstalled', (evt) => {
    if (typeof log === 'function') {
      log('앱이 성공적으로 설치되었습니다!');
    }
  });
  
  // Service Worker 등록
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js')
      .then(registration => console.log('SW registered'))
      .catch(error => console.log('SW registration failed'));
  }
  
  // 로딩 화면 숨기기
  setTimeout(function() {    
    document.getElementById('loadingScreen').classList.add('hidden');
    document.getElementById('main-content').classList.add('show');
    document.getElementById('mainNav').classList.remove('hidden');
    document.getElementById('accessibilityToggle').classList.remove('hidden');
    document.getElementById('main-content').focus();
  }, 2000);
  
  // WebSocket 연결
  connectWebSocket();
  
  // 페이지 종료 시 정리
  const cleanup = () => {
    if (window.isStreaming || window.pc) {
      cleanupWebRTC();
      navigator.sendBeacon('/reset', '');
    }
  };
  
  window.addEventListener('beforeunload', cleanup);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') cleanup();
  });
  window.addEventListener('blur', () => {
    setTimeout(() => {
      if (document.visibilityState === 'hidden') {
        cleanup();
      }
    }, 2000);
  });
});

// DOM 준비 시 초기화
document.addEventListener('DOMContentLoaded', function() {
  // PeerConnection 초기화
  window.pc = initializePeerConnection();
  
  // 네비게이션 초기화
  initNavigation();
  
  // 비디오 품질 설정 초기화
  initVideoQualitySettings();
  
  // 스트리밍 버튼 이벤트 리스너
  const viewCameraBtn = document.getElementById('viewCamera');
  if (viewCameraBtn) {
    viewCameraBtn.addEventListener('click', handleStreamButtonClick);
  }
  
  // Stream Console 토글 키보드 지원
  const logsHeader = document.querySelector('.logs-header');
  if (logsHeader) {
    logsHeader.addEventListener('keydown', function(e) {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        toggleLogs();
      }
    });
  }
});

// 스트리밍 버튼 클릭 핸들러
function handleStreamButtonClick() {
  if (window.isStreaming) {
    stopStreaming();
  } else {
    // 스트리밍이 아직 활성화되지 않은 경우, 이전 세션을 정리하고 새로 초기화
    if (window.pc) {
      cleanupWebRTC();
      window.pc = initializePeerConnection();
      // 약간의 지연을 두고 연결 시작
      setTimeout(startStreaming, 300);
    } else {
      startStreaming();
    }
  }
}

// 스트리밍 중지
function stopStreaming() {
  if (typeof log === 'function') {
    log('스트리밍 즉시 중지...');
  }
  if (typeof announceToScreenReader === 'function') {
    announceToScreenReader('스트리밍을 즉시 중지합니다');
  }

  // 상태를 즉시 변경하여 추가 요청 방지
  window.isStreaming = false;
  
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
  window.pc = initializePeerConnection();
  
  if (typeof log === 'function') {
    log('스트리밍이 즉시 중지되고 포트가 해제되었습니다');
  }
}
