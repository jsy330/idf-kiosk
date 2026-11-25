#!/bin/bash
# IDF 키오스크 자동 실행 설정 (라즈베리파이에서 한 번만 실행)
#   사용법:  bash install-kiosk.sh https://이름.netlify.app
# 다음 부팅부터 전원만 켜면 크롬이 전체화면으로 키오스크 주소를 엽니다.
set -e
URL="$1"
if [ -z "$URL" ]; then echo "사용법: bash install-kiosk.sh https://주소"; exit 1; fi

BROWSER="$(command -v chromium-browser || command -v chromium || true)"
if [ -z "$BROWSER" ]; then echo "Chromium이 없습니다: sudo apt install -y chromium-browser"; exit 1; fi

# 1) 실행 스크립트: 인터넷이 연결될 때까지 기다렸다가 전체화면으로 열기
cat > "$HOME/idf-kiosk.sh" <<SH
#!/bin/bash
pgrep -f -- "--kiosk.*$URL" >/dev/null && exit 0   # 이미 실행 중이면 종료
for i in \$(seq 1 60); do
  curl -s --head --max-time 3 "$URL" >/dev/null && break
  sleep 2
done
# 비정상 종료 경고창 제거
sed -i 's/"exited_cleanly":false/"exited_cleanly":true/; s/"exit_type":"Crashed"/"exit_type":"Normal"/' "\$HOME/.config/chromium/Default/Preferences" 2>/dev/null || true
exec "$BROWSER" --kiosk --noerrdialogs --disable-infobars --no-first-run \\
  --disable-session-crashed-bubble --disable-features=Translate \\
  --check-for-update-interval=31536000 --password-store=basic \\
  --overscroll-history-navigation=0 --disable-pinch "$URL"
SH
chmod +x "$HOME/idf-kiosk.sh"

# 2) 자동 실행 등록 (X11 / wayfire / labwc 데스크톱 모두 이 폴더를 읽음)
mkdir -p "$HOME/.config/autostart"
cat > "$HOME/.config/autostart/idf-kiosk.desktop" <<DESK
[Desktop Entry]
Type=Application
Name=IDF Kiosk
Exec=$HOME/idf-kiosk.sh
X-GNOME-Autostart-enabled=true
DESK

# 3) 화면 꺼짐 방지 + 데스크톱 자동 로그인
if command -v raspi-config >/dev/null; then
  sudo raspi-config nonint do_blanking 1 || true
  sudo raspi-config nonint do_boot_behaviour B4 || true
fi

echo "완료! 재부팅하면 키오스크가 자동으로 열립니다:  sudo reboot"
echo "(키오스크 종료: 키보드 Alt+F4 / 자동 실행 해제: bash uninstall-kiosk.sh)"
