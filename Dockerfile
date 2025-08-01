
# 1. Go 빌드 환경 사용
FROM golang:1.22

# 2. 작업 디렉토리 설정
WORKDIR /app

# 3. Go 의존성 파일 먼저 복사 후 다운로드
COPY go.mod go.sum ./
RUN go mod download

# 4. 프로젝트 전체 복사 (main.go + static 폴더 포함)
COPY . .

# 5. 이모지 폰트 설치 (□ 표시 방지)
RUN apt-get update && \
    apt-get install -y fonts-noto-color-emoji && \
    rm -rf /var/lib/apt/lists/*

# 6. Go 서버 빌드
RUN go build -o webrtc-streamer

# 7. 컨테이너 포트 노출
EXPOSE 8080

# 8. 실행 명령
CMD ["./webrtc-streamer"]
