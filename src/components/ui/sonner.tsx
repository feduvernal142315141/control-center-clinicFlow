'use client';

import { Toaster as Sonner, type ToasterProps } from 'sonner';

/** Toasts que siguen el tema efectivo (claro/oscuro) vía `color-scheme`. */
function Toaster(props: ToasterProps) {
  return (
    <Sonner
      richColors
      closeButton
      position="bottom-right"
      theme="system"
      toastOptions={{ className: 'font-sans' }}
      {...props}
    />
  );
}

export { Toaster };
