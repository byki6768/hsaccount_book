"use client";

type SpeechBubbleProps = {
  message: string;
};

export function SpeechBubble({ message }: SpeechBubbleProps) {
  return (
    <div className="relative mb-2 w-fit max-w-full">
      <div className="rounded-2xl bg-slate-800 px-3.5 py-2 text-sm font-medium text-white shadow-sm">
        {message}
      </div>
      <div
        aria-hidden
        className="absolute left-5 top-full h-0 w-0 border-x-8 border-t-8 border-x-transparent border-t-slate-800"
      />
    </div>
  );
}
