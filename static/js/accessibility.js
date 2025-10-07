// 접근성 기능 관리

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
      const selectedLang = this.getAttribute('data-lang');
      if (typeof setLanguage === 'function') {
        setLanguage(selectedLang);
        saveAccessibilitySetting('language', selectedLang);
      }
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
  document.body.classList.toggle('high-contrast', contrast === 'high');
}

function applyReducedMotion(enabled) {
  const duration = enabled ? '0.01ms' : '';
  document.documentElement.style.setProperty('--animation-duration', duration);
  document.documentElement.style.setProperty('--transition-duration', duration);
}

function applyScreenReaderMode(enabled) {
  document.body.classList.toggle('screen-reader-mode', enabled);
  if (enabled) {
    announceToScreenReader('스크린 리더 모드가 활성화되었습니다.');
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
  if (typeof setLanguage === 'function') {
    setLanguage(language);
  }
}

// Export functions for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    initAccessibilityFeatures,
    announceToScreenReader
  };
}
