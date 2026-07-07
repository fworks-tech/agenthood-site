"use client";

import { useCallback, useRef } from "react";
import { Drawer } from "@mantine/core";

interface MobileDrawerProps {
  open: boolean;
  onClose: () => void;
  onOpen: () => void;
  children: React.ReactNode;
}

export default function MobileDrawer({ open, onClose, onOpen, children }: MobileDrawerProps) {
  const edgeRef = useRef(false);

  const handleEdgeSwipe = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0];
    if (touch.clientX < 20 && !open) {
      edgeRef.current = true;
      onOpen();
    }
  }, [open, onOpen]);

  return (
    <>
      <div
        className="fixed top-0 left-0 bottom-0 w-5 z-30 md:hidden"
        onTouchStart={handleEdgeSwipe}
      />
      <Drawer
        opened={open}
        onClose={onClose}
        position="left"
        size={320}
        withCloseButton={false}
        padding={0}
        styles={{
          body: { padding: 0, height: "100%", overflow: "hidden" },
        }}
        transitionProps={{ duration: 300, timingFunction: "ease-out" }}
      >
        <div className="h-full overflow-hidden border-r border-zinc-800 bg-zinc-950">
          {children}
        </div>
      </Drawer>
    </>
  );
}
