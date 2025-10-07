// UI 업데이트 및 네비게이션 관리

// UI 업데이트를 위한 중앙 함수 - window 객체에 할당
window.updateUIForStreamingState = function(streamingActive) {
  window.isStreaming = streamingActive; // 전역 플래그 업데이트

  const btn = document.getElementById('viewCamera');
  const btnText = btn.querySelector('.btn-text');
  const btnIcon = btn.querySelector('.btn-icon');
  const videoPlayer = document.getElementById('remoteVideo');
  const subtitleBox = document.getElementById('subtitleBox');
  const currentLang = typeof window.getCurrentLanguage === 'function' ? window.getCurrentLanguage() : 'ko';

  // translations 객체를 사용
  const translations = window.translations || {
    ko: { 'Stop Stream': '스트리밍 중지', 'Start Stream': '스트리밍 시작', 'Click "Start Stream" to begin live broadcast': '"스트리밍 시작"을 클릭하여 실시간 방송을 시작하세요' },
    en: { 'Stop Stream': 'Stop Stream', 'Start Stream': 'Start Stream', 'Click "Start Stream" to begin live broadcast': 'Click "Start Stream" to begin live broadcast' }
  };

  if (streamingActive) {
    // 스트리밍 활성화 상태 UI
    btnText.textContent = translations[currentLang]['Stop Stream'] || 'Stop Stream';
    btnIcon.innerHTML = '⏹';
    btn.style.background = 'linear-gradient(135deg, #ff4444 0%, #cc0000 100%)';
    btn.setAttribute('aria-label', '스트리밍 중지');
    if (typeof window.updateStreamStatus === 'function') {
      window.updateStreamStatus('스트리밍이 활성화되었습니다');
    }
    
    // 자막 오버레이 준비 (내용은 나중에 표시됨)
    if (subtitleBox) {
      subtitleBox.style.display = 'none';
    }
  } else {
    // 스트리밍 비활성화 상태 UI
    btnText.textContent = translations[currentLang]['Start Stream'] || 'Start Stream';
    btnIcon.innerHTML = '▶';
    btn.style.background = 'linear-gradient(135deg, #ff0080 0%, #ff8c00 100%)';
    btn.setAttribute('aria-label', '스트리밍 시작');
    if (typeof window.updateStreamStatus === 'function') {
      window.updateStreamStatus('스트리밍이 비활성화되었습니다');
    }
    
    // 스트리밍 중지 시 자막 오버레이 숨기기
    if (subtitleBox) {
      subtitleBox.style.display = 'none';
    }

    // 비디오 플레이어를 초기 placeholder 상태로 되돌림
    videoPlayer.innerHTML = `<div class="video-placeholder"><p data-translate="Click "Start Stream" to begin live broadcast">${translations[currentLang]['Click "Start Stream" to begin live broadcast']}</p></div>`;
  }
}

