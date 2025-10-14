// 시스템 상태 관리

// 중요한 상태 변경 추적
let lastImportantStatus = {};

// 시스템 상태 업데이트 시작 - window 객체에 할당
window.startSystemStatusUpdates = function() {
  // 즉시 한 번 업데이트
  window.updateSystemStatus();
  
  // 10초마다 시스템 상태 업데이트
  setInterval(window.updateSystemStatus, 10000);
}

// 시스템 상태 업데이트 - window 객체에 할당
window.updateSystemStatus = async function() {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    
    const response = await fetch('/status', {
      signal: controller.signal,
      cache: 'no-cache'
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const status = await response.json();
    
    updateStatusDisplay('battery', status.battery);
    updateStatusDisplay('signal', status.signal);
    updateStatusDisplay('temperature', status.temperature);
    updateStatusDisplay('storage', status.storage);
    
    announceImportantStatusChanges(status);
    
  } catch (error) {
    if (error.name === 'AbortError') {
      console.log('System status request timed out');
    } else {
      console.error('Failed to fetch system status:', error);
    }
    
    updateStatusDisplay('battery', 'N/A');
    updateStatusDisplay('signal', 'N/A');
    updateStatusDisplay('temperature', 'N/A');
    updateStatusDisplay('storage', 'N/A');
  }
}

// 개별 상태 표시 업데이트 함수
function updateStatusDisplay(type, value) {
  const statusCards = document.querySelectorAll('.status-card');
  
  statusCards.forEach((card, index) => {
    const label = card.querySelector('.status-label');
    const valueElement = card.querySelector('.status-value');
    
    if (!label || !valueElement) return;
    
    const labelText = label.textContent.toLowerCase();
    let shouldUpdate = false;
    
    // 타입별 매칭 확인
    switch (type) {
      case 'battery':
        shouldUpdate = labelText.includes('battery') || labelText.includes('배터리');
        break;
      case 'signal':
        shouldUpdate = labelText.includes('signal') || labelText.includes('신호');
        break;
      case 'temperature':
        shouldUpdate = labelText.includes('temperature') || labelText.includes('온도');
        break;
      case 'storage':
        shouldUpdate = labelText.includes('storage') || labelText.includes('저장');
        break;
    }
    
    if (shouldUpdate) {
      valueElement.textContent = value;
      
      // 상태에 따른 시각적 피드백
      updateStatusVisuals(card, type, value);
    }
  });
}

// 상태에 따른 시각적 피드백 업데이트
function updateStatusVisuals(card, type, value) {
  // 기존 상태 클래스 제거
  card.classList.remove('status-good', 'status-warning', 'status-error');
  
  const valueStr = value.toLowerCase();
  
  switch (type) {
    case 'battery':
      if (valueStr.includes('충전') || valueStr.includes('charging')) {
        card.classList.add('status-good');
      } else if (valueStr.includes('낮음') || valueStr.includes('low')) {
        card.classList.add('status-warning');
      }
      break;
      
    case 'signal':
      if (valueStr.includes('강함') || valueStr.includes('strong') || 
          valueStr.includes('good') || valueStr.includes('excellent')) {
        card.classList.add('status-good');
      } else if (valueStr.includes('약함') || valueStr.includes('weak') || 
                 valueStr.includes('poor')) {
        card.classList.add('status-warning');
      } else if (valueStr.includes('없음') || valueStr.includes('no signal') || 
                 valueStr.includes('n/a')) {
        card.classList.add('status-error');
      }
      break;
      
    case 'temperature':
      // 온도 값 추출 (예: "45°C" -> 45)
      const tempMatch = value.match(/(\d+)°c/i);
      if (tempMatch) {
        const temp = parseInt(tempMatch[1]);
        if (temp < 60) {
          card.classList.add('status-good');
        } else if (temp < 75) {
          card.classList.add('status-warning');
        } else {
          card.classList.add('status-error');
        }
      }
      break;
      
    case 'storage':
      // 저장공간 여유 확인 (예: "15GB Free" -> 15)
      const storageMatch = value.match(/(\d+(?:\.\d+)?)\s*([gtmk]?b)?\s*free/i);
      if (storageMatch) {
        const freeSpace = parseFloat(storageMatch[1]);
        const unit = (storageMatch[2] || 'gb').toLowerCase();
        
        let freeGB = freeSpace;
        if (unit.startsWith('t')) {
          freeGB = freeSpace * 1024;
        } else if (unit.startsWith('m')) {
          freeGB = freeSpace / 1024;
        } else if (unit.startsWith('k')) {
          freeGB = freeSpace / (1024 * 1024);
        }
        
        if (freeGB > 10) {
          card.classList.add('status-good');
        } else if (freeGB > 5) {
          card.classList.add('status-warning');
        } else {
          card.classList.add('status-error');
        }
      }
      break;
  }
}

// 중요한 상태 변경 알림
function announceImportantStatusChanges(status) {
  // 배터리 상태 변경
  if (status.battery && status.battery !== lastImportantStatus.battery) {
    const batteryStr = status.battery.toLowerCase();
    if (batteryStr.includes('없음') || batteryStr.includes('n/a')) {
      // 배터리 정보를 가져올 수 없음 (심각하지 않음)
    }
  }
  
  // 네트워크 연결 상태 변경
  if (status.signal && status.signal !== lastImportantStatus.signal) {
    const signalStr = status.signal.toLowerCase();
    if (signalStr.includes('없음') || signalStr.includes('n/a') || signalStr.includes('none')) {
      if (typeof window.announceToScreenReader === 'function') {
        window.announceToScreenReader(window.t('msg_signal_lost'));
      }
    } else if (lastImportantStatus.signal && 
               (lastImportantStatus.signal.includes('없음') || lastImportantStatus.signal.includes('n/a') || lastImportantStatus.signal.includes('none'))) {
      if (typeof window.announceToScreenReader === 'function') {
        window.announceToScreenReader(window.t('msg_signal_restored'));
      }
    }
  }
  
  // 온도 과열 경고
  if (status.temperature && status.temperature !== lastImportantStatus.temperature) {
    const tempMatch = status.temperature.match(/(\d+)°c/i);
    if (tempMatch) {
      const temp = parseInt(tempMatch[1]);
      if (temp >= 75 && (!lastImportantStatus.temperature || 
          !lastImportantStatus.temperature.match(/(\d+)°c/i) || 
          parseInt(lastImportantStatus.temperature.match(/(\d+)°c/i)[1]) < 75)) {
        if (typeof window.announceToScreenReader === 'function') {
          window.announceToScreenReader(window.t('msg_temp_high'));
        }
      }
    }
  }
  
  // 저장 공간 경고
  if (status.storage && status.storage !== lastImportantStatus.storage) {
    const freeMatch = status.storage.match(/(\d+(?:\.\d+)?)[gtmk]?\s*free/i);
    if (freeMatch) {
      const freeSpace = parseFloat(freeMatch[1]);
      if (freeSpace < 5 && (!lastImportantStatus.storage || 
          !lastImportantStatus.storage.match(/(\d+(?:\.\d+)?)[gtmk]?\s*free/i) || 
          parseFloat(lastImportantStatus.storage.match(/(\d+(?:\.\d+)?)[gtmk]?\s*free/i)[1]) >= 5)) {
        if (typeof window.announceToScreenReader === 'function') {
          window.announceToScreenReader(window.t('msg_storage_low'));
        }
      }
    }
  }
  
  // 상태 저장 (다음 비교를 위해)
  lastImportantStatus = { ...status };
}

// Export functions for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    startSystemStatusUpdates: window.startSystemStatusUpdates,
    updateSystemStatus: window.updateSystemStatus
  };
}
