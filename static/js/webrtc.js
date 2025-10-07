// WebRTC 스트리밍 관리

// 전역 변수
let pc;
let isStreaming = false;

// 로깅 함수
let log = msg => {
  const timestamp = new Date().toLocaleTimeString();
  const logsElement = document.getElementById('logs');
  if (logsElement) {
    logsElement.innerHTML += `[${timestamp}] ${msg}<br>`;
    logsElement.scrollTop = logsElement.scrollHeight;
  }
}

// PeerConnection 초기화 함수
function initializePeerConnection() {
  // localhost 접속 감지 (더 정확한 감지)
  const hostname = window.location.hostname;
  const isLocalhost = hostname === 'localhost' || 
                     hostname === '127.0.0.1' ||
                     hostname === '::1' ||
                     hostname.startsWith('192.168.') ||
                     hostname.startsWith('10.') ||
                     hostname.startsWith('172.');
  
  // localhost/내부망인 경우 STUN 서버 없이 직접 연결
  const config = {
    iceServers: isLocalhost ? [] : [
      { urls: 'stun:stun.l.google.com:19302' }
    ],
    iceCandidatePoolSize: isLocalhost ? 0 : 10,
    bundlePolicy: 'max-bundle',
    rtcpMuxPolicy: 'require',
    iceTransportPolicy: 'all'
  };
  
  log(isLocalhost ? `Local network detected (${hostname}) - using direct connection` : `Remote connection (${hostname}) - using STUN server`);

  const newPc = new RTCPeerConnection(config);

  newPc.ontrack = function (event) {
    var el = document.createElement(event.track.kind);
    el.srcObject = event.streams[0];
    el.autoplay = true;
    el.controls = false;

    if (event.track.kind === 'video') {
      const videoPlayer = document.getElementById('remoteVideo');
      videoPlayer.innerHTML = '';
      videoPlayer.appendChild(el);
      el.style.width = '100%';
      el.style.height = '100%';
      el.style.objectFit = 'contain';
    } else {
      document.body.appendChild(el);
    }
    
    updateStreamStatus('스트리밍이 연결되었습니다');
  };

  newPc.oniceconnectionstatechange = e => {
    log(`ICE Connection state: ${newPc.iceConnectionState}`);
    
    // 연결 상태에 따라 UI 업데이트 함수 호출
    if (newPc.iceConnectionState === 'connected') {
      log('WebRTC connection established successfully');
      updateStreamStatus('스트리밍 연결 완료');
      if (typeof announceToScreenReader === 'function') {
        announceToScreenReader('스트리밍이 성공적으로 연결되었습니다');
      }
      // 연결 통계 로깅 시작
      logConnectionStats();
    } else if (newPc.iceConnectionState === 'disconnected') {
      log('WebRTC connection disconnected');
      updateStreamStatus('스트리밍 연결 끊김');
    } else if (newPc.iceConnectionState === 'failed') {
      log('WebRTC connection failed');
      updateStreamStatus('스트리밍 연결 실패');
      
      // 실패 원인 분석
      analyzeConnectionFailure().then(reason => {
        const errorMsg = `연결 실패: ${reason}`;
        showErrorMessage(errorMsg);
      });
    } else if (newPc.iceConnectionState === 'checking') {
      log('Checking ICE connection...');
      updateStreamStatus('스트리밍 연결 중...');
    }
  };
  
  // ICE candidate 로깅
  newPc.onicecandidate = event => {
    if (event.candidate) {
      const candidate = event.candidate;
      log(`ICE Candidate: ${candidate.type} ${candidate.protocol} ${candidate.address || 'N/A'}:${candidate.port || 'N/A'}`);
      
      // 연결 가능한 후보가 있는지 확인
      if (candidate.type === 'host' || candidate.type === 'srflx') {
        log(`Valid candidate found: ${candidate.type}`);
      }
    } else {
      log('All ICE candidates have been sent');
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
      const videos = videoPlayer.getElementsByTagName('video');
      Array.from(videos).forEach(video => {
        if (video.srcObject) {
          const tracks = video.srcObject.getTracks();
          tracks.forEach(track => track.stop());
          video.srcObject = null;
        }
        video.remove();
      });
      
      const audios = videoPlayer.getElementsByTagName('audio');
      Array.from(audios).forEach(audio => {
        if (audio.srcObject) {
          const tracks = audio.srcObject.getTracks();
          tracks.forEach(track => track.stop());
          audio.srcObject = null;
        }
        audio.remove();
      });
    }
    
    // 서버에 즉시 리셋 요청 (포트 해제)
    fetch('/reset', {
      method: 'POST',
      keepalive: true
    }).catch(e => console.log('Reset request sent:', e));
    
    // 상태 초기화
    isStreaming = false;
    if (typeof updateUIForStreamingState === 'function') {
      updateUIForStreamingState(false);
    }
    
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
  if (typeof announceToScreenReader === 'function') {
    announceToScreenReader('스트리밍 연결을 시작합니다');
  }
  
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
      return response.text().then(text => {
        throw new Error(text || `HTTP error! status: ${response.status}`);
      });
    }
    return response.text();
  })
  .then(data => {
    log('Received response from server');
    try {
      pc.setRemoteDescription(new RTCSessionDescription(JSON.parse(atob(data))));
    } catch (err) {
      throw new Error(`Failed to set remote description: ${err.message}`);
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
      errorMsg = '이미 스트리밍이 진행 중입니다. 잠시 후 다시 시도해주세요.';
    } else if (error.message.includes('Failed to fetch')) {
      errorMsg = '서버에 연결할 수 없습니다. 네트워크 연결을 확인해주세요.';
    } else {
      errorMsg = `연결 오류가 발생했습니다: ${error.message}`;
    }
    
    // 에러 표시 및 로깅
    showErrorMessage(errorMsg);
    log(`Error: ${error.message}`);
    if (typeof announceToScreenReader === 'function') {
      announceToScreenReader(`오류가 발생했습니다: ${errorMsg}`);
    }
    console.error('Error:', error);
    
    // UI 상태 초기화
    if (typeof updateUIForStreamingState === 'function') {
      updateUIForStreamingState(false);
    }
  });
}

