"use client";

type VoiceMicButtonProps = {
  listening: boolean;
  disabled?: boolean;
  unsupported?: boolean;
  onClick: () => void;
};

export function VoiceMicButton({
  listening,
  disabled,
  unsupported,
  onClick,
}: VoiceMicButtonProps) {
  const title = unsupported
    ? "이 브라우저는 음성 인식을 지원하지 않습니다"
    : listening
      ? "듣기 중지"
      : "음성으로 입력";

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || unsupported}
      aria-label={title}
      title={title}
      className={`relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition active:scale-95 disabled:cursor-not-allowed disabled:opacity-40 ${
        listening
          ? "bg-rose-500 text-white shadow-[0_0_0_4px_rgba(244,63,94,0.25)]"
          : "border border-slate-200 bg-slate-50 text-slate-700 hover:bg-white"
      }`}
    >
      {listening && (
        <span className="absolute inset-0 animate-ping rounded-full bg-rose-400/40" />
      )}
      <svg
        viewBox="0 0 24 24"
        className="relative h-5 w-5"
        fill="currentColor"
        aria-hidden
      >
        {listening ? (
          <path d="M6 6h12v12H6z" />
        ) : (
          <>
            <path d="M12 14a3 3 0 0 0 3-3V6a3 3 0 1 0-6 0v5a3 3 0 0 0 3 3z" />
            <path d="M19 11a1 1 0 1 0-2 0 5 5 0 0 1-10 0 1 1 0 1 0-2 0 7 7 0 0 0 6 6.93V21a1 1 0 1 0 2 0v-3.07A7 7 0 0 0 19 11z" />
          </>
        )}
      </svg>
    </button>
  );
}
