import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { readPublicLogoShare } from "@/lib/server/logo-shares";

type ShareLogoPageProps = {
  params: Promise<{ token: string }>;
};

export default async function ShareLogoPage({ params }: ShareLogoPageProps) {
  const { token } = await params;
  const share = await readPublicLogoShare(token);

  if (!share) {
    notFound();
  }

  return (
    <main className="grain min-h-screen px-4 py-6 text-ink">
      <section className="mx-auto grid min-h-[calc(100vh-48px)] w-full max-w-[430px] overflow-hidden rounded-[30px] border border-white/80 bg-surface shadow-floating">
        <div className="relative overflow-hidden bg-[radial-gradient(circle_at_20%_10%,#dbeafe_0%,transparent_34%),linear-gradient(155deg,#f8fbff_0%,#eef6ff_48%,#ffffff_100%)] px-5 pb-6 pt-5">
          <div className="mb-5 flex items-center justify-between text-xs font-black text-primary-strong">
            <span className="rounded-full bg-white/80 px-3 py-1 shadow-card">Printy Share</span>
            <span>로고 보기</span>
          </div>
          <div className="relative mx-auto aspect-square overflow-hidden rounded-[28px] border border-white/80 bg-white shadow-floating">
            <Image src={share.logo.imageUrl} alt={`${share.brandName} 로고`} fill sizes="390px" className="object-contain p-5" unoptimized priority />
          </div>
          <div className="mt-6 rounded-2xl border border-white/80 bg-white/84 p-5 shadow-card backdrop-blur">
            <p className="text-xs font-black text-primary-strong">공유받은 브랜드 로고</p>
            <h1 className="mt-2 text-3xl font-black tracking-[-0.06em] text-ink">{share.brandName}</h1>
            <p className="mt-2 text-sm font-bold text-muted">{share.category}</p>
            <p className="mt-4 text-sm font-medium leading-6 text-muted">{share.logo.description}</p>
          </div>
        </div>
        <div className="grid gap-4 px-5 py-5">
          <div className="rounded-lg border border-line bg-surface-blue p-4">
            <p className="text-sm font-black text-primary-strong">이 로고를 내 브랜드로 가져오기</p>
            <p className="mt-2 text-xs font-bold leading-5 text-muted">가입하면 공유 페이지는 잠기고, 로고와 브랜드가 가입한 계정 소유로 이동해요.</p>
          </div>
          <Link className="block rounded-md bg-primary px-5 py-4 text-center text-base font-extrabold text-white shadow-soft transition hover:-translate-y-0.5" href={`/?claimLogoShare=${encodeURIComponent(token)}`}>
            브랜드 사용하기
          </Link>
          <Link className="block rounded-md bg-surface-blue px-5 py-4 text-center text-sm font-extrabold text-primary-strong shadow-soft transition hover:-translate-y-0.5" href="/">
            Printy 둘러보기
          </Link>
        </div>
      </section>
    </main>
  );
}
