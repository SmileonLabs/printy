export const logoUiCopy = {
  initialGeneration: {
    title: "요청을 하나의 로고로 정리해요",
    description: (brandName: string, category: string) => `${brandName}의 ${category} 업종과 요청을 바탕으로 로고 시안을 만들고 있어요.`,
    message: "곧 시안을 보여드릴게요.",
    labels: ["요청 읽기", "브랜딩", "디자인"],
  },
  revisionGeneration: {
    title: "원본은 유지하고 요청만 반영해요",
    description: (brandName: string) => `${brandName}의 선택한 로고를 기준으로 수정 로고를 만들고 있어요.`,
    message: "수정 요청을 적용하고 있어요.",
    panelDescription: "바꾸고 싶은 부분만 짧게 적어주세요.",
    labels: ["원본 유지", "요청 반영", "정교화"],
  },
  missingSourceLogo: {
    title: "수정할 원본 로고를 찾지 못했어요",
    message: "로고를 다시 선택해 주세요.",
  },
} as const;
