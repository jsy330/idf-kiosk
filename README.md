# IDF 키오스크

```
idf 업뎃/
├── kiosk/            ← 이 폴더를 통째로 배포 (빌드 과정 없음)
│   ├── index.html, styles.css, app.js, game.js, sw.js
│   ├── data/equipment.csv   ← 장비·공구 목록 (여기만 고치면 됨)
│   └── images/              ← 용량 줄인 이미지 (31MB → 3.4MB)
├── pi-setup/         ← 라즈베리파이 자동 실행 스크립트
└── netlify.toml      ← Netlify 배포 설정 (푸시하면 자동 배포)
```

## 1. 장비·공구 목록 넣기

`idf-kiosk/tools_data_3.csv`(공구 77개, 장비 14개)를 정리해서 `kiosk/data/equipment.csv`에 넣어 두었습니다. 목록을 바꿀 때는 이 파일을 고치면 됩니다. 헤더 형식은 예전과 같습니다.

```
id,name,category,location,zone,status,description,safety,imageUrl,locationImageUrl
```

- `category`: `machine`(장비) 또는 `tool`(공구)
- `location`: 목록 위쪽 필터 버튼이 됩니다(공구 `A`·`B`·`C`, 장비 `3D CELL` 등).
- `status`: `available`(사용 가능) / `in-use`(사용 중) / `maintenance`(점검 중). 목록에는 사용 중·점검 중일 때만 표시됩니다.
- 설명·안전 수칙 중 "예약", "교육 신청", "대행", "최대 N시간"이 들어간 문장은 상세 화면의 **이용 안내** 칸으로 자동으로 모입니다.
- 설명과 안전 수칙 안에서 줄을 바꾸려면 `\n`을 쓰면 됩니다(지금 파일과 같은 방식).
- 엑셀에서 저장할 때는 **CSV UTF-8** 형식으로 저장하세요.
- 장비 위치 지도로 지정된 `images/map/1.png ~ 14.png` 파일은 아직 없습니다. 지금은 전체 시설 지도가 대신 나옵니다. 그림을 만들면 `kiosk/images/map/`에 넣기만 하면 됩니다.

## 2. 인터넷 주소로 배포하기 (Netlify, 무료)

깃허브 저장소(jsy330/idf-kiosk)를 Netlify에 연결해 두면, 푸시할 때마다 자동으로 사이트에 반영됩니다. 배포 설정은 저장소의 `netlify.toml`에 들어 있습니다.

처음 한 번만:
1. https://app.netlify.com 에서 **GitHub 계정으로 가입·로그인**합니다.
2. **Add new project → Import an existing project → GitHub**를 누르고 `idf-kiosk`를 고릅니다.
3. 설정은 그대로 두고 **Deploy**를 누릅니다.
4. **Project configuration → Change project name**에서 이름을 정하면 `https://이름.netlify.app` 주소가 생깁니다.

**수정할 때:** `kiosk/data/equipment.csv` 같은 파일을 고친 다음 커밋하고 푸시하면 1분 안에 사이트에 반영됩니다. 깃허브 웹사이트에서 파일을 직접 고쳐도 똑같이 반영됩니다. 키오스크 화면은 다음에 새로고침하거나 재부팅할 때 새 버전으로 바뀝니다.

정적 사이트라서 서버가 잠들지 않습니다. 주기적으로 접속해 줄 필요가 없고, 키오스크 한 대가 쓰는 양이면 무료 사용량 안에서 충분합니다.

## 3. 라즈베리파이: 전원만 켜면 자동으로 열리게

`pi-setup` 폴더를 USB 등으로 라즈베리파이에 옮긴 다음, 터미널에서 **한 번만** 실행합니다.

```bash
bash install-kiosk.sh https://이름.netlify.app
sudo reboot
```

이제 부팅하면 인터넷 연결을 기다렸다가 크롬이 전체화면으로 키오스크를 엽니다. 화면 꺼짐 방지와 자동 로그인도 함께 설정됩니다.

- 키오스크 끄기: 키보드에서 `Alt+F4`
- 자동 실행 해제: `bash uninstall-kiosk.sh`

## 숨은 기능

- **라이트/다크 모드**: 오른쪽 위 달/해 버튼을 누르면 바뀌고, 선택한 모드가 기억됩니다(처음에는 기기 설정을 따름). 주소 뒤에 `?theme=dark`를 붙이면 처음부터 다크 모드로 열립니다.
- **자동 복귀**: 90초 동안 터치가 없으면 첫 화면으로 돌아갑니다.
- **관리자 메뉴**: 왼쪽 위 로고를 **3초 동안 길게 누르면** CSV를 바로 올릴 수 있습니다. 이 방법은 그 기기에만 저장되므로, 영구 반영하려면 CSV를 고쳐서 푸시하세요.
- **오프라인 대비**: 인터넷이 잠깐 끊겨도 마지막으로 불러온 화면이 그대로 나옵니다.
