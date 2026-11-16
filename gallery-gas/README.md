# 우리 반 가상 미술관 Google 연동

이 페이지는 GitHub Pages 같은 정적 호스팅만으로는 `google.script.run`을 사용할 수 없습니다. Google 스프레드시트와 Drive에 실제 저장하려면 Apps Script 웹 앱으로 페이지를 제공해야 합니다. 설정이 완료되면 작품은 Drive에, 작품 정보와 감상평은 스프레드시트에 저장됩니다.

## 설정

1. Google 스프레드시트를 만들고 URL의 `/d/`와 `/edit` 사이에 있는 ID를 복사합니다.
2. 스프레드시트에서 **확장 프로그램 → Apps Script**를 엽니다.
3. Apps Script의 `Code.gs` 내용을 지우고 이 저장소의 `gallery-gas/Code.gs`를 붙여 넣습니다.
4. Apps Script 편집기에서 **+ → HTML**을 선택하고 파일 이름을 `Gallery`로 만듭니다. 저장소의 `gallery.html` 전체 내용을 HTML 파일에 복사해 저장합니다. 확장자는 Apps Script가 관리하므로 파일 이름은 `Gallery`입니다.
5. Apps Script **프로젝트 설정 → 스크립트 속성**에 다음 속성을 추가합니다.
   - `SPREADSHEET_ID`: 1단계의 스프레드시트 ID
   - `UPLOAD_PASSWORD`: 전시 업로드에 사용할 비밀번호. 기존 체험 모드 비밀번호 `1234`와 다른 값을 권장합니다.
   - `DRIVE_FOLDER_ID`: 선택 사항. 업로드 이미지를 넣을 Drive 폴더 ID. 비워 두면 내 Drive 최상위에 저장합니다.
6. **배포 → 새 배포 → 유형 선택 → 웹 앱**에서 실행 사용자는 **나**, 액세스 권한은 **모든 사용자**로 설정합니다. 권한 요청을 검토하고 허용한 다음 배포하세요.
7. 생성된 웹 앱 URL(끝이 `/exec`)을 열어 작품 목록, 업로드, 감상평 저장을 테스트합니다. 최초 실행 시 `작품`, `감상평` 시트가 자동 생성됩니다.
8. Apps Script 코드를 수정했다면 **배포 → 배포 관리 → 수정 → 새 버전**으로 다시 배포해야 합니다.

## 보안 및 공개 범위

- `gallery.html`은 이미 Apps Script 환경의 `google.script.run`을 감지하고, `getArtworks`, `addArtwork`, `getComments`, `addComment` 서버 함수를 호출하도록 되어 있습니다. 별도 URL 설정은 필요하지 않습니다.
- 익명 사용자에게 작품을 보여 주기 위해 업로드 파일을 **링크가 있는 모든 사용자에게 보기 가능**으로 설정합니다. 업로드한 이미지는 공개될 수 있으므로 개인 정보나 민감한 이미지는 올리지 마세요. 조직의 Drive 정책이 공개 링크를 막으면 업로드가 실패할 수 있습니다.
- 비밀번호는 Apps Script 스크립트 속성에 보관되며 페이지 소스에 넣지 않습니다. 다만 웹 앱은 공개이므로 비밀번호를 아는 누구나 업로드를 요청할 수 있습니다. 비밀번호를 공유하지 말고, 유출되면 스크립트 속성에서 변경하세요.
- GitHub Pages에서 기존 `gallery.html`을 직접 열면 체험 모드(localStorage)로 동작합니다. Google에 저장되는 앱은 위에서 배포한 Apps Script 웹 앱 URL로 접속해야 합니다.
