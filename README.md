webrtc-camera-viewer
WebRTC를 이용한 V4L2 카메라의 저지연 원격 스트리밍


GStreamer가 영상 속성을 설정하고, 하드웨어 인코더를 사용해 H.264로 인코딩한 뒤
RTP 패킷을 UDP를 통해 로컬호스트(localhost)로 전송.

Pion WebRTC는 해당 RTP 스트림을 받아 WebRTC 클라이언트로 전달합니다.

웹페이지는 WebRTC 클라이언트를 실행하여 카메라의 실시간 영상을 보여줍니다.


테스트된 플랫폼

하드웨어: Radxa CM5 8GB RAM & 64GB EMMC

시스템 이미지: Debian Bullseye (Radxa에서 공식 지원)


카메라: Radxa Camera 4K
UI에 사용된 아이콘 폰트: sudo apt install fonts-noto-color-emoji

사용 방법
WebRTC 스트리머 바이너리 빌드






##대부분 보드들은 제품에 관련 라이브러리가 설치 되있으나 GO는 버전 1.23으로 설치 필요 
 1.23이하일경우 에러 생김

go mod init webrtc-streamer
go mod tidy
go build
스트리밍 서버 실행


./webrtc-streamer
같은 네트워크에 연결된 다른 기기에서 웹페이지 접속

http://<보드 IP 주소>:8080/ ## 포트 번호는 암거나 해도 상관없다. 
"View Camera" 버튼 클릭


