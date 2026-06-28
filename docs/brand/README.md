# ArchiveOS 브랜드 가이드

ArchiveOS는 검은 배경 위의 기하학적 `A`, 청록색 결정 노드, 오른쪽으로 이어지는 연결선을 공식 마크로 사용합니다.

## 자산

- `archiveos-mark.svg` — 사이드바, 앱 아이콘, 파비콘 등 정사각형 영역용 마크
- `archiveos-lockup.svg` — GitHub README와 제품 소개 영역용 가로형 로고
- `../../public/archiveos-mark.svg` — 실제 웹 UI에서 사용하는 마크
- `../../public/favicon.svg` — 브라우저 탭 아이콘

모든 자산은 동일한 공식 마크 형상을 사용합니다. 모양을 따로 다시 그리거나 일부 요소를 제거하지 않습니다.

## 핵심 규칙

- 배경은 순수 검정 `#000000`을 사용합니다.
- `A`는 흰색에서 밝은 회색으로 이어지는 매우 약한 명도 변화만 허용합니다.
- 청록색 노드는 한 개만 사용합니다.
- 노드 오른쪽 연결선과 아래쪽 구조를 공식 형상 그대로 유지합니다.
- 비율을 찌그러뜨리거나 임의로 회전하지 않습니다.
- 외곽 발광, 과한 그림자, 3D 돌출 효과를 추가하지 않습니다.

## 사용 예시

```html
<img src="docs/brand/archiveos-lockup.svg" width="720" alt="ArchiveOS" />
```

```html
<img src="/archiveos-mark.svg" width="32" height="32" alt="" aria-hidden="true" />
```

## 색상

| 토큰 | 값 | 용도 |
| --- | --- | --- |
| Background | `#000000` | 로고 배경 |
| Primary | `#FFFFFF` | A 상단 및 주 형상 |
| Primary Shadow | `#ECECEC` | A 하단의 미세한 명도 변화 |
| Cyan Start | `#12F2F5` | 노드 상단 |
| Cyan End | `#00DDE8` | 노드 하단 |
| UI Surface | `#0F1214` | 제품 UI 카드 및 패널 |

## 슬로건

> Operate knowledge. Drive decisions.
