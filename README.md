# OMNISENSE - 실시간 스트리밍 및 자막 시스템

WebRTC를 이용한 V4L2 카메라의 저지연 원격 스트리밍과 실시간 음성인식 자막 기능을 제공합니다.

## 주요 기능

- **실시간 비디오 스트리밍**: WebRTC 기반 저지연 스트리밍
- **실시간 음성인식 자막**: SenseVoice 기반 다국어 음성인식
- **감정 인식**: 음성에서 감정을 감지하여 이모지로 표시
- **웹 오버레이**: 브라우저에서 실시간 자막 오버레이 표시
- **다국어 지원**: 한국어, 영어, 중국어, 일본어 등

## 시스템 아키텍처

```
마이크 입력 → realtime_sensevoice.py → Go 백엔드 → WebSocket → 프론트엔드 오버레이
     ↓
콘솔 출력 + 백엔드 전송
```

GStreamer가 영상 속성을 설정하고, 하드웨어 인코더를 사용해 H.264로 인코딩한 뒤
RTP 패킷을 UDP를 통해 로컬호스트(localhost)로 전송.

Pion WebRTC는 해당 RTP 스트림을 받아 WebRTC 클라이언트로 전달합니다.

웹페이지는 WebRTC 클라이언트를 실행하여 카메라의 실시간 영상을 보여주며,
WebSocket을 통해 실시간 자막을 오버레이로 표시합니다.

## 테스트된 플랫폼

- **하드웨어**: Radxa CM5 8GB RAM & 64GB EMMC
- **시스템 이미지**: Debian Bullseye (Radxa에서 공식 지원)
- **카메라**: Radxa Camera 4K
- **UI 아이콘**: `sudo apt install fonts-noto-color-emoji`

## 사용 방법

### 1. 의존성 설치

```bash
# Go 1.23 이상 필요 (대부분 보드들은 제품에 관련 라이브러리가 설치되어 있음)
go mod tidy

# Python 의존성
pip install requests numpy sounddevice soundfile noisereduce
```

### 2. 스트리밍 서버 실행

```bash
# Go 서버 실행 (백그라운드)
go run main.go &

# 또는 빌드 후 실행
go build -o omnisense-server
./omnisense-server &
```

### 3. 실시간 음성인식 실행

```bash
# SenseVoice 모델이 있는 경로로 설정
python3 realtime_sensevoice.py \
    --download_path /path/to/sensevoice/models \
    --backend_url http://localhost:8080 \
    --language ko \
    --save_recordings
```

### 4. 웹 브라우저 접속

```
http://<보드 IP 주소>:8080/  # 포트 번호는 원하는 대로 변경 가능
```

### 5. 기능 사용

1. **스트리밍 시작**: "Start Stream" 버튼 클릭
2. **자막 확인**: 실시간으로 음성인식된 자막이 영상 위에 오버레이로 표시
3. **감정 인식**: 자막과 함께 감정에 따른 이모지가 표시됨

### 6. 테스트

```bash
# 자막 전송 테스트
python3 test_subtitle_sender.py
```

## API 엔드포인트

- `POST /subtitle`: 자막 데이터 수신
- `WS /ws`: WebSocket 연결 (실시간 자막 전송)
- `POST /post`: WebRTC 연결 설정

## 자막 데이터 형식

```json
{
  "text": "인식된 음성 텍스트",
  "emotion": "HAPPY|SAD|ANGRY|NEUTRAL|FEARFUL|DISGUSTED|SURPRISED",
  "language": "ko|en|zh|ja",
  "timestamp": 1.5,
  "is_final": true,
  "emoji": "😊",
  "lang_code": "KR"
}
```

## 파일 구조

```
OMNISENSE_DEV/
├── main.go                    # Go 웹 서버 (WebRTC + WebSocket)
├── realtime_sensevoice.py     # 실시간 음성인식 스크립트
├── test_subtitle_sender.py    # 자막 전송 테스트 스크립트
├── static/                    # 웹 프론트엔드
│   ├── index.html            # 메인 웹페이지
│   ├── css/style.css         # 스타일시트
│   └── js/script.js          # JavaScript (WebRTC + WebSocket)
├── go.mod                     # Go 의존성
└── README.md                  # 이 파일
```

## 감정 이모지 매핑

| 감정 | 이모지 | 설명 |
|------|--------|------|
| HAPPY | 😊 | 기쁨 |
| SAD | 😢 | 슬픔 |
| ANGRY | 😠 | 분노 |
| NEUTRAL | 😐 | 중립 |
| FEARFUL | 😨 | 두려움 |
| DISGUSTED | 🤢 | 혐오 |
| SURPRISED | 😲 | 놀람 |
| EMO_UNKNOWN | 🙂 | 알 수 없음 |

## 언어 코드

| 언어 | 코드 | 설명 |
|------|------|------|
| 한국어 | KR | 기본 언어 |
| 영어 | EN | English |
| 중국어 | CN | Chinese |
| 일본어 | JP | Japanese |
| 광동어 | YUE | Cantonese |

## 문제 해결

### 자막이 표시되지 않는 경우
1. WebSocket 연결 상태 확인
2. 브라우저 개발자 도구에서 오류 메시지 확인
3. 백엔드 서버 로그 확인

### 음성인식이 작동하지 않는 경우
1. SenseVoice 모델 파일 경로 확인
2. 마이크 권한 확인
3. Python 의존성 설치 확인

### 스트리밍이 작동하지 않는 경우
1. 카메라 연결 상태 확인
2. 포트 충돌 확인
3. 방화벽 설정 확인