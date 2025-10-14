// 다국어 시스템 관리
// 현재 언어 상태 저장 - window 객체에 할당
window.currentLanguage = 'ko';

// 개선된 다국어 번역 객체 - window 객체에 할당
// 키 이름: 카테고리_용도 형식 (예: nav_streaming, ctl_start_stream)
window.translations = {
  ko: {
    // 네비게이션
    nav_streaming: '스트리밍',
    nav_settings: '설정',
    nav_status: '상태',
    nav_help: '도움말',
    
    // 메인 타이틀 및 컨트롤
    title_main: 'OMNISENSE 실시간 스트리밍',
    msg_start_prompt: '"스트리밍 시작"을 클릭하여 실시간 방송을 시작하세요',
    ctl_start_stream: '스트리밍 시작',
    ctl_stop_stream: '스트리밍 중지',
    ctl_toggle_console: '콘솔 토글',
    
    // 스트림 정보
    info_quality: '화질',
    info_viewers: '시청자',
    label_stream_console: '스트리밍 콘솔',
    
    // 설정 섹션
    section_stream_settings: '스트리밍 설정',
    label_video_quality: '비디오 화질',
    label_frame_rate: '프레임율',
    label_audio: '오디오',
    option_hd: 'HD (1280x720)',
    option_fhd: 'FHD (1920x1080)',
    option_4k: '4K (3840x2160)',
    option_30fps: '30 FPS',
    option_60fps: '60 FPS',
    help_video_quality: '높은 화질은 더 많은 대역폭을 사용합니다',
    help_frame_rate: '높은 프레임율은 더 부드러운 영상을 제공합니다',
    help_audio: '오디오 스트리밍을 활성화/비활성화합니다',
    
    // 상태 섹션
    section_device_status: '디바이스 상태',
    status_battery: '배터리',
    status_signal: '신호',
    status_temperature: '온도',
    status_storage: '저장공간',
    status_good: '양호',
    status_warning: '경고',
    status_error: '오류',
    signal_strong: '강함',
    signal_weak: '약함',
    signal_none: '없음',
    
    // 도움말 섹션
    section_help: '도움말 및 지원',
    help_quick_start: '빠른 시작',
    help_troubleshooting: '문제 해결',
    help_device_info: '디바이스 정보',
    help_start_guide: '"스트리밍 시작"을 클릭하여 방송을 시작하세요. 웨어러블 카메라가 자동으로 연결되어 스트리밍을 시작합니다.',
    help_check_camera: '카메라 연결 확인',
    help_check_network: '네트워크 연결 확인',
    help_restart_device: '필요시 디바이스 재시작',
    device_name: 'RADXA CM5 웨어러블 스트리밍 디바이스',
    device_firmware: '펌웨어: v1.0.0',
    device_webrtc: 'WebRTC 지원',
    
    // 접근성
    a11y_settings: '접근성 설정',
    a11y_font_size: '글자 크기',
    a11y_contrast: '대비',
    a11y_normal: '보통',
    a11y_large: '크게',
    a11y_xlarge: '매우 크게',
    a11y_high: '높음',
    a11y_reduce_motion: '애니메이션 줄이기',
    a11y_screen_reader: '스크린 리더 모드',
    a11y_close: '닫기',
    
    // 메시지 및 알림 (JS에서 사용)
    msg_streaming_connected: '스트리밍이 성공적으로 연결되었습니다',
    msg_streaming_start: '스트리밍 연결을 시작합니다',
    msg_streaming_stop: '스트리밍을 즉시 중지합니다',
    msg_streaming_active: '스트리밍이 활성화되었습니다',
    msg_streaming_inactive: '스트리밍이 비활성화되었습니다',
    msg_streaming_failed: '스트리밍 연결 실패',
    msg_streaming_disconnected: '스트리밍 연결 끊김',
    msg_streaming_checking: '스트리밍 연결 중...',
    msg_streaming_complete: '스트리밍 연결 완료',
    msg_error_occurred: '오류가 발생했습니다',
    msg_already_streaming: '이미 스트리밍이 진행 중입니다. 잠시 후 다시 시도해주세요.',
    msg_network_error: '서버에 연결할 수 없습니다. 네트워크 연결을 확인해주세요.',
    
    // WebSocket 및 자막
    msg_subtitle_connected: '자막 서비스가 연결되었습니다',
    msg_subtitle_prefix: '자막',
    
    // UI 상호작용
    msg_console_expanded: '스트림 콘솔이 펼쳐졌습니다',
    msg_console_collapsed: '스트림 콘솔이 접혔습니다',
    msg_quality_changed: '비디오 품질이 {quality}로 변경되었습니다',
    msg_section_navigated: '{section} 섹션으로 이동했습니다',
    
    // 상태 알림
    msg_signal_lost: '네트워크 신호가 없습니다',
    msg_signal_restored: '네트워크 신호가 복구되었습니다',
    msg_temp_high: '디바이스 온도가 높습니다. 주의하세요',
    msg_storage_low: '저장 공간이 부족합니다',
    
    // 접근성 알림
    msg_a11y_screen_reader_on: '스크린 리더 모드가 활성화되었습니다',
    msg_app_installed: '앱이 성공적으로 설치되었습니다!'
  },
  en: {
    // Navigation
    nav_streaming: 'Streaming',
    nav_settings: 'Settings',
    nav_status: 'Status',
    nav_help: 'Help',
    
    // Main title and controls
    title_main: 'OMNISENSE Live Streaming',
    msg_start_prompt: 'Click "Start Stream" to begin live broadcast',
    ctl_start_stream: 'Start Stream',
    ctl_stop_stream: 'Stop Stream',
    ctl_toggle_console: 'Toggle Console',
    
    // Stream info
    info_quality: 'Quality',
    info_viewers: 'Viewers',
    label_stream_console: 'Stream Console',
    
    // Settings section
    section_stream_settings: 'Stream Settings',
    label_video_quality: 'Video Quality',
    label_frame_rate: 'Frame Rate',
    label_audio: 'Audio',
    option_hd: 'HD (1280x720)',
    option_fhd: 'FHD (1920x1080)',
    option_4k: '4K (3840x2160)',
    option_30fps: '30 FPS',
    option_60fps: '60 FPS',
    help_video_quality: 'Higher quality uses more bandwidth',
    help_frame_rate: 'Higher frame rate provides smoother video',
    help_audio: 'Enable/disable audio streaming',
    
    // Status section
    section_device_status: 'Device Status',
    status_battery: 'Battery',
    status_signal: 'Signal',
    status_temperature: 'Temperature',
    status_storage: 'Storage',
    status_good: 'Good',
    status_warning: 'Warning',
    status_error: 'Error',
    signal_strong: 'Strong',
    signal_weak: 'Weak',
    signal_none: 'None',
    
    // Help section
    section_help: 'Help & Support',
    help_quick_start: 'Quick Start',
    help_troubleshooting: 'Troubleshooting',
    help_device_info: 'Device Info',
    help_start_guide: 'Click "Start Stream" to begin broadcasting. The wearable camera will automatically connect and start streaming.',
    help_check_camera: 'Check camera connection',
    help_check_network: 'Verify network connectivity',
    help_restart_device: 'Restart device if needed',
    device_name: 'RADXA CM5 Wearable Streaming Device',
    device_firmware: 'Firmware: v1.0.0',
    device_webrtc: 'WebRTC Enabled',
    
    // Accessibility
    a11y_settings: 'Accessibility Settings',
    a11y_font_size: 'Font Size',
    a11y_contrast: 'Contrast',
    a11y_normal: 'Normal',
    a11y_large: 'Large',
    a11y_xlarge: 'Extra Large',
    a11y_high: 'High',
    a11y_reduce_motion: 'Reduce Motion',
    a11y_screen_reader: 'Screen Reader Mode',
    a11y_close: 'Close',
    
    // Messages and notifications (used in JS)
    msg_streaming_connected: 'Streaming connected successfully',
    msg_streaming_start: 'Starting streaming connection',
    msg_streaming_stop: 'Stopping streaming immediately',
    msg_streaming_active: 'Streaming is now active',
    msg_streaming_inactive: 'Streaming is now inactive',
    msg_streaming_failed: 'Streaming connection failed',
    msg_streaming_disconnected: 'Streaming disconnected',
    msg_streaming_checking: 'Checking streaming connection...',
    msg_streaming_complete: 'Streaming connection complete',
    msg_error_occurred: 'An error occurred',
    msg_already_streaming: 'Stream already in progress. Please try again later.',
    msg_network_error: 'Cannot connect to server. Please check your network connection.',
    
    // WebSocket and subtitles
    msg_subtitle_connected: 'Subtitle service connected',
    msg_subtitle_prefix: 'Subtitle',
    
    // UI interactions
    msg_console_expanded: 'Stream console expanded',
    msg_console_collapsed: 'Stream console collapsed',
    msg_quality_changed: 'Video quality changed to {quality}',
    msg_section_navigated: 'Navigated to {section} section',
    
    // Status notifications
    msg_signal_lost: 'Network signal lost',
    msg_signal_restored: 'Network signal restored',
    msg_temp_high: 'Device temperature is high. Please be cautious',
    msg_storage_low: 'Storage space is low',
    
    // Accessibility notifications
    msg_a11y_screen_reader_on: 'Screen reader mode activated',
    msg_app_installed: 'App installed successfully!'
  }
};

