"use client";

import { type ReactNode, useRef, useState } from "react";

type DraggableCardScrollProps = {
  children: ReactNode;
  className?: string;
};

export function DraggableCardScroll({ children, className = "" }: DraggableCardScrollProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const dragStart = useRef({ x: 0, scrollLeft: 0 });
  const isDraggingRef = useRef(false);
  const [isDragging, setIsDragging] = useState(false);

  function stopDragging(pointerId?: number) {
    const scrollArea = scrollRef.current;
    if (scrollArea && pointerId != null && scrollArea.hasPointerCapture(pointerId)) {
      scrollArea.releasePointerCapture(pointerId);
    }
    isDraggingRef.current = false;
    setIsDragging(false);
  }

  return (
    <div
      ref={scrollRef}
      role="region"
      aria-label="Feature cards"
      tabIndex={0}
      className={`marketing-card-scroll ${isDragging ? "is-dragging" : ""} ${className}`}
      onPointerDown={(event) => {
        if (event.button !== 0 || !scrollRef.current) return;

        if (typeof event.pointerId === "number") {
          scrollRef.current.setPointerCapture(event.pointerId);
        }
        dragStart.current = {
          x: event.clientX,
          scrollLeft: scrollRef.current.scrollLeft,
        };
        isDraggingRef.current = true;
        setIsDragging(true);
      }}
      onPointerMove={(event) => {
        if (!isDraggingRef.current || !scrollRef.current) return;

        const deltaX = event.clientX - dragStart.current.x;
        scrollRef.current.scrollLeft = dragStart.current.scrollLeft - deltaX;
      }}
      onPointerUp={(event) => stopDragging(event.pointerId)}
      onPointerCancel={(event) => stopDragging(event.pointerId)}
      onLostPointerCapture={() => stopDragging()}
      onDragStart={(event) => event.preventDefault()}
      onWheel={(event) => {
        if (Math.abs(event.deltaX) > Math.abs(event.deltaY)) {
          event.preventDefault();
        }
      }}
    >
      {children}
    </div>
  );
}
