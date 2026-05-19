export function readQrImageFile(file: File) {
  return new Promise<string>((resolve, reject) => {
    if (!file.type.startsWith("image/")) {
      reject(new Error("이미지 파일만 업로드할 수 있어요."));
      return;
    }

    if (file.size > 1024 * 1024) {
      reject(new Error("QR 이미지는 1MB 이하로 업로드해 주세요."));
      return;
    }

    const reader = new FileReader();

    reader.onload = () => {
      resolve(typeof reader.result === "string" ? reader.result : "");
    };
    reader.onerror = () => reject(new Error("QR 이미지를 읽지 못했어요."));
    reader.readAsDataURL(file);
  });
}
