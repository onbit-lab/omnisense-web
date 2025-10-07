// WebSocket 및 자막 처리

let ws;
let subtitleTimeout;
let wsReconnectAttempts = 0;
const maxReconnectAttempts = 5;

// WebSocket 연결 및 자막 처리
function connectWebSocket() {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const wsUrl = `${protocol}//${window.location.host}/ws`;
  
  ws = new WebSocket(wsUrl);
  
  ws.onopen = function() {
    console.log('WebSocket connected for subtitles');
    if (typeof log === 'function') {
      log('WebSocket connected for subtitles');
    }
    if (typeof announceToScreenReader === 'function') {
      announceToScreenReader('자막 서비스가 연결되었습니다');
    }
    wsReconnectAttempts = 0; // 연결 성공 시 재연결 시도 횟수 리셋
  };
  
  ws.onmessage = function(event) {
    try {
      const subtitleData = JSON.parse(event.data);
      updateSubtitleOverlay(subtitleData);
    } catch (error) {
      console.error('Failed to parse subtitle data:', error);
    }
  };
  
  ws.onclose = function(event) {
    if (!event.wasClean) {
      console.log('WebSocket connection closed unexpectedly');
    }
    
    if (wsReconnectAttempts < maxReconnectAttempts) {
      wsReconnectAttempts++;
      console.log(`Reconnecting WebSocket (attempt ${wsReconnectAttempts}/${maxReconnectAttempts})...`);
      setTimeout(connectWebSocket, 2000 * wsReconnectAttempts);
    } else {
      console.error('Max WebSocket reconnection attempts reached');
    }
  };
  
  ws.onerror = function(error) {
    console.error('WebSocket error:', error);
  };
}

function updateSubtitleOverlay(subtitleData) {
  const subtitleBox = document.getElementById('subtitleBox');
  const emoji = document.getElementById('subtitleEmoji');
  const langCode = document.getElementById('subtitleLangCode');
  const timestamp = document.getElementById('subtitleTimestamp');
  const text = document.getElementById('subtitleText');
  const speaker = document.getElementById('subtitleSpeaker');
  
  // 스트리밍 중이 아니면 자막을 표시하지 않음
  if (!subtitleBox || !subtitleData.text.trim() || !window.isStreaming) {
    return;
  }
  
  // 자막 데이터 업데이트
  emoji.textContent = subtitleData.emoji || '🙂';
  langCode.textContent = subtitleData.lang_code || 'KR';
  timestamp.textContent = subtitleData.timestamp || '00:00:00';
  text.textContent = subtitleData.text;
  speaker.textContent = subtitleData.speaker ? `Speaker ${subtitleData.speaker}` : 'Detecting...';

  // 자막 박스 표시 (스트리밍 중인 경우에만)
  if (window.isStreaming) {
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
  if (subtitleData.is_final && typeof announceToScreenReader === 'function') {
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
    }, 300);
  }
}

// Export functions for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    connectWebSocket,
    updateSubtitleOverlay,
    hideSubtitleOverlay
  };
}
