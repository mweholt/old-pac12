import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'After the Conference — Pac-12 Football Tracker',
  description:
    'Weekly matchups, schedules, and scores for the old and new Pac-12 football teams.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){function report(data){try{fetch('/api/client-error',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(data),keepalive:true})}catch(_){}}window.addEventListener('error',function(e){report({kind:'error',message:e.message,source:e.filename,line:e.lineno,column:e.colno,stack:e.error&&e.error.stack})});window.addEventListener('unhandledrejection',function(e){var r=e.reason;report({kind:'rejection',message:r&&r.message||String(r),stack:r&&r.stack})})})();`,
          }}
        />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
