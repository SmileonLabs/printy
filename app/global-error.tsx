"use client";

export default function GlobalError() {
  return (
    <html lang="ko">
      <body>
        <main className="grid min-h-screen place-items-center bg-[#f6f8fb] px-6 text-center text-ink">
          <div>
            <p className="text-base font-black">페이지를 불러오지 못했어요</p>
            <p className="mt-3 text-sm font-bold text-muted">잠시 후 다시 시도해 주세요.</p>
          </div>
        </main>
      </body>
    </html>
  );
}
