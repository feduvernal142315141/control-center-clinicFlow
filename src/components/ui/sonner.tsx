'use client';

import { Toaster as Sonner, type ToasterProps } from 'sonner';

function Toaster(props: ToasterProps) {
  return <Sonner richColors closeButton position="top-right" {...props} />;
}

export { Toaster };
