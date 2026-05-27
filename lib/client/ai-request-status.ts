export const aiRequestStatusIntervalMs = 10_000;

type AiRequestStatusPhase = "queued" | "running" | "checking";

export function createAiRequestStatusMessage(label: string, elapsedMs: number, phase: AiRequestStatusPhase = "checking") {
  const seconds = Math.max(10, Math.round(elapsedMs / 1000));
  const phaseLabel = phase === "queued" ? "요청은 접수됐고" : phase === "running" ? "AI가 작업 중이고" : "상태를 확인 중이고";

  return `${label} ${phaseLabel}, ${seconds}초째 확인하고 있어요. 완료되면 바로 알려드릴게요.`;
}

export function startAiRequestStatusTicker(input: { label: string; onStatus: (message: string) => void; phase?: AiRequestStatusPhase }) {
  const startedAt = Date.now();
  const tick = () => input.onStatus(createAiRequestStatusMessage(input.label, Date.now() - startedAt, input.phase));
  const intervalId = window.setInterval(tick, aiRequestStatusIntervalMs);

  return () => window.clearInterval(intervalId);
}
