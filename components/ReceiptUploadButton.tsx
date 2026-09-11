"use client";

import { useRef } from "react";

type ReceiptUploadButtonProps = {
  disabled?: boolean;
  uploading?: boolean;
  onFile: (file: File) => void;
};

export function ReceiptUploadButton({
  disabled,
  uploading,
  onFile,
}: ReceiptUploadButtonProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) onFile(file);
        }}
      />
      <button
        type="button"
        disabled={disabled || uploading}
        onClick={() => inputRef.current?.click()}
        aria-label={uploading ? "영수증 분석 중" : "영수증 사진 업로드"}
        title={uploading ? "영수증 분석 중…" : "영수증 사진 업로드"}
        className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full border transition active:scale-95 disabled:cursor-not-allowed disabled:opacity-40 ${
          uploading
            ? "border-sky-200 bg-sky-50 text-sky-600"
            : "border-slate-200 bg-slate-50 text-slate-700 hover:bg-white"
        }`}
      >
        {uploading ? (
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-sky-300 border-t-sky-600" />
        ) : (
          <svg
            viewBox="0 0 24 24"
            className="h-5 w-5"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            aria-hidden
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M3 7.5A1.5 1.5 0 0 1 4.5 6h2.1l1.2-1.8A1.5 1.5 0 0 1 9 3.75h6a1.5 1.5 0 0 1 1.2.45L17.4 6h2.1A1.5 1.5 0 0 1 21 7.5v11a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 18.5v-11z"
            />
            <circle cx="12" cy="13" r="3.25" />
          </svg>
        )}
      </button>
    </>
  );
}
