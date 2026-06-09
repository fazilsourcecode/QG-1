
"use client";

import Link from 'next/link';
import { ScanText, Home, Upload, ChevronDown, NotebookPen, NotebookText, BookMarked, BookCopy } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Button } from '@/components/ui/button';
import React from 'react';

export function AppHeader() {
  const [isUploadMenuOpen, setIsUploadMenuOpen] = React.useState(false);

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-14 items-center max-w-7xl mx-auto px-4">
        <div className="flex items-center space-x-6">
          <Link href="/" className="flex items-center space-x-2">
            <ScanText className="h-6 w-6 text-primary" />
            <span className="font-bold text-lg">Quick Grade</span>
          </Link>
          <nav className="flex items-center space-x-4 text-sm font-medium">
            <Link
              href="/"
              className="flex items-center transition-colors hover:text-primary text-foreground"
            >
              <Home className="mr-1 h-4 w-4" />
              Home
            </Link>
            <div
              className="relative"
              onMouseEnter={() => setIsUploadMenuOpen(true)}
              onMouseLeave={() => setIsUploadMenuOpen(false)}
            >
              <DropdownMenu open={isUploadMenuOpen} onOpenChange={setIsUploadMenuOpen}>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="flex items-center transition-colors hover:text-primary text-foreground px-2 focus-visible:ring-0 focus-visible:ring-offset-0">
                    <Upload className="mr-1 h-4 w-4" />
                    Upload Marksheets
                    <ChevronDown className="ml-1 h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-72 md:w-80 lg:w-96">
                  <DropdownMenuGroup>
                    <DropdownMenuLabel className="text-xs text-muted-foreground px-2 pt-2 pb-1">Internal Assessment (CAT)</DropdownMenuLabel>
                    <DropdownMenuItem asChild>
                      <Link href="/upload" className="flex items-center gap-2 py-1.5">
                        <NotebookPen className="h-4 w-4 text-muted-foreground" />
                        <span>CAT Classic (3-Credit)</span>
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link href="/upload/cat-2-credits" className="flex items-center gap-2 py-1.5">
                        <NotebookText className="h-4 w-4 text-muted-foreground" />
                        <span>CAT Lite (2-Credit)</span>
                      </Link>
                    </DropdownMenuItem>
                  </DropdownMenuGroup>
                  <DropdownMenuSeparator />
                  <DropdownMenuGroup>
                    <DropdownMenuLabel className="text-xs text-muted-foreground px-2 pt-2 pb-1">Semester Exams (SEM)</DropdownMenuLabel>
                    <DropdownMenuItem asChild>
                      <Link href="/upload/sem-3-credits" className="flex items-center gap-2 py-1.5">
                        <BookMarked className="h-4 w-4 text-muted-foreground" />
                        <span>SEM Classic (3-Credit)</span>
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link href="/upload/sem-2-credits" className="flex items-center gap-2 py-1.5">
                        <BookCopy className="h-4 w-4 text-muted-foreground" />
                        <span>SEM Lite (2-Credit)</span>
                      </Link>
                    </DropdownMenuItem>
                  </DropdownMenuGroup>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </nav>
        </div>
      </div>
    </header>
  );
}