// 비디오 품질 설정 관리 - window 객체에 할당
window.initVideoQualitySettings = function() {
  const videoQualitySelect = document.getElementById('videoQuality');
  const streamQualityDisplay = document.querySelector('.stream-quality');
  
  if (!videoQualitySelect) return;
  
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
    if (typeof window.announceToScreenReader === 'function') {
      window.announceToScreenReader(`비디오 품질이 ${qualityText}로 변경되었습니다.`);
    }
    
    if (typeof window.log === 'function') {
      window.log(`Video quality changed to: ${qualityText}`);
    }
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

// Stream Console 토글 기능 - window 객체에 할당
window.toggleLogs = function() {
  const logsContent = document.getElementById('logs');
  const logsHeader = document.querySelector('.logs-header');
  const logsArrow = document.querySelector('.logs-arrow');
  
  if (!logsContent) return;
  
  const isCollapsed = logsContent.classList.contains('collapsed');
  
  if (isCollapsed) {
    // 펼치기
    logsContent.classList.remove('collapsed');
    logsArrow.classList.remove('collapsed');
    logsArrow.textContent = '▼';
    logsHeader.setAttribute('aria-expanded', 'true');
    if (typeof window.announceToScreenReader === 'function') {
      window.announceToScreenReader('스트림 콘솔이 펼쳐졌습니다');
    }
  } else {
    // 접기
    logsContent.classList.add('collapsed');
    logsArrow.classList.add('collapsed');
    logsArrow.textContent = '▶';
    logsHeader.setAttribute('aria-expanded', 'false');
    if (typeof window.announceToScreenReader === 'function') {
      window.announceToScreenReader('스트림 콘솔이 접혔습니다');
    }
  }
}

// 네비게이션 초기화 - window 객체에 할당
window.initNavigation = function() {
  // Navigation toggle for mobile
  const navToggle = document.getElementById('navToggle');
  const navMenu = document.getElementById('navMenu');
  
  if (navToggle && navMenu) {
    navToggle.addEventListener('click', function() {
      const isExpanded = navMenu.classList.contains('active');
      navMenu.classList.toggle('active');
      navToggle.classList.toggle('active');
      
      // ARIA 상태 업데이트
      navToggle.setAttribute('aria-expanded', !isExpanded);
    });
  }
  
  // Navigation links
  const navLinks = document.querySelectorAll('.nav-link');
  const contentSections = document.querySelectorAll('.content-section');
  
  navLinks.forEach(link => {
    link.addEventListener('click', function(e) {
      e.preventDefault();
      
      const targetSection = this.getAttribute('data-section');
      
      // 모든 링크와 섹션에서 active 클래스 제거
      navLinks.forEach(l => {
        l.classList.remove('active');
        l.removeAttribute('aria-current');
      });
      contentSections.forEach(s => s.classList.remove('active'));
      
      // 클릭된 링크와 해당 섹션 활성화
      this.classList.add('active');
      this.setAttribute('aria-current', 'page');
      
      const section = document.getElementById(targetSection + 'Section');
      if (section) {
        section.classList.add('active');
      }
      
      // URL 해시 업데이트 (히스토리에 추가)
      window.location.hash = targetSection;
      
      // 상태 탭인 경우 시스템 상태 업데이트
      if (targetSection === 'status' && typeof window.updateSystemStatus === 'function') {
        window.updateSystemStatus();
      }
      
      // 모바일에서 메뉴 자동 닫기
      if (navMenu && navMenu.classList.contains('active')) {
        navMenu.classList.remove('active');
        if (navToggle) {
          navToggle.classList.remove('active');
          navToggle.setAttribute('aria-expanded', 'false');
        }
      }
      
      // 스크린 리더에 알림
      if (typeof window.announceToScreenReader === 'function') {
        window.announceToScreenReader(`${this.textContent} 섹션으로 이동했습니다.`);
      }
    });
  });
  
  // 키보드 네비게이션 지원
  document.addEventListener('keydown', function(e) {
    // Alt + 숫자키로 빠른 네비게이션
    if (e.altKey && e.key >= '1' && e.key <= '4') {
      e.preventDefault();
      const index = parseInt(e.key) - 1;
      const links = document.querySelectorAll('.nav-link[data-section]');
      if (links[index]) {
        links[index].click();
      }
    }
  });
}

// 해시 네비게이션 초기화 - window 객체에 할당
window.initHashNavigation = function() {
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
    if (sectionName === 'status' && typeof window.updateSystemStatus === 'function') {
      window.updateSystemStatus();
    }
    
    // 스크린 리더에 알림
    if (typeof window.announceToScreenReader === 'function') {
      window.announceToScreenReader(`${targetLink.textContent} 섹션으로 이동했습니다.`);
    }
  }
}

// PWA 설치 버튼 표시 함수 - window 객체에 할당
window.showInstallButton = function(deferredPrompt) {
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
      console.log(`User response to the install prompt: ${outcome}`);
      deferredPrompt = null;
      installBtn.remove();
    }
  });
  
  const navBrand = document.querySelector('.nav-brand');
  if (navBrand) {
    navBrand.appendChild(installBtn);
  }
}

// Export functions for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    updateUIForStreamingState: window.updateUIForStreamingState,
    initVideoQualitySettings: window.initVideoQualitySettings,
    toggleLogs: window.toggleLogs,
    initNavigation: window.initNavigation,
    initHashNavigation: window.initHashNavigation,
    showInstallButton: window.showInstallButton
  };
}
