"use client";

import { useRef, useState } from "react";

/**
 * Drag-and-drop for one file onto an element, plus a hidden file input to
 * click open. `over` is true while a file hovers (the dashed gold edge).
 */
export function useFileDrop(onFile: (file: File) => void, disabled = false) {
  const [over, setOver] = useState(false);
  const depth = useRef(0);
  const input = useRef<HTMLInputElement>(null);

  const hasFiles = (e: React.DragEvent) => Array.from(e.dataTransfer.types).includes("Files");

  const dropProps = {
    onDragEnter: (e: React.DragEvent) => {
      if (disabled || !hasFiles(e)) return;
      e.preventDefault();
      depth.current += 1;
      setOver(true);
    },
    onDragOver: (e: React.DragEvent) => {
      if (disabled || !hasFiles(e)) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = "copy";
    },
    onDragLeave: () => {
      depth.current = Math.max(0, depth.current - 1);
      if (depth.current === 0) setOver(false);
    },
    onDrop: (e: React.DragEvent) => {
      if (disabled || !hasFiles(e)) return;
      e.preventDefault();
      depth.current = 0;
      setOver(false);
      const file = e.dataTransfer.files[0];
      if (file) onFile(file);
    },
  };

  const inputProps = {
    ref: input,
    type: "file" as const,
    hidden: true,
    tabIndex: -1,
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      e.target.value = ""; // the same file can be picked again
      if (file) onFile(file);
    },
  };

  return { over, dropProps, inputProps, pick: () => input.current?.click() };
}