// 연결 통계 로깅
function logConnectionStats() {
  if (!pc) return;
  
  pc.getStats().then(stats => {
    stats.forEach((report) => {
      if (report.type === 'inbound-rtp' && report.kind === 'video') {
        log(`Video: ${report.framesPerSecond || 0} fps, ` +
            `${report.bytesReceived || 0} bytes received, ` +
            `${report.packetsLost || 0} packets lost`);
      }
      if (report.type === 'candidate-pair' && report.state === 'succeeded') {
        log(`Connection: ${report.localCandidateId} -> ${report.remoteCandidateId}, ` +
            `RTT: ${report.currentRoundTripTime ? (report.currentRoundTripTime * 1000).toFixed(0) : 'N/A'}ms`);
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
      return '네트워크 인터페이스를 찾을 수 없습니다.';
    } else if (failedPairs > 0) {
      return `${failedPairs}개의 연결 시도가 실패했습니다. 방화벽이나 NAT 설정을 확인해주세요.`;
    } else {
      return '서버와 연결할 수 없습니다.';
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
      let packetsReceived = 0;
      let lastPacketsReceived = 0;
      
      stats.forEach((report) => {
        if (report.type === 'candidate-pair' && report.state === 'succeeded') {
          hasActiveConnection = true;
        }
        if (report.type === 'inbound-rtp' && report.kind === 'video') {
          packetsReceived = report.packetsReceived || 0;
        }
      });
      
      // 연결은 있지만 패킷을 받지 못하는 경우
      if (hasActiveConnection && packetsReceived === lastPacketsReceived && packetsReceived > 0) {
        log('Warning: Connection is active but no new packets received');
      }
      
      lastPacketsReceived = packetsReceived;
    });
  }, checkInterval);
}

function updateStreamStatus(message) {
  const statusElement = document.getElementById('stream-status');
  if (statusElement) {
    statusElement.textContent = message;
  }
}

function showErrorMessage(message) {
  log('ERROR: ' + message);
  updateStreamStatus(message);
  
  const existingError = document.querySelector('.error-message');
  if (existingError) existingError.remove();
  
  const errorBox = document.createElement('div');
  errorBox.className = 'error-message';
  errorBox.textContent = message;
  
  const videoContainer = document.querySelector('.video-container');
  if (videoContainer) {
    videoContainer.appendChild(errorBox);
    setTimeout(() => {
      errorBox.remove();
    }, 5000);
  }
  
  if (typeof announceToScreenReader === 'function') {
    announceToScreenReader(message);
  }
}

// Export functions and variables for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    initializePeerConnection,
    cleanupWebRTC,
    startStreaming,
    getPeerConnection: () => pc,
    isStreaming: () => isStreaming,
    setIsStreaming: (value) => { isStreaming = value; }
  };
}

// Make variables available globally
window.pc = pc;
window.isStreaming = isStreaming;
