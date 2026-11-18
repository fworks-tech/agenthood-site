"use client";

import { Drawer } from "@mantine/core";

interface MobileDrawerProps {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
}

export default function MobileDrawer({ open, onClose, children }: MobileDrawerProps) {
  return (
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
      <div className="h-full overflow-hidden border-r border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950">
        {children}
      </div>
    </Drawer>
  );
}
