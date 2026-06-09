
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { AppHeader } from '@/components/AppHeader'; // Import the new AppHeader
import { Toaster } from '@/components/ui/toaster'; // Import Toaster

const inter = Inter({
  variable: '--font-inter',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'Quick Grade',
  description: 'Effortlessly extract and manage grades from marksheets with AI.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full w-full">
      <body className={`${inter.variable} font-sans antialiased flex flex-col min-h-screen`}>
        <AppHeader />
        <main className="flex-1 container mx-auto max-w-7xl p-4 md:p-6">
          {children}
        </main>
        <Toaster />
      </body>
    </html>
  );
}