// 번역 헬퍼 함수 - 플레이스홀더 지원
window.t = function(key, params = {}) {
  const lang = window.currentLanguage;
  let text = window.translations[lang]?.[key] || window.translations['ko']?.[key] || key;
  
  // 플레이스홀더 치환 ({quality}, {section} 등)
  Object.keys(params).forEach(param => {
    text = text.replace(`{${param}}`, params[param]);
  });
  
  return text;
}

// 언어 시스템 초기화 - window 객체에 할당
window.initializeLanguageSystem = function() {
  // localStorage에서 저장된 언어 설정 로드
  const savedLanguage = JSON.parse(localStorage.getItem('accessibility_language') || '"ko"');
  window.currentLanguage = savedLanguage;
  
  // 초기 언어 적용 (DOM이 준비되기 전이므로 간단히)
  document.documentElement.lang = savedLanguage === 'ko' ? 'ko' : 'en';
}

// 언어 설정 함수 - window 객체에 할당 (data-i18n 사용)
window.setLanguage = function(lang) {
  // 유효한 언어인지 확인
  if (!window.translations[lang]) {
    console.warn(`Language ${lang} not supported, using Korean as fallback`);
    lang = 'ko';
  }
  
  window.currentLanguage = lang;
  
  // data-i18n 속성을 가진 모든 요소 업데이트
  const elements = document.querySelectorAll('[data-i18n]');
  elements.forEach(element => {
    const key = element.getAttribute('data-i18n');
    const translated = window.t(key);
    
    if (translated !== key) {
      element.textContent = translated;
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
    closeBtn.textContent = window.t('a11y_close');
  }
}

// Export functions for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    initializeLanguageSystem: window.initializeLanguageSystem,
    setLanguage: window.setLanguage,
    getCurrentLanguage: window.getCurrentLanguage,
    t: window.t,
    translations: window.translations
  };
}
