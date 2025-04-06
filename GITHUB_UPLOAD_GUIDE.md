# GitHub 업로드 가이드

## 1. GitHub 계정 및 리포지토리 준비

1. [GitHub](https://github.com) 계정에 로그인합니다.
2. 우측 상단의 '+' 버튼을 클릭하고 'New repository'를 선택합니다.
3. 다음 정보를 입력합니다:
   - Repository name: `tqqq-portfolio-simulation`
   - Description: `TQQQ와 다양한 자산을 조합한 포트폴리오의 성과를 분석하고 시뮬레이션하는 웹 애플리케이션`
   - Public 또는 Private 선택
   - README 파일 초기화는 체크하지 않음 (이미 프로젝트에 README.md가 있음)
4. 'Create repository' 버튼을 클릭합니다.

## 2. 로컬 프로젝트 초기화 및 GitHub 연결

터미널에서 다음 명령어를 차례로 실행합니다:

```bash
# 프로젝트 폴더로 이동
cd /path/to/your/project

# Git 초기화
git init

# 모든 파일을 스테이징
git add .

# 첫 번째 커밋 생성
git commit -m "Initial commit: version 0.0.1"

# GitHub 리포지토리 연결 (YOUR_USERNAME 부분을 본인의 GitHub 사용자명으로 변경)
git remote add origin https://github.com/YOUR_USERNAME/tqqq-portfolio-simulation.git

# 메인 브랜치 이름 설정
git branch -M main

# GitHub에 푸시
git push -u origin main
```

## 3. 이미지 파일 업로드

README.md 파일에서 참조하는 이미지를 `images` 폴더에 업로드해야 합니다:

1. 스크린샷 이미지를 `preview1.jpg`와 `preview2.jpg` 이름으로 저장하여 프로젝트의 `images` 폴더에 넣습니다.
2. 다음 명령어로 이미지 파일을 추가하고 커밋합니다:

```bash
git add images/
git commit -m "Add preview images"
git push
```

## 4. 리포지토리 확인

모든 파일이 성공적으로 업로드되면 GitHub 리포지토리 페이지에서 프로젝트를 확인할 수 있습니다:

```
https://github.com/YOUR_USERNAME/tqqq-portfolio-simulation
```

## 5. package.json 파일 업데이트 (필요한 경우)

GitHub 리포지토리 URL을 실제 URL로 업데이트하려면:

1. `package.json` 파일을 열고 다음 줄을 찾습니다:
   ```
   "url": "git+https://github.com/yourusername/tqqq-portfolio-simulation.git"
   ```
2. `yourusername` 부분을 실제 GitHub 사용자명으로 변경합니다.
3. 변경사항을 커밋하고 푸시합니다:
   ```bash
   git add package.json
   git commit -m "Update repository URL in package.json"
   git push
   ```

## 6. 버전 관리

향후 버전 업데이트 시:

1. `package.json`의 version 필드를 업데이트합니다.
2. 변경사항을 커밋하고 푸시합니다.
3. GitHub의 'Releases' 기능을 사용하여 태그를 생성할 수 있습니다.

---

이제 프로젝트가 GitHub에 공개되었습니다. 누구나 프로젝트를 확인하고 클론할 수 있습니다. 