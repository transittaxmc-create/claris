"use client"

export function NumPad({
  onKey,
  onDone,
}: {
  onKey: (k: string) => void
  onDone: () => void
}) {
  const keys = ["1", "2", "3", "4", "5", "6", "7", "8", "9", ".", "0", "⌫"]
  return (
    <div className="grid grid-cols-3 gap-1.5 rounded-2xl border border-neutral-800 bg-neutral-950 p-2">
      {keys.map((k) => (
        <button
          key={k}
          type="button"
          onClick={() => (k === "⌫" ? onKey("back") : onKey(k))}
          className="flex h-11 items-center justify-center rounded-xl bg-neutral-900 text-lg font-semibold text-white active:bg-neutral-800"
        >
          {k}
        </button>
      ))}
      <button
        type="button"
        onClick={onDone}
        className="col-span-3 mt-1 h-10 rounded-xl bg-yellow-400 text-sm font-bold text-black"
      >
        Listo
      </button>
    </div>
  )
}
